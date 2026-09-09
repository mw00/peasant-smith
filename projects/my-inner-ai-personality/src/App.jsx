import { useMemo, useState, useEffect, useCallback } from 'react'
import { QUESTIONS } from './config/questions.js'
import { AXES } from './config/axes.js'
import { QUADRANTS, FALLBACK, CLIENT_NOTES } from './config/presets.js'
import { scoreAxis, getQuadrantConfig, recommendParams } from './scoring/index.js'
import ShareCard from './components/ShareCard.jsx'

// Map an axis score in [-1, +1] to a percentage position in the grid.
// Horizontal = creativity (left deterministic -> right creative)
// Vertical   = control    (top controller -> bottom liberal)
function toPercent(v) {
  return ((v + 1) / 2) * 100
}

const LETTERS = ['A', 'B', 'C']

export default function App() {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // Sync the DOM class with the initial dark state on mount (external sync, run-once).
  useEffect(() => {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleDark = useCallback(() => {
    setDark((d) => {
      const next = !d
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }, [])

  const allAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined)

  const result = useMemo(() => {
    if (!submitted) return null
    const creativity = scoreAxis(answers, 'creativity')
    const control = scoreAxis(answers, 'control')
    const cfg = getQuadrantConfig(creativity, control)
    const params = recommendParams(creativity, control)
    return { creativity, control, cfg, params }
  }, [answers, submitted])

  const setAnswer = (qId, idx) => {
    setAnswers((prev) => ({ ...prev, [qId]: idx }))
  }

  // When the result view mounts, snap to the top so it never lands mid/bottom.
  useEffect(() => {
    if (submitted) window.scrollTo(0, 0)
  }, [submitted])

  const reset = () => {
    setAnswers({})
    setSubmitted(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-[#08090a] text-gray-900 dark:text-gray-100">
      <AuroraBg />
      <div className="relative z-10">
        <Header
          dark={dark}
          toggleDark={toggleDark}
          progress={{ answered: Object.keys(answers).length, total: QUESTIONS.length, show: !submitted }}
        />
        <main className="max-w-3xl mx-auto px-5 sm:px-6 py-10">
          {!submitted ? (
            <Quiz
              answers={answers}
              setAnswer={setAnswer}
              allAnswered={allAnswered}
              onSubmit={() => setSubmitted(true)}
            />
          ) : (
            <Result result={result} reset={reset} />
          )}
        </main>
      </div>
    </div>
  )
}

function AuroraBg() {
  return <div className="aurora" aria-hidden="true" />
}

function Header({ dark, toggleDark, progress }) {
  const pct = progress ? Math.round((progress.answered / progress.total) * 100) : 0
  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 dark:bg-[#08090a]/70 border-b border-gray-200/70 dark:border-white/5">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#6d6aff] via-[#8b5cf6] to-[#d946ef] shadow-lg shadow-indigo-500/30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight">My Inner AI Personality</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-0.5">Discover which AI parameters better suit your personality</p>
          </div>
        </div>
        <button
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          className="w-10 h-10 rounded-full flex items-center justify-center border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          {dark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin-in">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
      {/* Sticky progress strip — always visible below the title bar while answering */}
      {progress && progress.show && (
        <div className="max-w-3xl mx-auto px-5 sm:px-6 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {progress.answered} / {progress.total} answered
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6d6aff] via-[#8b5cf6] to-[#d946ef] transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </header>
  )
}

function Quiz({ answers, setAnswer, allAnswered, onSubmit }) {
  const answered = Object.keys(answers).length

  return (
    <div className="space-y-6">
      {/* Questions */}
      <div className="stagger space-y-4">
        {QUESTIONS.map((q, i) => (
          <QuestionCard key={q.id} q={q} index={i} answers={answers} setAnswer={setAnswer} />
        ))}
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          onClick={onSubmit}
          disabled={!allAnswered}
          className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
            allAnswered
              ? 'bg-gradient-to-r from-[#6d6aff] via-[#8b5cf6] to-[#d946ef] text-white hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] animate-pulse-glow'
              : 'bg-gray-200 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="M22 4 12 14.01l-3-3" />
          </svg>
          {allAnswered ? 'Reveal my personality' : `Answer all questions (${QUESTIONS.length - answered} remaining)`}
        </button>
      </div>
    </div>
  )
}

function QuestionCard({ q, index, answers, setAnswer }) {
  const answeredThis = answers[q.id] !== undefined
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white/80 dark:bg-white/[0.03] p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      {/* accent glow on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 dark:via-indigo-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <h2 className="font-semibold text-[15px] mb-4 flex items-start gap-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg text-[13px] font-bold bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 shrink-0">
          {index + 1}
        </span>
        {q.text}
        {answeredThis && (
          <span className="ml-auto text-emerald-500 dark:text-emerald-400 animate-pop-in" aria-label="answered">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        )}
      </h2>
      <div className="space-y-2.5">
        {q.options.map((opt, idx) => {
          const selected = answers[q.id] === idx
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setAnswer(q.id, idx)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                selected
                  ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 shadow-sm'
                  : 'border-gray-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
            >
              <input type="radio" name={q.id} checked={selected} readOnly className="opt-radio" />
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold shrink-0 transition-colors ${
                  selected
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-400'
                }`}
              >
                {LETTERS[idx]}
              </span>
              <span className="text-sm">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Result({ result, reset }) {
  const { creativity, control, cfg, params } = result
  const isFallback = cfg.label === FALLBACK.label

  return (
    <div className="space-y-8">
      {/* Result card, tinted with the quadrant color */}
      <div
        className="animate-scale-in rounded-3xl p-6 sm:p-8 border-2 relative overflow-hidden"
        style={{
          borderColor: cfg.color,
          background: isFallback
            ? 'rgba(107,114,128,0.08)'
            : `linear-gradient(135deg, ${cfg.color}22 0%, transparent 60%)`,
        }}
      >
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-40 animate-floaty"
          style={{ background: cfg.color }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: cfg.color }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: cfg.color }}>
              {isFallback ? 'Balanced' : cfg.id}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            You are <span style={{ color: cfg.color }}>{cfg.label}</span>
          </h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">{cfg.archetype}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium" style={{ background: `${cfg.color}1a`, color: cfg.color }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.5-6.3 4.5L8 13.8 2 9.4h7.6z" />
            </svg>
            Best for: {cfg.bestFor}
          </div>
        </div>
      </div>

      <QuadrantGrid creativity={creativity} control={control} highlightKey={cfg.key} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        <AxisGauge
          label={AXES.creativity.label}
          leftLabel={AXES.creativity.deterministicLabel}
          rightLabel={AXES.creativity.creativeLabel}
          value={creativity}
          color="#8b5cf6"
        />
        <AxisGauge
          label={AXES.control.label}
          leftLabel={AXES.control.controllerLabel}
          rightLabel={AXES.control.liberalLabel}
          value={control}
          color="#06b6d4"
        />
      </div>

      <ParamTable params={params} />
      <PresetBlock params={params} />
      <ShareCard result={result} />

      <div className="flex justify-center pt-2">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Re-take quiz
        </button>
      </div>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-gray-400 dark:text-gray-500 max-w-md mx-auto">
        This is intended for fun only — the same parameters may give different
        results when used on different language models.
      </p>
    </div>
  )
}

function QuadrantGrid({ creativity, control, highlightKey }) {
  const x = toPercent(creativity)
  const y = toPercent(control)

  const cells = [
    { geo: 'top-0 left-0', key: 'deterministic-controller', cfg: QUADRANTS['deterministic-controller'] },
    { geo: 'top-0 right-0', key: 'creative-controller', cfg: QUADRANTS['creative-controller'] },
    { geo: 'bottom-0 left-0', key: 'deterministic-liberal', cfg: QUADRANTS['deterministic-liberal'] },
    { geo: 'bottom-0 right-0', key: 'creative-liberal', cfg: QUADRANTS['creative-liberal'] },
  ]

  return (
    <div className="animate-fade-in-up">
      <h3 className="font-semibold mb-3 flex items-center gap-2 text-lg">
        <span className="text-indigo-500 dark:text-indigo-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </span>
        Where you sit
      </h3>
      <div className="flex justify-between text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1 px-1">
        <span>{AXES.creativity.deterministicLabel}</span>
        <span>{AXES.creativity.creativeLabel}</span>
      </div>
      <div className="flex gap-3">
        <div className="flex flex-col justify-between text-[11px] font-medium text-gray-400 dark:text-gray-500">
          <span>{AXES.control.controllerLabel}</span>
          <span>{AXES.control.liberalLabel}</span>
        </div>
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
          {cells.map(({ geo, key, cfg: c }) => (
            <div
              key={key}
              className={`absolute ${geo} w-1/2 h-1/2 flex flex-col items-center justify-center gap-1 p-2 transition-all duration-500 ${
                key === highlightKey ? 'scale-[1.02]' : ''
              }`}
              style={{ background: c.color, opacity: key === highlightKey ? 0.85 : 0.3 }}
            >
              <span className="text-white text-sm font-extrabold drop-shadow">{c.id}</span>
              <span className="text-white/90 text-[10px] font-semibold leading-tight text-center">{c.label}</span>
            </div>
          ))}
          {/* Highlight ring around user's quadrant */}
          <div
            className={`absolute w-1/2 h-1/2 pointer-events-none ${highlightKey === 'balanced' ? 'hidden' : ''}`}
            style={{
              top: control < 0 ? 0 : '50%',
              left: creativity < 0 ? 0 : '50%',
              border: '3px solid rgba(255,255,255,0.95)',
              boxShadow: '0 0 18px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.2)',
            }}
          />
          {/* User marker */}
          <div
            className="absolute w-6 h-6 rounded-full border-2 border-white shadow-xl animate-pop-in"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              background: '#0f1011',
              boxShadow: '0 0 0 4px rgba(255,255,255,0.35), 0 0 20px rgba(0,0,0,0.5)',
            }}
            title={`Creativity ${(creativity * 100).toFixed(0)}, Control ${(control * 100).toFixed(0)}`}
          />
        </div>
      </div>
    </div>
  )
}

function AxisGauge({ label, leftLabel, rightLabel, value, color }) {
  const pos = toPercent(value)
  const pct = `${Math.round(value * 100)}`
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white/80 dark:bg-white/[0.03] p-5 shadow-sm">
      <h4 className="font-semibold mb-4 flex items-center justify-between">
        {label}
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/10" style={{ color }}>
          {pct}%
        </span>
      </h4>
      <div className="relative h-2.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pos}%`, background: `linear-gradient(90deg, ${color}55, ${color})` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-white/30" />
        <div
          className="absolute top-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg -translate-y-1/2 transition-all duration-700 ease-out"
          style={{ left: `${pos}%`, transform: `translate(-50%, -50%)`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500 mt-2 font-medium">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

function ParamTable({ params }) {
  const rows = [
    ['temperature', params.temperature, 'Higher = more creative; lower = more deterministic'],
    ['top_p', params.top_p, 'Nucleus size — higher = broader variety'],
    ['top_k', params.top_k, 'Candidate token cap — higher = more freedom'],
    ['repeat_penalty', params.repeat_penalty, 'Higher = stricter against repetition'],
    ['frequency_penalty', params.frequency_penalty, 'Penalise repeated tokens'],
    ['presence_penalty', params.presence_penalty, 'Penalise themes already used'],
    ['max_tokens', params.max_tokens, 'Output length cap'],
    ['seed', params.seed ?? 'random', 'Fixed seed for reproducible output (deterministic only)'],
  ]
  return (
    <div className="animate-fade-in-up rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white/80 dark:bg-white/[0.03] p-5 sm:p-6 shadow-sm">
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 dark:text-indigo-400">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
        Recommended parameters
      </h3>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {rows.map(([k, v, why]) => (
          <div key={k} className="py-2.5 flex items-baseline gap-3">
            <span className="font-mono text-sm font-medium w-40 shrink-0 text-gray-600 dark:text-gray-300">{k}</span>
            <span className="font-mono text-sm font-bold px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              {v ?? 'random'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{why}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PresetBlock({ params }) {
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(
    {
      temperature: params.temperature,
      top_p: params.top_p,
      top_k: params.top_k,
      repeat_penalty: params.repeat_penalty,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
      max_tokens: params.max_tokens,
      seed: params.seed,
    },
    null,
    2
  )

  const copyJson = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="animate-fade-in-up rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white/80 dark:bg-white/[0.03] p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 dark:text-indigo-400">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copyable preset
        </h3>
        <button
          onClick={copyJson}
          className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg font-semibold transition-all duration-200 ${
            copied
              ? 'bg-emerald-500 text-white'
              : 'bg-gradient-to-r from-[#6d6aff] to-[#8b5cf6] text-white hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95'
          }`}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Copy JSON
            </>
          )}
        </button>
      </div>
      <pre className="mt-2 p-4 rounded-xl bg-gray-50 dark:bg-black/40 border border-gray-200/70 dark:border-white/10 text-xs font-mono overflow-x-auto text-gray-700 dark:text-gray-200">{json}</pre>
      <div className="mt-5 space-y-2.5">
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Per client</h4>
        {CLIENT_NOTES.map((n) => (
          <div key={n.client} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold px-2 py-1 rounded-md bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300">{n.client}</span>
            <code className="text-xs p-1.5 rounded-lg bg-gray-50 dark:bg-black/30 border border-gray-200/70 dark:border-white/5 text-gray-600 dark:text-gray-300">{n.cmd(params)}</code>
          </div>
        ))}
      </div>
    </div>
  )
}
