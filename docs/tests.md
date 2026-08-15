# Tests & Benchmarks — How Peasant Smith Measures

Every number in this repository comes from a named, documented protocol. This
page defines each protocol, what it measures, and — critically — **how a run
succeeds or fails**, so anyone can reproduce or challenge a result.

---

## Protocol: `reasoning-v1` (primary suite)

**Purpose:** measure generation throughput under realistic reasoning load while
also capturing whether the model stays coherent under stress.

**Shape:** 11 fixed prompts across 4 dimensions, run sequentially against one
model at a time.

| Dimension | Tests | What it stresses |
|---|---|---|
| hallucination | `unfalsifiable-number`, `invented-command-flag`, `control-group-known-fact` | Refusal honesty; the control confirms the model can answer what it knows |
| goal-diversion | `strict-format`, `refuse-no-cheerlead`, `resist-extra-task` | Instruction adherence under pressure to "help" more than asked |
| loops | `count-words`, `converge-arithmetic` | Repetition/degeneration — a model in a loop burns tokens and tanks t/s |
| wrong-route | `tool-routing`, `interpret-intent`, `no-tool-call` | Intent interpretation; premature tool-call hallucination |

**Primary metric:** median generation tokens/sec across all 11 tests.
Median (not mean) because one runaway test must not distort the score.

**Run discipline (mandatory):**

1. **One model at a time.** Load → run full suite → unload. Verify unload via
   `/api/ps` (or `ollama ps`) before the next model. Concurrent residents steal
   VRAM and invalidate the numbers.
2. **Fixed generation budget** (`num_predict` 8192 by default) so long-winded
   models can't game the average with padding.
3. **Chat transport, streaming off.** The runner measures end-to-end latency
   including prompt evaluation.
4. **Honor the model's own Modelfile parameters** unless the run is explicitly
   an "optimized params" variant (then record the overrides in notes).
5. **One retry per failed test**, then record the failure and move on.
   A model that cannot complete the suite is a valid result — see scoring.

**Success criteria:**
- All 11 tests return a response within the timeout (default 900 s per test).
- No more than 0 failed tests for a clean run. Failed tests lower the
  reliability component of PS Points and are visible on the leaderboard.
- Reported t/s is the **median**; mean and max are recorded for context.

**Failure modes (and what they mean):**

| Symptom | Likely cause | How it's recorded |
|---|---|---|
| Test times out | Model too slow for the generation budget, or stuck in a repetition loop | `tests.completed < attempted`; counts against reliability |
| HTTP error / connection refused | Backend down, wrong port, model not pulled | Run is `failed`; do not record a t/s |
| t/s near zero with tokens flowing | CPU-only fallback (GPU not engaged) | Check offloading config; record honestly with notes |
| Huge variance between tests | Thermal throttling or shared-GPU contention | Record max/median spread; note the environment |
| Empty output file | Run aborted mid-suite (OOM kill, power loss) | **Not ingested.** Example: `gemma4-31b` optimized run (Aug 2026) produced nothing and is excluded from the leaderboard |
| Garbage / repeated text | Degeneration at low temperature or bad stop tokens | Visible in raw responses; note it, don't hide it |

**Failed experiments are data.** A model that won't load on 12 GB is exactly
the answer someone else is searching for. Record it with
`result_classification: failed`.

---

## Protocol: `context-sweep`

**Purpose:** answer "does this model stay fast as context grows?"

**Shape:** same fixed prompt + generation at doubling context sizes
(8k → 16k → 32k → 64k → 96k → 128k or until OOM).

**Success:** generation t/s stays within ~±10% of the shortest-context run.
**Failure:** t/s degrades progressively (KV cache pressure) or the run OOMs —
record the largest stable context. Example result: q27bQ4 held 18.6–19.2 t/s
from 8k to 128k context (PS-0030) — flat scaling, which is the good outcome.

---

## Protocol: `kv-retention`

**Purpose:** verify that long context is *actually usable*, not just allocated.
A model can "support" 128k tokens and still lose the thread.

**Shape:** hide a needle string (e.g. `XK9-QWERTY-42`) deep in a long document,
pad the context to target lengths (60k, 120k), then ask the model to retrieve
the needle.

**Success:** exact needle retrieval at the target depth.
**Failure:** wrong answer, refusal, or the model paraphrasing the needle —
means the effective context is smaller than the configured context.
Example result: q27bQ4 retrieved the needle perfectly at 60k and 120k
(PS-0031).

---

## Protocol: `realworld` (code tasks)

**Purpose:** throughput on practical workloads (fibonacci, small functions)
instead of reasoning prompts. Same discipline, different prompts.
Used for the Ling-3.0-Flash runs (PS-0017).

---

## What is *not* measured here

- **Quality/correctness leaderboards** (MMLU etc.) — out of scope. The
  reasoning-v1 checks are sanity signals, not accuracy scores.
- **Prompt-processing (prefill) speed** — planned for v2 of the runner.
- **Power efficiency** — captured when available, not required.

## Reproducing a run

```bash
python3 scripts/benchmark/run_benchmark.py qwen3:8b \
    --url http://YOUR-OLLAMA:11434 \
    --hardware-ref your-system-slug \
    --ctx 32768
```

Then open a PR with the resulting JSON in `benchmarks/raw/`. See
[CONTRIBUTING.md](../CONTRIBUTING.md).
