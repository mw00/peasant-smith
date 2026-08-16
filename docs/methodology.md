# Benchmark Methodology - Peasant Smith

## Core principle

Results must be **reproducible** and **relevant to real users**. A number without context is a claim, not data.

## Metrics

### Generation speed (output t/s) - primary

Tokens/sec during decoding, reported as the **median across the suite** (robust to outliers). Bands in [definitions.md](definitions.md).

### Prompt processing (input pt/s)

How fast context is encoded. Matters for long documents. Planned for runner v2.

### Time to first token (TTFT)

Wall-clock delay to the first generated token. Includes prompt encoding + first decode step.

### Memory

Actual VRAM/RAM consumed, not theoretical. Measured steady-state.

## Run discipline

1. **One model at a time** - load → suite → unload, verified via `/api/ps`.
2. **Exact quant recorded** - the quant is part of the result, not metadata. Unknown quants are labeled `unknown`.
3. Fixed generation budget (`num_predict`) so padding can't game averages.
4. Honor the model's own Modelfile parameters unless the run is an explicit "optimized" variant (overrides recorded in notes).
5. Failed tests get one retry, then are recorded as failures - they lower reliability points rather than vanish.

## Why median + suite, not a single prompt

Single-prompt numbers drift with prompt luck and hide degeneration. An 11-test
suite across hallucination, instruction-following, loops, and routing (see
[tests.md](tests.md)) exposes repetition loops and stalls that a single happy
prompt would miss - and those failures are exactly what a buyer needs to know.

## Classification vs. scoring

- **Classification** (excellent…failed): fixed t/s bands - see [definitions.md](definitions.md).
- **PS Points**: composite ranking score - see [scoring.md](scoring.md).

The two are independent: a run is classified by how it *feels*, scored by how it *performs*.

## Reproducibility record

Every result preserves: model + exact quant, backend + version, driver, OS,
configuration, operator, timestamp. Screenshots alone are not data.
