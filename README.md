# Peasant Smith

### Making new AI run on old hardware.

*"AI for people whose GPU budget is determined by what they can find on eBay."*

---

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Data License: CC-BY-4.0](https://img.shields.io/badge/Data%20License-CC--BY--4.0-green.svg)](benchmarks/LICENSE-DATA)
[![Docs License: CC-BY-SA-4.0](https://img.shields.io/badge/Docs%20License-CC--BY--SA--4.0-green.svg)](docs/LICENSE-DOCS)

Hi — I'm [manoel (mw00)](https://github.com/mw00). I build and benchmark local AI
rigs out of used parts, and I publish every number I get, good or bad. This repo
is that work, opened up: a structured database of real benchmark runs on budget
hardware, with the methods, the scoring, and the raw records all public so
anyone can check, reproduce, or extend it.

## Why this exists

Most benchmark coverage assumes flagship hardware. Peasant Smith asks the
question that actually matters to most people:

> **What can I *really* run on the hardware I can afford?**

The honest answer almost always involves **quantization**. Full-precision
models are mostly inaccessible on consumer hardware — the useful, run-on-your-own-rig
results live at Q4, Q5, IQ3, and friends. That is why every record here
names its exact quant, and why runs with unknown quantization are labeled
`unknown` rather than guessed.

## The numbers so far

All August 2026 data below comes from one machine — **Uranus**, a used-parts
build of 2× RTX 3060 12 GB, a Xeon E5-1650 v4, and 128 GB of cheap ECC RAM.
30 validated runs, 14 models. Full table: [LEADERBOARD.md](LEADERBOARD.md).

| Model | Quant | Median t/s | Class | PS Points |
|---|---|---:|---|---:|
| LFM2.5-2.6B | Q4-class GGUF | 72.0 | excellent | 770 |
| gemma4-26b-a4b (MoE, 4B active) | GGUF | 44.1 | excellent | 491 |
| Qwen35-Hermes | GGUF | 40.9 | excellent | 459 |
| Ornith-1.0-9B | Q6_K | 34.5 | excellent | 395 |
| gemma-4-12b-it | UD-Q4_K_XL | 28.4 | excellent | 334 |
| Ling-3.0-Flash (MoE) | IQ4_XXS | 21.2 | excellent | 282 |
| q27bQ4 (Qwen3.8-27B) | Q4_K_M | 18.9 @ 128k ctx | excellent | 269 |
| Muse-Glimmer-30B | UD-Q4_K_XL | 18.0 | excellent | 234 |
| Qwen3.5-122B-A10B-MTP (MoE) | UD-IQ3_XXS | 8.0 | good | 131 |
| gemma4-31b (dense) | GGUF | 6.5 | usable | 135 |

The pattern is the whole thesis: **small efficient models and sparse MoE at
Q4-class quants deliver interactive speeds on €200 of used GPUs; dense 30B+
needs patience.** A 122B MoE at IQ3 still runs at 8 t/s with 128 GB RAM —
a dense 31B at similar quality would not fit at all.

## What you get from this repo

| You want... | Go to |
|---|---|
| "What runs on *my* GPU?" | [`data/benchmarks.csv`](data/benchmarks.csv) + [`data/hardware.csv`](data/hardware.csv) |
| How tests work & how they fail | [`docs/tests.md`](docs/tests.md) |
| The ranking formula | [`docs/scoring.md`](docs/scoring.md) |
| Live rankings | [`LEADERBOARD.md`](LEADERBOARD.md) |
| A tested system's full spec | [`data/systems.csv`](data/systems.csv) → [`hardware/systems/`](hardware/systems/) |
| Run a benchmark yourself | [`scripts/benchmark/run_benchmark.py`](scripts/benchmark/run_benchmark.py) |

## Project structure

| Directory | Contents |
|---|---|
| [`benchmarks/`](benchmarks/) | Raw result records (JSON), schema, examples |
| [`hardware/`](hardware/) | System, GPU and CPU profiles (YAML) |
| [`models/`](models/) | Model profiles with quant guidance |
| [`data/`](data/) | Flat-file databases (CSV): benchmarks, hardware, systems, models |
| [`docs/`](docs/) | Tests, scoring, methodology, definitions |
| [`scripts/`](scripts/) | Benchmark runner, validators, scoring engine, migrations |

## How a result becomes a record

1. Run the suite: `scripts/benchmark/run_benchmark.py <model> --hardware-ref <slug>`
2. Validate: `scripts/validation/validate_benchmark.py <result.json>`
3. PR the JSON into `benchmarks/raw/` — failed runs included
4. Maintainers assign a `PS-NNNN` id and regenerate the leaderboard

Details in [CONTRIBUTING.md](CONTRIBUTING.md). **Failed experiments are
welcome** — "won't fit on 12 GB" is the answer someone is searching for.

## Reproducibility promise

Every record preserves model + quant, backend and version, driver, OS, exact
configuration, and operator. Screenshots alone are never accepted as data.

## Licenses & links

- **Code**: [MIT](LICENSE) · **Data**: [CC BY 4.0](benchmarks/LICENSE-DATA) · **Docs**: [CC BY-SA 4.0](docs/LICENSE-DOCS)
- **X/Twitter**: [@PeasantSmith](https://x.com/PeasantSmith)
- **Methodology**: [docs/methodology.md](docs/methodology.md) · **Schema**: [benchmarks/schema/benchmark-schema.json](benchmarks/schema/benchmark-schema.json)

---

*Peasant Smith — because AI shouldn't require a flagship GPU budget.*
