import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Theme } from '../domain/models'
export const THEME_KEY = 'nobi.photos.theme.v1'
export const usePreferences = defineStore('preferences', () => {
  const theme = ref<Theme>('system')
  const error = ref('')
  function initialize() {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'light' || saved === 'dark' || saved === 'system') theme.value = saved
    } catch {
      error.value = '主题暂时无法保存，将在当前会话中生效。'
    }
  }
  function setTheme(value: Theme) {
    theme.value = value
    try {
      localStorage.setItem(THEME_KEY, value)
      error.value = ''
    } catch {
      error.value = '主题暂时无法保存，将在当前会话中生效。'
    }
  }
  return { theme, error, initialize, setTheme }
})
