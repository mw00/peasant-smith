# Definitions

*Terms used consistently across Peasant Smith.*

## Model terminology

- **Dense model** — all parameters active on every forward pass.
- **MoE (Mixture of Experts)** — a subset of expert layers activates per token; `active_parameter_count` < `parameter_count`. Runs faster than a dense model of the same total size; needs more RAM/VRAM to hold all experts.
- **MTP (multi-token prediction)** — draft layers that predict several tokens per step; can raise decode speed on supported backends.

## Quantization formats

| Format | Approx. bits | Notes |
|---|---|---|
| BF16 / FP16 | 16 | Baseline quality; rarely fits on consumer VRAM |
| Q8_0 / Q6_K | 8 / 6.5 | Near-lossless; large |
| Q5_K_M | ~5.7 | Good quality/speed balance |
| Q4_K_M | ~4.8 | **The community default** — best quality/size trade for most GPUs |
| Q3_K_M / IQ3_XXS | ~3.9 / ~3.4 | For fitting big models into small VRAM; visible quality cost |
| IQ2_XXS and below | <3 | Experimental; expect quality loss |
| UD-* (Unsloth dynamic) | varies | Per-layer mixed precision; XL = higher quality tier |

**Rule:** records must state the exact quant. Unknown = `unknown`, never guessed.

## Inference terminology

- **t/s** — generated (decode) tokens per second. The primary metric.
- **pt/s** — prompt (prefill) tokens per second.
- **TTFT** — time to first token. ≤3 s comfortable, >10 s feels laggy.
- **Context window** — max tokens (input + output) handled in one pass.
- **Offloading** — which model layers run on GPU (`full-gpu`, `partial-gpu`, `multi-gpu-spill`, `cpu-only`).
- **KV cache** — memory holding attention state; grows with context length.

## Usability classes

| Class | Generation t/s | Experience |
|---|---|---|
| excellent | ≥15 | Near-instant feel |
| good | 8–14 | Comfortable daily use |
| usable | 3–7 | Fine for chat/writing with patience |
| marginal | 1–2.9 | Technically runs |
| unusable | <1 | Experimental only |
| failed | — | Will not run |

Classification follows generation t/s by default; TTFT, context, and stability
can justify a deviation (recorded as rationale).
