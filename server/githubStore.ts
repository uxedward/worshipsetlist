import fs from 'node:fs'
import path from 'node:path'
import { githubSqliteFromEnv, type GithubSqlite } from '../shared/githubDb.ts'

type GithubContent = {
  sha?: string
  content?: string
  encoding?: string
  message?: string
}

let fileSha: string | null = null

export async function pullGithubDatabase(dest: string): Promise<boolean> {
  const github = githubSqliteFromEnv()
  if (!github) return false
  const body = await readGithubFile(github)
  if (!body) {
    fileSha = null
    return false
  }
  if (!body.content) {
    throw new Error('GitHub returned the database file without contents')
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, Buffer.from(body.content.replace(/\n/g, ''), 'base64'))
  fileSha = body.sha || null
  return true
}

export async function pushGithubDatabase(src: string): Promise<void> {
  const github = githubSqliteFromEnv()
  if (!github) return
  if (!fs.existsSync(src)) return
  await ensureDataBranch(github)
  if (!fileSha) await refreshGithubSha(github)
  await putGithubFile(github, src)
}

async function putGithubFile(github: GithubSqlite, src: string, attempt = 0): Promise<void> {
  const bytes = fs.readFileSync(src)
  const response = await githubFetch(
    github,
    contentsPath(github),
    {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Save Setflow song library',
        content: bytes.toString('base64'),
        branch: github.branch,
        ...(fileSha ? { sha: fileSha } : {}),
      }),
    },
  )
  const body = (await readJson(response)) as { content?: { sha?: string }; message?: string; sha?: string }
  if ((response.status === 409 || response.status === 422) && attempt < 2) {
    await refreshGithubSha(github)
    return putGithubFile(github, src, attempt + 1)
  }
  if (!response.ok) {
    throw new Error(githubError('Could not save the Setflow database to GitHub', response.status, body))
  }
  fileSha = body.content?.sha || body.sha || fileSha
}

async function refreshGithubSha(github: GithubSqlite) {
  const body = await readGithubFile(github)
  fileSha = body?.sha || null
}

async function readGithubFile(github: GithubSqlite): Promise<GithubContent | null> {
  const response = await githubFetch(
    github,
    `${contentsPath(github)}?ref=${encodeURIComponent(github.branch)}`,
  )
  if (response.status === 404) return null
  const body = (await readJson(response)) as GithubContent
  if (!response.ok) {
    throw new Error(githubError('Could not download the Setflow database from GitHub', response.status, body))
  }
  return body
}

async function ensureDataBranch(github: GithubSqlite) {
  const branch = await githubFetch(
    github,
    `/repos/${github.owner}/${github.repo}/git/ref/heads/${encodeURIComponent(github.branch)}`,
  )
  if (branch.status === 200) return
  if (branch.status !== 404) {
    const body = await readJson(branch)
    throw new Error(githubError('Could not read the GitHub data branch', branch.status, body))
  }
  const repo = await githubFetch(github, `/repos/${github.owner}/${github.repo}`)
  const repoBody = (await readJson(repo)) as { default_branch?: string; message?: string }
  if (!repo.ok) {
    throw new Error(githubError('Could not read the GitHub repository', repo.status, repoBody))
  }
  const defaultBranch = repoBody.default_branch || 'main'
  const head = await githubFetch(
    github,
    `/repos/${github.owner}/${github.repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
  )
  const headBody = (await readJson(head)) as { object?: { sha?: string }; message?: string }
  const sha = headBody.object?.sha
  if (!head.ok || !sha) {
    throw new Error(githubError('Could not read the default GitHub branch', head.status, headBody))
  }
  const created = await githubFetch(github, `/repos/${github.owner}/${github.repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${github.branch}`,
      sha,
    }),
  })
  if (!created.ok && created.status !== 422) {
    const createdBody = await readJson(created)
    throw new Error(githubError('Could not create the GitHub data branch', created.status, createdBody))
  }
}

function contentsPath(github: GithubSqlite) {
  const encoded = github.path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `/repos/${github.owner}/${github.repo}/contents/${encoded}`
}

async function githubFetch(github: GithubSqlite, apiPath: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com${apiPath}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${github.token}`,
      'User-Agent': 'setflow-worship-app',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...((init.headers as Record<string, string> | undefined) || {}),
    },
  })
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text }
  }
}

function githubError(prefix: string, status: number, body: { message?: string } | unknown) {
  const message =
    body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message
      : ''
  return message ? `${prefix} (${status}: ${message})` : `${prefix} (${status})`
}
