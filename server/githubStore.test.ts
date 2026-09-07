import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pullGithubDatabase, pushGithubDatabase } from './githubStore.ts'

const originalFetch = globalThis.fetch

describe('githubStore', () => {
  const tmp = path.join(os.tmpdir(), `setflow-github-test-${process.pid}.db`)

  beforeEach(() => {
    process.env.GITHUB_DATABASE_TOKEN = 'ghp_test'
    process.env.GITHUB_DATABASE_REPO = 'uxedward/worshipsetlist'
    fs.writeFileSync(tmp, 'sqlite-bytes')
  })

  afterEach(() => {
    delete process.env.GITHUB_DATABASE_TOKEN
    delete process.env.GITHUB_DATABASE_REPO
    globalThis.fetch = originalFetch
    try {
      fs.unlinkSync(tmp)
    } catch {
      // ignore
    }
  })

  it('downloads the sqlite file from GitHub contents', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input)
      expect(url).toContain('/repos/uxedward/worshipsetlist/contents/data/setflow.db')
      return new Response(
        JSON.stringify({
          sha: 'abc123',
          content: Buffer.from('from-github').toString('base64'),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch

    await expect(pullGithubDatabase(tmp)).resolves.toBe(true)
    expect(fs.readFileSync(tmp, 'utf8')).toBe('from-github')
  })

  it('uploads the sqlite file to a missing data branch', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input)
      calls.push(`${init?.method || 'GET'} ${url}`)
      if (url.endsWith('/contents/data/setflow.db') && init?.method === 'PUT') {
        return new Response(JSON.stringify({ content: { sha: 'newsha' } }), { status: 200 })
      }
      if (url.includes('/git/ref/heads/setflow-data')) {
        return new Response('{}', { status: 404 })
      }
      if (url.endsWith('/repos/uxedward/worshipsetlist')) {
        return new Response(JSON.stringify({ default_branch: 'main' }), { status: 200 })
      }
      if (url.includes('/git/ref/heads/main')) {
        return new Response(JSON.stringify({ object: { sha: 'mainsha' } }), { status: 200 })
      }
      if (url.endsWith('/git/refs') && init?.method === 'POST') {
        return new Response('{}', { status: 201 })
      }
      if (url.includes('/contents/data/setflow.db')) {
        return new Response('{}', { status: 404 })
      }
      return new Response('unexpected ' + url, { status: 500 })
    }) as typeof fetch

    await pushGithubDatabase(tmp)
    expect(calls.some((call) => call.startsWith('PUT ') && call.includes('/contents/data/setflow.db'))).toBe(true)
    expect(calls.some((call) => call.startsWith('POST ') && call.endsWith('/git/refs'))).toBe(true)
  })
})
