import type { Photo } from '../domain/models'
import type { DevicePhoto, ScanRepository } from '../native/contracts'
import schema1 from './schema.sql?raw'
import schema2 from './migration2.sql?raw'
import { normalizeTags, validateAlbum } from '../domain/organization'
import type { UserAlbum } from '../domain/organization'
export interface SqlCommand {
  statement: string
  values: (string | number | null)[]
}
export interface MetadataDriver {
  query(sql: string, values?: (string | number | null)[]): Promise<Record<string, unknown>[]>
  batch(commands: SqlCommand[]): Promise<void>
}
export const migrations = [
  {
    toVersion: 1,
    statements: schema1
      .split(';')
      .map((s) => s.replace(/--[^\n]*/g, '').trim())
      .filter((s) => s && !/^(PRAGMA|BEGIN|COMMIT)/i.test(s)),
  },
  {
    toVersion: 2,
    statements: schema2
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean),
  },
]
function command(statement: string, values: SqlCommand['values'] = []): SqlCommand {
  return { statement, values }
}
export function validatePhoto(photo: DevicePhoto) {
  if (
    !photo.assetId ||
    photo.assetId.length > 1500 ||
    typeof photo.title !== 'string' ||
    photo.title.length > 1000 ||
    !Number.isFinite(Date.parse(photo.takenAt)) ||
    !Number.isFinite(Date.parse(photo.modifiedAt)) ||
    !Number.isSafeInteger(photo.width) ||
    photo.width <= 0 ||
    !Number.isSafeInteger(photo.height) ||
    photo.height <= 0 ||
    !Number.isSafeInteger(photo.bytes) ||
    photo.bytes < 0 ||
    typeof photo.bytesKnown !== 'boolean'
  )
    throw new Error('照片元数据无效，索引未更新。')
}
export class DevicePhotoRepository implements ScanRepository {
  constructor(private driver: MetadataDriver) {}
  async initialize() {
    await this.driver.batch([
      command('DELETE FROM scan_staging'),
      command(
        "UPDATE scan_runs SET status = 'interrupted', finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE status = 'running'",
      ),
    ])
  }
  async list(): Promise<Photo[]> {
    const rows = await this.driver.query(
      "SELECT * FROM photos WHERE source = 'device' ORDER BY taken_at DESC, id",
    )
    const tagRows = await this.driver.query(
      "SELECT photo_id,tag FROM photo_tags WHERE origin='manual' ORDER BY tag",
    )
    const tags = new Map<string, string[]>()
    for (const row of tagRows)
      tags.set(String(row.photo_id), [...(tags.get(String(row.photo_id)) ?? []), String(row.tag)])
    return rows.map((r) => ({
      id: String(r.id),
      assetId: String(r.local_asset_id),
      title: String(r.title),
      takenAt: String(r.taken_at),
      modifiedAt: String(r.modified_at),
      width: Number(r.width),
      height: Number(r.height),
      bytes: Number(r.byte_size),
      bytesKnown: Boolean(r.bytes_known),
      favorite: Boolean(r.is_favorite),
      source: 'device',
      category: '未分类',
      location: '本机',
      tags: tags.get(String(r.id)) ?? [],
      manualTags: tags.get(String(r.id)) ?? [],
      thumbnail: '/photo-placeholder.svg',
    }))
  }
  async setFavorite(id: string, favorite: boolean) {
    if (
      !(await this.driver.query("SELECT id FROM photos WHERE id = ? AND source = 'device'", [id]))
        .length
    )
      throw new Error('未找到照片')
    await this.driver.batch([
      command('UPDATE photos SET is_favorite = ? WHERE id = ?', [favorite ? 1 : 0, id]),
    ])
  }
  async beginScan(id: string) {
    await this.driver.batch([
      command("INSERT INTO scan_runs(id, status) VALUES (?, 'running')", [id]),
    ])
  }
  async stagePage(id: string, photos: DevicePhoto[]) {
    photos.forEach(validatePhoto)
    if (!photos.length) return
    await this.driver.batch(
      photos.map((p) =>
        command(
          `INSERT OR REPLACE INTO scan_staging
      (scan_id,asset_id,title,taken_at,modified_at,width,height,byte_size,bytes_known) VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            id,
            p.assetId,
            p.title,
            p.takenAt,
            p.modifiedAt,
            p.width,
            p.height,
            p.bytes,
            p.bytesKnown ? 1 : 0,
          ],
        ),
      ),
    )
  }
  async commitScan(id: string) {
    if (
      !(
        await this.driver.query("SELECT id FROM scan_runs WHERE id = ? AND status = 'running'", [
          id,
        ])
      ).length
    )
      throw new Error('扫描会话已过期')
    // One native transaction: upsert preserves favorite, then reconcile metadata only.
    await this.driver.batch([
      command(
        `INSERT INTO photos(id,local_asset_id,title,taken_at,width,height,byte_size,source,modified_at,bytes_known)
        SELECT 'device:' || asset_id,asset_id,title,taken_at,width,height,byte_size,'device',modified_at,bytes_known FROM scan_staging WHERE scan_id = ?
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,taken_at=excluded.taken_at,width=excluded.width,height=excluded.height,
        byte_size=excluded.byte_size,modified_at=excluded.modified_at,bytes_known=excluded.bytes_known`,
        [id],
      ),
      command(
        "DELETE FROM photos WHERE source = 'device' AND local_asset_id NOT IN (SELECT asset_id FROM scan_staging WHERE scan_id = ?)",
        [id],
      ),
      command(
        "UPDATE scan_runs SET status='completed',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        [id],
      ),
      command('DELETE FROM scan_staging WHERE scan_id = ?', [id]),
      command(
        "INSERT OR REPLACE INTO local_settings(key,value) VALUES ('lastScanAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
      ),
      command(
        'DELETE FROM scan_runs WHERE id NOT IN (SELECT id FROM scan_runs ORDER BY started_at DESC LIMIT 20)',
      ),
    ])
  }
  async discardScan(id: string) {
    await this.driver.batch([
      command('DELETE FROM scan_staging WHERE scan_id = ?', [id]),
      command(
        "UPDATE scan_runs SET status='cancelled',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status='running'",
        [id],
      ),
    ])
  }
  async removeInaccessible(ids: string[]) {
    if (ids.length)
      await this.driver.batch(
        ids.map((id) =>
          command("DELETE FROM photos WHERE source='device' AND local_asset_id = ?", [id]),
        ),
      )
  }
  async clearMetadata() {
    await this.driver.batch([
      command("DELETE FROM photos WHERE source='device'"),
      command('DELETE FROM scan_staging'),
      command('DELETE FROM scan_runs'),
      command('DELETE FROM local_settings'),
      command("DELETE FROM albums WHERE kind='manual'"),
    ])
  }
  async listAlbums(): Promise<UserAlbum[]> {
    const albums = await this.driver.query(
      "SELECT id,name FROM albums WHERE kind='manual' ORDER BY name,id",
    )
    const relations = await this.driver.query(
      'SELECT album_id,photo_id FROM album_photos ORDER BY photo_id',
    )
    return albums.map((a) => ({
      id: String(a.id),
      name: String(a.name),
      photoIds: relations.filter((r) => r.album_id === a.id).map((r) => String(r.photo_id)),
    }))
  }
  async saveAlbum(album: UserAlbum) {
    const valid = validateAlbum(album, new Set((await this.list()).map((p) => p.id)))
    const existing = await this.listAlbums()
    if (!existing.some((a) => a.id === valid.id) && existing.length >= 200)
      throw new Error('最多创建 200 个相册')
    await this.driver.batch([
      command(
        "INSERT INTO albums(id,name,kind) VALUES (?,?,'manual') ON CONFLICT(id) DO UPDATE SET name=excluded.name",
        [valid.id, valid.name],
      ),
      command('DELETE FROM album_photos WHERE album_id=?', [valid.id]),
      ...valid.photoIds.map((id) =>
        command('INSERT INTO album_photos(album_id,photo_id) VALUES (?,?)', [valid.id, id]),
      ),
    ])
  }
  async deleteAlbum(id: string) {
    await this.driver.batch([command("DELETE FROM albums WHERE id=? AND kind='manual'", [id])])
  }
  async saveTags(id: string, tags: string[]) {
    const normalized = normalizeTags(tags)
    if (
      !(await this.driver.query("SELECT id FROM photos WHERE id=? AND source='device'", [id]))
        .length
    )
      throw new Error('未找到照片')
    await this.driver.batch([
      command("DELETE FROM photo_tags WHERE photo_id=? AND origin='manual'", [id]),
      ...normalized.map((tag) =>
        command("INSERT INTO photo_tags(photo_id,tag,origin) VALUES (?,?,'manual')", [id, tag]),
      ),
    ])
  }
  async getSetting(key: string) {
    return (await this.driver.query('SELECT value FROM local_settings WHERE key = ?', [key]))[0]
      ?.value as string | undefined
  }
  async setSetting(key: string, value: string) {
    await this.driver.batch([
      command('INSERT OR REPLACE INTO local_settings(key,value) VALUES (?,?)', [key, value]),
    ])
  }
}
