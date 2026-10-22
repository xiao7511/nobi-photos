<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { X, Heart, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Tags } from '@lucide/vue'
import type { Photo } from '../domain/models'
import { useLibrary } from '../stores/library'
import { localPreview } from '../services/localPreview'
import { originalPhoto } from '../services/originalPhoto'
import TagEditor from './TagEditor.vue'
const props = defineProps<{ photos: Photo[]; initialId: string }>()
const emit = defineEmits<{ close: [] }>()
const library = useLibrary()
const id = ref(props.initialId),
  dialog = ref<HTMLDialogElement>(),
  stage = ref<HTMLElement>()
const photo = computed(() => props.photos.find((p) => p.id === id.value))
const index = computed(() => props.photos.findIndex((p) => p.id === id.value))
const source = ref(''),
  originalSource = ref(''),
  status = ref(''),
  error = ref('')
const zoom = ref(1),
  details = ref(false),
  naturalWidth = ref(0),
  naturalHeight = ref(0)
let controller: AbortController | undefined
let release: (() => Promise<void>) | undefined
let version = 0
function dispose() {
  ++version
  controller?.abort()
  controller = undefined
  const cleanup = release
  release = undefined
  void cleanup?.().catch(() => {})
  source.value = ''
  originalSource.value = ''
}
function close() {
  dispose()
  dialog.value?.close()
  emit('close')
}
async function load() {
  dispose()
  const current = photo.value
  if (!current) return
  const request = version
  controller = new AbortController()
  const signal = controller.signal
  zoom.value = 1
  details.value = false
  error.value = ''
  status.value = '正在读取原图…'
  source.value = current.thumbnail
  void localPreview(current)
    .then((preview) => {
      if (request === version && !originalSource.value) source.value = preview
    })
    .catch(() => {})
  try {
    const result = await originalPhoto(current, signal)
    if (request !== version || signal.aborted) {
      await result.release()
      return
    }
    release = result.release
    originalSource.value = result.source
    source.value = result.source
  } catch {
    if (request !== version) return
    status.value = ''
    error.value = '原图暂不可读：请确认照片已在本机、格式受支持且已授权。超大照片请使用系统相册。'
  }
}
function loaded(event: Event) {
  const image = event.target as HTMLImageElement
  if (!originalSource.value || image.getAttribute('src') !== originalSource.value) return
  naturalWidth.value = image.naturalWidth
  naturalHeight.value = image.naturalHeight
  status.value = photo.value?.source === 'device' ? '原图' : '示例插画'
}
function failed(event: Event) {
  if (
    !originalSource.value ||
    (event.target as HTMLImageElement).getAttribute('src') !== originalSource.value
  )
    return
  originalSource.value = ''
  status.value = ''
  error.value = '当前设备无法显示此原图格式，请使用系统相册。'
  const current = photo.value
  const request = version
  if (current)
    void localPreview(current)
      .then((preview) => {
        if (request === version && photo.value?.id === current.id) source.value = preview
      })
      .catch(() => {})
  void release?.().catch(() => {})
  release = undefined
}
function move(offset: number) {
  const next = props.photos[index.value + offset]
  if (next) id.value = next.id
}
async function setZoom(value: number) {
  if (value > 1 && (!originalSource.value || status.value === '正在读取原图…')) return
  zoom.value = value
  await nextTick()
  if (stage.value) {
    stage.value.scrollLeft = (stage.value.scrollWidth - stage.value.clientWidth) / 2
    stage.value.scrollTop = (stage.value.scrollHeight - stage.value.clientHeight) / 2
  }
}
function key(event: KeyboardEvent) {
  if ((event.target as HTMLElement).closest('input, textarea, select')) return
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    move(1)
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    move(-1)
  }
}
let touchX = 0,
  touchY = 0,
  multiTouch = false
function start(event: TouchEvent) {
  multiTouch = event.touches.length !== 1
  if (event.touches.length !== 1) return
  touchX = event.touches[0]!.clientX
  touchY = event.touches[0]!.clientY
}
function end(event: TouchEvent) {
  if (multiTouch || zoom.value !== 1 || event.changedTouches.length !== 1 || event.touches.length)
    return
  const x = event.changedTouches[0]!.clientX - touchX,
    y = event.changedTouches[0]!.clientY - touchY
  if (Math.abs(x) > 70 && Math.abs(x) > Math.abs(y) * 1.5) move(x < 0 ? 1 : -1)
}
function visibility() {
  if (document.hidden) close()
}
watch(
  () => photo.value?.id,
  (value) => {
    if (!value) close()
    else void load()
  },
  { immediate: true },
)
onMounted(() => {
  dialog.value?.showModal()
  document.addEventListener('visibilitychange', visibility)
})
onUnmounted(() => {
  dispose()
  dialog.value?.close()
  document.removeEventListener('visibilitychange', visibility)
})
</script>
<template>
  <dialog
    ref="dialog"
    class="photo-viewer"
    aria-label="照片详情"
    @cancel.prevent="close"
    @keydown="key"
  >
    <template v-if="photo">
      <header class="viewer-toolbar">
        <button class="viewer-button" aria-label="关闭照片详情" autofocus @click="close">
          <X :size="22" />
        </button>
        <span class="viewer-count">{{ index + 1 }} / {{ photos.length }}</span>
        <button
          class="viewer-button"
          :aria-label="photo.favorite ? '取消收藏' : '收藏照片'"
          :aria-pressed="photo.favorite"
          :disabled="library.busy"
          @click="library.favorite(photo)"
        >
          <Heart :size="21" :fill="photo.favorite ? 'currentColor' : 'none'" />
        </button>
        <button
          class="viewer-button"
          aria-label="编辑标签"
          :aria-expanded="details"
          @click="details = !details"
        >
          <Tags :size="21" />
        </button>
      </header>
      <div
        ref="stage"
        class="viewer-stage"
        :class="{ zoomed: zoom > 1 }"
        @touchstart.passive="start"
        @touchend.passive="end"
        @dblclick="setZoom(zoom === 1 ? 2 : 1)"
      >
        <img
          :key="source + ':' + !!originalSource"
          class="viewer-image"
          :src="source || undefined"
          :alt="photo.title"
          :style="
            zoom > 1
              ? { width: `${naturalWidth * zoom}px`, height: `${naturalHeight * zoom}px` }
              : undefined
          "
          draggable="false"
          @load="loaded"
          @error="failed"
        />
      </div>
      <footer class="viewer-toolbar viewer-bottom">
        <button
          class="viewer-button"
          aria-label="上一张照片"
          :disabled="index <= 0"
          @click="move(-1)"
        >
          <ChevronLeft :size="24" />
        </button>
        <span class="viewer-quality" role="status">{{ status }}</span>
        <button
          class="viewer-button"
          :aria-label="zoom > 1 ? '适应屏幕' : '放大照片'"
          :disabled="!originalSource || status === '正在读取原图…'"
          @click="setZoom(zoom > 1 ? 1 : 2)"
        >
          <ZoomOut v-if="zoom > 1" :size="21" /><ZoomIn v-else :size="21" />
        </button>
        <button
          class="viewer-button"
          aria-label="下一张照片"
          :disabled="index >= photos.length - 1"
          @click="move(1)"
        >
          <ChevronRight :size="24" />
        </button>
      </footer>
      <div v-if="error" class="viewer-error" role="alert">
        {{ error }} <button @click="load">重试</button>
      </div>
      <section v-if="details" class="viewer-details" aria-label="照片标签">
        <div class="viewer-details-title">
          <h2>{{ photo.title }}</h2>
          <button class="icon-button" aria-label="收起标签" @click="details = false">
            <X :size="20" />
          </button>
        </div>
        <div class="chips">
          <span v-for="tag in photo.tags" :key="tag" class="chip">{{ tag }}</span>
        </div>
        <TagEditor :photo-id="photo.id" />
      </section>
    </template>
  </dialog>
</template>
