import type { Photo, PhotoManagementService, PhotoQuery, PhotoRepository } from '../domain/models'
export function filterPhotos(photos: Photo[], query: PhotoQuery = {}): Photo[] {
  validateQuery(query)
  const terms = (query.text ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const ids = query.photoIds ? new Set(query.photoIds) : undefined
  const tags = (query.manualTags ?? [])
    .map((t) => t.normalize('NFC').trim().toLocaleLowerCase())
    .filter(Boolean)
  return photos.filter((p) => {
    const haystack = [p.title, p.category, p.location, p.takenAt, ...p.tags]
      .join(' ')
      .toLocaleLowerCase()
    return (
      (!query.category || p.category === query.category) &&
      (!query.favoritesOnly || p.favorite) &&
      (!ids || ids.has(p.id)) &&
      (!query.fromDate || p.takenAt.slice(0, 10) >= query.fromDate) &&
      (!query.toDate || p.takenAt.slice(0, 10) <= query.toDate) &&
      (!query.orientation ||
        (query.orientation === 'square'
          ? p.width === p.height
          : query.orientation === 'landscape'
            ? p.width > p.height
            : p.height > p.width)) &&
      tags.every((tag) => (p.manualTags ?? []).some((t) => t.toLocaleLowerCase() === tag)) &&
      terms.every((t) => haystack.includes(t))
    )
  })
}
export function validateQuery(query: PhotoQuery) {
  for (const value of [query.fromDate, query.toDate]) {
    if (!value) continue
    const date = new Date(value)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new Error('请选择有效的日期。')
  }
  if (query.fromDate && query.toDate && query.fromDate > query.toDate)
    throw new Error('开始日期不能晚于结束日期。')
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
