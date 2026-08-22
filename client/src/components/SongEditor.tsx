import { useEffect, useMemo, useState } from 'react'
import { Clipboard, X } from 'lucide-react'
import { BPM_MAX, BPM_MIN, KEYS, TAGS, TIME_SIGNATURES } from '@shared/types.ts'
import type { SongInput } from '@shared/types.ts'
import { parseChart, chartToText, hasValidChart } from '@shared/chartParser.ts'
import { parseDuration, formatDuration } from '@shared/duration.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSong } from '../hooks/useQueries.ts'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'
import { Btn, Field, inputClass, inputStyle } from './ui.tsx'
import { ChordChart } from './ChordChart.tsx'

const PLACEHOLDER = `[Verse 1]
G              D
Your lyric line here
Em             C
Next lyric line`

const emptyForm = {
  title: '',
  artist: '',
  album: '',
  key: 'G',
  bpm: '80',
  timeSignature: '4/4',
  tag: 'Worship',
  duration: '',
  chart: '',
}

export function SongEditor() {
  const open = useAppStore((s) => s.editorOpen)
  const songId = useAppStore((s) => s.editorSongId)
  const closeEditor = useAppStore((s) => s.closeEditor)
  const askConfirm = useAppStore((s) => s.askConfirm)
  const { data: existing } = useSong(songId)
  const { createSong, patchSong } = useMutations()

  const [form, setForm] = useState(emptyForm)
  const [baseline, setBaseline] = useState(emptyForm)
  const [previewText, setPreviewText] = useState('')
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!open) return
    if (songId && existing) {
      const chart = existing.sections
        ? chartToText(
            [...existing.sections]
              .sort((a, b) => a.order - b.order)
              .map((s) => ({
                label: s.label,
                lines: [...s.lines]
                  .sort((a, b) => a.order - b.order)
                  .map((l) => ({ chords: l.chords, lyric: l.lyric })),
              })),
          )
        : ''
      const next = {
        title: existing.title,
        artist: existing.artist,
        album: existing.album ?? '',
        key: existing.key,
        bpm: String(existing.bpm),
        timeSignature: existing.timeSignature,
        tag: existing.tag,
        duration: existing.durationSeconds != null ? formatDuration(existing.durationSeconds) : '',
        chart,
      }
      setForm(next)
      setBaseline(next)
      setPreviewText(chart)
      setTried(false)
    } else if (!songId) {
      setForm(emptyForm)
      setBaseline(emptyForm)
      setPreviewText('')
      setTried(false)
    }
  }, [open, songId, existing])

  const debouncedPreview = useDebouncedCallback((text: string) => {
    setPreviewText(text)
  }, 300)

  const parsed = useMemo(() => parseChart(previewText), [previewText])
  const bpmNum = Number(form.bpm)
  const durationSeconds = form.duration.trim() ? parseDuration(form.duration) : null

  const errors = {
    title: !form.title.trim() ? 'Title is required' : '',
    artist: !form.artist.trim() ? 'Artist is required' : '',
    key: !KEYS.includes(form.key as (typeof KEYS)[number]) ? 'Choose a valid key' : '',
    bpm:
      !Number.isFinite(bpmNum) || bpmNum < BPM_MIN || bpmNum > BPM_MAX
        ? `BPM must be ${BPM_MIN}–${BPM_MAX}`
        : '',
    duration: form.duration.trim() && durationSeconds == null ? 'Use mm:ss' : '',
    chart: hasValidChart(parsed.sections) ? '' : 'Add at least one section with a lyric line',
  }
  const valid = !Object.values(errors).some(Boolean)
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)

  const close = () => {
    if (dirty) {
      askConfirm({
        title: 'Discard unsaved changes?',
        message: 'Your chart and metadata will be lost.',
        danger: true,
        confirmLabel: 'Discard',
        onConfirm: closeEditor,
      })
    } else closeEditor()
  }

  const save = async () => {
    setTried(true)
    if (!valid) return
    const body: SongInput = {
      title: form.title.trim(),
      artist: form.artist.trim(),
      album: form.album.trim() || null,
      key: form.key,
      bpm: bpmNum,
      timeSignature: form.timeSignature,
      tag: form.tag,
      durationSeconds,
      sections: parsed.sections.map((s) => ({
        label: s.label,
        order: s.order,
        lines: s.lines.map((l) => ({ chords: l.chords, lyric: l.lyric, order: l.order })),
      })),
    }
    if (songId) await patchSong.mutateAsync({ id: songId, body })
    else await createSong.mutateAsync(body)
    closeEditor()
  }

  const pasteChart = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setForm((f) => ({ ...f, chart: text }))
      setPreviewText(text)
    } catch {
      /* clipboard denied */
    }
  }

  if (!open) return null

  const warningByLine = new Map(parsed.warnings.map((w) => [w.lineIndex, w.message]))

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: 'var(--bg)' }}>
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <div className="text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
            {songId ? 'EDIT SONG' : 'NEW SONG'}
          </div>
          <div className="font-serif text-[20px]">{form.title || 'Untitled'}</div>
        </div>
        <div className="flex items-center gap-2">
          <Btn ghost onClick={close}>
            Cancel
          </Btn>
          <Btn accent disabled={!valid} onClick={() => void save()}>
            Save
          </Btn>
          <button type="button" onClick={close} style={{ color: 'var(--text-dim)' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[340px_1fr]">
        <div className="scrollbar-thin space-y-3 overflow-y-auto p-5" style={{ borderRight: '1px solid var(--border)' }}>
          <Field label="Title *" error={tried ? errors.title : ''}>
            <input
              className={inputClass}
              style={inputStyle}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Artist *" error={tried ? errors.artist : ''}>
            <input
              className={inputClass}
              style={inputStyle}
              value={form.artist}
              onChange={(e) => setForm({ ...form, artist: e.target.value })}
            />
          </Field>
          <Field label="Album">
            <input
              className={inputClass}
              style={inputStyle}
              value={form.album}
              onChange={(e) => setForm({ ...form, album: e.target.value })}
            />
          </Field>
          <Field label="Key" error={tried ? errors.key : ''}>
            <select
              className={inputClass}
              style={inputStyle}
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
            >
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="BPM" error={tried ? errors.bpm : ''}>
            <input
              type="number"
              min={BPM_MIN}
              max={BPM_MAX}
              className={inputClass}
              style={inputStyle}
              value={form.bpm}
              onChange={(e) => setForm({ ...form, bpm: e.target.value })}
            />
          </Field>
          <Field label="Time signature">
            <select
              className={inputClass}
              style={inputStyle}
              value={form.timeSignature}
              onChange={(e) => setForm({ ...form, timeSignature: e.target.value })}
            >
              {TIME_SIGNATURES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tag">
            <select
              className={inputClass}
              style={inputStyle}
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
            >
              {TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duration (mm:ss)" error={tried ? errors.duration : ''}>
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="4:12"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </Field>
          {tried && errors.chart ? (
            <p className="text-[12px]" style={{ color: 'var(--danger)' }}>
              {errors.chart}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
              Chord chart
            </span>
            <Btn ghost onClick={() => void pasteChart()}>
              <Clipboard size={14} /> Paste chart
            </Btn>
          </div>
          <textarea
            value={form.chart}
            onChange={(e) => {
              setForm({ ...form, chart: e.target.value })
              debouncedPreview(e.target.value)
            }}
            placeholder={PLACEHOLDER}
            className="min-h-[220px] flex-1 resize-none rounded-[12px] p-4 font-mono text-[13px] leading-relaxed outline-none"
            style={{
              ...inputStyle,
              fontFamily: 'var(--font-mono)',
              borderRadius: 12,
            }}
          />
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>
            Use [Section Name] for headers. Chord names go on the line above the lyrics they apply to.
          </p>

          <div className="mt-4 min-h-[180px] flex-1 overflow-y-auto rounded-[12px] p-4" style={{ background: 'var(--card)' }}>
            <div className="mb-2 text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
              LIVE PREVIEW
            </div>
            {previewText.trim() ? (
              <>
                <ChordChart
                  sections={parsed.sections.map((s, i) => ({
                    id: `p-${i}`,
                    songId: '',
                    label: s.label,
                    order: s.order,
                    lines: s.lines.map((l, j) => ({
                      id: `p-${i}-${j}`,
                      sectionId: `p-${i}`,
                      chords: l.chords,
                      lyric: l.lyric,
                      order: l.order,
                    })),
                  }))}
                />
                {parsed.warnings.length > 0 ? (
                  <div className="mt-4 space-y-1">
                    {previewText.split('\n').map((line, i) => {
                      const msg = warningByLine.get(i)
                      if (!msg) return null
                      return (
                        <div key={i} className="text-[12px]" title={msg}>
                          <span className="font-mono" style={{ borderBottom: '2px solid var(--warn)' }}>
                            {line || '(empty)'}
                          </span>
                          <span className="ml-2" style={{ color: 'var(--warn)' }}>
                            {msg}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
                Start typing a chart to see the preview.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
