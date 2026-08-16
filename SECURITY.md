# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Peasant Smith project code, please report it privately:

1. Open an issue on GitHub with the `[SECURITY]` tag and keep it muted if possible
2. Describe the vulnerability clearly (affected component, versions impacted)
3. Include reproduction steps if applicable

We aim to respond within 7 days. Vulnerability reports are treated confidentially until a fix is available.

## Benchmark data integrity

The most important security concern for this project is **data authenticity**. We consider:

- Fabricated benchmark numbers (deliberately inflated performance)
- Misleading hardware descriptions that hide the real configuration used
- Manipulated raw output logs to alter displayed results

These are treated more seriously than typical code vulnerabilities because they undermine the core value of this project. If you believe a submitted benchmark is misrepresented or fabricated, create an issue flagged as `data-review`. The maintainer will evaluate and may:
- Request additional evidence (raw logs, screenshots)
- Ask for reproduction on similar hardware
- Quarantine results pending verification until verified

## Supported versions

Only the current schema version (`v1.0` at time of writing) is actively maintained. Older data remains in the repository but may not pass new validation rules - that's by design, and older records are preserved with their original schema version tag.
