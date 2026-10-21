import type { Photo } from './models'
import { normalizeTags, validateAlbum } from './organization'
import type { UserAlbum } from './organization'

export type BatchEdit =
  | { kind: 'favorite'; value: boolean }
  | { kind: 'tags'; mode: 'add' | 'remove'; tags: string[] }
  | { kind: 'album'; mode: 'add' | 'remove'; albumId: string }

export interface BatchPlan {
  ids: string[]
  favorite?: boolean
  tags?: { id: string; tags: string[] }[]
  album?: UserAlbum
}

// Validate the entire change before either storage adapter writes anything.
export function planBatch(
  ids: string[],
  edit: BatchEdit,
  photos: Photo[],
  albums: UserAlbum[],
): BatchPlan {
  const unique = [...new Set(ids)]
  if (!unique.length || unique.length > 500) throw new Error('每次请选择 1–500 张照片。')
  const available = new Map(photos.map((p) => [p.id, p]))
  if (unique.some((id) => !available.has(id)))
    throw new Error('部分照片已不可访问，请重新加载后选择。')
  if (edit.kind === 'favorite') return { ids: unique, favorite: edit.value }
  if (edit.kind === 'tags') {
    const requested = normalizeTags(edit.tags)
    if (!requested.length) throw new Error('请至少填写一个手动标签。')
    const removing = new Set(requested.map((tag) => tag.toLocaleLowerCase()))
    const tags = unique.map((id) => {
      const existing = available.get(id)!.manualTags ?? []
      return {
        id,
        tags:
          edit.mode === 'add'
            ? normalizeTags([...existing, ...requested])
            : existing.filter((tag) => !removing.has(tag.toLocaleLowerCase())),
      }
    })
    return { ids: unique, tags }
  }
  const album = albums.find((a) => a.id === edit.albumId)
  if (!album) throw new Error('目标相册已不存在，请重新选择。')
  const selected = new Set(unique)
  return {
    ids: unique,
    album: validateAlbum(
      {
        ...album,
        photoIds:
          edit.mode === 'add'
            ? [...new Set([...album.photoIds, ...unique])]
            : album.photoIds.filter((id) => !selected.has(id)),
      },
      new Set(available.keys()),
    ),
  }
}
