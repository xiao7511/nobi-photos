import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Photo } from '../domain/models'
import { isNative, photoBridge } from '../native/bridge'
import { hasAccess } from '../native/contracts'
import { localPreview, decodePixels } from '../services/localPreview'
import { fingerprint, groupSimilar } from '../services/similarity'
import type { SimilarGroup, VisualFingerprint } from '../services/similarity'
export const useAnalysis = defineStore('analysis', () => {
  const running = ref(false),
    completed = ref(false),
    processed = ref(0),
    total = ref(0),
    skipped = ref(0),
    limited = ref(false)
  const error = ref(''),
    groups = ref<SimilarGroup[]>([]),
    reviewed = ref<string[]>([])
  let controller: AbortController | undefined
  function cancel() {
    controller?.abort()
  }
  function reset() {
    cancel()
    groups.value = []
    reviewed.value = []
    completed.value = false
  }
  async function analyze(photos: Photo[]) {
    if (running.value) return
    reset()
    error.value = ''
    running.value = true
    processed.value = 0
    skipped.value = 0
    controller = new AbortController()
    const signal = controller.signal
    const selected = photos.slice(0, 500)
    total.value = selected.length
    limited.value = photos.length > 500
    const features: VisualFingerprint[] = []
    try {
      if (isNative && !hasAccess((await photoBridge.getAccess()).status))
        throw new Error('照片权限不可用')
      for (const photo of selected) {
        if (signal.aborted) throw new Error('分析已取消')
        try {
          const source = await localPreview(photo)
          if (signal.aborted) throw new Error('分析已取消')
          const result = fingerprint(
            photo.id,
            await decodePixels(source, signal),
            photo.width / photo.height,
          )
          if (result) features.push(result)
          else skipped.value++
        } catch {
          if (signal.aborted) throw new Error('分析已取消')
          skipped.value++
        }
        processed.value++
        if (processed.value % 8 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      if (isNative) {
        if (!hasAccess((await photoBridge.getAccess()).status))
          throw new Error('照片权限已变化，请重新加载后分析')
        const available = new Set<string>()
        for (let i = 0; i < selected.length; i += 200) {
          const result = await photoBridge.filterAccessible({
            assetIds: selected.slice(i, i + 200).map((p) => p.assetId!),
          })
          result.assetIds.forEach((id) => available.add(id))
        }
        for (let i = features.length - 1; i >= 0; i--)
          if (!available.has(selected.find((p) => p.id === features[i]!.id)!.assetId!))
            features.splice(i, 1)
      }
      if (signal.aborted) throw new Error('分析已取消')
      groups.value = groupSimilar(features)
      completed.value = true
    } catch (e) {
      groups.value = []
      error.value = e instanceof Error ? e.message : '分析未完成'
    } finally {
      features.length = 0
      running.value = false
      controller = undefined
    }
  }
  function keep(id: string) {
    if (!reviewed.value.includes(id)) reviewed.value.push(id)
  }
  return {
    running,
    completed,
    processed,
    total,
    skipped,
    limited,
    error,
    groups,
    reviewed,
    analyze,
    cancel,
    reset,
    keep,
  }
})
