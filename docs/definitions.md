# Definitions

*Terms used consistently across Peasant Smith.*

## Model terminology
- **Dense model**: All parameters active during every forward pass.
- **MoE (Mixture of Experts)**: Subset of expert layers activate per token. `active_parameter_count` < `parameter_count`.

## Quantisation formats reference

| Format | Bits = approx = Notes |
|--------|:---|
Q4_K_M ~4.25 Default recommendation
BF16 16 Baseline highest quality VRAM

## Inference terminology
pt/s prompt tokens per second
t/s generation tokens per second
TTFT time to first token under 3s comfortable above 10s laggy
Context window max tokens processed single pass input plus output combined typically measured thousands abbreviation K notation convention practice custom habit routine pattern...
