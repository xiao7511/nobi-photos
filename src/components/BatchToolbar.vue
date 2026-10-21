<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Check, ListChecks, X } from '@lucide/vue'
import type { BatchEdit } from '../domain/batchEdit'
import { useLibrary } from '../stores/library'
const props = defineProps<{ selecting: boolean; selectedIds: string[]; total: number }>()
const emit = defineEmits<{ start: []; exit: []; all: []; clear: []; saved: [] }>()
const library = useLibrary()
const dialog = ref<HTMLDialogElement>(),
  action = ref('favorite-on'),
  tagText = ref(''),
  albumId = ref(''),
  error = ref('')
const tagAction = computed(() => action.value.startsWith('tags-'))
const albumAction = computed(() => action.value.startsWith('album-'))
const submittedIds = ref<string[]>([])
let opener: HTMLElement | null = null
function open() {
  submittedIds.value = [...props.selectedIds]
  error.value = ''
  tagText.value = ''
  albumId.value = library.albums[0]?.id ?? ''
  opener = document.activeElement as HTMLElement
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
  if (opener?.isConnected) opener.focus()
}
async function save() {
  error.value = ''
  let edit: BatchEdit
  if (tagAction.value)
    edit = {
      kind: 'tags',
      mode: action.value === 'tags-add' ? 'add' : 'remove',
      tags: tagText.value.split(/[,，\n]/),
    }
  else if (albumAction.value)
    edit = {
      kind: 'album',
      mode: action.value === 'album-add' ? 'add' : 'remove',
      albumId: albumId.value,
    }
  else edit = { kind: 'favorite', value: action.value === 'favorite-on' }
  try {
    await library.editBatch(submittedIds.value, edit)
    close()
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '批量操作未保存，请重试。'
  }
}
watch(
  () => props.selectedIds,
  (ids) => {
    if (dialog.value?.open && submittedIds.value.some((id) => !ids.includes(id))) close()
  },
)
onUnmounted(() => dialog.value?.close())
</script>
<template>
  <div class="batch-toolbar" aria-label="批量整理">
    <button
      v-if="!selecting"
      class="button"
      :disabled="!total || library.loading || library.busy"
      @click="emit('start')"
    >
      <ListChecks :size="17" /> 选择照片
    </button>
    <template v-else>
      <strong role="status">已选 {{ selectedIds.length }} 张</strong>
      <button class="button" :disabled="library.busy" @click="emit('all')">
        {{ total > 500 ? '选择前 500 张' : '全选当前结果' }}
      </button>
      <button class="button" :disabled="!selectedIds.length || library.busy" @click="emit('clear')">
        清空选择
      </button>
      <button class="button primary" :disabled="!selectedIds.length || library.busy" @click="open">
        <Check :size="16" /> 整理所选照片
      </button>
      <button class="button" data-exit-selection :disabled="library.busy" @click="emit('exit')">
        <X :size="16" /> 退出选择
      </button>
      <small>每次最多 500 张 · 仅修改本地整理记录</small>
    </template>
  </div>
  <dialog
    ref="dialog"
    class="confirm-dialog batch-dialog"
    aria-labelledby="batch-title"
    @cancel.prevent="close"
  >
    <form @submit.prevent="save">
      <h2 id="batch-title">批量整理 {{ submittedIds.length }} 张照片</h2>
      <label class="field-label"
        >整理操作<select v-model="action" class="text-input">
          <option value="favorite-on">加入本地收藏</option>
          <option value="favorite-off">取消本地收藏</option>
          <option value="tags-add">添加手动标签</option>
          <option value="tags-remove">移除手动标签</option>
          <option value="album-add">加入已有相册</option>
          <option value="album-remove">移出已有相册</option>
        </select></label
      >
      <label v-if="tagAction" class="field-label"
        >批量手动标签<input
          v-model="tagText"
          class="text-input"
          maxlength="520"
          required
          placeholder="用逗号分隔，例如：旅行，值得纪念"
      /></label>
      <label v-if="albumAction" class="field-label"
        >目标相册<select v-model="albumId" class="text-input" required>
          <option value="" disabled>请选择相册</option>
          <option v-for="album in library.albums" :key="album.id" :value="album.id">
            {{ album.name }}
          </option>
        </select></label
      >
      <p v-if="albumAction && !library.albums.length" class="body-text">
        请先到分类页创建一个相册。
      </p>
      <p class="body-text">
        {{
          tagAction ? '只增减填写的手动标签，保留其他标签。' : '不移动、复制或删除系统照片。'
        }}本次操作将对全部所选照片一起保存。
      </p>
      <p v-if="error" class="banner error" role="alert">{{ error }}</p>
      <div class="data-actions">
        <button class="button" type="button" :disabled="library.busy" @click="close">取消</button
        ><button
          class="button primary"
          type="submit"
          :disabled="library.busy || (albumAction && !albumId)"
        >
          {{ library.busy ? '保存中…' : '确认保存整理' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
