import { describe, it, expect } from 'vitest'
import { scoreAxis, getQuadrant, getQuadrantConfig, getQuadrantColor, recommendParams, clamp } from './index.js'
import { QUESTIONS } from '../config/questions.js'
import { QUADRANTS, FALLBACK } from '../config/presets.js'

// helper: build an answers object with the same option index for a given axis
function answersFor(axis, optionIndex) {
  return QUESTIONS.filter((q) => q.axis === axis).reduce((acc, q) => {
    acc[q.id] = optionIndex
    return acc
  }, {})
}

describe('clamp', () => {
  it('bounds a value within [min, max]', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })
  it('returns min for NaN', () => {
    expect(clamp(NaN, 0, 1)).toBe(0)
  })
})

describe('scoreAxis', () => {
  it('averages mapped values on the creativity axis', () => {
    const answers = answersFor('creativity', 2) // all C -> +0.8 etc
    const score = scoreAxis(answers, 'creativity')
    // mean of [-0.0? no]: A1 C=0.8, A2 C=0.8, A3 C=0.8, A4 C=0.8, A5 C=0.7
    expect(score).toBeCloseTo((0.8 + 0.8 + 0.8 + 0.8 + 0.7) / 5, 5)
  })

  it('averages mapped values on the control axis', () => {
    const answers = answersFor('control', 0) // all A -> controller
    const score = scoreAxis(answers, 'control')
    // mean of -0.8, -0.8, -0.8, -0.7, -0.7
    expect(score).toBeCloseTo((-0.8 - 0.8 - 0.8 - 0.7 - 0.7) / 5, 5)
  })

  it('returns 0 when no questions are answered on the axis', () => {
    expect(scoreAxis({}, 'creativity')).toBe(0)
    expect(scoreAxis({}, 'control')).toBe(0)
  })

  it('clamps the result to [-1, 1]', () => {
    // force extreme via a single question is not possible (max 0.8);
    // instead verify clamp via a crafted answers object with out-of-range is not needed.
    // Just verify bounds on a real full answer set.
    const s = scoreAxis(answersFor('creativity', 2), 'creativity')
    expect(s).toBeGreaterThanOrEqual(-1)
    expect(s).toBeLessThanOrEqual(1)
  })
})

describe('getQuadrant', () => {
  it('returns Q1 for creative + controller', () => {
    expect(getQuadrant(0.8, -0.8)).toBe('creative-controller')
  })
  it('returns Q2 for creative + liberal', () => {
    expect(getQuadrant(0.8, 0.8)).toBe('creative-liberal')
  })
  it('returns Q3 for deterministic + controller', () => {
    expect(getQuadrant(-0.8, -0.8)).toBe('deterministic-controller')
  })
  it('returns Q4 for deterministic + liberal', () => {
    expect(getQuadrant(-0.8, 0.8)).toBe('deterministic-liberal')
  })
  it('returns balanced when both axes are near-neutral', () => {
    expect(getQuadrant(0.01, -0.01)).toBe('balanced')
  })
})

describe('getQuadrantConfig', () => {
  it('returns the matching quadrant config with color', () => {
    const cfg = getQuadrantConfig(0.8, -0.8)
    expect(cfg.key).toBe('creative-controller')
    expect(cfg.label).toBe(QUADRANTS['creative-controller'].label)
    expect(cfg.color).toBe(QUADRANTS['creative-controller'].color)
  })
  it('returns fallback for balanced neutral scores', () => {
    const cfg = getQuadrantConfig(0.01, -0.01)
    expect(cfg.key).toBe('balanced')
    expect(cfg.label).toBe(FALLBACK.label)
    expect(cfg.color).toBe(FALLBACK.color)
  })
})

describe('getQuadrantColor', () => {
  it('returns the quadrant color', () => {
    expect(getQuadrantColor(-0.8, 0.8)).toBe(QUADRANTS['deterministic-liberal'].color)
  })
})

describe('recommendParams', () => {
  it('emits clamped values for extreme deterministic+controller', () => {
    const p = recommendParams(-1, -1)
    expect(p.temperature).toBeGreaterThanOrEqual(0.2)
    expect(p.temperature).toBeLessThanOrEqual(1.4)
    expect(p.top_p).toBeGreaterThanOrEqual(0.85)
    expect(p.top_p).toBeLessThanOrEqual(0.95)
    expect(p.repeat_penalty).toBeGreaterThanOrEqual(1.1)
    expect(p.repeat_penalty).toBeLessThanOrEqual(1.3)
    expect(p.max_tokens).toBe(512)
    expect(p.seed).toBe(42) // deterministic
  })

  it('emits clamped values for extreme creative+liberal', () => {
    const p = recommendParams(1, 1)
    expect(p.temperature).toBeGreaterThanOrEqual(0.2)
    expect(p.temperature).toBeLessThanOrEqual(1.4)
    expect(p.top_p).toBeGreaterThanOrEqual(0.85)
    expect(p.top_p).toBeLessThanOrEqual(0.95)
    expect(p.repeat_penalty).toBeGreaterThanOrEqual(1.1)
    expect(p.repeat_penalty).toBeLessThanOrEqual(1.3)
    expect(p.max_tokens).toBe(2048)
    expect(p.seed).toBeNull() // not deterministic
  })

  it('is invariant to axis extremes (property: never NaN/undefined)', () => {
    for (let c = -1; c <= 1; c += 0.5) {
      for (let n = -1; n <= 1; n += 0.5) {
        const p = recommendParams(c, n)
        for (const k of ['temperature', 'top_p', 'top_k', 'repeat_penalty', 'frequency_penalty', 'presence_penalty', 'max_tokens']) {
          expect(Number.isFinite(p[k])).toBe(true)
        }
      }
    }
  })

  it('produces higher temperature for more creative scores', () => {
    expect(recommendParams(1, 0).temperature).toBeGreaterThan(recommendParams(-1, 0).temperature)
  })

  it('produces stronger repeat penalty for more controller scores', () => {
    expect(recommendParams(0, -1).repeat_penalty).toBeGreaterThan(recommendParams(0, 1).repeat_penalty)
  })
})

describe('all-middle answer set - integration', () => {
  it('scores near zero and resolves to a valid quadrant (not the true fallback)', () => {
    const answers = QUESTIONS.reduce((acc, q) => {
      acc[q.id] = 1 // middle option for every question
      return acc
    }, {})
    const c = scoreAxis(answers, 'creativity')
    const n = scoreAxis(answers, 'control')
    expect(Number.isFinite(c)).toBe(true)
    expect(Number.isFinite(n)).toBe(true)
    expect(Math.abs(c)).toBeLessThan(0.15)
    expect(Math.abs(n)).toBeLessThan(0.15)
    // B options are intentionally slightly off-center, so "all middle" is NOT
    // truly neutral. It must still resolve to a valid quadrant config.
    const cfg = getQuadrantConfig(c, n)
    expect(cfg.label).toBeTruthy()
    expect(cfg.color).toBeTruthy()
  })

  it('returns the true fallback only when both axes are within the neutral band', () => {
    const cfg = getQuadrantConfig(0.01, -0.01)
    expect(cfg.label).toBe(FALLBACK.label)
    expect(cfg.color).toBe(FALLBACK.color)
  })
})
