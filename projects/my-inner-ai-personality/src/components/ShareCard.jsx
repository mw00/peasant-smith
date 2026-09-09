import { useRef, useState } from 'react'
import { toPng, toBlob } from 'html-to-image'
import { AXES } from '../config/axes.js'

// Renders a branded, social-ready share card for the user's result and lets
// them download it as a PNG, copy it to the clipboard, or grab a ready-made
// post text (+ a pre-filled X intention link).
//
// The card is rendered at ~540px logical and exported at pixelRatio: 2 for a
// crisp ~1080px image, which reads well on X/Twitter, LinkedIn and Instagram.
export default function ShareCard({ result }) {
  const { creativity, control, cfg, params } = result
  const cardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedText, setCopiedText] = useState(false)

  const color = cfg.color
  const isBalanced = cfg.label === 'Balanced Generalist'

  const shareText =
    `I took the LLM Personality test and I'm "${cfg.label}" (${isBalanced ? 'Balanced' : cfg.id}) 🎯\n` +
    `Creative ${Math.round(creativity * 100)} · Control ${Math.round(control * 100)}\n` +
    `My model leans on temp ${params.temperature}, top_p ${params.top_p}, ${params.top_k}.\n` +
    `What's your LLM personality? Take the test 👇`

  const xIntent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText)

  const downloadPng = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const link = document.createElement('a')
      link.download = `llm-personality-${cfg.id || 'balanced'}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setDownloading(false)
    }
  }

  const copyImage = async () => {
    if (!cardRef.current) return
    try {
      const blob = await toBlob(cardRef.current, { pixelRatio: 2, cacheBust: true })
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2200)
    } catch (e) {
      console.error('Copy image failed:', e)
    }
  }

  const copyText = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2200)
    })
  }

  return (
    <div className="animate-fade-in-up rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white/80 dark:bg-white/[0.03] p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 dark:text-indigo-400">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share your result
        </h3>
      </div>

      {/* The shareable card (this exact DOM node is exported as the image) */}
      <div
        ref={cardRef}
        className="w-full rounded-2xl overflow-hidden "
        style={{
          background: `linear-gradient(145deg, #0b0c0f 0%, #14151a 45%, #0b0c0f 100%)`,
          border: `1px solid ${color}44`,
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 8, background: `linear-gradient(90deg, ${color}, #8b5cf6)` }} />
        <div className="p-6 sm:p-7">
          {/* Brand row */}
          <div className="flex items-center gap-2.5 mb-6">
            <div style={{ background: `linear-gradient(135deg, ${color}, #8b5cf6)` }} className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
              </svg>
            </div>
            <div>
              <div className="text-white text-[13px] font-bold leading-none">LLM Personality</div>
              <div className="text-white/50 text-[11px] leading-tight mt-0.5">Recommender</div>
            </div>
            <div className="ml-auto text-[11px] font-semibold" style={{ color }}>
              {isBalanced ? 'BALANCED' : cfg.id}
            </div>
          </div>

          {/* Persona */}
          <div className="mb-5">
            <div className="text-white/60 text-xs font-medium uppercase tracking-widest mb-1">Your LLM personality</div>
            <div className="text-white text-3xl font-extrabold leading-tight" style={{ textShadow: `0 0 40px ${color}66` }}>
              {cfg.label}
            </div>
          </div>

          {/* Score bars */}
          <div className="space-y-4 mb-5">
            <ShareBar
              label={AXES.creativity.label}
              left={AXES.creativity.deterministicLabel}
              right={AXES.creativity.creativeLabel}
              value={creativity}
              color={color}
            />
            <ShareBar
              label={AXES.control.label}
              left={AXES.control.controllerLabel}
              right={AXES.control.liberalLabel}
              value={control}
              color={color}
            />
          </div>

          {/* Key params */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <ShareStat label="temp" value={params.temperature} color={color} />
            <ShareStat label="top_p" value={params.top_p} color={color} />
            <ShareStat label="top_k" value={params.top_k} color={color} />
          </div>

          {/* CTA */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: `${color}1f`, border: `1px solid ${color}55` }}
          >
            <span className="text-white/90 text-sm font-semibold">What's YOUR LLM personality?</span>
            <span className="text-sm font-bold" style={{ color }}>
              Take the test →
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          onClick={downloadPng}
          disabled={downloading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#6d6aff] to-[#8b5cf6] text-white hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloading ? 'Rendering…' : 'Download PNG'}
        </button>

        <button
          onClick={copyImage}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
        >
          {copiedImage ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M20 6 9 17l-5-5" /></svg>
              <span className="text-emerald-600 dark:text-emerald-400">Image copied!</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Copy image
            </>
          )}
        </button>
      </div>

      {/* Share text */}
      <div className="mt-3">
        <div className="flex items-start gap-2">
          <textarea
            readOnly
            value={shareText}
            rows={4}
            className="flex-1 p-3 rounded-xl text-xs font-mono bg-gray-50 dark:bg-black/30 border border-gray-200/70 dark:border-white/10 text-gray-600 dark:text-gray-300 resize-none"
          />
          <button
            onClick={copyText}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/15 transition-all shrink-0"
          >
            {copiedText ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M20 6 9 17l-5-5" /></svg>
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              'Copy text'
            )}
          </button>
        </div>
        <a
          href={xIntent}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Post to X
        </a>
      </div>
    </div>
  )
}

function ShareBar({ label, left, right, value, color }) {
  const pos = ((value + 1) / 2) * 100
  return (
    <div>
      <div className="flex justify-between text-[10px] text-white/50 font-medium mb-0.5">
        <span className="font-bold text-white/70">{label}</span>
      </div>
      <div className="flex justify-between text-[10px] text-white/50 font-medium mb-1">
        <span>{left}</span>
        <span style={{ color }} className="font-bold">{Math.round(value * 100)}</span>
        <span>{right}</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pos}%`, background: `linear-gradient(90deg, ${color}66, ${color})` }} />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
      </div>
    </div>
  )
}

function ShareStat({ label, value, color }) {
  return (
    <div className="rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-center">
      <div className="text-[10px] text-white/50 font-medium">{label}</div>
      <div className="text-white font-bold text-sm" style={{ color }}>{value}</div>
    </div>
  )
}
