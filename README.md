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

The song library and Sunday AM playlist are stored in `prisma/setflow.db` and rebuilt from `prisma/playlistSongs.ts` + `prisma/playlistMore.ts`.

## Vercel

The project is set up for Vercel (`vercel.json` + `api/index.ts`). The SQLite file is copied into `/tmp` on each serverless start so the seeded charts are available without a hosted Postgres database.

## Scripts

- `npm run dev` — API + Vite together
- `npm test` — chord parser, transpose, and presentation unit tests
- `npm run db:migrate` / `npm run db:seed` / `npm run db:songs`
