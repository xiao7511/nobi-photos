<script setup lang="ts">
import { ref, watch } from 'vue'
import { useLibrary } from '../stores/library'
const props = defineProps<{ photoId: string }>()
const library = useLibrary(),
  text = ref(''),
  error = ref('')
watch(
  () => [props.photoId, library.photos.find((p) => p.id === props.photoId)?.manualTags?.join(', ')],
  () => {
    text.value = library.photos.find((p) => p.id === props.photoId)?.manualTags?.join(', ') ?? ''
    error.value = ''
  },
  { immediate: true },
)
async function save() {
  error.value = ''
  try {
    await library.saveTags(props.photoId, text.value.split(/[,，\n]/))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '标签未保存'
  }
}
</script>
<template>
  <form class="tag-editor" @submit.prevent="save">
    <label class="field-label"
      >手动标签<input
        v-model="text"
        class="text-input"
        aria-label="手动标签"
        placeholder="用逗号分隔，如：周末，值得纪念"
        maxlength="520" /></label
    ><small>最多 20 个，每个 24 字；留空并保存可移除手动标签。</small
    ><button class="button" type="submit" :disabled="library.busy">保存标签</button>
    <p v-if="error" class="banner error" role="alert">{{ error }}</p>
  </form>
</template>
