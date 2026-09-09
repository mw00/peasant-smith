import { useRef, useState } from 'react'
import { toPng, toBlob } from 'html-to-image'
import { AXES } from '../config/axes.js'
import { QUADRANTS } from '../config/presets.js'

const X = 1024 // square export size

// Renders a branded, social-ready share card for the user's result.
//
// Design: a 1:1 (square) card that is DATA-HEAVY — the quadrant mini-map,
// axis scores and recommended parameters are the focus. No URL is baked
// into the image (a link can't be clicked in an image), so the CTA lives in
// the post text instead. Square is the best fit for an X in-feed image.
export default function ShareCard({ result }) {
  const { creativity, control, cfg, params } = result
  const exportRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [copiedText, setCopiedText] = useState(false)

  const color = cfg.color
  const isBalanced = cfg.label === 'Balanced Generalist'

  // The recommended parameters (reference values shown on the card).
  const recParams = {
    temp: params.temperature,
    top_p: params.top_p,
    top_k: params.top_k,
  }

  const shareText =
    `I got ${cfg.label} result as my AI compatibility test, check yours 👇\nhttps://mw00.github.io/peasant-smith/`

  const xIntent = 'https://x.com/intent/post?text=' + encodeURIComponent(shareText)

  const exportOpts = { pixelRatio: 1, cacheBust: true, skipFonts: true }

  const downloadPng = async () => {
    setDownloading(true)
    try {
      const dataUrl = await toPng(exportRef.current, exportOpts)
      const link = document.createElement('a')
      link.download = `my-inner-ai-personality-${cfg.id || 'balanced'}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setDownloading(false)
    }
  }

  const copyImage = async () => {
    try {
      const blob = await toBlob(exportRef.current, exportOpts)
      if (!blob) throw new Error('no blob')
      // As of 2026 Safari, image clipboard writes via ClipboardItem are not
      // supported; attempt it but catch cleanly.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2200)
    } catch (e) {
      console.error('Copy image failed:', e)
      // Graceful inline guidance instead of a jarring alert: your browser
      // blocked the image clipboard write, so point the user to Share/Download.
      setCopyError(true)
      setTimeout(() => setCopyError(false), 4000)
    }
  }

  // Native share sheet (mobile-friendly): shares the square image + text
  // together via the OS share dialog. Reliable on iOS/Android — lets the user
  // pick X directly without any clipboard gymnastics.
  const shareToX = async () => {
    try {
      const blob = await toBlob(exportRef.current, exportOpts)
      if (!blob) throw new Error('no blob')
      const file = new File([blob], `my-inner-ai-personality-${cfg.id || 'balanced'}.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: shareText,
          title: 'My Inner AI Personality',
        })
        return
      }
      // No native share support (e.g. desktop) — fall back to copy + open X.
      await copyImage()
      window.open(xIntent, '_blank', 'noopener,noreferrer')
    } catch (e) {
      if (e && e.name === 'AbortError') {
        console.log('Share cancelled by user')
        return
      }
      console.error('Share failed:', e)
      // Final fallback: copy image + open X composer.
      await copyImage()
      window.open(xIntent, '_blank', 'noopener,noreferrer')
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

      {/* Responsive on-page preview (auto height, mirrors the 1:1 export) */}
      <div className="w-full rounded-2xl overflow-hidden" style={{ background: `linear-gradient(160deg, #0b0c0f 0%, #17131c 50%, #0b0c0f 100%)`, border: `1px solid ${color}44` }}>
        <div style={{ height: 5, background: `linear-gradient(90deg, ${color}, #8b5cf6)` }} />
        <div className="flex flex-col items-center justify-center p-5 sm:p-6 text-center">
          <BrandBlock color={color} />
          <div className="mt-4 text-white/60 text-[11px] font-medium uppercase tracking-[0.2em]">Your LLM personality</div>
          <div className="mt-1 text-white text-3xl sm:text-4xl font-extrabold leading-tight" style={{ textShadow: `0 0 44px ${color}66` }}>{cfg.label}</div>
          <div className="mt-2.5 inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: `${color}1f`, border: `1px solid ${color}44` }}>
            <span className="text-white/70 text-xs font-semibold">Quadrant</span>
            <span className="text-sm font-bold" style={{ color }}>{isBalanced ? 'Balanced' : cfg.id}</span>
          </div>
          <div className="mt-5 w-full max-w-[340px]">
            <QuadrantMap creativity={creativity} control={control} color={color} compact />
          </div>
          <div className="mt-5 w-full max-w-[320px] flex flex-col gap-3">
            <ShareBar label={AXES.creativity.label} left={AXES.creativity.deterministicLabel} right={AXES.creativity.creativeLabel} value={creativity} color={color} />
            <ShareBar label={AXES.control.label} left={AXES.control.controllerLabel} right={AXES.control.liberalLabel} value={control} color={color} />
          </div>
          <div className="mt-5 w-full grid grid-cols-3 gap-2" style={{ maxWidth: 320 }}>
            <ShareStat label="temperature" value={recParams.temp} color={color} />
            <ShareStat label="top_p" value={recParams.top_p} color={color} />
            <ShareStat label="top_k" value={recParams.top_k} color={color} />
          </div>
        </div>
      </div>

      {/* Hidden 1:1 export node (1024x1024) — captured for download/copy */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: '-99999px', width: `${X}px`, height: `${X}px`, pointerEvents: 'none', zIndex: -1 }}>
        <div
          ref={exportRef}
          style={{
            width: `${X}px`, height: `${X}px`, boxSizing: 'border-box',
            background: `radial-gradient(circle at 20% 15%, ${color}22 0%, rgba(0,0,0,0) 45%), radial-gradient(circle at 85% 85%, #8b5cf622 0%, rgba(0,0,0,0) 45%), linear-gradient(160deg, #0b0c0f 0%, #17131c 52%, #0b0c0f 100%)`,
            border: `1px solid ${color}55`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
            padding: '46px 54px',
          }}
        >
          {/* top accent + brand */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${color}, #8b5cf6)`, marginBottom: 28 }} />
            <BrandBlock color={color} />
          </div>

          {/* persona */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 12 }}>Your LLM personality</div>
            <div style={{ color: '#fff', fontSize: 64, fontWeight: 800, lineHeight: 1.05, textShadow: `0 0 56px ${color}88` }}>{cfg.label}</div>
            <div style={{ marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 10, borderRadius: 999, padding: '10px 20px', background: `${color}1f`, border: `1px solid ${color}55` }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }}>Quadrant</span>
              <span style={{ color, fontSize: 16, fontWeight: 700 }}>{isBalanced ? 'Balanced' : cfg.id}</span>
            </div>
          </div>

          {/* quadrant map */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <QuadrantMap creativity={creativity} control={control} color={color} />
            <div style={{ display: 'flex', width: 380, justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>
              <span>Deterministic</span>
              <span>Creative</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>Creativity →</div>
          </div>

          {/* axis bars + params */}
          <div style={{ width: '100%', maxWidth: 620 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <ShareBar label={AXES.creativity.label} left={AXES.creativity.deterministicLabel} right={AXES.creativity.creativeLabel} value={creativity} color={color} />
              <ShareBar label={AXES.control.label} left={AXES.control.controllerLabel} right={AXES.control.liberalLabel} value={control} color={color} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 20 }}>
              <ShareStat label="temperature" value={recParams.temp} color={color} />
              <ShareStat label="top_p" value={recParams.top_p} color={color} />
              <ShareStat label="top_k" value={recParams.top_k} color={color} />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          onClick={shareToX}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg, #1d9bf0, #0d8bd9)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share to X
        </button>

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

      {copyError && (
        <p className="mt-2.5 text-center text-[11px] text-amber-600 dark:text-amber-400">
          Your browser blocked the image clipboard. Tap <strong>Share to X</strong> to share it directly, or use Download PNG.
        </p>
      )}

      <p className="mt-2.5 text-center text-[11px] text-gray-400 dark:text-gray-500">
        Share to X opens your device's share sheet (or the X composer on desktop) with the card and caption ready.
      </p>

      {/* Share text (includes the link, since a URL can't live in the image) */}
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
      </div>
    </div>
  )
}

// 2x2 quadrant mini-map matching the app's "Where you sit" grid exactly.
// x-axis = creativity: -1 Deterministic(left) -> +1 Creative(right)
// y-axis = control:    -1 Controller(top)      -> +1 Liberal(bottom)
// The user's exact (creativity, control) position is marked by a glowing dot,
// and their own quadrant cell is highlighted at full colour.
function QuadrantMap({ creativity, control, color, compact }) {
  const SIZE = compact ? 210 : 400
  const pad = compact ? 10 : 16
  const cell = (SIZE - 2 * pad) / 2
  const toPercent = (v) => ((v + 1) / 2) * 100

  const x = pad + (toPercent(creativity) / 100) * (SIZE - 2 * pad)
  const y = pad + (toPercent(control) / 100) * (SIZE - 2 * pad)

  const creativityKey = creativity >= 0 ? 'creative' : 'deterministic'
  const controlKey = control >= 0 ? 'liberal' : 'controller'
  const highlightKey = `${creativityKey}-${controlKey}`

  const cells = [
    { geo: { left: pad, top: pad }, key: 'deterministic-controller' },
    { geo: { left: pad + cell, top: pad }, key: 'creative-controller' },
    { geo: { left: pad, top: pad + cell }, key: 'deterministic-liberal' },
    { geo: { left: pad + cell, top: pad + cell }, key: 'creative-liberal' },
  ]

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, borderRadius: compact ? 16 : 22, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}>
      {cells.map(({ geo, key }) => {
        const q = QUADRANTS[key]
        const active = key === highlightKey
        return (
          <div
            key={key}
            style={{
              position: 'absolute', left: geo.left, top: geo.top, width: cell, height: cell,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              background: active ? q.color : `${q.color}14`,
              transition: 'background 0.4s, opacity 0.4s',
            }}
          >
            <span style={{ color: active ? '#fff' : q.color, fontSize: compact ? 13 : 18, fontWeight: 800, letterSpacing: '0.04em', opacity: active ? 1 : 0.7 }}>{q.id}</span>
            <span style={{ color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)', fontSize: compact ? 9.5 : 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.15, padding: '0 6px' }}>{q.label}</span>
          </div>
        )
      })}
      {/* axis dividers */}
      <div style={{ position: 'absolute', left: pad + cell, top: pad, width: 1, height: SIZE - 2 * pad, background: 'rgba(255,255,255,0.18)' }} />
      <div style={{ position: 'absolute', left: pad, top: pad + cell, width: SIZE - 2 * pad, height: 1, background: 'rgba(255,255,255,0.18)' }} />
      {/* user dot */}
      <div style={{ position: 'absolute', left: x - (compact ? 9 : 14), top: y - (compact ? 9 : 14), width: compact ? 18 : 28, height: compact ? 18 : 28, borderRadius: '50%', background: color, border: '2px solid rgba(255,255,255,0.9)', boxShadow: `0 0 0 6px ${color}44, 0 0 26px ${color}` }} />
    </div>
  )
}

function BrandBlock({ color }) {
  return (
    <div className="flex items-center gap-2.5">
      <div style={{ background: `linear-gradient(135deg, ${color}, #8b5cf6)` }} className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg shrink-0">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      </div>
      <div>
        <div className="text-white text-[13px] font-bold leading-none">My Inner AI Personality</div>
        <div className="text-white/50 text-[11px] leading-tight mt-0.5">Meet the AI that's most like you</div>
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
        <span style={{ color }} className="font-bold">{Math.round(value * 100)}</span>
      </div>
      <div className="flex justify-between text-[10px] text-white/50 font-medium mb-1">
        <span>{left}</span>
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
