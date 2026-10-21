<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Photo } from '../domain/models'
import { photoBridge } from '../native/bridge'
const props = defineProps<{ photo: Photo; detail?: boolean }>()
const element = ref<HTMLImageElement>()
const source = ref(props.photo.thumbnail)
const unavailable = ref(false)
let observer: IntersectionObserver | undefined
let alive = true
let version = 0
async function load() {
  const request = ++version
  if (props.photo.source !== 'device' || !props.photo.assetId) return
  try {
    const result = await photoBridge.thumbnail({ assetId: props.photo.assetId })
    if (!alive || request !== version) return
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result.dataUrl))
      source.value = result.dataUrl
    else unavailable.value = true
  } catch {
    if (alive && request === version) unavailable.value = true
  }
}
onMounted(() => {
  if (props.detail || !('IntersectionObserver' in window)) {
    void load()
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect()
        void load()
      }
    },
    { rootMargin: '150px' },
  )
  if (element.value) observer.observe(element.value)
})
watch(
  () => props.photo.id,
  () => {
    source.value = props.photo.thumbnail
    unavailable.value = false
    void load()
  },
)
onUnmounted(() => {
  alive = false
  ++version
  observer?.disconnect()
  source.value = ''
})
</script>
<template>
  <img
    ref="element"
    :src="source"
    :alt="unavailable ? `${photo.title}（本地缩略图不可用）` : photo.title"
    :style="detail ? undefined : { aspectRatio: `${photo.width}/${photo.height}` }"
    loading="lazy"
  />
</template>
