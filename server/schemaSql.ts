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
  `CREATE INDEX IF NOT EXISTS "Section_songId_idx" ON "Section"("songId")`,
  `CREATE INDEX IF NOT EXISTS "Line_sectionId_idx" ON "Line"("sectionId")`,
  `CREATE INDEX IF NOT EXISTS "SetlistSong_setlistId_idx" ON "SetlistSong"("setlistId")`,
  `CREATE INDEX IF NOT EXISTS "SetlistSong_songId_idx" ON "SetlistSong"("songId")`,
]
