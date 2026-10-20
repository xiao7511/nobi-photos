<script setup lang="ts">
import { Heart, Images, X, MapPin, ShieldCheck } from '@lucide/vue'
import { nextTick, onUnmounted, ref, watch } from 'vue'
import type { Photo } from '../domain/models'
import { useLibrary } from '../stores/library'
withDefaults(defineProps<{ photos: Photo[]; compact?: boolean }>(), { compact: false })
const library = useLibrary()
const selected = ref<Photo | null>(null)
const dialog = ref<HTMLDialogElement>()
let opener: HTMLElement | null = null
async function open(photo: Photo, event: MouseEvent) {
  opener = event.currentTarget as HTMLElement
  selected.value = photo
  await nextTick()
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
  selected.value = null
  opener?.focus()
}
watch(
  () => library.photos,
  (photos) => {
    if (selected.value && !photos.some((p) => p.id === selected.value?.id)) close()
  },
)
onUnmounted(() => dialog.value?.close())
</script>
<template>
  <div v-if="photos.length" :class="['photo-grid', { compact }]">
    <article v-for="photo in photos" :key="photo.id" class="photo-card">
      <button class="photo-open" :aria-label="`查看${photo.title}`" @click="open(photo, $event)">
        <img
          :src="photo.thumbnail"
          :alt="photo.title"
          :style="{ aspectRatio: `${photo.width}/${photo.height}` }"
          loading="lazy"
        />
        <div class="photo-caption">
          <span>{{ photo.title }}</span
          ><small>{{ photo.location }}</small>
        </div>
      </button>
      <button
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
    <p>暂无匹配的照片，试试其他筛选条件。</p>
    <RouterLink to="/privacy" class="text-link">管理或恢复示例相册 →</RouterLink>
  </div>
  <dialog
    ref="dialog"
    class="photo-dialog"
    aria-label="照片详情"
    @cancel.prevent="close"
    @click="
      (e) => {
        if (e.target === dialog) close()
      }
    "
  >
    <template v-if="selected">
      <button class="dialog-close icon-button" aria-label="关闭照片详情" @click="close">
        <X /></button
      ><img :src="selected.thumbnail" :alt="selected.title" />
      <div class="dialog-info">
        <span class="eyebrow">A LITTLE MOMENT</span>
        <h2>{{ selected.title }}</h2>
        <p><MapPin :size="14" /> {{ selected.location }} · {{ selected.takenAt.slice(0, 10) }}</p>
        <div class="chips">
          <span v-for="tag in selected.tags" :key="tag" class="chip">{{ tag }}</span>
        </div>
        <button
          class="button"
          :disabled="library.busy"
          @click="library.favorite(library.photos.find((p) => p.id === selected?.id)!)"
        >
          <Heart :size="17" />
          {{
            library.photos.find((p) => p.id === selected?.id)?.favorite ? '取消收藏' : '收藏这一刻'
          }}
        </button>
        <p class="fine-print"><ShieldCheck :size="14" /> 本地示例插画 · 未读取系统照片</p>
      </div>
    </template>
  </dialog>
</template>
