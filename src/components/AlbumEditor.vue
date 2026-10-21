<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { X, Check } from '@lucide/vue'
import type { UserAlbum } from '../domain/organization'
import { useLibrary } from '../stores/library'
import { filterPhotos } from '../services/photoService'
import PhotoThumbnail from './PhotoThumbnail.vue'
const library = useLibrary()
const dialog = ref<HTMLDialogElement>(),
  name = ref(''),
  query = ref(''),
  selected = ref<string[]>([]),
  error = ref(''),
  id = ref('')
const emit = defineEmits<{ saved: [id: string] }>()
const matches = computed(() => filterPhotos(library.photos, { text: query.value }))
const shown = computed(() => matches.value.slice(0, 200))
let opener: HTMLElement | null = null
function open(album?: UserAlbum) {
  opener = document.activeElement as HTMLElement
  id.value = album?.id ?? ''
  name.value = album?.name ?? ''
  selected.value = [...(album?.photoIds ?? [])]
  query.value = ''
  error.value = ''
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
  opener?.focus()
}
async function save() {
  error.value = ''
  try {
    const albumId = id.value || `user:${crypto.randomUUID()}`
    await library.saveAlbum({ id: albumId, name: name.value, photoIds: selected.value })
    close()
    emit('saved', albumId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '相册未保存，请重试'
  }
}
defineExpose({ open })
watch(
  () => library.photos,
  (photos) => {
    if (library.isNative && !photos.length) close()
  },
)
onUnmounted(() => dialog.value?.close())
</script>
<template>
  <dialog
    ref="dialog"
    class="album-editor"
    aria-labelledby="album-editor-title"
    @cancel.prevent="close"
  >
    <button
      class="dialog-close icon-button"
      aria-label="关闭相册编辑"
      :disabled="library.busy"
      @click="close"
    >
      <X :size="20" />
    </button>
    <form @submit.prevent="save">
      <span class="eyebrow">YOUR OWN COLLECTION</span>
      <h2 id="album-editor-title">{{ id ? '编辑相册' : '新建相册' }}</h2>
      <label class="field-label"
        >相册名称<input
          v-model="name"
          class="text-input"
          maxlength="40"
          required
          placeholder="给这一集回忆起个名字"
      /></label>
      <label class="field-label"
        >筛选要加入的照片<input
          v-model="query"
          class="text-input"
          placeholder="搜索标题、日期或标签"
      /></label>
      <p class="body-text">
        已选择 {{ selected.length }} 张 · 照片可以属于多个相册。{{
          matches.length > 200 ? '当前仅显示前 200 张，请搜索缩小范围。' : ''
        }}
      </p>
      <div class="album-picker">
        <label v-for="photo in shown" :key="photo.id" class="picker-photo"
          ><PhotoThumbnail :photo="photo" /><input
            v-model="selected"
            type="checkbox"
            :value="photo.id"
            :aria-label="`将${photo.title}加入相册`"
          /><span>{{ photo.title }}</span></label
        >
      </div>
      <p v-if="!library.photos.length" class="body-text">暂无可选照片，可以先创建空相册。</p>
      <p v-if="error" class="banner error" role="alert">{{ error }}</p>
      <p class="fine-print">仅保存本应用的整理关系，不移动或复制系统照片。</p>
      <div class="data-actions">
        <button class="button" type="button" :disabled="library.busy" @click="close">取消</button
        ><button class="button primary" :disabled="library.busy" type="submit">
          <Check :size="16" />{{ library.busy ? '保存中…' : '保存相册' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
