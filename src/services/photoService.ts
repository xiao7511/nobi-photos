import type { Photo, PhotoManagementService, PhotoQuery, PhotoRepository } from '../domain/models'
export function filterPhotos(photos: Photo[], query: PhotoQuery = {}): Photo[] {
  const terms = (query.text ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return photos.filter((p) => {
    const haystack = [p.title, p.category, p.location, p.takenAt, ...p.tags]
      .join(' ')
      .toLocaleLowerCase()
    return (
      (!query.category || p.category === query.category) &&
      (!query.favoritesOnly || p.favorite) &&
      terms.every((t) => haystack.includes(t))
    )
  })
}
export class LocalPhotoService implements PhotoManagementService {
  constructor(private repository: PhotoRepository) {}
  async list(query: PhotoQuery = {}) {
    return filterPhotos(await this.repository.list(), query)
  }
  setFavorite(id: string, favorite: boolean) {
    return this.repository.setFavorite(id, favorite)
  }
  async cleanupCandidates() {
    return (await this.repository.list()).filter((p) => p.duplicateGroup)
  }
  async requestLibraryAccess(): Promise<never> {
    throw new Error('浏览器不支持系统相册授权，请使用 Phase 2 原生应用。')
  }
  async deleteOriginals(ids: string[]): Promise<never> {
    void ids
    throw new Error('本应用不支持删除原始照片。')
  }
}
