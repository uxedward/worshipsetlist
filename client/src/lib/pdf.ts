import { jsPDF } from 'jspdf'
import type { Setlist, SetlistSong } from '@shared/types.ts'
import { soundingKey } from '@shared/transpose.ts'
import { chartToText } from '@shared/chartParser.ts'

function sounding(ss: SetlistSong): string {
  return soundingKey(ss.song.key, ss.transposedKey)
}

export function buildSetlistPlain(songs: SetlistSong[]): string {
  return songs
    .map((ss, i) => `${i + 1}. ${ss.song.title} — ${sounding(ss)} — ${ss.song.bpm} BPM`)
    .join('\n')
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportSetlistPdf(
  setlist: Setlist,
  songs: SetlistSong[],
  includeCharts: boolean,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 54
  let y = 64

  const write = (text: string, size: number, font: 'times' | 'helvetica' = 'helvetica', style: 'normal' | 'bold' = 'normal') => {
    doc.setFont(font, style)
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, pageW - margin * 2)
    for (const line of lines) {
      if (y > 740) {
        doc.addPage()
        y = 64
      }
      doc.text(line, margin, y)
      y += size + 6
    }
  }

  write(setlist.name, 22, 'times', 'bold')
  const meta = [setlist.serviceName, setlist.date ? new Date(setlist.date).toLocaleDateString() : '']
    .filter(Boolean)
    .join('  ·  ')
  if (meta) {
    doc.setTextColor(90)
    write(meta, 11, 'helvetica', 'normal')
    doc.setTextColor(0)
  }
  y += 10

  songs.forEach((ss, i) => {
    write(
      `${i + 1}.  ${ss.song.title}    ${sounding(ss)}    ${ss.song.bpm} BPM    ${ss.song.tag}`,
      12,
      'helvetica',
      'normal',
    )
  })

  if (includeCharts) {
    for (const ss of songs) {
      y += 16
      if (y > 700) {
        doc.addPage()
        y = 64
      }
      write(ss.song.title, 16, 'times', 'bold')
      write(`${ss.song.artist}  ·  Key of ${sounding(ss)}  ·  ${ss.song.bpm} BPM`, 10)
      const sections = [...(ss.song.sections ?? [])].sort((a, b) => a.order - b.order)
      const chart = chartToText(
        sections.map((s) => ({
          label: s.label,
          lines: [...s.lines].sort((a, b) => a.order - b.order).map((l) => ({ chords: l.chords, lyric: l.lyric })),
        })),
      )
      doc.setFont('courier', 'normal')
      doc.setFontSize(9)
      for (const line of chart.split('\n')) {
        if (y > 740) {
          doc.addPage()
          y = 64
        }
        doc.text(line || ' ', margin, y)
        y += 12
      }
      doc.setTextColor(0)
    }
  }

  const filename = `${setlist.name.replace(/[^\w]+/g, '-').toLowerCase()}-setlist.pdf`
  doc.save(filename)
}
