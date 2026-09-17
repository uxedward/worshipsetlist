/* Streams present videos from public Storage parts. Keep in sync with shared/presentVideo.ts. */
const SLICE = 8 * 1024 * 1024
const PREFIX = '/present-media/'
const manifests = new Map()

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'present-video-manifest' || !data.manifest?.id) return
  manifests.set(data.manifest.id, data.manifest)
  event.ports?.[0]?.postMessage({ ok: true, id: data.manifest.id })
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.startsWith(PREFIX)) return
  const id = decodeURIComponent(url.pathname.slice(PREFIX.length).split('/')[0] || '')
  const manifest = manifests.get(id)
  if (!manifest) return
  event.respondWith(streamPresentVideo(event.request, manifest))
})

function parseRange(header, size) {
  if (!header || size <= 0) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header).trim())
  if (!match) return null
  const rawStart = match[1]
  const rawEnd = match[2]
  if (rawStart === '' && rawEnd === '') return null
  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(rawStart)
  const end = rawEnd === '' ? size - 1 : Number(rawEnd)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null
  }
  return { start, end: Math.min(end, size - 1) }
}

function concat(buffers) {
  const total = buffers.reduce((sum, item) => sum + item.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const item of buffers) {
    out.set(new Uint8Array(item), offset)
    offset += item.byteLength
  }
  return out
}

async function streamPresentVideo(request, manifest) {
  const size = Number(manifest.sizeBytes) || 0
  const mime = manifest.mimeType || 'video/mp4'
  if (size <= 0) return new Response('Video not found.', { status: 404 })
  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
      },
    })
  }
  const requested = parseRange(request.headers.get('Range'), size)
  const start = requested?.start ?? 0
  const rawEnd = requested?.end ?? size - 1
  const end = Math.min(size - 1, rawEnd, start + SLICE - 1)
  const chunkBytes = Number(manifest.chunkBytes) || SLICE
  const base = String(manifest.chunkBaseUrl || '').endsWith('/')
    ? manifest.chunkBaseUrl
    : `${manifest.chunkBaseUrl || ''}/`
  const first = Math.floor(start / chunkBytes)
  const last = Math.floor(end / chunkBytes)
  const parts = []
  for (let index = first; index <= last; index++) {
    const chunkStart = index * chunkBytes
    const from = Math.max(0, start - chunkStart)
    const to = Math.min(chunkBytes - 1, end - chunkStart)
    const res = await fetch(`${base}${index}`, { headers: { Range: `bytes=${from}-${to}` } })
    if (!res.ok && res.status !== 206) {
      return new Response('Video not found.', { status: 404 })
    }
    parts.push(await res.arrayBuffer())
  }
  const body = concat(parts)
  return new Response(body, {
    status: 206,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(body.byteLength),
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${start + body.byteLength - 1}/${size}`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
