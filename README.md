# Setflow

Worship setlist builder — charts, transpose, presentation mode.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Express + Prisma + PostgreSQL

## Setup

```bash
cp .env.example .env
docker compose up -d        # or use a local Postgres matching DATABASE_URL
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

App: http://localhost:5173  
API: http://localhost:3001

The API also loads the worship library automatically on startup if it is empty, so lyrics and chords show up without a separate seed step after Postgres is running.

Seed data includes Sunday AM / Midweek / Easter setlists plus 21 worship songs with charts (the referenced playlist is attached to Sunday AM).

## Scripts

- `npm run dev` — API + Vite together
- `npm test` — chord parser, transpose, and presentation unit tests
- `npm run db:migrate` / `npm run db:seed` / `npm run db:songs`

## Import / export

Songs round-trip through a `===` text format (library Import / Export all songs).
