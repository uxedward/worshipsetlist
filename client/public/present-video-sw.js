/* Streams present videos from public Storage parts. Keep in sync with shared/presentVideo.ts. */
const SLICE = 32 * 1024 * 1024
const PREFIX = '/present-media/'
const PART_CACHE_LIMIT = 12
const manifests = new Map()
const partCache = new Map()
const partInflight = new Map()

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

function partBase(manifest) {
  return String(manifest.chunkBaseUrl || '').endsWith('/')
    ? manifest.chunkBaseUrl
    : `${manifest.chunkBaseUrl || ''}/`
}

function rememberPart(key, data) {
  partCache.delete(key)
  partCache.set(key, data)
  while (partCache.size > PART_CACHE_LIMIT) {
    const oldest = partCache.keys().next().value
    partCache.delete(oldest)
  }
}

function loadPart(manifest, index) {
  const key = `${manifest.id}:${index}`
  const cached = partCache.get(key)
  if (cached) {
    partCache.delete(key)
    partCache.set(key, cached)
    return Promise.resolve(cached)
  }
  const pending = partInflight.get(key)
  if (pending) return pending
  const work = fetch(`${partBase(manifest)}${index}`)
    .then(async (res) => {
      if (!res.ok && res.status !== 206) throw new Error('Video part missing.')
      const data = await res.arrayBuffer()
      rememberPart(key, data)
      return data
    })
    .finally(() => {
      if (partInflight.get(key) === work) partInflight.delete(key)
    })
  partInflight.set(key, work)
  return work
}

function prefetchParts(manifest, fromIndex, count) {
  const chunkBytes = Number(manifest.chunkBytes) || 8 * 1024 * 1024
  const lastIndex = Math.max(0, Math.ceil((Number(manifest.sizeBytes) || 0) / chunkBytes) - 1)
  for (let i = 0; i < count; i++) {
    const index = fromIndex + i
    if (index < 0 || index > lastIndex) continue
    void loadPart(manifest, index).catch(() => undefined)
  }
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
  const chunkBytes = Number(manifest.chunkBytes) || 8 * 1024 * 1024
  const first = Math.floor(start / chunkBytes)
  const last = Math.floor(end / chunkBytes)
  prefetchParts(manifest, first, last - first + 3)
  try {
    const loaded = await Promise.all(
      Array.from({ length: last - first + 1 }, (_, offset) => loadPart(manifest, first + offset)),
    )
    const parts = loaded.map((buffer, offset) => {
      const index = first + offset
      const chunkStart = index * chunkBytes
      const from = Math.max(0, start - chunkStart)
      const to = Math.min(buffer.byteLength, end - chunkStart + 1)
      return buffer.slice(from, to)
    })
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
  } catch {
    return new Response('Video not found.', { status: 404 })
  }
}
