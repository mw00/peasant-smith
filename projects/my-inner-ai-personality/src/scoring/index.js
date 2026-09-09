// Pure scoring engine: no side effects, fully unit-testable.
// Exposes scoreAxis, getQuadrant, getQuadrantConfig, recommendParams, clamp.

import { QUESTIONS } from '../config/questions.js'
import { QUADRANTS, FALLBACK } from '../config/presets.js'

export const NEUTRAL_BAND = 0.05 // |score| below this is treated as near-neutral

export function clamp(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

// Average the mapped option values of the questions on the given axis.
// answers: { [questionId]: optionIndex } (0-based index into options)
export function scoreAxis(answers, axis, questions = QUESTIONS) {
  const values = questions
    .filter((q) => q.axis === axis)
    .map((q) => {
      const idx = answers[q.id]
      if (idx === undefined || idx === null) return NaN
      const opt = q.options[idx]
      return opt ? opt.value : NaN
    })
    .filter((v) => !Number.isNaN(v))

  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  return clamp(sum / values.length, -1, 1)
}

// Determine the quadrant key from signed axis scores.
// Near-zero resolves toward the more decisive axis; both near-zero -> fallback.
export function getQuadrant(creativity, control) {
  const cNear = Math.abs(creativity) < NEUTRAL_BAND
  const nNear = Math.abs(control) < NEUTRAL_BAND

  if (cNear && nNear) return 'balanced'

  // Resolve each near-zero axis toward the other, more decisive axis's pole
  // so borderline users land in a sensible quadrant rather than an edge case.
  let cPos = creativity >= 0
  let nPos = control >= 0
  if (cNear) {
    // creativity near zero: lean toward the control axis direction if decisive
    cPos = nNear ? true : nPos
  }
  if (nNear) {
    nPos = cNear ? true : cPos
  }

  return `${cPos ? 'creative' : 'deterministic'}-${nPos ? 'liberal' : 'controller'}`
}

// Return the quadrant config (label, color, archetype, bestFor, refParams),
// or the fallback config for a balanced result.
export function getQuadrantConfig(creativity, control) {
  const key = getQuadrant(creativity, control)
  if (key === 'balanced') return { key, ...FALLBACK }
  return { key, ...QUADRANTS[key] }
}

// Return the hex color for the user's quadrant (gray for balanced).
export function getQuadrantColor(creativity, control) {
  return getQuadrantConfig(creativity, control).color
}

// Map the continuous axis scores to concrete, clamped sampling parameters.
// creativity/control in [-1, +1]. All outputs are clamped to valid ranges.
export function recommendParams(creativity, control) {
  const cNorm = clamp((creativity + 1) / 2, 0, 1) // 0..1
  const nNorm = clamp((control + 1) / 2, 0, 1) // 0..1

  const temperature = clamp(0.2 + 0.6 * cNorm, 0.2, 1.4)
  const top_p = clamp(0.85 + 0.1 * cNorm, 0.85, 0.95)
  const top_k = 40 + Math.round(20 * cNorm) // 40, 60, or 80
  const repeat_penalty = clamp(1.3 - 0.2 * nNorm, 1.1, 1.3)
  const frequency_penalty = control < 0 ? 0.6 : 0.0
  const presence_penalty = control < 0 ? 0.3 : 0.0
  const max_tokens = control < 0 ? 512 : 2048
  const seed = creativity < -0.5 ? 42 : null

  return {
    temperature: round2(temperature),
    top_p: round2(top_p),
    top_k,
    repeat_penalty: round2(repeat_penalty),
    frequency_penalty,
    presence_penalty,
    max_tokens,
    seed,
  }
}

// Round to 2 decimals for clean display.
function round2(n) {
  return Math.round(n * 100) / 100
}
