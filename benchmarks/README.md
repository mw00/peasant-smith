# Benchmarks Directory

## Structure

- `schema/` - JSON Schema v1.1. Submissions must validate against it.
- `raw/` - One JSON file per benchmark run. Naming: `PS-NNNN.json` (registry id).
- `examples/` - Annotated starting points for new contributors (marked `example: true`, skipped by validators).

## Records

Every real result lives here as a single JSON file validated against
[schema/benchmark-schema.json](schema/benchmark-schema.json). Key fields:

- `benchmark_id` - assigned by maintainers (PS-0001 …)
- `hardware_ref` - joins to a system in `data/systems.csv`
- `model.quantization` - **the exact quant. Unknown means `null`/`unknown`, never a guess.**
- `ps_points` - computed by `scripts/score/compute_score.py`, see [docs/scoring.md](../docs/scoring.md)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) and the benchmark-submission issue template.
