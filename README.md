# Setflow

Worship setlist builder — charts, transpose, presentation mode.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Express + Prisma + **SQLite** (local file, GitHub-backed file, or Turso)

## Setup

```bash
cp .env.example .env
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

App: http://localhost:5173  
API: http://localhost:3001

The song library is stored in SQLite. Locally that is `prisma/setflow.db`. On Vercel the bundled file is copied into `/tmp` on each serverless start, so new songs vanish unless a durable backend is configured.

The seed files `prisma/playlistSongs.ts` + `prisma/playlistMore.ts` only fill an **empty** library. Existing songs and setlists are left alone.

Import more titles from **Song Library → Spotify / Import** by pasting a Spotify playlist, album, or song link. Spotify does not provide lyrics, so imports use an “Add lyrics” placeholder you can replace in Edit. Playlist imports include the first 50 tracks.

## Vercel

The project is set up for Vercel (`vercel.json` + `api/index.ts`). Without a durable backend, the bundled SQLite file is copied into `/tmp` on each serverless start — that copy is temporary, so songs added in production would disappear.

`GET /api/health` reports `{ durable, backend }`. `backend` is `github`, `turso`, or `file`. Songs stay saved when `durable` is `true`.

### GitHub (no extra database account)

1. Create a fine-grained GitHub PAT with **Contents: Read and write** on `uxedward/worshipsetlist`.
2. In Vercel → Settings → Environment Variables, add `GITHUB_DATABASE_TOKEN` (Production and Preview).
3. Redeploy.

The API stores `data/setflow.db` on the `setflow-data` branch (Vercel does not deploy that branch). The first request uploads the seeded library if the file is missing. After that, New Song, Edit, Spotify import, and setlist changes are written back to GitHub.

### Turso

1. Create a free [Turso](https://turso.tech) database.
2. In Vercel, add `TURSO_DATABASE_URL` (`libsql://…`) and `TURSO_AUTH_TOKEN`.
3. Redeploy.

The first request copies the seeded library into Turso if that database is empty. After that, writes go to Turso. If both GitHub and Turso are configured, Turso is used.

## Scripts

- `npm run dev` — API + Vite together
- `npm test` — chord parser, transpose, and presentation unit tests
- `npm run db:migrate` / `npm run db:seed` / `npm run db:songs`
