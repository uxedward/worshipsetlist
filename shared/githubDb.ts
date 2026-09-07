export type GithubSqlite = {
  token: string
  owner: string
  repo: string
  path: string
  branch: string
}

export function githubSqliteFromEnv(
  env: Record<string, string | undefined> = process.env,
): GithubSqlite | null {
  const token = (env.GITHUB_DATABASE_TOKEN || env.GH_PAT || '').trim()
  if (!token) return null
  const repo = githubRepoFromEnv(env)
  if (!repo) return null
  return {
    token,
    owner: repo.owner,
    repo: repo.repo,
    path: (env.GITHUB_DATABASE_PATH || 'data/setflow.db').replace(/^\/+/, ''),
    branch: env.GITHUB_DATABASE_BRANCH || 'setflow-data',
  }
}

export function githubRepoFromEnv(
  env: Record<string, string | undefined> = process.env,
): { owner: string; repo: string } | null {
  const explicit = env.GITHUB_DATABASE_REPO || env.GITHUB_REPOSITORY || ''
  if (explicit.includes('/')) {
    const [owner, repo] = explicit.split('/').map((part) => part.trim())
    if (owner && repo) return { owner, repo }
  }
  const owner = env.VERCEL_GIT_REPO_OWNER || env.GITHUB_DATABASE_OWNER || 'uxedward'
  const repo = env.VERCEL_GIT_REPO_SLUG || env.GITHUB_DATABASE_NAME || 'worshipsetlist'
  if (owner && repo) return { owner, repo }
  return null
}
