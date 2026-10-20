import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Photo } from '../domain/models'
import { LocalPhotoRepository } from '../services/localRepository'
import { LocalPhotoService } from '../services/photoService'

export const useLibrary = defineStore('library', () => {
  const photos = ref<Photo[]>([])
  const loading = ref(false)
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  // Storage access occurs inside actions so private-mode denial is recoverable.
  const repository = new LocalPhotoRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  })
  const service = new LocalPhotoService(repository)
  const favorites = computed(() => photos.value.filter((p) => p.favorite))
  async function load() {
    loading.value = true
    error.value = ''
    try {
      photos.value = await service.list()
    } catch {
      error.value = '无法读取本地数据。请检查浏览器存储权限，或在隐私中心重置示例。'
      photos.value = []
    } finally {
      loading.value = false
    }
  }
  async function favorite(photo: Photo) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      await service.setFavorite(photo.id, !photo.favorite)
      const current = photos.value.find((p) => p.id === photo.id)
      if (current) current.favorite = !photo.favorite
      notice.value = current?.favorite ? '已加入本地收藏' : '已取消收藏'
    } catch {
      error.value = '收藏未保存，请检查本地存储空间或权限后重试。'
    } finally {
      busy.value = false
    }
  }
  async function reset(clear: boolean) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      if (clear) await repository.clearMetadata()
      else await repository.restoreDemo()
      await load()
      notice.value = clear ? '本地示例记录已清除，未访问任何原始照片' : '示例相册已恢复'
    } catch {
      error.value = '操作未完成，请检查浏览器存储权限。'
    } finally {
      busy.value = false
    }
  }
  return { photos, loading, busy, error, notice, favorites, load, favorite, reset }
})
