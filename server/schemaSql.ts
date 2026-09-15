/** Idempotent-enough bootstrap for a fresh Supabase/Postgres database. */
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Song" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT,
    "key" TEXT NOT NULL,
    "bpm" INTEGER NOT NULL,
    "timeSignature" TEXT NOT NULL DEFAULT '4/4',
    "tag" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Section" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Line" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "chords" TEXT NOT NULL DEFAULT '',
    "lyric" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Setlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceName" TEXT,
    "date" TIMESTAMP(3),
    "colorIndex" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Setlist_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "SetlistSong" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "transposedKey" TEXT,
    "notes" TEXT,
    CONSTRAINT "SetlistSong_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Preference" (
    "id" INTEGER NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "presentationFontSize" TEXT NOT NULL DEFAULT 'medium',
    "lastSetlistId" TEXT,
    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "CustomBackground" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'video',
    "src" TEXT NOT NULL,
    "poster" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomBackground_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "CustomBackground" ADD COLUMN IF NOT EXISTS "mimeType" TEXT NOT NULL DEFAULT 'video/mp4'`,
  `ALTER TABLE "CustomBackground" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS "BackgroundChunk" (
    "id" TEXT NOT NULL,
    "backgroundId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    CONSTRAINT "BackgroundChunk_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "BackgroundChunk_backgroundId_index_key" ON "BackgroundChunk"("backgroundId", "index")`,
  `CREATE INDEX IF NOT EXISTS "BackgroundChunk_backgroundId_idx" ON "BackgroundChunk"("backgroundId")`,
  `CREATE INDEX IF NOT EXISTS "Section_songId_idx" ON "Section"("songId")`,
  `CREATE INDEX IF NOT EXISTS "Line_sectionId_idx" ON "Line"("sectionId")`,
  `CREATE INDEX IF NOT EXISTS "SetlistSong_setlistId_idx" ON "SetlistSong"("setlistId")`,
  `CREATE INDEX IF NOT EXISTS "SetlistSong_songId_idx" ON "SetlistSong"("songId")`,
  `ALTER TABLE "Song" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Section" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Line" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Setlist" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "SetlistSong" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Preference" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "CustomBackground" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "BackgroundChunk" ENABLE ROW LEVEL SECURITY`,
]

/** Prisma table names in the public schema. PostgREST exposes these without RLS. */
export const APP_TABLES = [
  'Song',
  'Section',
  'Line',
  'Setlist',
  'SetlistSong',
  'Preference',
  'CustomBackground',
  'BackgroundChunk',
] as const

export function enableRlsStatement(table: string) {
  return `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`
}

export function revokePublicAccessStatement(table: string, role: 'anon' | 'authenticated') {
  return `REVOKE ALL ON TABLE "${table}" FROM ${role}`
}

export const RLS_STATEMENTS = APP_TABLES.map((table) => enableRlsStatement(table))
export const REVOKE_PUBLIC_ACCESS_STATEMENTS = APP_TABLES.flatMap((table) => [
  revokePublicAccessStatement(table, 'anon'),
  revokePublicAccessStatement(table, 'authenticated'),
])
