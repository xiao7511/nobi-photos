import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import {
  musicCatalog,
  musicScores,
  type LocalMusicTrack,
  type MusicTheme,
} from '../domain/albumMusic'
import { localMusic, releaseLocalMusic } from '../services/localMusic'

// Session-only selection. File names, audio bytes and blob URLs never enter storage or requests.
export const useMusicSelection = defineStore('music-selection', () => {
  const choice = ref('auto'),
    local = shallowRef<LocalMusicTrack>(),
    open = ref(false)
  const localRequest = ref(0),
    error = ref('')
  function track(theme: MusicTheme) {
    return choice.value === 'local' && local.value
      ? local.value
      : (musicCatalog.find((item) => item.id === choice.value) ?? musicScores[theme])
  }
  function select(id: string) {
    if (id !== 'auto' && !musicCatalog.some((item) => item.id === id)) return
    choice.value = id
    error.value = ''
  }
  function selectFile(file: File) {
    try {
      const next = localMusic(file)
      const previous = local.value
      local.value = next
      choice.value = 'local'
      error.value = ''
      releaseLocalMusic(previous)
    } catch (problem) {
      error.value = problem instanceof Error ? problem.message : '音频暂不可用，请重新选择。'
    }
  }
  function clearLocal() {
    const previous = local.value
    local.value = undefined
    if (choice.value === 'local') choice.value = 'auto'
    releaseLocalMusic(previous)
  }
  function reset() {
    clearLocal()
    choice.value = 'auto'
    open.value = false
    error.value = ''
  }
  return { choice, local, open, localRequest, error, track, select, selectFile, clearLocal, reset }
})
