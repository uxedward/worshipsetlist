import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Minus, Plus, Settings, Trash2, X } from 'lucide-react'
import type { SetlistSong } from '@shared/types.ts'
import { soundingKey } from '@shared/transpose.ts'
import { LYRICS_PER_SLIDE, displaySections, firstSlideIndexForSection, slidesFromSections } from '@shared/presentationSlides.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSong } from '../hooks/useQueries.ts'
import { useIsMobile } from '../hooks/useMediaQuery.ts'
import { cn } from '../lib/cn.ts'
import { endpoints } from '../lib/api.ts'
import {
  DEFAULT_PRESENT_BACKGROUND,
  PRESENT_BACKGROUNDS,
  findPresentBackground,
  pickPresentVideoSrc,
  currentViewport,
  presentBackgroundFill,
  type PresentBackground,
} from '../lib/presentBackgrounds.ts'
import {
  addCustomBackgroundFile,
  deleteCustomBackground,
  loadCustomBackgrounds,
  mergeCustomBackgrounds,
  promoteCustomBackgroundSrc,
} from '../lib/customPresentBackgrounds.ts'
import {
  FONT_MAX,
  FONT_MIN,
  LINE_WIDTH_MAX,
  LINE_WIDTH_MIN,
  PRESENT_FONTS,
  PRESENT_STROKES,
  coarseFontSize,
  findPresentFont,
  fittedFontSize,
  lyricTextShadow,
  presentFontFamily,
  type PresentFontId,
  type PresentStrokeId,
} from '../lib/presentSettings.ts'
import './presentFonts.css'

export function PresentationOverlay({ songs }: { songs: SetlistSong[] }) {
  const open = useAppStore((s) => s.presentationOpen)
  const close = useAppStore((s) => s.closePresentation)
  const activeId = useAppStore((s) => s.activeSetlistSongId)
  const setActive = useAppStore((s) => s.setActiveSetlistSongId)
  const slide = useAppStore((s) => s.presentationSection)
  const setSlide = useAppStore((s) => s.setPresentationSection)
  const setFontSize = useAppStore((s) => s.setFontSize)
  const backgroundId = useAppStore((s) => s.presentBackgroundId)
  const setBackgroundId = useAppStore((s) => s.setPresentBackgroundId)
  const presentSettings = useAppStore((s) => s.presentSettings)
  const setPresentSettings = useAppStore((s) => s.setPresentSettings)
  const { patchPrefs } = useMutations()
  const isMobile = useIsMobile()
  const [anim, setAnim] = useState<'in' | 'out'>('in')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [fittedSize, setFittedSize] = useState(presentSettings.fontSize)
  const [customBackgrounds, setCustomBackgrounds] = useState<PresentBackground[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const touchX = useRef<number | null>(null)
  const lyricsBoxRef = useRef<HTMLDivElement>(null)
  const background = findPresentBackground(backgroundId, customBackgrounds)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const local = await loadCustomBackgrounds()
      if (!cancelled) setCustomBackgrounds(local)
      try {
        const remote = await endpoints.backgrounds()
        if (cancelled) return
        setCustomBackgrounds(mergeCustomBackgrounds(local, remote.backgrounds))
      } catch {
        /* local uploads still work without the API */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedIndex = songs.findIndex((s) => s.id === activeId)
  const index = selectedIndex >= 0 ? selectedIndex : 0
  const current = songs[index]
  const { data: full } = useSong(current?.songId ?? null)
  const song = full ?? current?.song

  const sections = useMemo(
    () => displaySections(song?.sections, song?.id),
    [song],
  )
  const slides = useMemo(() => slidesFromSections(sections), [sections])
  const currentSlide = slides[slide] ?? slides[0]
  const lyrics = (currentSlide?.lines ?? []).slice(0, LYRICS_PER_SLIDE)
  const key = current ? soundingKey(current.song.key, current.transposedKey) : ''
  const minSize = FONT_MIN
  const preferredSize = presentSettings.fontSize

  const lastCoarse = useRef(coarseFontSize(presentSettings.fontSize))

  const applyFontSize = (next: number) => {
    setPresentSettings({ fontSize: next })
    const coarse = coarseFontSize(next)
    setFontSize(coarse)
    if (lastCoarse.current !== coarse) {
      lastCoarse.current = coarse
      patchPrefs.mutate({ presentationFontSize: coarse })
    }
  }

  const goSlide = (next: number) => {
    if (next < 0) {
      if (index > 0) {
        setActive(songs[index - 1].id)
        setSlide(0)
      }
      return
    }
    if (next >= slides.length) {
      if (index < songs.length - 1) {
        setActive(songs[index + 1].id)
        setSlide(0)
      }
      return
    }
    setAnim('out')
    window.setTimeout(() => {
      setSlide(next)
      setAnim('in')
    }, 150)
  }

  const nudgeFont = (dir: number) => {
    applyFontSize(presentSettings.fontSize + dir * 4)
  }

  useLayoutEffect(() => {
    const el = lyricsBoxRef.current
    if (!el) return

    const fit = () => {
      let size = preferredSize
      el.style.fontSize = `${size}px`
      for (let i = 0; i < 24; i++) {
        const width = el.clientWidth
        const longest = Math.max(
          el.scrollWidth,
          ...Array.from(el.children).map((child) => (child as HTMLElement).scrollWidth),
        )
        if (width <= 1 || longest <= width + 1 || size <= minSize) break
        size = fittedFontSize(size, longest, width * 0.98, minSize)
        el.style.fontSize = `${size}px`
      }
      setFittedSize((prev) => (prev === size ? prev : size))
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    const family = findPresentFont(presentSettings.fontId).family.split(',')[0]
    const weight = findPresentFont(presentSettings.fontId).weight
    const loaded = document.fonts?.load?.(`${weight} ${preferredSize}px ${family}`)
    if (loaded) void loaded.then(fit).catch(() => undefined)
    return () => observer.disconnect()
  }, [lyrics, preferredSize, minSize, presentSettings.lineWidth, presentSettings.fontId])

  useEffect(() => {
    if (slides.length === 0) {
      if (slide !== 0) setSlide(0)
      return
    }
    if (slide >= slides.length) setSlide(0)
  }, [song?.id, slides.length, slide, setSlide])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!open) return
    let hideTimer = 0
    const show = () => {
      setChromeVisible(true)
      window.clearTimeout(hideTimer)
      if (pickerOpen || settingsOpen) return
      hideTimer = window.setTimeout(() => setChromeVisible(false), 2000)
    }
    show()
    window.addEventListener('mousemove', show)
    window.addEventListener('touchstart', show)
    return () => {
      window.clearTimeout(hideTimer)
      window.removeEventListener('mousemove', show)
      window.removeEventListener('touchstart', show)
    }
  }, [open, pickerOpen, settingsOpen])

  useEffect(() => {
    if (!open) {
      setPickerOpen(false)
      setSettingsOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const fromSlider = (e.target as HTMLElement | null)?.tagName === 'INPUT'
      if (e.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false)
          return
        }
        if (pickerOpen) {
          setPickerOpen(false)
          return
        }
        close()
      }
      if (fromSlider) return
      if (e.key === 'b' || e.key === 'B') {
        setPickerOpen((v) => !v)
        setSettingsOpen(false)
      }
      if (e.key === 's' || e.key === 'S') {
        setSettingsOpen((v) => !v)
        setPickerOpen(false)
      }
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault()
        goSlide(slide + 1)
      }
      if (e.key === 'ArrowLeft') goSlide(slide - 1)
      if (e.key === 'n' || e.key === 'N') {
        if (index < songs.length - 1) {
          setActive(songs[index + 1].id)
          setSlide(0)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, slide, index, songs, close, setActive, setSlide, slides.length, pickerOpen, settingsOpen])

  if (!open || !current || !song) return null

  return (
    <div
      data-theme="dark"
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ color: 'var(--text-primary)' }}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchX.current
        const end = e.changedTouches[0]?.clientX
        if (start == null || end == null) return
        const dx = end - start
        if (dx < -40) goSlide(slide + 1)
        if (dx > 40) goSlide(slide - 1)
      }}
    >
      <PresentBackdrop background={background} reduceMotion={reduceMotion} />
      <div
        className="relative z-10 flex h-11 items-center justify-between px-4 transition-opacity duration-150"
        style={{
          opacity: chromeVisible || pickerOpen || settingsOpen ? 1 : 0,
          pointerEvents: chromeVisible || pickerOpen || settingsOpen ? 'auto' : 'none',
        }}
      >
        <div className="w-[28%] truncate text-label" style={{ color: 'var(--text-secondary)' }}>
          {song.title} · {index + 1} of {songs.length} · {key}
        </div>
        <div className="flex max-w-[44%] gap-1.5 overflow-x-auto">
          {sections.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                const target = firstSlideIndexForSection(slides, i)
                setAnim('out')
                window.setTimeout(() => {
                  setSlide(target)
                  setAnim('in')
                }, 180)
              }}
              className="shrink-0 rounded-[8px] px-3 py-1 text-caption"
              style={
                currentSlide?.sectionIndex === i
                  ? { background: 'var(--surface-2)', color: 'var(--text-primary)' }
                  : {
                      background: 'var(--present-scrim)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-secondary)',
                    }
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex w-[28%] justify-end gap-1">
          <button
            type="button"
            title="Backgrounds"
            aria-label="Backgrounds"
            onClick={() => {
              setPickerOpen((v) => !v)
              setSettingsOpen(false)
            }}
            className="flex h-7 w-7 items-center justify-center rounded-[8px]"
            style={{ background: pickerOpen ? 'var(--surface-2)' : 'var(--present-scrim)' }}
          >
            <ImageIcon size={14} />
          </button>
          <button
            type="button"
            title="Text settings"
            aria-label="Text settings"
            onClick={() => {
              setSettingsOpen((v) => !v)
              setPickerOpen(false)
            }}
            className="flex h-7 w-7 items-center justify-center rounded-[8px]"
            style={{ background: settingsOpen ? 'var(--surface-2)' : 'var(--present-scrim)' }}
          >
            <Settings size={14} />
          </button>
          {[
            { title: 'Smaller', onClick: () => nudgeFont(-1), icon: <Minus size={14} /> },
            { title: 'Larger', onClick: () => nudgeFont(1), icon: <Plus size={14} /> },
            { title: 'Exit', onClick: close, icon: <X size={14} /> },
          ].map((b) => (
            <button
              key={b.title}
              type="button"
              title={b.title}
              aria-label={b.title}
              onClick={b.onClick}
              className="flex h-7 w-7 items-center justify-center rounded-[8px]"
              style={{ background: 'var(--present-scrim)' }}
            >
              {b.icon}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative z-10 flex flex-1 cursor-pointer flex-col items-center"
        style={{ paddingTop: '16vh' }}
        onClick={() => goSlide(slide + 1)}
      >
        <div
          className={cn(anim === 'out' ? 'lyrics-out' : 'lyrics-in', 'relative flex flex-col items-center')}
          style={{ width: `${presentSettings.lineWidth}%`, maxWidth: '96%' }}
        >
          <div
            className="relative mb-6 text-caption"
            style={{ color: 'var(--text-muted)' }}
          >
            {currentSlide?.sectionLabel ?? ''}
          </div>
          <div
            ref={lyricsBoxRef}
            className="relative w-full text-center"
            style={{
              fontFamily: presentFontFamily(presentSettings.fontId),
              fontSize: Math.max(fittedSize, FONT_MIN),
              lineHeight: 1.28,
              letterSpacing: findPresentFont(presentSettings.fontId).tracking ?? 'normal',
              color: 'var(--present-lyric)',
              fontWeight: findPresentFont(presentSettings.fontId).weight,
              textShadow: lyricTextShadow(presentSettings.shadow, presentSettings.strokeId),
            }}
          >
            {lyrics.length > 0 ? (
              lyrics.map((line, i) => (
                <div
                  key={`${i}-${line}`}
                  className="overflow-hidden"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {line}
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>Instrumental</div>
            )}
          </div>
        </div>
      </div>

      {pickerOpen ? (
        <BackgroundPicker
          selectedId={background.id}
          customItems={customBackgrounds}
          uploading={uploading}
          error={uploadError}
          onSelect={setBackgroundId}
          onUpload={async (file) => {
            setUploadError(null)
            setUploading(true)
            try {
              const created = await addCustomBackgroundFile(file)
              setCustomBackgrounds((prev) => [...prev.filter((bg) => bg.id !== created.id), created])
              setBackgroundId(created.id)
              try {
                const remote = await endpoints.backgrounds()
                if (remote.blobEnabled) {
                  const { upload } = await import('@vercel/blob/client')
                  const blob = await upload(file.name, file, {
                    access: 'public',
                    handleUploadUrl: '/api/backgrounds/upload',
                  })
                  const saved = await endpoints.createBackground({
                    id: created.id,
                    label: created.label,
                    src: blob.url,
                    poster: created.poster,
                  })
                  await promoteCustomBackgroundSrc(created.id, saved.src ?? blob.url)
                  setCustomBackgrounds((prev) =>
                    prev.map((bg) => (bg.id === created.id ? { ...bg, ...saved, src: saved.src ?? blob.url } : bg)),
                  )
                }
              } catch {
                /* keep the local copy if remote hosting is unavailable */
              }
            } catch (err) {
              setUploadError(err instanceof Error ? err.message : 'Could not add that video.')
            } finally {
              setUploading(false)
            }
          }}
          onDelete={(id) => {
            useAppStore.getState().askConfirm({
              title: 'Delete this background?',
              message: 'This removes the uploaded video from Present mode.',
              danger: true,
              confirmLabel: 'Delete',
              onConfirm: () => {
                void (async () => {
                  await deleteCustomBackground(id)
                  setCustomBackgrounds((prev) => prev.filter((bg) => bg.id !== id))
                  if (backgroundId === id) setBackgroundId(DEFAULT_PRESENT_BACKGROUND)
                  try {
                    await endpoints.deleteBackground(id)
                  } catch {
                    /* local delete still stands */
                  }
                })()
              },
            })
          }}
        />
      ) : null}
      {settingsOpen ? (
        <PresentSettingsPanel
          fontId={presentSettings.fontId}
          fontSize={presentSettings.fontSize}
          lineWidth={presentSettings.lineWidth}
          shadow={presentSettings.shadow}
          strokeId={presentSettings.strokeId}
          onFontId={(fontId) => setPresentSettings({ fontId })}
          onFontSize={applyFontSize}
          onLineWidth={(lineWidth) => setPresentSettings({ lineWidth })}
          onShadow={(shadow) => setPresentSettings({ shadow })}
          onStrokeId={(strokeId) => setPresentSettings({ strokeId })}
        />
      ) : null}

      <div
        className="relative z-10 flex h-14 items-center justify-between px-4 transition-opacity duration-150"
        style={{
          opacity: chromeVisible || pickerOpen || settingsOpen ? 1 : 0,
          pointerEvents: chromeVisible || pickerOpen || settingsOpen ? 'auto' : 'none',
        }}
      >
        <button
          type="button"
          aria-label="Previous slide"
          onClick={(e) => {
            e.stopPropagation()
            goSlide(slide - 1)
          }}
          className={cn('rounded-[24px] px-4 py-2 text-label', isMobile && 'min-h-11')}
          style={{ background: 'var(--present-scrim)' }}
        >
          <ChevronLeft size={14} className="inline" /> Prev
        </button>
        <div className="flex max-w-[50%] items-center gap-1.5 overflow-x-auto">
          {slides.map((s, i) => (
            <span
              key={`${s.sectionLabel}-${i}`}
              className="h-2 shrink-0 rounded-full"
              style={{
                width: i === slide ? 8 : 6,
                background:
                  i === slide
                    ? 'var(--text-primary)'
                    : i < slide
                      ? 'var(--text-muted)'
                      : 'var(--text-disabled)',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next slide"
          onClick={(e) => {
            e.stopPropagation()
            goSlide(slide + 1)
          }}
          className={cn('rounded-[24px] px-4 py-2 text-label', isMobile && 'min-h-11')}
          style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
        >
          Next <ChevronRight size={14} className="inline" />
        </button>
      </div>
    </div>
  )
}

function PresentBackdrop({
  background,
  reduceMotion,
}: {
  background: PresentBackground
  reduceMotion: boolean
}) {
  const videoSrc = pickPresentVideoSrc(background, currentViewport())
  const showVideo = background.kind === 'video' && Boolean(videoSrc) && !reduceMotion
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {background.kind === 'gradient' ? (
        <div className="absolute inset-0" style={{ background: presentBackgroundFill(background) }} />
      ) : null}
      {background.kind === 'photo' && background.src ? (
        <img src={background.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {showVideo ? (
        <video
          key={`${background.id}-${videoSrc}`}
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          poster={background.poster}
          preload="metadata"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : null}
      {background.kind === 'video' && reduceMotion && background.poster ? (
        <img src={background.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {background.kind !== 'gradient' ? (
        <div className="absolute inset-0" style={{ background: 'var(--present-scrim)' }} />
      ) : null}
    </div>
  )
}

function PresentSettingsPanel({
  fontId,
  fontSize,
  lineWidth,
  shadow,
  strokeId,
  onFontId,
  onFontSize,
  onLineWidth,
  onShadow,
  onStrokeId,
}: {
  fontId: PresentFontId
  fontSize: number
  lineWidth: number
  shadow: number
  strokeId: PresentStrokeId
  onFontId: (id: PresentFontId) => void
  onFontSize: (n: number) => void
  onLineWidth: (n: number) => void
  onShadow: (n: number) => void
  onStrokeId: (id: PresentStrokeId) => void
}) {
  return (
    <div
      className="relative z-20 mx-4 mb-3 rounded-[12px] px-4 py-3"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 text-label" style={{ color: 'var(--text-muted)' }}>
        Text
      </div>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {PRESENT_FONTS.map((font) => {
          const selected = font.id === fontId
          return (
            <button
              key={font.id}
              type="button"
              onClick={() => onFontId(font.id)}
              className="shrink-0 rounded-[8px] px-2 py-1.5 text-left"
              style={{
                width: 110,
                border: selected ? '2px solid var(--border-strong)' : '2px solid var(--border)',
                background: selected ? 'var(--surface-3)' : 'var(--canvas)',
              }}
              aria-pressed={selected}
              aria-label={font.label}
            >
              <span
                className="block text-center text-title"
                style={{
                  fontFamily: font.family,
                  fontWeight: font.weight,
                  color: 'var(--text-primary)',
                }}
              >
                Aa
              </span>
              <span className="mt-1 block truncate text-center text-caption" style={{ color: 'var(--text-secondary)' }}>
                {font.label}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mb-2 text-label" style={{ color: 'var(--text-muted)' }}>
        Stroke
      </div>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {PRESENT_STROKES.map((stroke) => {
          const selected = stroke.id === strokeId
          return (
            <button
              key={stroke.id}
              type="button"
              onClick={() => onStrokeId(stroke.id)}
              className="flex shrink-0 flex-col items-center gap-1 rounded-[8px] px-2 py-1.5"
              style={{
                width: 64,
                border: selected ? '2px solid var(--border-strong)' : '2px solid var(--border)',
                background: selected ? 'var(--surface-3)' : 'var(--canvas)',
              }}
              aria-pressed={selected}
              aria-label={`${stroke.label} stroke`}
            >
              <span
                className="block h-6 w-6 rounded-full"
                style={{
                  background: stroke.id === 'off' ? 'transparent' : stroke.fill,
                  border: stroke.id === 'white' || stroke.id === 'off' ? '1px solid var(--border-strong)' : '1px solid transparent',
                  backgroundImage:
                    stroke.id === 'off'
                      ? 'linear-gradient(135deg, transparent 46%, var(--danger) 46%, var(--danger) 54%, transparent 54%)'
                      : undefined,
                }}
              />
              <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                {stroke.label}
              </span>
            </button>
          )
        })}
      </div>
      <PresentSlider
        label="Size"
        value={fontSize}
        min={FONT_MIN}
        max={FONT_MAX}
        onChange={onFontSize}
      />
      <PresentSlider
        label="Line width"
        value={lineWidth}
        min={LINE_WIDTH_MIN}
        max={LINE_WIDTH_MAX}
        suffix="%"
        onChange={onLineWidth}
      />
      <PresentSlider label="Stroke weight" value={shadow} min={0} max={100} onChange={onShadow} />
    </div>
  )
}

function PresentSlider({
  label,
  value,
  min,
  max,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (n: number) => void
}) {
  return (
    <label className="flex items-center gap-3 py-1.5">
      <span className="w-[7.2rem] shrink-0 text-caption" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        className="present-slider min-h-8 flex-1"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-11 text-right text-caption tabular" style={{ color: 'var(--text-muted)' }}>
        {value}
        {suffix}
      </span>
    </label>
  )
}

function BackgroundPicker({
  selectedId,
  customItems,
  uploading,
  error,
  onSelect,
  onUpload,
  onDelete,
}: {
  selectedId: string
  customItems: PresentBackground[]
  uploading: boolean
  error: string | null
  onSelect: (id: string) => void
  onUpload: (file: File) => void
  onDelete: (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const gradients = PRESENT_BACKGROUNDS.filter((bg) => bg.kind === 'gradient')
  const stills = PRESENT_BACKGROUNDS.filter((bg) => bg.group === 'still' && bg.kind !== 'gradient')
  const motion = PRESENT_BACKGROUNDS.filter((bg) => bg.group === 'motion')
  return (
    <div
      className="relative z-20 mx-4 mb-3 rounded-[12px] px-4 py-3"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <BackgroundRow title="Your videos" selectedId={selectedId} onSelect={onSelect}>
        {customItems.map((bg) => (
          <BackgroundThumb
            key={bg.id}
            background={bg}
            selected={bg.id === selectedId}
            onSelect={() => onSelect(bg.id)}
            onDelete={() => onDelete(bg.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex h-[86px] w-[104px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] text-caption"
          style={{
            border: '2px dashed var(--border-strong)',
            color: 'var(--text-secondary)',
          }}
        >
          <Plus size={16} />
          {uploading ? 'Uploading…' : 'Add video'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onUpload(file)
          }}
        />
      </BackgroundRow>
      {error ? (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--warning)' }}>
          {error}
        </p>
      ) : null}
      <BackgroundRow title="Gradients" items={gradients} selectedId={selectedId} onSelect={onSelect} />
      <BackgroundRow title="Stills" items={stills} selectedId={selectedId} onSelect={onSelect} />
      <BackgroundRow title="Live HD" items={motion} selectedId={selectedId} onSelect={onSelect} />
    </div>
  )
}

function BackgroundThumb({
  background,
  selected,
  onSelect,
  onDelete,
}: {
  background: PresentBackground
  selected: boolean
  onSelect: () => void
  onDelete?: () => void
}) {
  return (
    <div className="relative shrink-0" style={{ width: 104 }}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full overflow-hidden rounded-[10px] text-left"
        style={{
          border: selected ? '2px solid var(--text-primary)' : '2px solid var(--border)',
        }}
      >
        <span
          className="block h-14 w-full bg-cover bg-center"
          style={{
            background:
              background.kind === 'gradient'
                ? presentBackgroundFill(background)
                : background.poster || background.src
                  ? `url(${background.poster ?? background.src}) center/cover`
                  : 'var(--surface-1)',
          }}
        />
        <span className="block truncate px-1.5 py-1 text-caption" style={{ color: 'var(--text-secondary)' }}>
          {background.label}
        </span>
      </button>
      {onDelete ? (
        <button
          type="button"
          title={`Delete ${background.label}`}
          aria-label={`Delete ${background.label}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-[8px]"
          style={{ background: 'var(--present-scrim)', color: 'var(--text-primary)' }}
        >
          <Trash2 size={12} />
        </button>
      ) : null}
    </div>
  )
}

function BackgroundRow({
  title,
  items,
  selectedId,
  onSelect,
  children,
}: {
  title: string
  items?: PresentBackground[]
  selectedId: string
  onSelect: (id: string) => void
  children?: ReactNode
}) {
  return (
    <div className={title === 'Your videos' ? undefined : 'mt-3'}>
      <div className="mb-2 text-label" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>
      <div className="scrollbar-hidden flex gap-2 overflow-x-auto">
        {items?.map((bg) => (
          <BackgroundThumb
            key={bg.id}
            background={bg}
            selected={bg.id === selectedId}
            onSelect={() => onSelect(bg.id)}
          />
        ))}
        {children}
      </div>
    </div>
  )
}
