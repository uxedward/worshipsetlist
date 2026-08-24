import type { Section } from '@shared/types.ts'
import { transposeChordLine } from '@shared/transpose.ts'
import { cn } from '../lib/cn.ts'

export function ChordChart({
  sections,
  lyricsOnly,
  semitones,
  preferFlats,
  highlightSection,
}: {
  sections: Section[]
  lyricsOnly?: boolean
  semitones?: number
  preferFlats?: boolean
  highlightSection?: number
}) {
  const sorted = [...sections].sort((a, b) => a.order - b.order)
  return (
    <div className="space-y-5">
      {sorted.map((section, i) => (
        <div
          key={section.id || `${section.label}-${i}`}
          className={cn(highlightSection === i && 'rounded-[8px]')}
          style={highlightSection === i ? { outline: '1px solid var(--accent)' } : undefined}
        >
          <div
            className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--text-dim)' }}
          >
            {section.label}
          </div>
          <div className="space-y-1.5">
            {[...section.lines]
              .sort((a, b) => a.order - b.order)
              .map((line) => (
                <div key={line.id || `${line.order}`}>
                  {!lyricsOnly && line.chords?.trim() ? (
                    <pre
                      className="m-0 font-mono text-[13px] font-bold leading-[1.35]"
                      style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
                    >
                      {transposeChordLine(line.chords, semitones ?? 0, preferFlats ?? false)}
                    </pre>
                  ) : null}
                  {line.lyric?.trim() ? (
                    <p className="m-0 text-[16px] leading-[1.6]" style={{ color: 'var(--text)' }}>
                      {line.lyric}
                    </p>
                  ) : null}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
