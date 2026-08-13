# Benchmark Methodology — Peasant Smith

## Core principle

Benchmark results must be **reproducible** and **relevant to real users**. A number without context is a claim, not data.

## What we benchmark

### Prompt processing speed (input tokens/sec)

How quickly the system processes input/context before generating output. This matters when you paste long documents or have long conversation history. High prompt throughput means faster response setup.

We measure by feeding a fixed-length prompt and recording tokens processed until generation begins.

### Time to first token (TTFT)

The wall-clock delay between submitting a prompt and receiving the first generated token. For interactive chat use, TTFT below ~3 seconds is comfortable, above ~10 seconds is noticeable as a "wait."

TTFT includes:
- Prompt encoding time
- KV-cache computation
- First decoding step

### Generation speed (output tokens/sec)

Tokens produced per second during the generation phase. This is the metric most直接影响s interactive user experience:
| t/s | UX classification |
|---|---|
| ≥15 | **Excellent** — near-instant response feel |
| 8–14 | **Good** — comfortable for regular use |
| 3–7 | **Usable** — acceptable with patience |
| 1–2.9 | **Marginal** — slow but sometimes useful (drafting, background tasks) |
| <1 | **Unusable** — not meaningfully interactive |

### Memory requirements

We record **actual consumed memory**, not theoretical minimums:
- GPU VRAM used by the active process during inference
- System RAM used by the active process during inference
- Peak allocations observed (higher than steady-state)

This information answers: "Can this actually run on my hardware?"

### Context scalability

A model may load fine but fail or degrade as context grows. We encourage benchmarks at multiple context sizes:
- 2048 tokens — baseline, low memory pressure
- 8192 tokens — moderate context (typical real-world use)
- Higher values where relevant for the specific workload

Results should note whether performance degrades significantly with increased context.

### Power consumption

Where measurable (via power meter, NVIDIA SMI `power draw`, or similar), record the actual system or GPU power during inference. This is especially valuable for:
- Used hardware buyers comparing efficiency
- Users on constrained power supplies
- Multi-GPU setups where total PSU capacity matters
- Datacenter/container use cases

Power data is optional but encouraged.

## Defining "usable"

The classification combines metrics but is not a simple formula. A result producing 15 t/s with only 128 tokens of context before OOM gets classified differently than 7 t/s at 32K tokens — the latter may be more practically useful depending on the task.

Required for each benchmark:
- **rating**: one of `excellent`, `good`, `usable`, `marginal`, `unusable`, `failed`
- **rationale** (recommended): why this classification was chosen, noting any non-obvious tradeoffs

## Ensuring reproducibility

Every benchmark record includes enough information for another person with similar hardware to reproduce the result. Minimum required:

1. Exact model name and quantization format
2. Inference backend and version
3. Operating system and driver versions (where relevant)
4. Full command-line or config used
5. Hardware specification including all relevant details
6. Benchmark schema version

Screenshots are supplementary evidence — not substitutes for structured data.

## Benchmark run protocol

For consistent results:

1. Close other GPU-intensive applications before running
2. Allow the system to stabilize thermally (wait for steady temperature)
3. Run at least 2 passes and record the average (or fastest if outlier detection needed)
4. Record both peak and steady-state memory values
5. Note any background processes that may affect results

## Failed benchmarks are valid contributions

A result showing "model X cannot load on GPU Y" is valuable data. We classify these as `failed` with notes explaining why (OOM, driver error, architecture mismatch). This helps others avoid wasting time and identifies hardware boundaries clearly.
