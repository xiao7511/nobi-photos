ALTER TABLE photos ADD COLUMN modified_at TEXT NOT NULL DEFAULT '';
ALTER TABLE photos ADD COLUMN bytes_known INTEGER NOT NULL DEFAULT 1 CHECK (bytes_known IN (0,1));
CREATE TABLE scan_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running','completed','cancelled','interrupted')),
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT
);
CREATE TABLE scan_staging (
  scan_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  title TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  bytes_known INTEGER NOT NULL CHECK (bytes_known IN (0,1)),
  PRIMARY KEY (scan_id, asset_id)
);
CREATE TABLE local_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO schema_migrations(version) VALUES (2);
