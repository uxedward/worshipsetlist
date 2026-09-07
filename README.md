# Setflow

Worship setlist builder — charts, transpose, presentation mode.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Express + Prisma + **Postgres** (hosted Prisma Postgres in production)

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

Production songs are stored in a hosted Postgres database, so they survive Vercel deploys. The first request copies the bundled library into that database if it is empty. Seed files only fill an **empty** library.

**Keep the production database:** claim it so it is not auto-deleted after 24 hours:  
https://create-db.prisma.io/claim?projectID=proj_bz9ukysjihfodq1v7dkyaw5t

Import more titles from **Song Library → Spotify / Import** by pasting a Spotify playlist, album, or song link. Spotify does not provide lyrics, so imports use an “Add lyrics” placeholder you can replace in Edit. Playlist imports include the first 50 tracks.

## Vercel

`GET /api/health` should report `{ "ok": true, "durable": true, "backend": "postgres" }`. New Song, Edit, Spotify import, and setlist changes save in Postgres.

## Scripts

- `npm run dev` — API + Vite together
- `npm test` — chord parser, transpose, and presentation unit tests
- `npm run db:migrate` / `npm run db:seed` / `npm run db:songs`
