import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLibrary } from './library'
import { THEME_KEY, usePreferences } from './preferences'
describe('UI state persistence and errors', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  it('commits favorite UI state only after a successful local write', async () => {
    const store = useLibrary()
    await store.load()
    const photo = store.photos[0]!
    await store.favorite(photo)
    expect(photo.favorite).toBe(false)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    await store.favorite(photo)
    expect(photo.favorite).toBe(false)
    expect(store.error).toContain('未保存')
  })
  it('recovers from unreadable metadata via a deliberate reset', async () => {
    localStorage.setItem('nobi.photos.demo.v1', 'invalid')
    const store = useLibrary()
    await store.load()
    expect(store.error).toBeTruthy()
    expect(store.photos).toHaveLength(0)
    await store.reset(false)
    expect(store.error).toBe('')
    expect(store.photos).toHaveLength(12)
  })
  it('does not claim a successful clear on a storage failure', async () => {
    const store = useLibrary()
    await store.load()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    await store.reset(true)
    expect(store.photos).toHaveLength(12)
    expect(store.error).toContain('未完成')
    expect(store.notice).toBe('')
  })
  it('validates saved themes and falls back to session state if storage is blocked', () => {
    localStorage.setItem(THEME_KEY, 'invalid')
    const store = usePreferences()
    store.initialize()
    expect(store.theme).toBe('system')
    store.setTheme('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    store.setTheme('light')
    expect(store.theme).toBe('light')
    expect(store.error).toBeTruthy()
  })
})
