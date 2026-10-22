import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Photo } from '../domain/models'
import { LocalPhotoRepository } from '../services/localRepository'
import { LocalPhotoService } from '../services/photoService'
import { isNative } from '../native/bridge'
import { useDeviceLibrary } from './deviceLibrary'
import { openDeviceRepository } from '../db/nativeDatabase'
import { DemoOrganizationRepository } from '../services/demoOrganization'
import type { OrganizationRepository, UserAlbum } from '../domain/organization'
import { useAnalysis } from './analysis'
import type { BatchEdit } from '../domain/batchEdit'
import { useSmartOrganization } from './smartOrganization'
import type { SmartSuggestion } from '../domain/smartOrganization'

export const useLibrary = defineStore('library', () => {
  const photos = ref<Photo[]>([])
  const albums = ref<UserAlbum[]>([])
  const loading = ref(false)
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  const device = useDeviceLibrary()
  let loadVersion = 0
  let foreground = true
  let revision = ''
  const analysis = useAnalysis()
  const smart = useSmartOrganization()
  // Storage access occurs inside actions so private-mode denial is recoverable.
  const repository = new LocalPhotoRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  })
  const service = new LocalPhotoService(repository)
  const organization = new DemoOrganizationRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  })
  async function organizationRepository(): Promise<OrganizationRepository> {
    return isNative ? await openDeviceRepository() : organization
  }
  const favorites = computed(() => photos.value.filter((p) => p.favorite))
  async function load() {
    if (isNative && !foreground) return
    const version = ++loadVersion
    loading.value = true
    error.value = ''
    try {
      const loaded = isNative ? await device.readPhotos() : await service.list()
      const savedAlbums = await (await organizationRepository()).listAlbums()
      const available = new Set(loaded.map((p) => p.id))
      if (version === loadVersion) {
        const nextRevision = loaded
          .map((p) => [p.id, p.modifiedAt ?? '', p.width, p.height].join(':'))
          .sort()
          .join('|')
        if (nextRevision !== revision) {
          analysis.reset()
          smart.reset()
          revision = nextRevision
        }
        photos.value = loaded
        albums.value = savedAlbums.map((a) => ({
          ...a,
          photoIds: a.photoIds.filter((id) => available.has(id)),
        }))
      }
    } catch {
      if (version === loadVersion) {
        error.value = isNative
          ? '无法读取本地相册索引，请检查照片权限或稍后重试。'
          : '无法读取本地数据。请检查浏览器存储权限，或在隐私中心重置示例。'
        photos.value = []
        albums.value = []
        analysis.reset()
        smart.reset()
      }
    } finally {
      if (version === loadVersion) loading.value = false
    }
  }
  async function favorite(photo: Photo) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      const target = !photo.favorite
      if (isNative) await (await openDeviceRepository()).setFavorite(photo.id, target)
      else await service.setFavorite(photo.id, target)
      const current = photos.value.find((p) => p.id === photo.id)
      if (current) current.favorite = target
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
    analysis.reset()
    smart.reset()
    try {
      if (isNative) {
        if (!clear) throw new Error('原生端不加载示例')
        await device.clearIndex()
      } else if (clear) await repository.clearMetadata()
      else await repository.restoreDemo()
      await load()
      notice.value = isNative
        ? '本地索引已清除，自动扫描已关闭；系统原图未修改。'
        : clear
          ? '本地示例记录已清除，未访问任何原始照片'
          : '示例相册已恢复'
    } catch {
      error.value = '操作未完成，请检查浏览器存储权限。'
    } finally {
      busy.value = false
    }
  }
  async function scanDevice() {
    if (!isNative || !foreground || busy.value || device.scanning) return
    photos.value = []
    albums.value = []
    analysis.reset()
    smart.reset()
    try {
      await device.startScan()
      await load()
    } catch {
      error.value = '本地扫描未完成，请检查照片权限后重试。'
    }
  }
  function suspend() {
    foreground = false
    ++loadVersion
    device.cancel()
    photos.value = []
    albums.value = []
    analysis.reset()
    smart.reset()
    loading.value = false
  }
  function activate() {
    foreground = true
  }
  async function organize(
    action: (repo: OrganizationRepository) => Promise<void>,
    message: string,
  ) {
    if (busy.value || device.scanning || (isNative && !foreground))
      throw new Error('请等待当前操作完成')
    busy.value = true
    error.value = ''
    try {
      await action(await organizationRepository())
      await load()
      if (error.value) throw new Error('已保存，但重新加载失败，请重试')
      notice.value = message
    } catch (e) {
      if (isNative) await load()
      error.value = e instanceof Error ? e.message : '本地整理记录未保存，请重试。'
      throw e
    } finally {
      busy.value = false
    }
  }
  function saveAlbum(album: UserAlbum) {
    return organize((repo) => repo.saveAlbum(album), '相册已保存在本地')
  }
  function deleteAlbum(id: string) {
    return organize((repo) => repo.deleteAlbum(id), '相册已移除，照片原图未修改')
  }
  function renameAlbum(id: string, name: string) {
    return organize((repo) => repo.renameAlbum(id, name), '相册名称已更新')
  }
  function saveTags(id: string, tags: string[]) {
    return organize((repo) => repo.saveTags(id, tags), '手动标签已保存在本地')
  }
  function editBatch(ids: string[], edit: BatchEdit) {
    const selected = [...ids]
    return organize(
      async (repo) => {
        // Recheck native accessibility just before writing a batch, including limited access.
        const current = isNative ? await device.readPhotos() : photos.value
        if (isNative && !foreground) throw new Error('应用已进入后台，请返回后重试。')
        const available = new Set(current.map((p) => p.id))
        if (selected.some((id) => !available.has(id)))
          throw new Error('部分照片已不可访问，请重新加载后选择。')
        await repo.editBatch(selected, edit)
      },
      `已更新 ${new Set(selected).size} 张照片的本地整理记录`,
    )
  }
  function saveSmartAlbums(suggestions: SmartSuggestion[]) {
    const selected = suggestions.map((s) => ({ ...s, photoIds: [...s.photoIds] }))
    return organize(async (repo) => {
      const current = isNative ? await device.readPhotos() : photos.value
      if (isNative && !foreground) throw new Error('应用已进入后台，请返回后重试')
      const available = new Set(current.map((p) => p.id))
      if (selected.some((s) => s.photoIds.some((id) => !available.has(id))))
        throw new Error('部分照片已不可访问，请重新分析')
      await repo.saveSmartAlbums(selected)
      smart.reset()
    }, `已保存 ${selected.length} 个智能建议相册，原图未修改`)
  }
  return {
    photos,
    albums,
    loading,
    busy,
    error,
    notice,
    favorites,
    load,
    favorite,
    reset,
    scanDevice,
    suspend,
    activate,
    isNative,
    saveAlbum,
    deleteAlbum,
    renameAlbum,
    saveTags,
    editBatch,
    saveSmartAlbums,
  }
})
