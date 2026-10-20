import type { Photo, PhotoManagementService, PhotoQuery, PhotoRepository } from '../domain/models'
export function filterPhotos(photos: Photo[], query: PhotoQuery = {}): Photo[] {
  const terms = (query.text ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return photos.filter((p) => {
    const haystack = [p.title, p.category, p.location, ...p.tags].join(' ').toLocaleLowerCase()
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
    throw new Error('Phase 1 未接入系统相册，请等待 Phase 2 验收后开发。')
  }
  async deleteOriginals(ids: string[]): Promise<never> {
    void ids
    throw new Error('Phase 1 不支持删除原始照片。')
  }
}
