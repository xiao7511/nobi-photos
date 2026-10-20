// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { SQLITE_SCHEMA_V1, SqliteMetadataStore } from './sqlite'
describe('SQLite v1 metadata model (in-memory only)', () => {
  const insert = `INSERT INTO photos (id, local_asset_id, title, taken_at, width, height, byte_size, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  it('migrates idempotently and enforces constraints and cascades', () => {
    const db = new DatabaseSync(':memory:')
    try {
      db.exec(SQLITE_SCHEMA_V1)
      db.exec(SQLITE_SCHEMA_V1)
      expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(1)
      expect(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()?.count).toBe(1)
      db.prepare(insert).run('p1', 'asset1', '测试', '2026-10-18', 900, 1100, 10, 'demo')
      expect(() =>
        db.prepare(insert).run('p2', 'asset2', 'bad', '2026', 0, 100, 10, 'device'),
      ).toThrow()
      expect(() =>
        db.prepare(insert).run('p2', 'asset1', 'bad', '2026', 10, 100, 10, 'device'),
      ).toThrow()
      expect(() => db.exec("INSERT INTO photo_tags VALUES ('missing', '海', 'manual')")).toThrow()
      expect(() => db.exec("INSERT INTO photo_tags VALUES ('p1', '海', 'cloud')")).toThrow()
      db.exec(
        "INSERT INTO albums VALUES ('a1', '旅行', 'manual'); INSERT INTO album_photos VALUES ('a1', 'p1'); INSERT INTO photo_tags VALUES ('p1', '海', 'demo'); INSERT INTO cleanup_candidates(photo_id,group_id,reason) VALUES ('p1','g1','similar')",
      )
      // Metadata deletion is intentionally tested, never an OS photo deletion.
      db.exec("DELETE FROM photos WHERE id = 'p1'")
      for (const table of ['album_photos', 'photo_tags', 'cleanup_candidates'])
        expect(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count).toBe(0)
    } finally {
      db.close()
    }
  })
  it('uses bound parameters, including IDs containing SQL syntax', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      const store = new SqliteMetadataStore({
        execute: async (sql) => {
          db.exec(sql)
        },
        run: async (sql, values) => ({ changes: Number(db.prepare(sql).run(...values).changes) }),
      })
      await store.initialize()
      const id = "x'; DROP TABLE photos;--"
      db.prepare(insert).run(id, 'asset1', '本地', '2026-10-18', 100, 100, 1, 'demo')
      await store.setFavorite(id, true)
      expect(db.prepare('SELECT is_favorite FROM photos WHERE id = ?').get(id)?.is_favorite).toBe(1)
      await expect(store.setFavorite('unknown', true)).rejects.toThrow('未找到')
    } finally {
      db.close()
    }
  })
})
