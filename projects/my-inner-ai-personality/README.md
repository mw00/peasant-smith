# LLM Personality Recommender

A small single-page web app that asks 10 personal-preference questions, maps your answers onto two personality axes, places you in one of four quadrants, and recommends concrete LLM sampling parameters matched to your style.

Answer the questions → get a color-coded quadrant card, your position on a 2×2 grid, and a copyable parameter preset for Ollama, llama.cpp, or the OpenAI API.

## The two axes

Each axis is scored independently on `[-1, +1]` from your answers, then the signs of the two scores place you in a quadrant.

- **Axis A — Creative ↔ Deterministic** → drives `temperature`, `top_p`, `top_k`, `seed`
- **Axis B — Controller ↔ Liberal** → drives `repeat_penalty`, `frequency_penalty`, `presence_penalty`, `max_tokens`

## The four quadrants

| Quadrant | Personality | Color | Best for |
|---|---|---|---|
| Q1 Creative + Controller | The Imaginative Ruler | 🔵 Blue | Creative writing with a tight brief |
| Q2 Creative + Liberal | The Free Spirit | 🟣 Purple | Brainstorming, fiction, open exploration |
| Q3 Deterministic + Controller | The Exact Engineer | 🔴 Red | Code, factual Q&A, structured output |
| Q4 Deterministic + Liberal | The Unconstrained Analyst | 🟢 Green | Exhaustive long-form analysis |

A "Balanced Generalist" (gray) fallback is used when both axis scores are near-neutral.

## How scoring works

1. **Questions** — 10 multiple-choice questions (5 per axis), each with 3 options (A/B/C) mapped to a value on `[-1, +1]`. A leans deterministic/controller, C leans creative/liberal, B is near-neutral.
2. **Score** — each axis score is the average (mean) of that axis's question option values, clamped to `[-1, +1]`.
3. **Quadrant** — derived from the sign of each score.
4. **Parameters** — mapped continuously from the scores (not 4 static presets), then clamped to valid ranges.

## Tech stack

Vite + React 19 + Tailwind CSS 3. Pure client-side — no backend, no data leaves the browser. Builds to static files that deploy to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).

## Getting started

```bash
npm install
npm run dev        # local dev server (http://localhost:5173)
npm test           # run the Vitest unit test suite
npm run build      # production build to dist/
npm run preview    # preview the production build (http://localhost:4173)
```

## Project structure

```
src/
  config/
    axes.js         axis definitions (creativity, control)
    questions.js    the 10 questions + option values
    presets.js      quadrant colors, labels, archetypes, per-client formats
  scoring/
    index.js        scoreAxis, getQuadrant, getQuadrantConfig, recommendParams
    index.test.js   unit tests
  App.jsx           quiz → result (color card + 2×2 grid + gauges + params + preset)
  main.jsx          React bootstrap
  index.css         Tailwind directives
```

## Extending

- **Add/edit a question**: append to `src/config/questions.js`. Each question targets one axis and carries per-option `value`s. The scoring engine picks it up automatically.
- **Tune the parameter mapping**: edit `recommendParams` in `src/scoring/index.js`.
- **Change quadrant copy/colors**: edit `src/config/presets.js`.

## Testing

`npm test` runs the Vitest suite covering scoring math, all four quadrant corners, color lookup, parameter clamping, and the all-neutral fallback.

## Notes

- **Parameters** are recommendations only — the app does not run an LLM. You paste the preset into your own client.
- `min_p` is intentionally excluded (its effect on the Controller ↔ Liberal axis is ambiguous and would make the mapping misleading).
- Anonymised shared-results view (a public aggregate of users' quadrant placements) would require a backend — out of scope for this client-side build.
