import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { Photo } from '../domain/models'

export function usePhotoSelection(photos: Ref<Photo[]>) {
  const selecting = ref(false)
  const selectedIds = ref<string[]>([])
  function toggle(id: string) {
    if (selectedIds.value.includes(id))
      selectedIds.value = selectedIds.value.filter((v) => v !== id)
    else if (selectedIds.value.length < 500) selectedIds.value.push(id)
  }
  function selectVisible() {
    selectedIds.value = photos.value.slice(0, 500).map((p) => p.id)
  }
  function clear() {
    selectedIds.value = []
  }
  function exit() {
    clear()
    selecting.value = false
  }
  watch(photos, (current) => {
    const available = new Set(current.map((p) => p.id))
    selectedIds.value = selectedIds.value.filter((id) => available.has(id))
    if (!current.length) exit()
  })
  return { selecting, selectedIds, toggle, selectVisible, clear, exit }
}
