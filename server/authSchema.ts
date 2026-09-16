/**
 * Auth DDL, kept separate from SCHEMA_STATEMENTS because `ensureSchema()` skips
 * everything once the Song table exists. An already-deployed database has that
 * table, so these statements need their own idempotent pass to land.
 */
export const AUTH_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE TABLE IF NOT EXISTS "AuthSetting" (
    "id" INTEGER NOT NULL,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AuthSetting_pkey" PRIMARY KEY ("id")
  )`,
  // Preferences move from one global row (id = 1) to one row per user.
  `ALTER TABLE "Preference" ADD COLUMN IF NOT EXISTS "userId" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Preference_userId_key" ON "Preference"("userId")`,
  // The old table declared `id` with no default, so per-user rows need a sequence.
  `CREATE SEQUENCE IF NOT EXISTS "Preference_id_seq" OWNED BY "Preference"."id"`,
  `SELECT setval('"Preference_id_seq"', COALESCE((SELECT MAX("id") FROM "Preference"), 0) + 1, false)`,
  `ALTER TABLE "Preference" ALTER COLUMN "id" SET DEFAULT nextval('"Preference_id_seq"')`,
  `CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx" ON "PasswordReset"("userId")`,
  `ALTER TABLE "Preference" ADD COLUMN IF NOT EXISTS "onboardingDoneAt" TIMESTAMP(3)`,
]

export const AUTH_TABLES = ['User', 'AuthSetting', 'PasswordReset'] as const
