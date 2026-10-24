import type { Router } from 'vue-router'

export async function handleNativeBack(router: Router, minimize: () => Promise<void>) {
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
  const dialog = dialogs.item(dialogs.length - 1)
  if (dialog) {
    // Preserve component-specific cancellation, including focus and selected-photo cleanup.
    const cancelled = !dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    if (!cancelled && dialog.open) dialog.close()
    return
  }
  const selection = document.querySelector<HTMLButtonElement>('[data-exit-selection]')
  if (selection) {
    if (!selection.disabled) selection.click()
    return
  }
  const path = router.currentRoute.value.path
  if (path === '/albums' && router.currentRoute.value.query?.album) await router.replace('/albums')
  else if (['/privacy', '/account', '/studio'].includes(path)) await router.replace('/profile')
  else if (path !== '/') await router.replace('/')
  else await minimize()
}
