import { useRef, useState } from 'react'
import { toPng, toBlob } from 'html-to-image'
import { AXES } from '../config/axes.js'

// Renders a branded, social-ready share card for the user's result and lets
// them download it as a PNG, copy it to the clipboard, or share to X.
//
// Display: the card is FULLY RESPONSIVE (auto height) so it always shows
// completely on any screen width — no more clipped/overflowing content on
// mobile. It stacks vertically on small screens and goes two-column wide on
// larger ones.
//
// Export: a dedicated off-screen 1280x720 (16:9) node is captured, so the
// saved/shared image is always a crisp landscape 16:9 that fits an X post,
// independent of the on-page responsive sizing.
export default function ShareCard({ result }) {
  const { creativity, control, cfg, params } = result
  const exportRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedText, setCopiedText] = useState(false)

  const color = cfg.color
  const isBalanced = cfg.label === 'Balanced Generalist'

  const shareText =
    `I took the AI Personality test and I'm "${cfg.label}" (${isBalanced ? 'Balanced' : cfg.id}) 🎯\n` +
    `Creative ${Math.round(creativity * 100)} · Control ${Math.round(control * 100)}\n` +
    `My model leans on temp ${params.temperature}, top_p ${params.top_p}, ${params.top_k}.\n` +
    `What's YOUR LLM personality? Take the test 👇`

  const xIntent = 'https://x.com/intent/post?text=' + encodeURIComponent(shareText)

  const downloadPng = async () => {
    setDownloading(true)
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 1, cacheBust: true, skipFonts: true })
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

  // Copy the image so it's ready to paste (Ctrl/Cmd+V) into the X composer.
  const copyImage = async () => {
    try {
      const blob = await toBlob(exportRef.current, { pixelRatio: 1, cacheBust: true, skipFonts: true })
      if (!blob) throw new Error('no blob')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2200)
    } catch (e) {
      console.error('Copy image failed:', e)
      // Fallback: paste the image into an anchor download so the user still
      // gets the image even if the clipboard write is blocked (e.g. no focus
      // or clipboard permission denied).
      try {
        const dataUrl = await toPng(exportRef.current, { pixelRatio: 1, cacheBust: true, skipFonts: true })
        const link = document.createElement('a')
        link.download = `my-inner-ai-personality-${cfg.id || 'balanced'}.png`
        link.href = dataUrl
        link.click()
        alert('Clipboard image copy was blocked by your browser, so the image was downloaded instead.')
      } catch (e2) {
        console.error('Fallback failed:', e2)
      }
    }
  }

  // One-click "share to X": copy the image to clipboard AND open X's composer
  // with the text pre-filled. X's web intent cannot attach an image directly,
  // so this gets you to a ready-to-post composer with the caption loaded; the
  // image is already on your clipboard to paste (Ctrl/Cmd+V).
  const shareToX = async () => {
    await copyImage()
    window.open(xIntent, '_blank', 'noopener,noreferrer')
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

      {/* Responsive on-page preview (auto height, never clipped) */}
      <div className="w-full rounded-2xl overflow-hidden" style={{ background: `linear-gradient(145deg, #0b0c0f 0%, #14151a 45%, #0b0c0f 100%)`, border: `1px solid ${color}44` }}>
        <div style={{ height: 6, background: `linear-gradient(90deg, ${color}, #8b5cf6)` }} />
        <div className="flex flex-col sm:flex-row">
          <div className="flex-1 flex flex-col justify-between p-5 sm:p-6" style={{ width: '100%' }}>
            <BrandBlock color={color} />
            <div className="my-4">
              <div className="text-white/60 text-[11px] font-medium uppercase tracking-widest mb-1.5">Your LLM personality</div>
              <div className="text-white text-3xl sm:text-4xl font-extrabold leading-tight" style={{ textShadow: `0 0 44px ${color}66` }}>{cfg.label}</div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: `${color}1f`, border: `1px solid ${color}44` }}>
                <span className="text-white/70 text-xs font-semibold">Quadrant</span>
                <span className="text-sm font-bold" style={{ color }}>{isBalanced ? 'Balanced' : cfg.id}</span>
              </div>
            </div>
            <CtaBlock color={color} />
          </div>
          <div className="w-full sm:w-[44%] flex flex-col justify-center gap-4 p-5 sm:p-6 sm:border-l" style={{ borderColor: `${color}22` }}>
            <div>
              <ShareBar label={AXES.creativity.label} left={AXES.creativity.deterministicLabel} right={AXES.creativity.creativeLabel} value={creativity} color={color} />
              <div className="h-3" />
              <ShareBar label={AXES.control.label} left={AXES.control.controllerLabel} right={AXES.control.liberalLabel} value={control} color={color} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <ShareStat label="temp" value={params.temperature} color={color} />
              <ShareStat label="top_p" value={params.top_p} color={color} />
              <ShareStat label="top_k" value={params.top_k} color={color} />
            </div>
          </div>
        </div>
      </div>

      {/* Hidden 16:9 export node (1280x720) — captured for download/copy */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: '-99999px', width: '1280px', height: '720px', pointerEvents: 'none', zIndex: -1 }}>
        <div ref={exportRef} style={{ width: '1280px', height: '720px', background: `linear-gradient(145deg, #0b0c0f 0%, #14151a 45%, #0b0c0f 100%)`, border: `1px solid ${color}44`, boxSizing: 'border-box' }}>
          <div style={{ height: 8, background: `linear-gradient(90deg, ${color}, #8b5cf6)` }} />
          <div style={{ display: 'flex', height: '712px' }}>
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', width: '56%', boxSizing: 'border-box' }}>
              <BrandBlock color={color} />
              <div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px' }}>Your LLM personality</div>
                <div style={{ color: '#fff', fontSize: '58px', fontWeight: 800, lineHeight: 1.1, textShadow: `0 0 44px ${color}66` }}>{cfg.label}</div>
                <div style={{ marginTop: '18px', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '999px', padding: '8px 16px', background: `${color}1f`, border: `1px solid ${color}44` }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600 }}>Quadrant</span>
                  <span style={{ color, fontSize: '15px', fontWeight: 700 }}>{isBalanced ? 'Balanced' : cfg.id}</span>
                </div>
              </div>
              <CtaBlock color={color} />
            </div>
            <div style={{ width: '44%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '22px', padding: '48px 52px', borderLeft: `1px solid ${color}22`, boxSizing: 'border-box' }}>
              <div>
                <ShareBar label={AXES.creativity.label} left={AXES.creativity.deterministicLabel} right={AXES.creativity.creativeLabel} value={creativity} color={color} />
                <div style={{ height: '22px' }} />
                <ShareBar label={AXES.control.label} left={AXES.control.controllerLabel} right={AXES.control.liberalLabel} value={control} color={color} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '6px' }}>
                <ShareStat label="temp" value={params.temperature} color={color} />
                <ShareStat label="top_p" value={params.top_p} color={color} />
                <ShareStat label="top_k" value={params.top_k} color={color} />
              </div>
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

      <p className="mt-2.5 text-center text-[11px] text-gray-400 dark:text-gray-500">
        Share to X copies the image to your clipboard and opens the composer — just paste (Ctrl/Cmd+V) and post.
      </p>

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
      </div>
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

function CtaBlock({ color }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: `${color}1f`, border: `1px solid ${color}55` }}>
      <span className="text-white/90 text-sm sm:text-base font-semibold">What's YOUR AI personality?</span>
      <span className="text-base font-bold" style={{ color }}>Take the test →</span>
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
