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

The first time you open the app it asks you to create the admin account. After
that, sign-in is required for everything except `/api/health`.

The song library starts empty so you can add titles in the app. Production saves to Postgres (the Vercel Supabase integration’s `POSTGRES_PRISMA_URL` / `POSTGRES_URL`), so songs survive deploys. Default setlists (Sunday AM, Midweek) stay empty until you add songs.

Import more titles from **Song Library → Spotify / Import** by pasting a Spotify playlist, album, or song link. Spotify does not provide lyrics, so imports use an “Add lyrics” placeholder you can replace in Edit. Playlist imports include the first 50 tracks.

## Accounts

Two roles:

| | Admin | Team member |
| --- | --- | --- |
| Add songs, import from Spotify | ✅ | ✅ |
| Edit songs and charts | ✅ | ✅ |
| Build, rename, reorder setlists | ✅ | ✅ |
| Run Present mode | ✅ | ✅ |
| **Delete songs** | ✅ | — |
| **Delete setlists** | ✅ | — |
| **Add/remove Present backgrounds** | ✅ | — |
| **Manage accounts** | ✅ | — |

Editing is open to the team because Spotify imports arrive with an “Add lyrics”
placeholder that someone has to replace. Deleting is not: it destroys work
other people depend on.

There is no public sign-up. The first visit creates the admin; everyone else is
added from **Accounts** in the sidebar. Removing someone or changing a role
signs out every other device immediately.

Set `AUTH_SECRET` to a long random string in production — `GET /api/health`
reports `sessionSecretConfigured` so you can check. Without it, sessions are
signed with a key derived from `DATABASE_URL`, which works but rotates whenever
that connection string changes. Optionally set `ADMIN_EMAIL` / `ADMIN_PASSWORD`
to seed the admin on boot instead of using the first-run screen.

## Vercel

`GET /api/health` should report `{ "ok": true, "durable": true, "backend": "postgres", "vendor": "supabase", "sessionSecretConfigured": true }`. New Song, Edit, Spotify import, and setlist changes save in Postgres.

Upgrading an install that predates accounts needs no manual migration: the
account tables are created on boot, and the old single-row preferences (theme,
font size, last setlist) are handed to the first admin account you create.

## Scripts

- `npm run dev` — API + Vite together
- `npm test` — chord parser, transpose, and presentation unit tests
- `npm run db:migrate` / `npm run db:songs` (optional playlist seed)
