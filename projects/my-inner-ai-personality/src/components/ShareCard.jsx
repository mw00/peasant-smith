import { useRef, useState } from 'react'
import { toPng, toBlob } from 'html-to-image'
import { AXES } from '../config/axes.js'
import { ANIMALS, FALLBACK_ANIMAL } from '../config/presets.js'

const X = 1024 // square export size

// Renders a branded, social-ready share card for the user's result.
//
// Design: a bold, gaming-card-inspired 1:1 (square) card tuned for MOBILE
// legibility on an X post. The persona name is the hero, the 2x2 quadrant
// map is the visual centerpiece, and the two axis scores are shown as LARGE
// stat numbers (not thin bars) so they stay readable when the image is shown
// small on a phone. No URL is baked into the image — the link lives in the
// post text. Square is the best fit for an X in-feed image.
export default function ShareCard({ result }) {
  const { creativity, control, cfg, params } = result
  const exportRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [copiedText, setCopiedText] = useState(false)

  const color = cfg.color

  // The recommended parameters (reference values shown on the card).
  const recParams = {
    temp: params.temperature,
    top_p: params.top_p,
    top_k: params.top_k,
  }

  const shareText =
    `I got ${cfg.label} result as my AI compatibility test, check yours 👇\nhttps://mw00.github.io/peasant-smith/llm-profile/`

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
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2200)
    } catch (e) {
      console.error('Copy image failed:', e)
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
      await copyImage()
      window.open(xIntent, '_blank', 'noopener,noreferrer')
    } catch (e) {
      if (e && e.name === 'AbortError') {
        console.log('Share cancelled by user')
        return
      }
      console.error('Share failed:', e)
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

  const animal = ANIMALS[cfg.key] || FALLBACK_ANIMAL

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
        <CardPortrait creativity={creativity} control={control} cfg={cfg} color={color} recParams={recParams} animal={animal} responsive />
      </div>

      {/* Hidden 1:1 export node (1024x1024) — captured for download/copy */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: '-99999px', width: `${X}px`, height: `${X}px`, pointerEvents: 'none', zIndex: -1 }}>
        <div
          ref={exportRef}
          style={{
            width: `${X}px`, height: `${X}px`, boxSizing: 'border-box',
            background: `radial-gradient(circle at 18% 12%, ${color}26 0%, rgba(0,0,0,0) 46%), radial-gradient(circle at 86% 88%, #8b5cf62b 0%, rgba(0,0,0,0) 46%), linear-gradient(160deg, #0b0c0f 0%, #17131c 52%, #0b0c0f 100%)`,
            border: `1px solid ${color}55`,
            overflow: 'hidden',
          }}
        >
          <CardPortrait creativity={creativity} control={control} cfg={cfg} color={color} recParams={recParams} animal={animal} />
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

// The reference-inspired portrait card: a color-tinted animal portrait on the
// left with the persona name + recommended stats on the right, inside a 1:1
// canvas. `responsive` switches between the on-page (auto-height, Tailwind)
// version and the fixed-offscreen 1024x1024 export (inline styles).
function CardPortrait({ creativity, control, cfg, color, recParams, animal, responsive }) {
  const isBalanced = cfg.label === 'Balanced Generalist'

  // shared visual bits, sized differently for the export vs the page preview
  const outer = responsive
    ? { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 30px', textAlign: 'center' }
    : { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 56px', textAlign: 'center', height: '100%' }

  const portraitBox = responsive
    ? { width: 150, height: 190, borderRadius: 18 }
    : { width: 340, height: 430, borderRadius: 26 }

  const emojiSize = responsive ? 86 : 210

  return (
    <div style={outer}>
      {/* header: brand tab + quadrant badge */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: responsive ? 14 : 26 }}>
        <BrandBlock color={color} compact={responsive} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: responsive ? '6px 10px' : '10px 16px', borderRadius: 999, background: `${color}22`, border: `1px solid ${color}55` }}>
          <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: responsive ? 10 : 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quadrant</span>
          <span style={{ color, fontSize: responsive ? 13 : 17, fontWeight: 800 }}>{isBalanced ? 'Balanced' : cfg.id}</span>
        </div>
      </div>

      {/* eyebrow */}
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: responsive ? 12 : 15, fontWeight: 700, letterSpacing: responsive ? '0.2em' : '0.3em', textTransform: 'uppercase', marginBottom: responsive ? 10 : 18 }}>
        {animal.name} · Your LLM personality
      </div>

      {/* split: animal portrait (left) + name & stats (right) */}
      <div style={{ width: '100%', display: 'flex', flexDirection: responsive ? 'column' : 'row', alignItems: 'center', gap: responsive ? 20 : 44, flex: 1 }}>
        {/* portrait */}
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              ...portraitBox,
              position: 'relative',
              border: `2px solid ${color}66`,
              background: `linear-gradient(160deg, ${color}30 0%, ${color}0f 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 18px 50px ${color}33`,
            }}
          >
            <span style={{ fontSize: emojiSize, filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.4))', lineHeight: 1 }}>{animal.emoji}</span>
            {/* corner tab like the reference's "SP" badge */}
            <div style={{ position: 'absolute', top: 12, left: 12, padding: responsive ? '3px 8px' : '6px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: responsive ? 10 : 14, fontWeight: 800, letterSpacing: '0.08em' }}>{cfg.id || 'Q'}</div>
          </div>
        </div>

        {/* right column: name + special parameters + special power */}
        <div style={{ flex: 1, width: '100%', textAlign: responsive ? 'center' : 'left' }}>
          <div style={{ color: '#fff', fontSize: responsive ? 30 : 56, fontWeight: 800, lineHeight: 1.04, textShadow: `0 0 40px ${color}77` }}>{cfg.label}</div>

          {/* SPECIAL PARAMETERS */}
          <div style={{ marginTop: responsive ? 16 : 30 }}>
            <div style={{ color, fontSize: responsive ? 11 : 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: responsive ? 8 : 14 }}>Special parameters</div>
            <div style={{ display: 'flex', gap: responsive ? 10 : 16 }}>
              {[
                ['temp', recParams.temp],
                ['top_p', recParams.top_p],
                ['top_k', recParams.top_k],
              ].map(([k, v]) => (
                <div key={k} style={{ flex: 1, borderRadius: 14, padding: responsive ? '10px 6px' : '16px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${color}33` }}>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: responsive ? 9 : 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                  <div style={{ color, fontSize: responsive ? 20 : 36, fontWeight: 800, marginTop: 2, lineHeight: 1 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SPECIAL POWER */}
          <div style={{ marginTop: responsive ? 16 : 30 }}>
            <div style={{ color, fontSize: responsive ? 11 : 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: responsive ? 8 : 14 }}>Special power</div>
            <div style={{ display: 'flex', gap: responsive ? 10 : 16 }}>
              <StatChip label={AXES.creativity.creativeLabel} value={Math.round(creativity * 100)} color={color} responsive={responsive} />
              <StatChip label={AXES.control.liberalLabel} value={Math.round(control * 100)} color={color} responsive={responsive} />
            </div>
          </div>
        </div>
      </div>

      {/* footer archetype line */}
      <div style={{ marginTop: responsive ? 16 : 30, color: 'rgba(255,255,255,0.55)', fontSize: responsive ? 12 : 16, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.45, maxWidth: 880 }}>
        “{cfg.archetype}”
      </div>
    </div>
  )
}

// A single axis-score stat chip (the "special power" numbers).
function StatChip({ label, value, color, responsive }) {
  return (
    <div style={{ flex: 1, borderRadius: 14, padding: responsive ? '10px 6px' : '16px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${color}33`, textAlign: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: responsive ? 9 : 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ color, fontSize: responsive ? 22 : 40, fontWeight: 800, marginTop: 2, lineHeight: 1 }}>{value}</div>
    </div>
  )
}


function BrandBlock({ color, compact }) {
  const logo = compact ? 30 : 46
  const title = compact ? 14 : 18
  const sub = compact ? 11 : 13
  return (
    <div className="flex items-center gap-3">
      <div style={{ background: `linear-gradient(135deg, ${color}, #8b5cf6)` }} className="rounded-xl flex items-center justify-center shadow-lg shrink-0" width={logo} height={logo}>
        <svg width={compact ? 16 : 22} height={compact ? 16 : 22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      </div>
      <div className="text-left">
        <div className="text-white font-bold leading-none" style={{ fontSize: title }}>My Inner AI Personality</div>
        <div className="text-white/55 leading-tight mt-0.5" style={{ fontSize: sub }}>Meet the AI that's most like you</div>
      </div>
    </div>
  )
}
