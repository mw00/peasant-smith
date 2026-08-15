# Hardware Database

Canonical hardware registry for Peasant Smith. Benchmark records reference this
database via `hardware_ref` (system slug) and `gpu_name` fields.

## Structure

| Path | Contents |
|---|---|
| `systems/` | Complete tested systems (one YAML per machine). Registered in `data/systems.csv`. |
| `gpus/` | Individual GPU profiles with VRAM variants, used-market pricing, inference notes |
| `cpus/` | CPU profiles relevant to local AI (RAM channels matter for CPU inference) |

## Joining results to hardware

1. Every benchmark record carries `hardware_ref` (e.g. `uranus`).
2. `data/systems.csv` maps each slug to its full spec.
3. `hardware/systems/<slug>.yml` holds the detailed profile.

## Pricing notes

Used-market prices are stored with a date stamp (`used_price_date`) because they
move fast. Update a price only when the market has visibly shifted, and always
bump the date with it. Never copy a price you cannot source.

## Adding new hardware

- Open an issue: [Hardware Submission](https://github.com/mw00/peasant-smith/issues/new?template=hardware-submission.yml)
- Or PR a new YAML file plus a row in `data/systems.csv` (for systems).
- VRAM figures must come from TechPowerUp, Wikipedia, or the vendor spec — never guessed.
