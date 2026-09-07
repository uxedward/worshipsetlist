# Setflow

Worship setlist builder — charts, transpose, presentation mode.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Express + Prisma + **SQLite** (database file lives in this GitHub repo)

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

The song library is stored in SQLite. Locally that is `prisma/setflow.db`. On Vercel, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` so new songs are written to a real database and are not wiped on the next serverless start.

The seed files `prisma/playlistSongs.ts` + `prisma/playlistMore.ts` only fill an **empty** library. Existing songs and setlists are left alone.

Import more titles from **Song Library → Spotify / Import** by pasting a Spotify playlist, album, or song link. Spotify does not provide lyrics, so imports use an “Add lyrics” placeholder you can replace in Edit. Playlist imports include the first 50 tracks.

## Vercel

The project is set up for Vercel (`vercel.json` + `api/index.ts`). Without Turso, the bundled SQLite file is copied into `/tmp` on each serverless start — that copy is temporary, so songs added in production would disappear.

To keep production songs:

1. Create a free [Turso](https://turso.tech) database.
2. In the Vercel project, add environment variables `TURSO_DATABASE_URL` (`libsql://…`) and `TURSO_AUTH_TOKEN`.
3. Redeploy.

The first request copies the seeded library into Turso if that database is empty. After that, New Song, Edit, Spotify import, and setlist changes save in Turso.

## Scripts

- `npm run dev` — API + Vite together
- `npm test` — chord parser, transpose, and presentation unit tests
- `npm run db:migrate` / `npm run db:seed` / `npm run db:songs`
