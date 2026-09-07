import { describe, expect, it } from 'vitest'
import { githubRepoFromEnv, githubSqliteFromEnv } from './githubDb.ts'

describe('githubSqliteFromEnv', () => {
  it('is inactive without a token', () => {
    expect(
      githubSqliteFromEnv({
        VERCEL_GIT_REPO_OWNER: 'uxedward',
        VERCEL_GIT_REPO_SLUG: 'worshipsetlist',
      }),
    ).toBeNull()
  })

  it('reads a GitHub PAT and defaults the data branch', () => {
    expect(
      githubSqliteFromEnv({
        GITHUB_DATABASE_TOKEN: 'ghp_test',
        GITHUB_REPOSITORY: 'uxedward/worshipsetlist',
      }),
    ).toEqual({
      token: 'ghp_test',
      owner: 'uxedward',
      repo: 'worshipsetlist',
      path: 'data/setflow.db',
      branch: 'setflow-data',
    })
  })

  it('uses Vercel git metadata when GITHUB_REPOSITORY is unset', () => {
    expect(
      githubRepoFromEnv({
        VERCEL_GIT_REPO_OWNER: 'uxedward',
        VERCEL_GIT_REPO_SLUG: 'worshipsetlist',
      }),
    ).toEqual({ owner: 'uxedward', repo: 'worshipsetlist' })
  })

  it('accepts GH_PAT and a custom path', () => {
    expect(
      githubSqliteFromEnv({
        GH_PAT: 'github_pat_test',
        GITHUB_DATABASE_REPO: 'uxedward/worshipsetlist',
        GITHUB_DATABASE_PATH: '/library/songs.db',
        GITHUB_DATABASE_BRANCH: 'db',
      }),
    ).toEqual({
      token: 'github_pat_test',
      owner: 'uxedward',
      repo: 'worshipsetlist',
      path: 'library/songs.db',
      branch: 'db',
    })
  })
})
