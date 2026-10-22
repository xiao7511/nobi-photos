import type { BatchEdit } from './batchEdit'
import type { SmartSuggestion } from './smartOrganization'
export interface UserAlbum {
  id: string
  name: string
  photoIds: string[]
}
export interface OrganizationRepository {
  listAlbums(): Promise<UserAlbum[]>
  saveAlbum(album: UserAlbum): Promise<void>
  renameAlbum(id: string, name: string): Promise<void>
  deleteAlbum(id: string): Promise<void>
  saveTags(photoId: string, tags: string[]): Promise<void>
  editBatch(photoIds: string[], edit: BatchEdit): Promise<void>
  saveSmartAlbums(suggestions: SmartSuggestion[]): Promise<void>
}
export function normalizeName(value: string): string {
  const name = value.normalize('NFC').trim()
  if (!name || Array.from(name).length > 40 || /\p{Cc}/u.test(name))
    throw new Error('相册名称需为 1–40 个字符，不能包含控制字符。')
  return name
}
export function normalizeTags(values: string[]): string[] {
  const tags: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const tag = raw.normalize('NFC').trim()
    if (!tag) continue
    if (Array.from(tag).length > 24 || /\p{Cc}/u.test(tag))
      throw new Error('每个标签最多 24 个字符，不能包含控制字符。')
    const key = tag.toLocaleLowerCase()
    if (!seen.has(key)) {
      tags.push(tag)
      seen.add(key)
    }
  }
  if (tags.length > 20) throw new Error('每张照片最多添加 20 个手动标签。')
  return tags
}
export function validateAlbum(album: UserAlbum, available: Set<string>) {
  if (!album.id.startsWith('user:') || album.id.length > 100) throw new Error('相册标识无效')
  if (album.photoIds.length > 10000 || album.photoIds.some((id) => !available.has(id)))
    throw new Error('部分照片已不可访问，请重新加载后选择。')
  return { id: album.id, name: normalizeName(album.name), photoIds: [...new Set(album.photoIds)] }
}
