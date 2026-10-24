<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Expand } from '@lucide/vue'
import type { Photo } from '../domain/models'
import PhotoThumbnail from './PhotoThumbnail.vue'
const props = defineProps<{ photos: Photo[] }>()
const emit = defineEmits<{ open: [id: string] }>()
const scene = ref<HTMLElement>()
const selectedId = ref(
  props.photos[Math.min(2, Math.floor((props.photos.length - 1) / 2))]?.id ?? '',
)
const index = computed(() =>
  Math.max(
    0,
    props.photos.findIndex((p) => p.id === selectedId.value),
  ),
)
const leaves = computed(() =>
  props.photos.slice(Math.max(0, index.value - 2), index.value + 3).map((photo) => ({
    photo,
    offset: props.photos.indexOf(photo) - index.value,
  })),
)
watch(
  () => props.photos,
  (photos) => {
    if (photos.length && !photos.some((p) => p.id === selectedId.value))
      selectedId.value = photos[Math.min(2, Math.floor((photos.length - 1) / 2))]!.id
  },
)
function move(offset: number) {
  const next = props.photos[index.value + offset]
  if (next) selectedId.value = next.id
}
async function keyMove(offset: number) {
  move(offset)
  await nextTick()
  scene.value?.querySelector<HTMLButtonElement>('.fan-photo.is-active')?.focus()
}
function choose(photo: Photo) {
  if (photo.id === selectedId.value) emit('open', photo.id)
  else selectedId.value = photo.id
}
let touchX = 0,
  touchY = 0
function start(event: TouchEvent) {
  if (event.touches.length !== 1) return
  touchX = event.touches[0]!.clientX
  touchY = event.touches[0]!.clientY
}
function end(event: TouchEvent) {
  if (event.changedTouches.length !== 1 || event.touches.length) return
  const x = event.changedTouches[0]!.clientX - touchX,
    y = event.changedTouches[0]!.clientY - touchY
  if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y) * 1.5) move(x < 0 ? 1 : -1)
}
</script>
<template>
  <section v-if="photos.length" class="album-fan-browser" aria-label="扇形相册浏览">
    <div
      ref="scene"
      class="album-fan-scene"
      @touchstart.passive="start"
      @touchend.passive="end"
      @keydown.left.prevent="keyMove(-1)"
      @keydown.right.prevent="keyMove(1)"
    >
      <button
        v-for="leaf in leaves"
        :key="leaf.photo.id"
        class="fan-photo"
        :class="{ 'is-active': leaf.offset === 0 }"
        :aria-label="leaf.offset === 0 ? `查看${leaf.photo.title}` : `选中${leaf.photo.title}`"
        :aria-current="leaf.offset === 0 ? 'true' : undefined"
        :tabindex="leaf.offset === 0 ? 0 : -1"
        :style="{
          '--offset': leaf.offset,
          '--rotation': `${leaf.offset * 13}deg`,
          zIndex: 5 - Math.abs(leaf.offset),
        }"
        @click="choose(leaf.photo)"
      >
        <PhotoThumbnail :photo="leaf.photo" /><span v-if="leaf.offset === 0" class="fan-open-hint"
          ><Expand :size="14" /> 点击查看原图</span
        >
      </button>
    </div>
    <div class="fan-navigation">
      <button class="icon-button" aria-label="扇形上一张" :disabled="index === 0" @click="move(-1)">
        <ChevronLeft :size="22" />
      </button>
      <span role="status">{{ index + 1 }} / {{ photos.length }}</span>
      <button
        class="icon-button"
        aria-label="扇形下一张"
        :disabled="index >= photos.length - 1"
        @click="move(1)"
      >
        <ChevronRight :size="22" />
      </button>
    </div>
  </section>
</template>
