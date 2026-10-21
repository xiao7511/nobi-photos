// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { DevicePhotoRepository, migrations } from './deviceRepository'
import type { DevicePhoto } from '../native/contracts'
const databases: DatabaseSync[] = []
afterEach(() => databases.splice(0).forEach((db) => db.close()))
export const photo = (assetId: string, title = '本机照片'): DevicePhoto => ({
  assetId,
  title,
  takenAt: '2026-10-21T01:00:00Z',
  modifiedAt: '2026-10-21T01:00:00Z',
  width: 100,
  height: 120,
  bytes: 0,
  bytesKnown: false,
})
function setup() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  db.exec('PRAGMA foreign_keys=ON')
  migrations.forEach((m) => m.statements.forEach((sql) => db.exec(sql)))
  const repo = new DevicePhotoRepository({
    query: async (sql, values = []) => db.prepare(sql).all(...values),
    batch: async (commands) => {
      db.exec('BEGIN IMMEDIATE')
      try {
        commands.forEach((c) => db.prepare(c.statement).run(...c.values))
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  })
  return { db, repo }
}
async function index(repo: DevicePhotoRepository, id: string, photos: DevicePhoto[]) {
  await repo.beginScan(id)
  await repo.stagePage(id, photos)
  await repo.commitScan(id)
}
describe('device SQLite index and migration v2', () => {
  it('migrates from v1 without replacing existing metadata', () => {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    migrations[0]!.statements.forEach((s) => db.exec(s))
    db.exec(
      "INSERT INTO photos(id,local_asset_id,title,taken_at,width,height,byte_size,source,is_favorite) VALUES ('demo','demo','kept','2026',1,1,0,'demo',1)",
    )
    migrations[1]!.statements.forEach((s) => db.exec(s))
    expect(db.prepare('SELECT is_favorite FROM photos').get()?.is_favorite).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()?.count).toBe(2)
  })
  it('does not expose staged partial results and preserves favorites across scans', async () => {
    const { repo } = setup()
    await index(repo, 'first', [photo('a')])
    await repo.setFavorite('device:a', true)
    await repo.beginScan('next')
    await repo.stagePage('next', [photo('a', 'edited'), photo('b')])
    expect((await repo.list()).map((p) => p.title)).toEqual(['本机照片'])
    await repo.commitScan('next')
    expect(await repo.list()).toMatchObject([
      {
        id: 'device:a',
        title: 'edited',
        favorite: true,
        category: '未分类',
        source: 'device',
        bytesKnown: false,
      },
      { id: 'device:b', favorite: false },
    ])
  })
  it('reconciles disappeared metadata only after a completed scan, including empty libraries', async () => {
    const { repo } = setup()
    await index(repo, 'first', [photo('a'), photo('b')])
    await repo.beginScan('cancel')
    await repo.stagePage('cancel', [photo('a')])
    await repo.discardScan('cancel')
    expect(await repo.list()).toHaveLength(2)
    await index(repo, 'second', [photo('a')])
    expect(await repo.list()).toHaveLength(1)
    await index(repo, 'empty', [])
    expect(await repo.list()).toEqual([])
  })
  it('rolls back all changes when reconciliation fails partway through', async () => {
    const { db, repo } = setup()
    await index(repo, 'first', [photo('a')])
    await repo.beginScan('broken')
    await repo.stagePage('broken', [photo('b')])
    db.exec(
      "CREATE TRIGGER fail_delete BEFORE DELETE ON photos BEGIN SELECT RAISE(ABORT,'injected failure'); END",
    )
    await expect(repo.commitScan('broken')).rejects.toThrow('injected failure')
    expect((await repo.list()).map((p) => p.assetId)).toEqual(['a'])
    expect(db.prepare("SELECT status FROM scan_runs WHERE id='broken'").get()?.status).toBe(
      'running',
    )
  })
  it('cleans interrupted staging on launch, not the last complete index', async () => {
    const { db, repo } = setup()
    await index(repo, 'first', [photo('a')])
    await repo.beginScan('interrupted')
    await repo.stagePage('interrupted', [photo('b')])
    await repo.initialize()
    expect(await repo.list()).toHaveLength(1)
    expect(db.prepare('SELECT COUNT(*) AS count FROM scan_staging').get()?.count).toBe(0)
    expect(db.prepare("SELECT status FROM scan_runs WHERE id='interrupted'").get()?.status).toBe(
      'interrupted',
    )
  })
  it('rejects malformed metadata, parameterizes IDs and clears only the device index', async () => {
    const { db, repo } = setup()
    const id = "'; DELETE FROM photos;--"
    await index(repo, 'first', [photo(id)])
    await repo.setFavorite('device:' + id, true)
    expect((await repo.list())[0]?.favorite).toBe(true)
    await repo.beginScan('invalid')
    await expect(repo.stagePage('invalid', [{ ...photo('b'), width: 0 }])).rejects.toThrow('无效')
    await repo.setSetting('autoScan', 'true')
    expect(await repo.getSetting('autoScan')).toBe('true')
    db.exec(
      "INSERT INTO photos(id,local_asset_id,title,taken_at,width,height,byte_size,source) VALUES ('demo','demo','sample','2026',1,1,0,'demo')",
    )
    await repo.clearMetadata()
    expect(await repo.list()).toEqual([])
    expect(await repo.getSetting('autoScan')).toBeUndefined()
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM photos WHERE source='demo'").get()?.count,
    ).toBe(1)
  })
})
