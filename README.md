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

The library ships empty. Seed data is 2–3 example setlists with no songs.

## Scripts

- `npm run dev` — API + Vite together
- `npm test` — chord parser and transpose unit tests
- `npm run db:migrate` / `npm run db:seed`

## Import / export

Songs round-trip through a `===` text format (library Import / Export all songs).
