# CONTRIBUTING.md — Peasant Smith Contribution Guide

## What is this project?

Peasant Smith collects structured benchmark data on running modern AI models with consumer, used, and unconventional hardware. Our goal: **"Making new AI run on old hardware."**

This means we *want* your GTX 1060 result as much as any RTX 4090 score. Imperfect hardware is the point of this project.

## Who should contribute?

Anyone who has ever asked "can I run this model on what I have?" and found the answer unsatisfying. Specifically:
- People with consumer GPUs (or no GPU at all)
- Hardware enthusiasts with unusual setups (multi-GPU, workstation gear, old server hardware)
- Anyone who discovered an optimization that made a meaningful difference
- Users of llama.cpp, Ollama, LM Studio, or other local inference backends

## How to run a benchmark

### Option 1: Use the Peasant Smith benchmark runner
```bash
pip install -r scripts/benchmark/requirements.txt
python scripts/benchmark/run_benchmark.py \
  --model path/to/model.gguf \
  --backend llama.cpp \
  --context-size 4096 \
  --prompt "Explain quantum computing in simple terms" \
  --output results.json
```
The runner auto-detects hardware and produces a JSON file conforming to [our schema](benchmarks/schema/benchmark-schema.json).

### Option 2: Run it yourself
Any valid benchmark run is acceptable. The important thing is recording the data in our structured format. See the [Example Benchmark](#example-benchmark) below for what to include.

## How to submit results

1. **Save your result as a JSON file** conforming to [the schema](benchmarks/schema/benchmark-schema.json). Place it in `benchmarks/raw/` with a descriptive filename:
   ```
   benchmarks/raw/qwen3-8b-q4k_m-rtx3060-12gb-llama.cpp_b3957.json
   ```

2. **Open a Pull Request** or create an issue using the [Benchmark Submission template](https://github.com/mw00/peasant-smith/issues/new?template=benchmark-submission.yml).

3. **Include**:
   - The JSON result file
   - Your hardware configuration
   - A note about any unusual conditions

## How results are validated

Every submission passes automated validation:
- Schema compliance check (JSON must validate against v1.0 schema)
- Required field presence check
- Numeric range sanity checks (negative tokens/sec flagged)
- Memory value plausibility (VRAM > GPU total flagged for review)

Results that pass validation are merged and appear in the database. Results with unusual but potentially valid values may be flagged for manual review — we do not automatically reject results from low-end hardware because the numbers look "low".

## How optimization reports work

To document an optimization:
1. Run a baseline benchmark (before)
2. Apply the change (e.g., enable KV-cache quantization, adjust `n_gpu_layers`, switch backends)
3. Run again with identical settings (after)
4. Document both results and what changed using the [Optimization Report template](https://github.com/mw00/peasant-smith/issues/new?template=optimization-report.yml)

Every optimization report should answer:
- **What** you changed
- **Why** it works (the mechanism)
- **How much** improvement, measured against a baseline on the *same* hardware
- **What you gave up** (quality, context length, stability tradeoffs)

Optimization folklore with no numbers is not useful. We measure — then we decide.

## How hardware profiles are submitted

If your GPU or CPU isn't represented in our hardware database:
1. Add it to `hardware/gpus/` (or `cpus/`) as a YAML file, or update `data/hardware.csv`
2. Use the [Hardware Submission template](https://github.com/mw00/peasant-smith/issues/new?template=hardware-submission.yml)

Include:
- Model name, architecture, VRAM (or cores/specs for CPUs), release year
- Known inference notes (driver quirks, CUDA limitations, etc.)
- Approximate used-market pricing (with date/source noted as approximate)

## Code of conduct

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). We're a technical community — but we treat each other like humans.

## Style guide for documentation

- Use actual numbers, not subjective adjectives
- Include units (tokens/sec, GB, seconds, watts)
- Prefer imperative voice: "Run this command" over "You might want to run..."
- Distinguish measured facts from opinions/assumptions explicitly

---

