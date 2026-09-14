import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  deleteLocalMedia,
  findLocalMedia,
  isBlobUploadBody,
  presentVideoBucketCreateBody,
  saveLocalMedia,
  supabaseConfig,
  videoHostingStatus,
} from './videoHosting.ts'

describe('present video hosting', () => {
  it('always hosts uploads in the Postgres database', () => {
    expect(
      videoHostingStatus({
        BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'key',
        VERCEL: '1',
      }),
    ).toMatchObject({ provider: 'database', hostingEnabled: true, blobEnabled: true, supabaseEnabled: true })
    expect(videoHostingStatus({ VERCEL: '1' })).toMatchObject({
      provider: 'database',
      hostingEnabled: true,
    })
    expect(videoHostingStatus({})).toMatchObject({ provider: 'database', hostingEnabled: true })
  })

  it('reads supabase config from common env names', () => {
    expect(
      supabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co/',
        SUPABASE_ANON_KEY: 'anon',
      }),
    ).toEqual({ url: 'https://example.supabase.co', key: 'anon' })
    expect(supabaseConfig({})).toBeNull()
  })

  it('creates a public present-videos bucket without a 1GB file cap that Supabase rejects', () => {
    expect(presentVideoBucketCreateBody()).toEqual({
      id: 'present-videos',
      name: 'present-videos',
      public: true,
    })
    expect(presentVideoBucketCreateBody()).not.toHaveProperty('file_size_limit')
  })

  it('detects Vercel Blob client upload bodies', () => {
    expect(isBlobUploadBody({ type: 'blob.generate-client-token', payload: {} })).toBe(true)
    expect(isBlobUploadBody({ id: 'custom-1', filename: 'clip.mp4' })).toBe(false)
  })

  it('stores a local video file under its custom id', async () => {
    const id = 'custom-hosting-test'
    deleteLocalMedia(id)
    const src = await saveLocalMedia(id, 'clip.mp4', Readable.from(Buffer.from('fake-mp4-bytes')) as never)
    expect(src).toBe('/api/backgrounds/media/custom-hosting-test')
    expect(findLocalMedia(id)).toBeTruthy()
    deleteLocalMedia(id)
    expect(findLocalMedia(id)).toBeNull()
  })
})
