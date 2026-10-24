import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { handleNativeBack } from './navigation'

afterEach(() => {
  document.body.replaceChildren()
})
function state(path: string) {
  const replace = vi.fn().mockResolvedValue(undefined)
  const minimize = vi.fn().mockResolvedValue(undefined)
  const router = { currentRoute: { value: { path } }, replace } as unknown as Router
  return { router, replace, minimize }
}
describe('Android back navigation', () => {
  it('returns from an opened album to its list before leaving the tab', async () => {
    const s = state('/albums')
    s.router.currentRoute.value.query = { album: 'user:smart:animals' }
    await handleNativeBack(s.router, s.minimize)
    expect(s.replace).toHaveBeenCalledWith('/albums')
    expect(s.minimize).not.toHaveBeenCalled()
  })
  it('runs dialog cancellation before navigation so unsaved changes are not submitted', async () => {
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    const cancel = vi.fn((event: Event) => event.preventDefault())
    dialog.addEventListener('cancel', cancel)
    document.body.append(dialog)
    const s = state('/albums')
    await handleNativeBack(s.router, s.minimize)
    expect(cancel).toHaveBeenCalledOnce()
    expect(s.replace).not.toHaveBeenCalled()
    expect(s.minimize).not.toHaveBeenCalled()
  })
  it('closes the topmost ordinary dialog without closing the one underneath', async () => {
    const dialogs = [document.createElement('dialog'), document.createElement('dialog')]
    const closes = dialogs.map((dialog) => {
      dialog.setAttribute('open', '')
      const close = vi.fn()
      Object.defineProperty(dialog, 'close', { value: close })
      document.body.append(dialog)
      return close
    })
    const s = state('/privacy')
    await handleNativeBack(s.router, s.minimize)
    expect(closes[0]).not.toHaveBeenCalled()
    expect(closes[1]).toHaveBeenCalledOnce()
    expect(s.replace).not.toHaveBeenCalled()
  })
  it('exits selection before leaving a tab and waits while a save is busy', async () => {
    const button = document.createElement('button')
    button.dataset.exitSelection = ''
    const exit = vi.fn()
    button.addEventListener('click', exit)
    document.body.append(button)
    const s = state('/search')
    await handleNativeBack(s.router, s.minimize)
    expect(exit).toHaveBeenCalledOnce()
    button.disabled = true
    await handleNativeBack(s.router, s.minimize)
    expect(exit).toHaveBeenCalledOnce()
    expect(s.replace).not.toHaveBeenCalled()
  })
  it.each([
    ['/privacy', '/profile'],
    ['/search', '/'],
    ['/albums', '/'],
  ])('returns from %s to %s without traversing tab history', async (from, to) => {
    const s = state(from)
    await handleNativeBack(s.router, s.minimize)
    expect(s.replace).toHaveBeenCalledWith(to)
    expect(s.minimize).not.toHaveBeenCalled()
  })
  it('minimizes at the photo root instead of exiting or deleting data', async () => {
    const s = state('/')
    await handleNativeBack(s.router, s.minimize)
    expect(s.minimize).toHaveBeenCalledOnce()
    expect(s.replace).not.toHaveBeenCalled()
  })
})
