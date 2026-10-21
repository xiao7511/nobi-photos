import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { isNative, photoBridge } from '../native/bridge'
import { hasAccess } from '../native/contracts'
import type { LibraryAccess, ScanState } from '../native/contracts'
import { openDeviceRepository } from '../db/nativeDatabase'
import { ScanEngine } from '../services/scanEngine'
export const useDeviceLibrary = defineStore('deviceLibrary', () => {
  const access = ref<LibraryAccess>(isNative ? 'prompt' : 'unavailable')
  const autoScan = ref(false)
  const lastScanAt = ref('')
  const error = ref('')
  const requesting = ref(false)
  const preparing = ref(false)
  const scan = ref<ScanState>({ status: 'idle', processed: 0, total: 0, error: '' })
  const scanning = computed(
    () => preparing.value || scan.value.status === 'running' || scan.value.status === 'cancelling',
  )
  let engine: ScanEngine | undefined
  let cancelRequested = false
  async function repository() {
    const repo = await openDeviceRepository()
    if (!engine)
      engine = new ScanEngine(photoBridge, repo, (value) => {
        scan.value = value
      })
    return repo
  }
  async function refreshAccess() {
    if (!isNative) return
    access.value = (await photoBridge.getAccess()).status
    if (!hasAccess(access.value)) {
      autoScan.value = false
      lastScanAt.value = ''
      await (await repository()).clearMetadata()
    }
  }
  async function readPhotos() {
    const repo = await repository()
    await refreshAccess()
    if (!hasAccess(access.value)) return []
    autoScan.value = (await repo.getSetting('autoScan')) === 'true'
    lastScanAt.value = (await repo.getSetting('lastScanAt')) ?? ''
    const photos = await repo.list()
    const visible = new Set<string>()
    // Always revalidate stored identifiers, including changes within limited access.
    for (let i = 0; i < photos.length; i += 200) {
      const result = await photoBridge.filterAccessible({
        assetIds: photos.slice(i, i + 200).map((p) => p.assetId!),
      })
      result.assetIds.forEach((id) => visible.add(id))
    }
    const finalAccess = (await photoBridge.getAccess()).status
    if (!hasAccess(finalAccess) || finalAccess !== access.value) {
      await refreshAccess()
      return []
    }
    await repo.removeInaccessible(
      photos.filter((p) => !visible.has(p.assetId!)).map((p) => p.assetId!),
    )
    return photos.filter((p) => visible.has(p.assetId!))
  }
  async function requestAccess() {
    if (!isNative || requesting.value || scanning.value) return
    requesting.value = true
    error.value = ''
    try {
      access.value = (await photoBridge.requestAccess()).status
    } catch {
      error.value = '系统授权未完成，请重试或打开系统设置。'
    } finally {
      requesting.value = false
    }
  }
  async function startScan() {
    if (!isNative || scanning.value) return
    error.value = ''
    preparing.value = true
    cancelRequested = false
    try {
      await repository()
      if (cancelRequested) {
        scan.value = { ...scan.value, status: 'cancelled' }
        return
      }
      await engine!.scan()
      if (scan.value.status === 'error') error.value = scan.value.error
    } finally {
      preparing.value = false
    }
  }
  function cancel() {
    cancelRequested = true
    engine?.cancel()
  }
  async function setAutoScan(value: boolean) {
    if (scanning.value || requesting.value) return
    if (value) {
      await refreshAccess()
      if (!hasAccess(access.value)) throw new Error('请先连接本机相册并授权')
    }
    await (await repository()).setSetting('autoScan', String(value))
    autoScan.value = value
  }
  async function clearIndex() {
    if (scanning.value || requesting.value) throw new Error('请先取消扫描并等待结束')
    await (await repository()).clearMetadata()
    autoScan.value = false
    lastScanAt.value = ''
    scan.value = { status: 'idle', processed: 0, total: 0, error: '' }
  }
  async function openSettings() {
    await photoBridge.openSettings()
  }
  return {
    isNative,
    access,
    autoScan,
    lastScanAt,
    error,
    scan,
    requesting,
    scanning,
    readPhotos,
    requestAccess,
    startScan,
    cancel,
    setAutoScan,
    clearIndex,
    openSettings,
  }
})
