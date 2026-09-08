# Setflow

Worship setlist builder — charts, transpose, presentation mode.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Express + Prisma + **Postgres** (Supabase in production; Prisma is the ORM only)

## Setup

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

App: http://localhost:5173  
API: http://localhost:3001

The song library starts empty so you can add titles in the app. Production saves to Postgres (the Vercel Supabase integration’s `POSTGRES_PRISMA_URL` / `POSTGRES_URL`), so songs survive deploys. Default setlists (Sunday AM, Midweek) stay empty until you add songs.

Import more titles from **Song Library → Spotify / Import** by pasting a Spotify playlist, album, or song link. Spotify does not provide lyrics, so imports use an “Add lyrics” placeholder you can replace in Edit. Playlist imports include the first 50 tracks.

## Vercel

`GET /api/health` should report `{ "ok": true, "durable": true, "backend": "postgres", "vendor": "supabase" }`. New Song, Edit, Spotify import, and setlist changes save in Postgres.

## Scripts

- `npm run dev` — API + Vite together
- `npm test` — chord parser, transpose, and presentation unit tests
- `npm run db:migrate` / `npm run db:songs` (optional playlist seed)
