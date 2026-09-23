# Recipe: Qwen3.8-Flash-Next (IQ3_XXS) on 2× Tesla V100 32GB

A complete, reproducible recipe for running a large sparse MoE model with **MTP
speculative decoding** and **vision** on two datacenter Volta GPUs — hardware
that most current inference stacks have quietly stopped supporting.

## Results at a glance

| Metric | Value |
|---|---|
| **Peak decode (tuned, short ctx)** | **103.3 tok/s** |
| Production decode @ 131k | 80.9 tok/s |
| Production decode @ 64k | 65.0 tok/s |
| Production decode @ 256k | 56.2 tok/s |
| Baseline (MTP disabled) | 42.8 tok/s |
| **MTP speedup** | **2.4×** |
| Prefill | 176–311 tok/s |
| Vision | ✅ working |
| VRAM (131k, bf16 KV) | 28.1 / 30.7 GB of 64 GB |

Two used V100-PCIE-32GB cards give 64 GB of VRAM for a fraction of the price of
a single modern 48 GB card. The catch is software support, not silicon.

---

## Hardware requirements

| Component | Requirement |
|---|---|
| GPU | 2× Tesla V100-PCIE-32GB (compute capability **7.0 / sm_70**) |
| Total VRAM | 64 GB (model weights ~55 GB) |
| System RAM | 32 GB minimum (mmap + lazy loading reduces this a lot) |
| Storage | NVMe strongly recommended (model + MTP head + mmproj ≈ 74 GB) |

> **Why the V100 specifically:** it is Volta — **sm_70**. Modern CUDA releases
> and prebuilt inference bundles have largely dropped it. Nearly every problem
> in this recipe traces back to that fact.

---

## Software requirements

| Component | Version | Notes |
|---|---|---|
| NVIDIA driver | 580.178.04 | Modern drivers still support Volta |
| CUDA toolkit | **12.8** | **CUDA 13 does not support sm_70** |
| llama.cpp | b11030-mix | Must include `--spec-type draft-mtp` |
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

Upstream repository: `ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF`

A convenience mirror containing all four files in one place:
`peasantsmith/qwen38-flash-next-v100-recipe` (Hugging Face, private — request
access or mirror from upstream).

Files required:

| File | Size | Purpose |
|---|---|---|
| `Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00001-of-00002.gguf` | 47.0 GB | Model weights (shard 1) |
| `Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00002-of-00002.gguf` | 28.8 GB | Model weights (shard 2) |
| `mtp-Qwen3.8-Flash-Next-shared-Q8_0.gguf` | 2.8 GB | **MTP draft head** — speculative decoding |
| `mmproj-Qwen3.8-Flash-Next-BF16.gguf` | 0.9 GB | **Vision projector** |

Verify shard integrity before serving — each file must begin with the ASCII
magic `GGUF`:

```bash
python3 -c "
for f in ['Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00001-of-00002.gguf',
          'Qwen3.8-Flash-Next-GSQ-RCO-IQ3_XXS-00002-of-00002.gguf']:
    with open(f,'rb') as fh:
        print(f, fh.read(4))
"
# Each must print b'GGUF'
```

---

## Step 3 — Understand the memory layout

The model (~55 GB of weights) is large relative to 64 GB of total VRAM, so
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

Measure your own footprint to size the split:

```bash
nvidia-smi --query-gpu=index,memory.used,memory.total --format=csv,noheader
```

On this hardware the natural split (`46.5 / 53.5`) is a trap — see Step 5.

---

## Step 4 — KV cache quantization

KV type has a large effect on both memory and speed.

| KV type | 131k ctx | 256k ctx |
|---|---|---|
| `bf16` | **80.9 tok/s** | ❌ OOM |
| `f16` | 59.3 tok/s | ❌ OOM |
| `q8_0` / `q4_0` | 56.8 tok/s | **56.2 tok/s** ✅ |

Two findings worth knowing:

- **`bf16` consistently outperforms `f16`** by roughly 4%, reproducible across
  runs. The measurement is solid; the mechanism is not established.
- **Only quantized KV makes 256k context possible at all.** It costs roughly
  30% of decode throughput but halves KV memory.

Valid cache types in this build: `f32, f16, bf16, q8_0, q4_0, q4_1, iq4_nl,
q5_0, q5_1`. **`q2_K` and `q3_K` are not accepted** — the server exits with
`Unsupported cache type` — so `q4_0` is effectively the floor.

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

A split *near* the natural ratio still fails — the natural split is already at
the edge, so load must be moved meaningfully, not slightly.

**Lesson:** "it loaded" is not "it fits." Check headroom on the tightest card.

### The tensor split is also a performance lever

The split is not only about fitting — it strongly affects decode speed. For
short-context, high-`n-max` decoding, moving load onto the first card gives a
large, reproducible gain:

| `--tensor-split` | Decode (c=512, `n-max 16`) |
|---|---|
| **`60,40`** | **103.3 tok/s** (best of 10: 102.9 top-3 avg) |
| `50,50` | 88.1 tok/s |
| `55,45` (production) | 87.5 tok/s |
| `65,35` | ❌ OOM |
| `70,30` | ❌ OOM |

An ~18% decode gain from the split alone, reproduced across 10 runs per
configuration. Beyond `60,40` the first card runs out of VRAM.

**Caveat:** this was measured at short context. At production context (131k,
`bf16` KV) the memory budget is very different, so `60,40` should be verified
against your own workload before adopting it. The recipe's production command
uses `55,45`, which is the correct choice for maximum context.

### Optional: disable ECC for extra VRAM

ECC can be disabled to reclaim VRAM on Tesla cards:

```bash
sudo nvidia-smi -e 0
```

On this hardware this did **not** change the outcome for `bf16` KV at 256k — it
still OOMs. Do not count on it to unlock a configuration that otherwise does
not fit. It does free a modest amount of VRAM for other uses.

---

## Step 6 — Tune MTP speculative decoding

The MTP draft head converts single-token decode into multi-token speculative
decode. Measured multiplier: **2.4×** (42.8 → 103.3 tok/s).

**`--spec-draft-n-max` has opposite optima at different context lengths.**
This is one of the two most important tuning insights in this recipe.

### Short context (4k) — ranked best to worst

| `n-max` | tok/s | Acceptance |
|---|---|---|
| **16** | **96.1** | 80.6% |
| 12 | 95.8 | 94.8% |
| 6 (draft KV `q4_0`) | 93.9 | 100.0% |
| 6 | 92.0 | 96.2% |
| 4 | 91.6 | 96.2% |
| 3 | 80.3 | — |

### Long context (131k) — ranked best to worst

| `n-max` | tok/s | Acceptance |
|---|---|---|
| **3** | **80.9** | — |
| 4 | 63.4 | 64.0% |
| 5 | 58.4 | 53.9% |
| 7 | 49.3 | 42.6% |
| 8 | 38.5 | 38.5% |

At long context, raising `n-max` is **strictly worse** — acceptance collapses
because the draft head predicts poorly over longer horizons against a large KV
cache. At short context the same setting is a clear win.

**Tune `n-max` per context regime, not once globally.**

### What does not help

Each of these was measured and made no meaningful difference, or failed:

| Change | Result |
|---|---|
| `-ub 128 / 256 / 512 / 1024` | 95.2 – 96.1 tok/s — flat |
| `-t 6 / 12 / 24` | 95.5 – 96.1 tok/s — flat |
| `-b 1024 / 2048 / 4096 / 8192` | ≤1% difference |
| `-c 512 / 1024` (tiny context alone) | **87.5 tok/s — worse** |
| `n-max 20 / 24` | 94.0 / 77.4 tok/s — worse |
| `-fa off` | fails |
| draft KV `q4_0` | 93.9 tok/s, no gain over `bf16` |
| `-lm lock` | rejected (`invalid value`) |
| `-lm` default (lookup table in RAM) | 103.3 vs 102.2 — within noise |
| `-nkvo 1` | rejected (`invalid argument`) |
| `q2_K` / `q3_K` KV | rejected (`Unsupported cache type`) |

Three counterintuitive results worth stating plainly:

- **Reducing context does not increase decode speed.** 512-token and 1k
  contexts measured *slower* (87.5) than the 4k configuration (96.1), with
  lower draft acceptance. The gain at 103 tok/s comes from combining a short
  context *with* an asymmetric tensor split, not from the short context itself.
- **Batch size and thread count are effectively irrelevant** here. The workload
  is bandwidth-bound on the model weights; those knobs do not move it.
- **Where the lookup table lives is irrelevant.** Paging it from SSD via
  `-lm mmap` and holding it in RAM measured within noise of each other (~1%).

The practical ceiling on this hardware is **103.3 tok/s decode**, reached with
a short context, `n-max 16`, and `--tensor-split 60,40`.

---

## Step 7 — The full command (production)

This is the balanced configuration: maximum context, vision, and the best
long-context decode speed.

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
| `-fa on` | Flash attention (required — `off` fails) |
| `-ctk/-ctv bf16` | Fastest KV type measured |
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

> **Vision accuracy note:** this is a Qwen-VL architecture. The server logs a
> warning that these models need at least 1024 image tokens. If vision results
> look wrong, add `--image-min-tokens 1024`.

**Tool calling** (needed for agent use): send a request with a `tools` array and
confirm `finish_reason: "tool_calls"`.

**Speed**, from the response body:

```bash
# timings.predicted_per_second  -> decode tok/s
# timings.prompt_per_second     -> prefill tok/s
```

---

## Step 9 — Survive a reboot

Wrap it in a systemd unit so it comes back after a restart. The important detail
is waiting for the GPUs before allocating ~55 GB of VRAM.

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

## Performance reference

All figures: greedy decoding (temperature 0), 180-token generations, best of
3–7 runs, identical prompt. Decode and prefill are reported separately because
they scale differently.

### Decode by configuration (ranked)

| Configuration | Decode |
|---|---|
| **Short ctx, `tensor-split 60,40`, `n-max 16`** | **103.3 tok/s** |
| Short ctx, `tensor-split 60,40`, `n-max 16`, `-lm mmap` | 102.2 tok/s |
| Short ctx, `n-max 16`, `tensor-split 55,45` | 96.1 tok/s |
| Short ctx, `n-max 12` | 95.8 tok/s |
| Short ctx, `n-max 6`, draft KV `q4_0` | 93.9 tok/s |
| Short ctx, `n-max 6`, `b4096/ub1024` | 92.0 tok/s |
| Short ctx, `n-max 4` | 91.6 tok/s |
| Short ctx, `tensor-split 50,50` | 88.1 tok/s |
| Short ctx, `n-max 16`, `c=512` only (no split change) | 87.5 tok/s |
| Short ctx, `n-max 3` | 80.3 tok/s |
| **Production @ 131k, `n-max 3`** | **80.9 tok/s** |
| Production @ 64k, `n-max 3` | 65.0 tok/s |
| Production @ 256k, `q8_0`/`q4_0` KV | 56.2 tok/s |
| **MTP disabled (baseline)** | **42.8 tok/s** |

### Decode vs context length (production config)

| Context | Decode |
|---|---|
| 713 | 57.4 tok/s |
| 4,716 | 56.1 tok/s |
| 6,116 | 52.8 tok/s |
| 11,016 | 48.3 tok/s |
| 14,516 | 43.6 tok/s |
| 21,516 | 37.7 tok/s |

### Prefill vs prompt length (production config)

| Prompt tokens | Prefill |
|---|---|
| 2,413 | 278 tok/s |
| 5,316 | **285 tok/s** |
| 10,116 | 273 tok/s |
| 19,716 | 249 tok/s |
| 36,516 | 213 tok/s |
| 48,516 | 176 tok/s |

Both curves decline as context grows: prefill −38% and decode −34% from the
smallest to the largest measured size.

### Thermals under sustained load

15.3 minutes of continuous inference, 451 samples, ambient uncontrolled:

| | GPU 0 | GPU 1 |
|---|---|---|
| Temperature (min/avg/max) | 32 / 39.8 / **43 °C** | 37 / 46.5 / **51 °C** |
| Utilisation (avg/max) | 37% / 90% | 36% / 92% |
| Power (avg/max) | 67 / 131 W | 70 / 160 W |

Idle baseline was 33 °C / 38 °C. Inference raises temperatures by only ~7 °C
and ~9 °C respectively. These cards are nowhere near a thermal limit — the
workload is bandwidth-bound, not power- or heat-bound. GPU 1 runs hotter and
peaks higher on power, consistent with it carrying the larger share of the
tensor split.

---

## Gotchas

- **Verify `min sm` in build metadata before anything else.** Architecture
  support is a data question, not a version-number question.
- **CUDA 13 does not support sm_70.** Keep `/usr/local/cuda` on 12.8.
- **`which -a nvcc`** — a distro toolkit may shadow the one you built with.
- **The mmproj and MTP head live in the same repo as the model**, not separate
  ones. Pull the whole repository, not just the quant subdirectory.
- **The default tensor split is a trap** at long context — it loads with ~500 MB
  of headroom and OOMs under KV growth.
- **`n-max` optima invert between short and long context.** Tune per regime.
- **The tensor split affects decode speed, not just fit.** `60,40` gave ~18%
  more decode than `55,45` at short context. Verify against your own memory
  budget before adopting.
- **`q2_K` / `q3_K` are not valid KV cache types** — the server rejects them at
  startup. `q4_0` is the floor.
- **`-lm lock` and `-nkvo 1` are rejected** by this build.
- **Smaller context is not faster.** 512-token context alone measured slower
  than 4k.
- **Disabling ECC did not enable anything** that otherwise failed.
- **`reasoning_effort` is silently ignored** by llama.cpp. Only
  `chat_template_kwargs: {"enable_thinking": false}` changes behaviour.

---

*All measurements taken on 2× Tesla V100-PCIE-32GB (sm_70), driver 580.178.04,
CUDA 12.8, llama.cpp b11030, greedy decoding.*
