import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Photo } from '../domain/models'
import {
  smartSuggestions,
  type ImageLabel,
  type SmartSuggestion,
} from '../domain/smartOrganization'
import { isNative, photoBridge } from '../native/bridge'
import { hasAccess } from '../native/contracts'

export const useSmartOrganization = defineStore('smartOrganization', () => {
  const running = ref(false),
    completed = ref(false),
    processed = ref(0),
    total = ref(0)
  const skipped = ref(0),
    unmatched = ref(0),
    limited = ref(false)
  const error = ref(''),
    engine = ref(''),
    suggestions = ref<SmartSuggestion[]>([])
  let controller: AbortController | undefined
  function reset() {
    controller?.abort()
    suggestions.value = []
    completed.value = false
  }
  function cancel() {
    controller?.abort()
  }
  async function analyze(photos: Photo[]) {
    if (running.value) return
    reset()
    running.value = true
    error.value = engine.value = ''
    processed.value = skipped.value = unmatched.value = 0
    controller = new AbortController()
    const signal = controller.signal
    const selected = [...photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 500)
    total.value = selected.length
    limited.value = photos.length > selected.length
    const results: { photoId: string; labels: ImageLabel[] }[] = []
    try {
      const access = isNative ? (await photoBridge.getAccess()).status : 'unavailable'
      if (isNative && !hasAccess(access)) throw new Error('请先连接相册并授予照片读取权限')
      for (const photo of selected) {
        if (signal.aborted) throw new Error('智能整理已取消，未保存任何建议')
        try {
          if (isNative) {
            if (photo.source !== 'device' || !photo.assetId) throw new Error('本机照片标识不可用')
            const result = await photoBridge.classify({ assetId: photo.assetId })
            if (!Array.isArray(result.labels) || !result.labels.length)
              throw new Error('本机模型没有返回识别结果')
            if (signal.aborted) throw new Error('智能整理已取消')
            engine.value = result.engine
            results.push({ photoId: photo.id, labels: result.labels })
          } else {
            // Explicit browser demonstration only; never claim these are model predictions.
            const label =
              photo.category === '自然'
                ? 'landscape'
                : photo.category === '建筑'
                  ? 'building'
                  : photo.category === '旅行'
                    ? 'beach'
                    : 'coffee'
            results.push({ photoId: photo.id, labels: [{ label, confidence: 1 }] })
            engine.value = 'demo'
          }
        } catch (e) {
          if (
            signal.aborted ||
            (e && typeof e === 'object' && 'code' in e && e.code === 'PERMISSION_DENIED')
          )
            throw e
          skipped.value++
        }
        processed.value++
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      if (isNative) {
        if (selected.length && !results.length)
          throw new Error('本地 AI 未能读取或识别照片，请检查本地预览后重试')
        if ((await photoBridge.getAccess()).status !== access)
          throw new Error('照片权限已变化，请重新分析')
        const available = new Set<string>()
        for (let i = 0; i < selected.length; i += 200) {
          const filtered = await photoBridge.filterAccessible({
            assetIds: selected.slice(i, i + 200).map((p) => p.assetId!),
          })
          filtered.assetIds.forEach((id) => available.add(id))
        }
        if (selected.some((p) => !available.has(p.assetId!)))
          throw new Error('部分照片已不可访问，请重新加载后分析')
      }
      if (signal.aborted) throw new Error('智能整理已取消，未保存任何建议')
      suggestions.value = smartSuggestions(results)
      unmatched.value =
        results.length - suggestions.value.reduce((sum, g) => sum + g.photoIds.length, 0)
      completed.value = true
    } catch (e) {
      suggestions.value = []
      error.value = signal.aborted
        ? '智能整理已取消，未保存任何建议'
        : e instanceof Error
          ? e.message
          : '本地 AI 分析未完成，请检查权限后重试'
    } finally {
      results.length = 0
      running.value = false
      controller = undefined
    }
  }
  return {
    running,
    completed,
    processed,
    total,
    skipped,
    unmatched,
    limited,
    error,
    engine,
    suggestions,
    analyze,
    cancel,
    reset,
  }
})
