import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Minus, Plus, X } from 'lucide-react'
import type { SetlistSong, PresentationFontSize } from '@shared/types.ts'
import { soundingKey } from '@shared/transpose.ts'
import { LYRICS_PER_SLIDE, firstSlideIndexForSection, slidesFromSections } from '@shared/presentationSlides.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSong } from '../hooks/useQueries.ts'
import { useIsMobile } from '../hooks/useMediaQuery.ts'
import { cn } from '../lib/cn.ts'
import {
  PRESENT_BACKGROUNDS,
  findPresentBackground,
  type PresentBackground,
} from '../lib/presentBackgrounds.ts'

const DESKTOP_SIZE: Record<PresentationFontSize, number> = {
  small: 36,
  medium: 52,
  large: 68,
}

export function PresentationOverlay({ songs }: { songs: SetlistSong[] }) {
  const open = useAppStore((s) => s.presentationOpen)
  const close = useAppStore((s) => s.closePresentation)
  const activeId = useAppStore((s) => s.activeSetlistSongId)
  const setActive = useAppStore((s) => s.setActiveSetlistSongId)
  const slide = useAppStore((s) => s.presentationSection)
  const setSlide = useAppStore((s) => s.setPresentationSection)
  const fontSize = useAppStore((s) => s.fontSize)
  const setFontSize = useAppStore((s) => s.setFontSize)
  const backgroundId = useAppStore((s) => s.presentBackgroundId)
  const setBackgroundId = useAppStore((s) => s.setPresentBackgroundId)
  const { patchPrefs } = useMutations()
  const isMobile = useIsMobile()
  const [anim, setAnim] = useState<'in' | 'out'>('in')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const touchX = useRef<number | null>(null)
  const background = findPresentBackground(backgroundId)

  const selectedIndex = songs.findIndex((s) => s.id === activeId)
  const index = selectedIndex >= 0 ? selectedIndex : 0
  const current = songs[index]
  const { data: full } = useSong(current?.songId ?? null)
  const song = full ?? current?.song

  const sections = useMemo(
    () => [...(song?.sections ?? [])].sort((a, b) => a.order - b.order),
    [song],
  )
  const slides = useMemo(() => slidesFromSections(sections), [sections])
  const currentSlide = slides[slide] ?? slides[0]
  const lyrics = (currentSlide?.lines ?? []).slice(0, LYRICS_PER_SLIDE)
  const key = current ? soundingKey(current.song.key, current.transposedKey) : ''

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
    }, 250)
  }

  const cycleFont = (dir: number) => {
    const order: PresentationFontSize[] = ['small', 'medium', 'large']
    const i = Math.max(0, Math.min(2, order.indexOf(fontSize) + dir))
    const next = order[i]
    setFontSize(next)
    patchPrefs.mutate({ presentationFontSize: next })
  }

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
    if (!open) setPickerOpen(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerOpen) {
          setPickerOpen(false)
          return
        }
        close()
      }
      if (e.key === 'b' || e.key === 'B') {
        setPickerOpen((v) => !v)
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
  }, [open, slide, index, songs, close, setActive, setSlide, slides.length, pickerOpen])

  if (!open || !current || !song) return null

  const size = isMobile ? 26 : DESKTOP_SIZE[fontSize]

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col text-white"
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
      <div className="relative z-10 flex h-11 items-center justify-between px-4">
        <div className="w-[28%] truncate text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
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
              className="shrink-0 rounded-[20px] px-3 py-1 text-[12px]"
              style={
                currentSlide?.sectionIndex === i
                  ? { background: 'var(--accent)', color: '#fff' }
                  : {
                      background: 'rgba(0,0,0,0.25)',
                      border: '0.5px solid rgba(255,255,255,0.2)',
                      color: 'rgba(255,255,255,0.7)',
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
            onClick={() => setPickerOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-[8px]"
            style={{ background: pickerOpen ? 'var(--accent)' : 'rgba(0,0,0,0.25)' }}
          >
            <ImageIcon size={14} />
          </button>
          {[
            { title: 'Smaller', onClick: () => cycleFont(-1), icon: <Minus size={14} /> },
            { title: 'Larger', onClick: () => cycleFont(1), icon: <Plus size={14} /> },
            { title: 'Exit', onClick: close, icon: <X size={14} /> },
          ].map((b) => (
            <button
              key={b.title}
              type="button"
              title={b.title}
              onClick={b.onClick}
              className="flex h-7 w-7 items-center justify-center rounded-[8px]"
              style={{ background: 'rgba(0,0,0,0.25)' }}
            >
              {b.icon}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative z-10 flex flex-1 cursor-pointer flex-col items-center"
        style={{ paddingTop: '18vh' }}
        onClick={() => goSlide(slide + 1)}
      >
        <div
          className={cn(anim === 'out' ? 'lyrics-out' : 'lyrics-in', 'flex flex-col items-center')}
          style={{ maxWidth: '80%' }}
        >
          <div
            className="mb-6 text-[11px] uppercase"
            style={{ letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)' }}
          >
            {currentSlide?.sectionLabel ?? ''}
          </div>
          <div
            className="text-center font-serif font-normal"
            style={{
              fontSize: size,
              lineHeight: 1.45,
              textShadow: '0 2px 28px rgba(0,0,0,0.8), 0 0 18px rgba(0,0,0,0.55)',
            }}
          >
            {lyrics.length > 0 ? (
              lyrics.map((line, i) => <div key={`${i}-${line}`}>{line}</div>)
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.4)' }}>Instrumental</div>
            )}
          </div>
        </div>
      </div>

      {pickerOpen ? (
        <BackgroundPicker
          selectedId={background.id}
          onSelect={setBackgroundId}
        />
      ) : null}

      <div className="relative z-10 flex h-14 items-center justify-between px-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            goSlide(slide - 1)
          }}
          className={cn('rounded-[24px] px-4 py-2 text-[13px]', isMobile && 'min-h-11')}
          style={{ background: 'rgba(0,0,0,0.4)' }}
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
                    ? 'var(--accent)'
                    : i < slide
                      ? 'rgba(255,255,255,0.4)'
                      : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            goSlide(slide + 1)
          }}
          className={cn('rounded-[24px] px-4 py-2 text-[13px]', isMobile && 'min-h-11')}
          style={{ background: 'var(--accent)' }}
        >
          Next <ChevronRight size={14} className="inline" />
        </button>
      </div>
    </div>
  )
}

const DUSK_GRADIENT =
  'radial-gradient(ellipse at center, #8B3A0F 0%, #5C2008 35%, #2A0D04 65%, #0D0503 100%)'

function PresentBackdrop({
  background,
  reduceMotion,
}: {
  background: PresentBackground
  reduceMotion: boolean
}) {
  const showVideo = background.kind === 'video' && Boolean(background.src) && !reduceMotion
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {background.kind === 'gradient' ? (
        <div className="absolute inset-0" style={{ background: DUSK_GRADIENT }} />
      ) : null}
      {background.kind === 'photo' && background.src ? (
        <img src={background.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {showVideo ? (
        <video
          key={background.id}
          className="absolute inset-0 h-full w-full object-cover"
          src={background.src}
          poster={background.poster}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : null}
      {background.kind === 'video' && reduceMotion && background.poster ? (
        <img src={background.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            background.kind === 'gradient'
              ? 'transparent'
              : 'linear-gradient(180deg, rgba(8,4,2,0.28) 0%, rgba(8,4,2,0.42) 45%, rgba(8,4,2,0.62) 100%)',
        }}
      />
    </div>
  )
}

function BackgroundPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (id: string) => void
}) {
  const stills = PRESENT_BACKGROUNDS.filter((bg) => bg.group === 'still')
  const motion = PRESENT_BACKGROUNDS.filter((bg) => bg.group === 'motion')
  return (
    <div
      className="relative z-20 mx-4 mb-3 rounded-[12px] px-4 py-3"
      style={{ background: 'rgba(12,8,6,0.78)', border: '1px solid rgba(255,255,255,0.12)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <BackgroundRow title="Stills" items={stills} selectedId={selectedId} onSelect={onSelect} />
      <BackgroundRow title="Live HD" items={motion} selectedId={selectedId} onSelect={onSelect} />
    </div>
  )
}

function BackgroundRow({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string
  items: PresentBackground[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className={title === 'Live HD' ? 'mt-3' : undefined}>
      <div className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-white/50">{title}</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((bg) => {
          const selected = bg.id === selectedId
          return (
            <button
              key={bg.id}
              type="button"
              onClick={() => onSelect(bg.id)}
              className="shrink-0 overflow-hidden rounded-[10px] text-left"
              style={{
                width: 104,
                border: selected ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <span
                className="block h-14 w-full bg-cover bg-center"
                style={{
                  background:
                    bg.kind === 'gradient'
                      ? DUSK_GRADIENT
                      : `url(${bg.poster ?? bg.src}) center/cover`,
                }}
              />
              <span className="block truncate px-1.5 py-1 text-[11px] text-white/80">{bg.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
