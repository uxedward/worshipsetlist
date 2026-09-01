import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'
import { parseBulkImport } from '@shared/bulkFormat.ts'
import { parseSpotifyUrl } from '@shared/spotify.ts'
import { endpoints } from '../lib/api.ts'
import { downloadText } from '../lib/pdf.ts'
import { Btn } from './ui.tsx'
import { X } from 'lucide-react'

export function BulkImportModal() {
  const open = useAppStore((s) => s.bulkImportOpen)
  const close = () => useAppStore.getState().setBulkImportOpen(false)
  const { bulkImport, spotifyImport } = useMutations()
  const [tab, setTab] = useState<'charts' | 'spotify'>('spotify')
  const [text, setText] = useState('')
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const preview = useMemo(() => parseBulkImport(text), [text])
  const ready = preview.filter((p) => p.input)
  const skipped = preview.filter((p) => !p.input)
  const spotifyLink = parseSpotifyUrl(spotifyUrl)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[12px] p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-[20px]">Import songs</h3>
          <button type="button" onClick={close} style={{ color: 'var(--text-dim)' }}>
            <X size={16} />
          </button>
        </div>
        <div className="mb-3 flex gap-1">
          <TabBtn active={tab === 'spotify'} onClick={() => setTab('spotify')}>
            Spotify
          </TabBtn>
          <TabBtn active={tab === 'charts'} onClick={() => setTab('charts')}>
            Chord charts
          </TabBtn>
        </div>

        {tab === 'spotify' ? (
          <>
            <p className="mb-2 text-[12px]" style={{ color: 'var(--text-dim)' }}>
              Paste a Spotify playlist, album, or song link. Spotify does not include lyrics, so each
              song is added with an “Add lyrics” placeholder — open Edit to paste your chart.
            </p>
            <input
              value={spotifyUrl}
              onChange={(e) => {
                setSpotifyUrl(e.target.value)
                setResult(null)
                setError(null)
              }}
              placeholder="https://open.spotify.com/playlist/…"
              className="h-10 rounded-[12px] px-3 text-[13px] outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            {spotifyUrl.trim() && !spotifyLink ? (
              <div className="mt-2 text-[12px]" style={{ color: 'var(--warn)' }}>
                That does not look like a Spotify playlist, album, or song link.
              </div>
            ) : null}
            {error ? (
              <div className="mt-2 text-[13px]" style={{ color: 'var(--danger)' }}>
                {error}
              </div>
            ) : null}
            {result ? (
              <div className="mt-2 text-[13px]" style={{ color: 'var(--accent)' }}>
                {result}
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Btn ghost onClick={close}>
                Close
              </Btn>
              <Btn
                accent
                disabled={!spotifyLink || busy}
                onClick={async () => {
                  setBusy(true)
                  setError(null)
                  setResult(null)
                  try {
                    const res = await spotifyImport.mutateAsync(spotifyUrl)
                    setResult(res.message)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not import from Spotify.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? 'Importing…' : 'Import from Spotify'}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-[12px]" style={{ color: 'var(--text-dim)' }}>
              Separate songs with === lines. Each block needs Title and Artist.
            </p>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setResult(null)
              }}
              className="min-h-[220px] flex-1 rounded-[12px] p-3 font-mono text-[12px] outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder={`===\nTitle: Song Name\nArtist: Artist Name\nKey: G\nBPM: 72\nTag: Worship\n\n[Verse 1]\nG              D\nLyric line here\n===`}
            />
            {preview.length > 0 ? (
              <div className="mt-3 max-h-32 overflow-y-auto text-[12px]">
                <div style={{ color: 'var(--text-dim)' }}>
                  {ready.length} will import
                  {skipped.length ? ` · ${skipped.length} skipped` : ''}
                </div>
                {preview.map((p, i) => (
                  <div key={i} className="truncate">
                    {p.input ? p.input.title : `Skipped (${p.skipReason})`}
                  </div>
                ))}
              </div>
            ) : null}
            {result ? (
              <div className="mt-2 text-[13px]" style={{ color: 'var(--accent)' }}>
                {result}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <Btn
                ghost
                onClick={async () => {
                  const body = await endpoints.exportSongs()
                  downloadText('setflow-songs.txt', body)
                }}
              >
                Export all songs
              </Btn>
              <div className="flex gap-2">
                <Btn ghost onClick={close}>
                  Close
                </Btn>
                <Btn
                  accent
                  disabled={ready.length === 0}
                  onClick={async () => {
                    const res = await bulkImport.mutateAsync(text)
                    setResult(res.message)
                  }}
                >
                  Confirm import
                </Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[20px] px-3 py-1 text-[12px]"
      style={
        active
          ? { background: 'var(--accent)', color: '#fff' }
          : { background: 'var(--card)', color: 'var(--text-dim)' }
      }
    >
      {children}
    </button>
  )
}

export function ExportModal({
  setlistName,
  songs,
}: {
  setlistName: string
  songs: Parameters<typeof import('../lib/pdf.ts').exportSetlistPdf>[1]
}) {
  const open = useAppStore((s) => s.exportOpen)
  const close = () => useAppStore.getState().setExportOpen(false)
  const setlistId = useAppStore((s) => s.activeSetlistId)
  const [charts, setCharts] = useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-full max-w-sm rounded-[12px] p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-[20px]">Export {setlistName}</h3>
          <button type="button" onClick={close} style={{ color: 'var(--text-dim)' }}>
            <X size={16} />
          </button>
        </div>
        <label className="mb-4 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={charts} onChange={(e) => setCharts(e.target.checked)} />
          Include full chord charts
        </label>
        <div className="flex justify-end gap-2">
          <Btn ghost onClick={close}>
            Cancel
          </Btn>
          <Btn
            accent
            onClick={async () => {
              const { exportSetlistPdf } = await import('../lib/pdf.ts')
              const { endpoints } = await import('../lib/api.ts')
              const fullSongs = await Promise.all(
                songs.map(async (ss) => {
                  if (ss.song.sections) return ss
                  const song = await endpoints.song(ss.songId)
                  return { ...ss, song }
                }),
              )
              const setlist = setlistId ? await endpoints.setlist(setlistId) : null
              if (setlist) await exportSetlistPdf(setlist, fullSongs, charts)
              close()
            }}
          >
            Download PDF
          </Btn>
        </div>
      </div>
    </div>
  )
}
