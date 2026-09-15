-- Run this in the Supabase SQL editor (SQL → New query).
-- It closes the public Data API. Setflow keeps working through Prisma.

ALTER TABLE "Song" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Section" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Line" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SetlistSong" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomBackground" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BackgroundChunk" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Song" FROM anon, authenticated;
REVOKE ALL ON TABLE "Section" FROM anon, authenticated;
REVOKE ALL ON TABLE "Line" FROM anon, authenticated;
REVOKE ALL ON TABLE "Setlist" FROM anon, authenticated;
REVOKE ALL ON TABLE "SetlistSong" FROM anon, authenticated;
REVOKE ALL ON TABLE "Preference" FROM anon, authenticated;
REVOKE ALL ON TABLE "CustomBackground" FROM anon, authenticated;
REVOKE ALL ON TABLE "BackgroundChunk" FROM anon, authenticated;
