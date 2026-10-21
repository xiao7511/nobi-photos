import { createDemoPhotos } from '../data/demo'
import { METADATA_KEY } from './storageKeys'
import type { StoragePort } from './localRepository'
import { normalizeTags, validateAlbum } from '../domain/organization'
import type { OrganizationRepository, UserAlbum } from '../domain/organization'
import { planBatch } from '../domain/batchEdit'
import type { BatchEdit } from '../domain/batchEdit'
export interface DemoOrganization {
  albums: UserAlbum[]
  tags: Record<string, string[]>
}
export function readOrganization(raw: unknown): DemoOrganization {
  if (raw === undefined) return { albums: [], tags: {} }
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('albums' in raw) ||
    !Array.isArray(raw.albums) ||
    !('tags' in raw) ||
    !raw.tags ||
    typeof raw.tags !== 'object' ||
    Array.isArray(raw.tags)
  )
    throw new Error('整理记录格式异常，请重置示例数据。')
  const ids = new Set(createDemoPhotos().map((p) => p.id))
  const albums = raw.albums.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('id' in entry) ||
      typeof entry.id !== 'string' ||
      !('name' in entry) ||
      typeof entry.name !== 'string' ||
      !('photoIds' in entry) ||
      !Array.isArray(entry.photoIds) ||
      !entry.photoIds.every((id: unknown) => typeof id === 'string')
    )
      throw new Error('相册记录格式异常')
    return validateAlbum({ id: entry.id, name: entry.name, photoIds: entry.photoIds }, ids)
  })
  if (albums.length > 200 || new Set(albums.map((a) => a.id)).size !== albums.length)
    throw new Error('相册记录格式异常')
  const tags: Record<string, string[]> = {}
  for (const [id, values] of Object.entries(raw.tags)) {
    if (!ids.has(id) || !Array.isArray(values) || !values.every((v) => typeof v === 'string'))
      throw new Error('标签记录格式异常')
    tags[id] = normalizeTags(values)
  }
  return { albums, tags }
}
export class DemoOrganizationRepository implements OrganizationRepository {
  constructor(private storage: StoragePort) {}
  private read() {
    const raw = this.storage.getItem(METADATA_KEY)
    if (raw === null)
      return {
        cleared: false,
        favorites: createDemoPhotos()
          .filter((p) => p.favorite)
          .map((p) => p.id),
        organization: readOrganization(undefined),
      }
    const state = JSON.parse(raw)
    if (
      !state ||
      typeof state !== 'object' ||
      typeof state.cleared !== 'boolean' ||
      !Array.isArray(state.favorites) ||
      !state.favorites.every((id: unknown) => typeof id === 'string')
    )
      throw new Error('本地数据格式异常')
    return {
      cleared: state.cleared as boolean,
      favorites: state.favorites as string[],
      organization: readOrganization(state.organization),
    }
  }
  async listAlbums() {
    return this.read().organization.albums
  }
  async saveAlbum(album: UserAlbum) {
    const state = this.read()
    const ids = new Set(state.cleared ? [] : createDemoPhotos().map((p) => p.id))
    const valid = validateAlbum(album, ids)
    if (
      !state.organization.albums.some((a) => a.id === valid.id) &&
      state.organization.albums.length >= 200
    )
      throw new Error('最多创建 200 个相册')
    state.organization.albums = [
      ...state.organization.albums.filter((a) => a.id !== valid.id),
      valid,
    ]
    this.storage.setItem(METADATA_KEY, JSON.stringify(state))
  }
  async deleteAlbum(id: string) {
    const state = this.read()
    state.organization.albums = state.organization.albums.filter((a) => a.id !== id)
    this.storage.setItem(METADATA_KEY, JSON.stringify(state))
  }
  async saveTags(id: string, tags: string[]) {
    const state = this.read()
    if (state.cleared || !createDemoPhotos().some((p) => p.id === id)) throw new Error('未找到照片')
    state.organization.tags[id] = normalizeTags(tags)
    this.storage.setItem(METADATA_KEY, JSON.stringify(state))
  }
  async editBatch(ids: string[], edit: BatchEdit) {
    const state = this.read()
    const photos = state.cleared
      ? []
      : createDemoPhotos().map((p) => ({
          ...p,
          manualTags: state.organization.tags[p.id] ?? [],
        }))
    const plan = planBatch(ids, edit, photos, state.organization.albums)
    if (plan.favorite !== undefined) {
      const favorites = new Set(state.favorites)
      for (const id of plan.ids) {
        if (plan.favorite) favorites.add(id)
        else favorites.delete(id)
      }
      state.favorites = [...favorites]
    }
    for (const entry of plan.tags ?? []) state.organization.tags[entry.id] = entry.tags
    if (plan.album)
      state.organization.albums = state.organization.albums.map((a) =>
        a.id === plan.album!.id ? plan.album! : a,
      )
    this.storage.setItem(METADATA_KEY, JSON.stringify(state))
  }
}
