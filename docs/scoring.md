# PS Points — The Peasant Smith Scoring System

PS Points turn a benchmark run into one comparable number so the community can
rank results at a glance. The formula is deliberately simple and fully
mechanical: **no human judgment enters the score.** Anyone can recompute every
score in this repo with one command.

```bash
python3 scripts/score/compute_score.py score          # recompute all raw records
python3 scripts/score/compute_score.py leaderboard    # regenerate LEADERBOARD.md
```

---

## The formula

```
PS Points = Speed + Reliability + Latency bonus + Context bonus
```

### 1. Speed — 10 points per t/s (cap: 100 t/s = 1000 pts)

`median generation tokens/sec × 10`

Generation speed is the metric people feel every day. Median across the suite
is used so one degenerate test can't inflate or wreck the score. The 100 t/s
cap stops absurd outliers from compressing everyone else.

### 2. Reliability — up to 50 points

`50 × (tests completed / tests attempted)`

A model that finishes the full suite gets 50. A model that completes 10 of 11
gets ~45. A model that crashes on 5 tests visibly loses points — **a fast model
that can't finish the work is not as good as the raw t/s suggests.**

### 3. Latency bonus — 0 to 50 points (time to first token)

| TTFT | Bonus |
|---|---|
| ≤ 1 s | 50 |
| ≤ 3 s | 30 |
| ≤ 10 s | 10 |
| > 10 s | 0 |

Interactive feel matters. A model averaging 20 t/s that makes you wait 15
seconds for the first token feels worse than the number says. (Runs recorded
before TTFT capture was added simply score 0 here — no penalty applied.)

### 4. Context bonus — 0 to 30 points

| Verified context | Bonus |
|---|---|
| ≥ 128k | 30 |
| ≥ 64k | 20 |
| ≥ 32k | 10 |

Long usable context is a real capability on budget hardware and worth
rewarding. Only the context the run actually exercised counts — a model
*claiming* 128k in a 4k run earns nothing.

---

## Design decisions

- **Median, not mean.** Reasoning-v1 mixes short and long outputs; median is
  robust to the variance.
- **No quality weighting (yet).** Quality checks exist in the suite but are
  reported separately. Weighting correctness into PS Points is on the roadmap
  once more data exists to calibrate it.
- **No price normalization in the base score.** "Points per dollar" is a
  derived view the community is welcome to compute from
  `data/hardware.csv` price bands — but the raw score stays hardware-agnostic.
- **Classification is separate from points.** The usability class
  (excellent/good/usable/marginal/unusable/failed) follows the fixed t/s bands
  in [methodology.md](methodology.md) and is never overridden by the score.

## Score bands (rough guide)

| PS Points | Reading |
|---|---|
| 700+ | Small/efficient model running flat-out on full VRAM |
| 400–699 | Comfortable interactive speed (≥ ~35 t/s) |
| 200–399 | Good daily-driver territory (15–35 t/s) |
| 100–199 | Usable with patience (3–15 t/s) |
| < 100 | Marginal or partial-suite completion |
| 0 | Failed run |

## Current leaderboard

See [LEADERBOARD.md](../LEADERBOARD.md) — auto-generated from every validated
record in `benchmarks/raw/`.
