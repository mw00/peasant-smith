# Recipe: Qwen3.8-Flash-Next (IQ3_XXS) on 2× Tesla V100 32GB

A complete, reproducible recipe for running a 131B-class MoE model with **MTP
speculative decoding** and **vision** on two datacenter Volta GPUs — hardware
that most current inference stacks have quietly stopped supporting.

Reference results on this exact hardware and config:

- **65.0 tok/s** decode @ 64k context
- **80.9 tok/s** decode @ 131k context
- **56.2 tok/s** decode @ 256k context
- **305–387 tok/s** prefill
- Full multimodal (text + image input)

Cost note: two used V100-PCIE-32GB cards represent a fraction of the price of
a single modern 48GB card, while offering 64GB of VRAM total. The catch is
software support, not silicon.

---

## Hardware requirements

| Component | Requirement |
|---|---|
| GPU | 2× Tesla V100-PCIE-32GB (compute capability **7.0 / sm_70**) |
| Total VRAM | 64 GB (model needs ~55 GB) |
| System RAM | 32 GB minimum (16 GB works with mmap + lazy loading) |
| Storage | NVMe strongly recommended (model + MTP head + mmproj ≈ 60 GB) |

> **Why the V100 specifically:** it is Volta — **sm_70**. Modern CUDA releases
> and prebuilt inference bundles have largely dropped it. Nearly every problem
> in this recipe traces back to that fact.

---

## Software requirements

| Component | Version | Notes |
|---|---|---|
| NVIDIA driver | 580.178.04 | Modern drivers still support Volta |
| CUDA toolkit | **12.8** | **CUDA 13 does not support sm_70** |
| llama.cpp | b11030-mix or newer | Must include `--spec-type draft-mtp` |
| OS | Ubuntu 22.04 / 24.04 | |

---

## Step 1 — Get a build that actually runs on sm_70

This is the step that wastes the most time. **Architecture support must be
verified from the build metadata, not assumed from the version number.**

Prebuilt CUDA bundles vary in their supported SM set:

| Bundle variant | min SM | Runs on V100? |
|---|---|---|
| cuda12-legacy | 50 | ✅ |
| **cuda12-portable** | **70** | ✅ **use this** |
| cuda12-newer | 86 | ❌ |

A bundle built for `min sm: 86` contains no sm_70 SASS. It will appear to load
and then fail at device time.

**Check before you run:**

```bash
grep -E '^(variant|min sm|toolkit version):' BUILD_INFO.txt
```

If `min sm` is greater than 70, that build cannot run on a V100. Use the
`portable` variant.

### Verify your toolchain

Two traps that make `nvcc --version` lie to you:

**Trap 1 — `/usr/local/cuda` pointing at the wrong toolkit.** CUDA 13 dropped
Volta entirely. If the symlink points at 13.x, your build will not support sm_70.

```bash
readlink -f /usr/local/cuda          # must resolve to a 12.x toolkit
sudo update-alternatives --set cuda /usr/local/cuda-12.8
```

**Trap 2 — a distro `nvcc` shadowing the toolkit you intended.**

```bash
which -a nvcc
# /usr/bin/nvcc                    <- distro nvidia-cuda-toolkit (may be older)
# /usr/local/cuda-12.8/bin/nvcc    <- the one you actually want
```

Always invoke the toolkit compiler by absolute path, or prepend it to `PATH`:

```bash
export PATH=/usr/local/cuda-12.8/bin:$PATH
nvcc --version
```

---

## Step 2 — Download the model and its two companions

The most easily missed part: **the vision projector and the MTP draft head live
in the same repository as the quantized model.** If you pull only the quant
subdirectory, you get a text-only model with no speculative decoding.

Repository: `ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF`

Files required:

| File | Purpose |
|---|---|
| `Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00001-of-00002.gguf` | Model weights (shard 1) |
| `Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00002-of-00002.gguf` | Model weights (shard 2) |
| `mtp-Qwen3.8-Flash-Next-shared-Q8_0.gguf` | **MTP draft head** — speculative decoding |
| `mmproj-Qwen3.8-Flash-Next-BF16.gguf` | **Vision projector** — ~907 MB |

Verify shard integrity before serving:

```bash
python3 -c "
import struct
for f in ['Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00001-of-00002.gguf',
          'Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00002-of-00002.gguf']:
    with open(f,'rb') as fh:
        print(f, fh.read(4))
"
# Each must print b'GGUF'
```

---

## Step 3 — Understand the memory layout

The model is large (~55 GB of weights) relative to 64 GB of total VRAM, so
allocation strategy matters more than raw compute.

Three things make this fit:

1. **`-ncmoe 0`** — all MoE expert layers on GPU. This is the single most
   important flag. Without it, experts spill to CPU and throughput collapses
   from ~54 tok/s to ~19 tok/s.
2. **`--lazy-mode on` + `-lm mmap`** — the large lookup table stays lazily
   paged from SSD. Process RSS stays around 1.8 GB while ~55 GB sits in VRAM.
   If weights were being read from disk you would see gigabytes of I/O per run;
   measured I/O is ~71 MB, which confirms only the lookup table is on disk.
3. **`--tensor-split 55,45`** — see Step 5.

Measure your own footprint to size the split. Load with a tiny context and no
MTP head to isolate the weight footprint:

```bash
nvidia-smi --query-gpu=index,memory.used,memory.total --format=csv,noheader
```

On this hardware the natural split (`46.5 / 53.5`) is a trap — see Step 5.

---

## Step 4 — KV cache quantization

KV cache type has a large effect on both memory and speed, and the result is
not what you would guess:

| KV type | 131k ctx | 256k ctx |
|---|---|---|
| `bf16` | **80.9 tok/s** | ❌ OOM |
| `f16` | 59.3 tok/s | ❌ OOM |
| `q8_0` / `q4_0` | 56.8 tok/s | **56.2 tok/s** ✅ |

Two findings worth knowing:

- **`bf16` consistently outperforms `f16`** by roughly 4%, reproducible across
  runs. Report the measurement; the mechanism is not established.
- **Only quantized KV makes 256k context possible at all.** It costs roughly
  30% of decode throughput but halves KV memory.

Choose per your priorities: `bf16` for speed at ≤131k, `q8_0`/`q4_0` if you
need 256k.

---

## Step 5 — Balance the tensor split (do not skip)

At 131k context with `bf16` KV, the **default split pegs the second card at
32,280 MiB of 32,768** — 488 MiB of headroom. It loads. It will OOM the moment
the KV cache grows.

Measured balance:

| `--tensor-split` | Card 0 | Card 1 | Headroom |
|---|---|---|---|
| natural (~46.5/53.5) | 25,270 | 32,280 | 0.5 GB ⚠️ |
| `47,53` | — | OOM | ❌ |
| `52,48` | 26,082 | 31,466 | 1.3 GB |
| **`55,45`** | **26,932** | **30,618** | **2.2 GB** ✅ |

Note that a split *near* the natural ratio still fails — the natural split is
already at the edge, so load must be moved meaningfully, not slightly.

**Lesson:** "it loaded" is not "it fits." Check headroom on the tightest card.

### Optional: disable ECC for extra VRAM

ECC can be disabled to reclaim VRAM on Tesla cards:

```bash
sudo nvidia-smi -e 0
```

On this hardware this did **not** change the outcome for `bf16` KV at 256k —
it still OOMs. Do not count on it to unlock a configuration that otherwise
does not fit.

---

## Step 6 — Tune MTP speculative decoding

The MTP draft head converts single-token decode into multi-token speculative
decode. Measured multiplier: **2.1×** (42.8 → 90.9 tok/s).

**`--spec-draft-n-max` has opposite optima at different context lengths.**

Short context (4k), best of 5 runs:

| `n-max` | tok/s |
|---|---|
| 3 | 80.3 |
| **6** | **90.9** |
| 8 | 80.6 |
| 10 | 90.5 |

Long context (131k), with draft acceptance:

| `n-max` | tok/s | acceptance |
|---|---|---|
| **3** | **80.9** | — |
| 4 | 63.4 | 64.0% |
| 5 | 58.4 | 53.9% |
| 7 | 49.3 | 42.6% |
| 8 | 38.5 | 38.5% |

At long context, raising `n-max` is **strictly worse** — draft acceptance
collapses because the head predicts poorly over longer horizons against a large
KV cache. At short context the same setting is a clear win.

**Tune this per context regime, not once globally.**

---

## Step 7 — The full command

```bash
./llama-server \
  --host 0.0.0.0 --port 8080 \
  -m  Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00001-of-00002.gguf \
  --mmproj mmproj-Qwen3.8-Flash-Next-BF16.gguf \
  -md mtp-Qwen3.8-Flash-Next-shared-Q8_0.gguf \
  --spec-type draft-mtp --spec-draft-n-max 3 \
  -c 131072 \
  -fa on \
  -ngl 99 -ncmoe 0 \
  --tensor-split 55,45 \
  -ctk bf16 -ctv bf16 -ctkd bf16 -ctvd bf16 \
  -t 12 -b 2048 -ub 512 \
  -lm mmap --lazy-mode on \
  --jinja \
  --sleep-idle-seconds 900
```

### Flag reference

| Flag | Why |
|---|---|
| `-ncmoe 0` | All MoE experts on GPU. **Most important flag.** 19 → 54 tok/s |
| `--lazy-mode on` + `-lm mmap` | Lookup table paged from SSD; keeps RAM use low |
| `--tensor-split 55,45` | Prevents the second card from being pegged |
| `-fa on` | Flash attention |
| `-ctk/-ctv bf16` | Fastest KV type in testing |
| `-ctkd/-ctvd bf16` | Draft model KV — match the main model |
| `--spec-type draft-mtp` | Enables MTP speculative decoding |
| `--spec-draft-n-max 3` | Optimal at long context; raise for short context |
| `--mmproj` | Enables vision |
| `--jinja` | Required for `chat_template_kwargs` |
| `--sleep-idle-seconds 900` | Unload after 15 min idle; frees VRAM |

---

## Step 8 — Verify it works

**Vision:**

```bash
curl -s http://127.0.0.1:8080/v1/models | python3 -c "
import sys,json; print(json.load(sys.stdin)['models'][0].get('capabilities'))"
# ['completion', 'multimodal']
```

Then confirm with an actual image request — capabilities alone only proves the
projector loaded, not that inference on images works.

**Tool calling** (needed for agent use): send a request with a `tools` array
and confirm `finish_reason: "tool_calls"`.

**Speed**, from the response body:

```bash
# timings.predicted_per_second  -> decode tok/s
# timings.prompt_per_second     -> prefill tok/s
```

---

## Step 9 — Survive a reboot

Wrap it in a systemd unit so it comes back after a restart. The important
detail is waiting for the GPUs before allocating ~55 GB of VRAM:

```ini
[Unit]
Description=llama.cpp server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=<your-user>
WorkingDirectory=<model-dir>

# Wait for GPUs to be ready after boot
ExecStartPre=/bin/bash -c 'for i in $(seq 1 60); do nvidia-smi -L >/dev/null 2>&1 && exit 0; sleep 2; done; echo "GPUs never appeared"; exit 1'

ExecStart=<path>/llama-server <flags from Step 7>

Restart=on-failure
RestartSec=20
TimeoutStartSec=900
LimitMEMLOCK=infinity

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now llamacpp.service
systemctl is-enabled llamacpp.service   # must print: enabled
```

---

## Results

All figures: greedy decoding (temperature 0), 180-token generations, median of
3–5 runs, identical prompt.

| Metric | Value |
|---|---|
| Decode @ 64k, bf16 KV, n-max 3 | 65.0 tok/s |
| Decode @ 131k, bf16 KV, n-max 3 | **80.9 tok/s** |
| Decode @ 256k, q8_0/q4_0 KV | 56.2 tok/s |
| Prefill (12k prompt) | 305–387 tok/s |
| Peak short-context decode | 90.9 tok/s |
| MTP disabled (baseline) | 42.8 tok/s |
| **MTP speedup** | **2.1×** |
| VRAM used (131k, bf16) | 28.1 / 30.7 GB of 64 GB |

### Context is nearly free

| Context | bf16 KV | q8_0/q4_0 KV |
|---|---|---|
| 64k | 64.9 | 57.0 |
| 128k | 64.7 | 56.8 |
| 256k | ❌ OOM | 56.2 |

From 64k to 256k at the same KV type: roughly **1% throughput difference**. If
you have the VRAM, take the context.

---

## Gotchas

- **Verify `min sm` in build metadata before anything else.** Architecture
  support is a data question, not a version-number question.
- **CUDA 13 does not support sm_70.** Keep `/usr/local/cuda` on 12.8.
- **`which -a nvcc`** — a distro toolkit may shadow the one you built with.
- **The mmproj and MTP head are in the same repo as the model**, not separate
  ones. Pull the whole repository, not just the quant subdirectory.
- **The default tensor split is a trap** at long context — it loads with
  ~500 MB of headroom and OOMs under KV growth.
- **`n-max` optima invert between short and long context.** Tune per regime.
- **Disabling ECC did not enable anything** that otherwise failed.
- **`reasoning_effort` is silently ignored** by llama.cpp. Only
  `chat_template_kwargs: {"enable_thinking": false}` changes behaviour.

---

*All measurements taken on 2× Tesla V100-PCIE-32GB (sm_70), driver 580.178.04,
CUDA 12.8, llama.cpp b11030, greedy decoding.*
