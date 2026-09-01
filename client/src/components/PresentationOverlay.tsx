import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'
import type { SetlistSong, PresentationFontSize } from '@shared/types.ts'
import { soundingKey } from '@shared/transpose.ts'
import { LYRICS_PER_SLIDE, firstSlideIndexForSection, slidesFromSections } from '@shared/presentationSlides.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSong } from '../hooks/useQueries.ts'
import { useIsMobile } from '../hooks/useMediaQuery.ts'
import { cn } from '../lib/cn.ts'

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
  const { patchPrefs } = useMutations()
  const isMobile = useIsMobile()
  const [anim, setAnim] = useState<'in' | 'out'>('in')
  const touchX = useRef<number | null>(null)

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
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
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
  }, [open, slide, index, songs, close, setActive, setSlide, slides.length])

  if (!open || !current || !song) return null

  const size = isMobile ? 26 : DESKTOP_SIZE[fontSize]

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col text-white"
      style={{
        background:
          'radial-gradient(ellipse at center, #8B3A0F 0%, #5C2008 35%, #2A0D04 65%, #0D0503 100%)',
      }}
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
      <div className="flex h-11 items-center justify-between px-4">
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
        className="flex flex-1 cursor-pointer flex-col items-center"
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
              textShadow: '0 2px 24px rgba(0,0,0,0.4)',
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

      <div className="flex h-14 items-center justify-between px-4">
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
