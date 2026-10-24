<script setup lang="ts">
import { Heart, Images } from '@lucide/vue'
import { ref } from 'vue'
import type { Photo } from '../domain/models'
import { useLibrary } from '../stores/library'
import PhotoThumbnail from './PhotoThumbnail.vue'
import PhotoViewer from './PhotoViewer.vue'
import type { MusicTheme } from '../domain/albumMusic'
const props = withDefaults(
  defineProps<{
    photos: Photo[]
    compact?: boolean
    selecting?: boolean
    selectedIds?: string[]
    musicTheme?: MusicTheme
    galleryHidden?: boolean
  }>(),
  {
    compact: false,
    selecting: false,
    selectedIds: () => [],
    musicTheme: undefined,
    galleryHidden: false,
  },
)
const emit = defineEmits<{ toggle: [id: string] }>()
const library = useLibrary()
const selected = ref('')
const autoplay = ref(false)
let opener: HTMLElement | null = null
function open(photo: Photo, event: MouseEvent) {
  opener = event.currentTarget as HTMLElement
  selected.value = photo.id
  autoplay.value = false
}
function play() {
  const first = props.photos[0]
  if (!first) return
  opener = document.activeElement as HTMLElement
  autoplay.value = true
  selected.value = first.id
}
function openPhoto(id: string) {
  if (!props.photos.some((photo) => photo.id === id)) return
  opener = document.activeElement as HTMLElement
  autoplay.value = false
  selected.value = id
}
defineExpose({ play, openPhoto })
function close() {
  selected.value = ''
  opener?.focus()
}
</script>
<template>
  <div v-if="photos.length" v-show="!galleryHidden" :class="['photo-grid', { compact }]">
    <article v-for="photo in photos" :key="photo.id" class="photo-card">
      <button
        class="photo-open"
        :aria-label="`${selecting ? '选择' : '查看'}${photo.title}`"
        :aria-pressed="selecting ? selectedIds.includes(photo.id) : undefined"
        :class="{ 'selection-active': selecting && selectedIds.includes(photo.id) }"
        @click="selecting ? emit('toggle', photo.id) : open(photo, $event)"
      >
        <PhotoThumbnail :photo="photo" />
        <span v-if="selecting" class="photo-selection" aria-hidden="true">{{
          selectedIds.includes(photo.id) ? '✓' : ''
        }}</span>
        <div class="photo-caption">
          <span>{{ photo.title }}</span
          ><small>{{ photo.location }}</small>
        </div>
      </button>
      <button
        v-if="!selecting"
        :class="['favorite-button', { saved: photo.favorite }]"
        :aria-label="`${photo.favorite ? '取消收藏' : '收藏'}${photo.title}`"
        :aria-pressed="photo.favorite"
        :disabled="library.busy"
        @click="library.favorite(photo)"
      >
        <Heart :size="17" :fill="photo.favorite ? 'currentColor' : 'none'" />
      </button>
    </article>
  </div>
  <div v-else class="empty-state">
    <Images :size="42" />
    <h3>留一点空间，给新的回忆</h3>
    <p>
      {{
        library.isNative
          ? '暂无匹配照片；可连接相册、扫描或更换筛选条件。'
          : '暂无匹配的照片，试试其他筛选条件。'
      }}
    </p>
    <RouterLink to="/privacy" class="text-link">{{
      library.isNative ? '管理本机相册与权限 →' : '管理或恢复示例相册 →'
    }}</RouterLink>
  </div>
  <PhotoViewer
    v-if="selected"
    :photos="photos"
    :initial-id="selected"
    :autoplay="autoplay"
    :music-theme="musicTheme"
    @close="close"
  />
</template>
