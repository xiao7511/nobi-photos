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
  it('saves reviewed AI albums atomically, merges members, and preserves manual edits', async () => {
    const { repo } = setup()
    await index(repo, 'smart', [photo('a'), photo('b')])
    await repo.saveTags('device:a', ['手动保留'])
    await repo.setFavorite('device:a', true)
    await repo.saveSmartAlbums([
      { key: 'nature', name: 'ignored', photoIds: ['device:a'], confidence: 0.9 },
    ])
    await repo.renameAlbum('user:smart:nature', '改过的名字')
    await repo.saveSmartAlbums([
      { key: 'nature', name: 'ignored', photoIds: ['device:b'], confidence: 0.9 },
    ])
    expect(await repo.listAlbums()).toEqual([
      { id: 'user:smart:nature', name: '改过的名字', photoIds: ['device:a', 'device:b'] },
    ])
    expect((await repo.list())[0]).toMatchObject({ favorite: true, manualTags: ['手动保留'] })
  })
  it('rolls back all suggested albums when a later album insert fails', async () => {
    const { repo, db } = setup()
    await index(repo, 'smart', [photo('a')])
    db.exec(
      "CREATE TRIGGER fail_smart BEFORE INSERT ON albums WHEN NEW.id='user:smart:food' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    await expect(
      repo.saveSmartAlbums([
        { key: 'nature', name: 'n', photoIds: ['device:a'], confidence: 0.9 },
        { key: 'food', name: 'f', photoIds: ['device:a'], confidence: 0.9 },
      ]),
    ).rejects.toThrow('test failure')
    expect(await repo.listAlbums()).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS n FROM album_photos').get()?.n).toBe(0)
    expect(await repo.list()).toHaveLength(1)
  })
  it('rolls back every photo in a native batch when a later SQL write fails', async () => {
    const { repo, db } = setup()
    await index(repo, 'batch', [photo('a'), photo('b')])
    await repo.saveTags('device:a', ['keep'])
    db.exec(
      "CREATE TRIGGER reject_b BEFORE INSERT ON photo_tags WHEN NEW.photo_id='device:b' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    await expect(
      repo.editBatch(['device:a', 'device:b'], { kind: 'tags', mode: 'add', tags: ["tag';--"] }),
    ).rejects.toThrow('test failure')
    expect((await repo.list()).find((p) => p.id === 'device:a')?.manualTags).toEqual(['keep'])
    expect((await repo.list()).find((p) => p.id === 'device:b')?.manualTags).toEqual([])
  })
  it('persists native batch favorites, tags and album memberships without modifying other records', async () => {
    const { repo } = setup()
    await index(repo, 'batch', [photo('a'), photo('b'), photo('c')])
    await repo.saveAlbum({ id: 'user:batch', name: 'batch', photoIds: ['device:c'] })
    await repo.editBatch(['device:a', 'device:b'], { kind: 'favorite', value: true })
    await repo.editBatch(['device:a', 'device:b'], {
      kind: 'tags',
      mode: 'add',
      tags: ["tag';--", 'Keep'],
    })
    await repo.editBatch(['device:a'], { kind: 'tags', mode: 'remove', tags: ['KEEP'] })
    await repo.editBatch(['device:a', 'device:b'], {
      kind: 'album',
      mode: 'add',
      albumId: 'user:batch',
    })
    await repo.editBatch(['device:a'], { kind: 'album', mode: 'remove', albumId: 'user:batch' })
    expect((await repo.list()).find((p) => p.id === 'device:a')).toMatchObject({
      favorite: true,
      manualTags: ["tag';--"],
    })
    expect((await repo.list()).find((p) => p.id === 'device:c')).toMatchObject({
      favorite: false,
      manualTags: [],
    })
    expect((await repo.listAlbums())[0]?.photoIds).toEqual(['device:b', 'device:c'])
    await index(repo, 'again', [photo('a'), photo('b'), photo('c')])
    expect((await repo.listAlbums())[0]?.photoIds).toEqual(['device:b', 'device:c'])
    await expect(
      repo.editBatch(['device:a', 'missing'], { kind: 'favorite', value: false }),
    ).rejects.toThrow('不可访问')
    expect((await repo.list()).find((p) => p.id === 'device:a')?.favorite).toBe(true)
  })
  it('persists manual albums/tags across scans and cascades missing membership only', async () => {
    const { repo } = setup()
    await index(repo, 'initial', [photo('a'), photo('b')])
    await repo.saveAlbum({
      id: 'user:test',
      name: "旅行'; DROP TABLE photos;--",
      photoIds: ['device:a', 'device:b', 'device:a'],
    })
    await repo.saveTags('device:a', ['纪念', '旅行', '纪念'])
    await index(repo, 'updated', [photo('a', 'modified')])
    expect((await repo.list())[0]).toMatchObject({
      title: 'modified',
      manualTags: ['旅行', '纪念'],
    })
    expect((await repo.listAlbums())[0]?.photoIds).toEqual(['device:a'])
    await repo.deleteAlbum('user:test')
    expect(await repo.listAlbums()).toEqual([])
    expect(await repo.list()).toHaveLength(1)
    expect((await repo.list())[0]?.tags).toContain('纪念')
    await repo.saveTags('device:a', [])
    expect((await repo.list())[0]?.tags).toEqual([])
  })
  it('validates native album inputs and clears user organization with the index', async () => {
    const { repo } = setup()
    await index(repo, 'initial', [photo('a')])
    await expect(
      repo.saveAlbum({ id: 'user:bad', name: 'bad', photoIds: ['missing'] }),
    ).rejects.toThrow('不可访问')
    await repo.saveAlbum({ id: 'user:ok', name: '保留', photoIds: ['device:a'] })
    await repo.saveTags('device:a', ['本地'])
    await repo.clearMetadata()
    expect(await repo.listAlbums()).toEqual([])
    expect(await repo.list()).toEqual([])
  })
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
