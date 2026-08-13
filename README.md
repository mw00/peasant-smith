# Peasant Smith

### Making new AI run on old hardware.

*"AI for people whose GPU budget is determined by what they can find on eBay."*

---

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Data License: CC-BY-4.0](https://img.shields.io/badge/Data%20License-CC--BY--4.0-green.svg)](benchmarks/LICENSE-DATA)
[![Docs License: CC-BY-SA-4.0](https://img.shields.io/badge/Docs%20License-CC--BY--SA--4.0-green.svg)](docs/LICENSE-DOCS)

## What is Peasant Smith?

An open, community-driven effort to test new AI models on ordinary, old, used, and unconventional hardware — with a focus on optimization, reproducibility, affordability, and real-world usability.

Most AI benchmarks assume expensive, flagship hardware. Peasant Smith asks a different question:

> **How far can we push the hardware people already own?**

## Why this matters

You don't need an RTX 4090 to run AI locally — but figuring out what *does* work takes testing, sharing, and honest reporting. This project collects structured benchmark data so you can answer questions like:

- Can a modern model run on my 12 GB GPU?
- How much system RAM do I actually need?
- What happens with partial offloading?
- Which quantization level is both fast enough and good enough?
- Does flash attention or KV-cache quantization make a practical difference?
- Can two cheap GPUs beat one expensive card?
- What optimizations turn "impossible" into "usable"?

## What we measure

| Dimension | Description |
|---|---|
| **Tokens/sec (generation)** | How fast the model produces output during generation |
| **Tokens/sec (prompt)** | How quickly input/context is processed |
| **Time to first token** | Latency before generation begins |
| **VRAM usage** | Actual GPU memory consumed, not theoretical |
| **RAM usage** | System memory requirements with offloading |
| **Context scalability** | Usability at different context lengths |
| **Power draw** | Where measurable — watts on consumer hardware |
| **Model compatibility** | Which models run, which don't, and why |
| **Optimization impact** | Measured before/after specific tweaks |
| **Real-world usability** | A holistic judgment — numbers alone don't tell the whole story |

## Usability classification

Results include a standardized classification to answer "is this actually usable?":

- **excellent** — Fast response, comfortable interaction speed (≥15 t/s)
- **good** — Smooth experience for most tasks (8–14 t/s)
- **usable** — Acceptable for chat/writing with some patience (3–7 t/s)
- **marginal** — Technically runs but frustrating for interactive use (1–2.9 t/s)
- **unusable** — Below 1 t/s or unstable; experimental only
- **failed** — Model will not run on this configuration

Raw tokens/sec alone doesn't determine the classification: context length, TTFT, memory constraints, and stability all factor in. Submitters are encouraged to explain unusual classifications.

## Project structure

| Directory | Contents |
|---|---|
| [`benchmarks/`](benchmarks/) | Structured benchmark data (JSON + CSV), schema definitions, examples |
| [`hardware/`](hardware/) | Hardware database — GPUs, CPUs, systems, pricing notes |
| [`models/`](models/) | Model profiles with hardware requirements and compatibility notes |
| [`optimizations/`](optimizations/) | Optimization knowledge base — proven techniques with measured results |
| [`scripts/`](scripts/) | Benchmark runner, validation tools, data utilities |
| [`docs/`](docs/) | Methodology, contribution guides, definitions |
| [`data/`](data/) | Flat-file databases (CSV) for quick queries and imports |

## Contribution guide

1. **[Run a benchmark](docs/benchmark-guide.md)** — Use our scripts or your own toolchain
2. **[Submit results](CONTRIBUTING.md)** — PR, issue template, or data drop
3. **[Share an optimization](optimizations/README.md)** — Document what worked and by how much

No hardware is "too old" to test. We actively encourage GTX 1060s, RTX 3060s, Tesla P40s, integrated graphics, CPUs-only setups, and unusual multi-GPU configurations. Failed experiments are valid contributions.

## Data licensing

- **Code**: [MIT License](LICENSE)
- **Benchmark data**: [CC BY 4.0](benchmarks/LICENSE-DATA) — attribute the source
- **Documentation**: [CC BY-SA 4.0](docs/LICENSE-DOCS) — share alike

## Reproducibility

Every benchmark record preserves:
- Exact model and quantization
- Backend, backend version, drivers, OS
- Hardware specification
- Relevant commands and configurations
- Benchmark schema version

Screenshots alone are not sufficient as a data record. They can supplement structured results but should never replace them.

## Links

- **X/Twitter**: [@PeasantSmith](https://x.com/PeasantSmith)
- **Methodology**: [docs/methodology.md](docs/methodology.md)
- **Benchmark Schema**: [benchmarks/schema/benchmark-schema.json](benchmarks/schema/benchmark-schema.json)

---

*Peasant Smith — because AI shouldn't require a flagship GPU budget.*
