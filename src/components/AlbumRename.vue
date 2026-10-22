<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useLibrary } from '../stores/library'
import type { UserAlbum } from '../domain/organization'
const library = useLibrary()
const dialog = ref<HTMLDialogElement>(),
  name = ref(''),
  id = ref(''),
  error = ref('')
let opener: HTMLElement | null = null
function open(album: UserAlbum) {
  opener = document.activeElement as HTMLElement
  id.value = album.id
  name.value = album.name
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
    await library.renameAlbum(id.value, name.value)
    close()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '相册名称未保存'
  }
}
watch(
  () => library.albums,
  (albums) => {
    if (id.value && !albums.some((a) => a.id === id.value)) close()
  },
)
onUnmounted(() => dialog.value?.close())
defineExpose({ open })
</script>
<template>
  <dialog
    ref="dialog"
    class="confirm-dialog"
    aria-labelledby="rename-album-title"
    @cancel.prevent="close"
  >
    <form @submit.prevent="save">
      <h2 id="rename-album-title">修改相册名称</h2>
      <label class="field-label"
        >相册名称<input v-model="name" class="text-input" maxlength="80" required autofocus
      /></label>
      <p v-if="error" class="banner error" role="alert">{{ error }}</p>
      <div class="data-actions">
        <button type="button" class="button" :disabled="library.busy" @click="close">取消</button
        ><button type="submit" class="button primary" :disabled="library.busy">
          {{ library.busy ? '保存中…' : '保存名称' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
