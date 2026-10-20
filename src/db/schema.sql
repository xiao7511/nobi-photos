-- Local metadata only. Never store original photo bytes, GPS or cloud credentials.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  local_asset_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0,1)),
  source TEXT NOT NULL CHECK (source IN ('demo','device')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('manual','category'))
);
CREATE TABLE IF NOT EXISTS album_photos (
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, photo_id)
);
CREATE TABLE IF NOT EXISTS photo_tags (
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('manual','demo','on_device')),
  PRIMARY KEY (photo_id, tag)
);
CREATE TABLE IF NOT EXISTS cleanup_candidates (
  photo_id TEXT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('duplicate','similar','blurred')),
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending','keep','dismissed'))
);
CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON photo_tags(tag);
INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
PRAGMA user_version = 1;
COMMIT;
