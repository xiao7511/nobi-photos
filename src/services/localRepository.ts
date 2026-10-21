import { createDemoPhotos } from '../data/demo'
import type { Photo, PhotoRepository } from '../domain/models'
import { readOrganization } from './demoOrganization'

import { METADATA_KEY } from './storageKeys'
export { METADATA_KEY } from './storageKeys'
export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export class LocalPhotoRepository implements PhotoRepository {
  constructor(private storage: StoragePort) {}
  async list(): Promise<Photo[]> {
    const raw = this.storage.getItem(METADATA_KEY)
    if (raw === null) return createDemoPhotos()
    const state: unknown = JSON.parse(raw)
    if (
      !state ||
      typeof state !== 'object' ||
      !('favorites' in state) ||
      !('cleared' in state) ||
      typeof state.cleared !== 'boolean' ||
      !Array.isArray(state.favorites) ||
      !state.favorites.every((id: unknown) => typeof id === 'string')
    ) {
      throw new Error('本地数据格式异常，请在隐私中心重置示例数据。')
    }
    if (state.cleared) return []
    const favorites = state.favorites
    const organization = readOrganization('organization' in state ? state.organization : undefined)
    return createDemoPhotos().map((p) => ({
      ...p,
      favorite: favorites.includes(p.id),
      manualTags: organization.tags[p.id] ?? [],
      tags: [...new Set([...p.tags, ...(organization.tags[p.id] ?? [])])],
    }))
  }
  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const photos = await this.list()
    if (!photos.some((p) => p.id === id)) throw new Error('未找到照片')
    const raw = this.storage.getItem(METADATA_KEY)
    const organization = raw
      ? readOrganization(JSON.parse(raw).organization)
      : readOrganization(undefined)
    this.write(
      photos.map((p) => (p.id === id ? { ...p, favorite } : p)),
      false,
      organization,
    )
  }
  async clearMetadata(): Promise<void> {
    this.write([], true)
  }
  async restoreDemo(): Promise<void> {
    this.write(createDemoPhotos(), false)
  }
  private write(photos: Photo[], cleared: boolean, organization = readOrganization(undefined)) {
    this.storage.setItem(
      METADATA_KEY,
      JSON.stringify({
        cleared,
        favorites: photos.filter((p) => p.favorite).map((p) => p.id),
        organization,
      }),
    )
  }
}
