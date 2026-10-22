import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import { createPinia } from 'pinia'
import PhotosView from './PhotosView.vue'
import { useLibrary } from '../stores/library'

vi.mock('../native/bridge', () => ({ isNative: true, photoBridge: {} }))
vi.mock('../components/PhotoGrid.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../components/BatchToolbar.vue', () => ({ default: { template: '<div />' } }))

let app: App | undefined
let host: HTMLDivElement | undefined
const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
}
afterEach(() => {
  app?.unmount()
  app = undefined
  host?.remove()
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
  vi.restoreAllMocks()
})

it('keeps the native consent dialog mounted across an empty-library refresh', async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: close })
  const pinia = createPinia()
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(PhotosView)
  app.use(pinia)
  app.component(
    'RouterLink',
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('a', slots.default?.()),
    }),
  )
  app.mount(host)
  const library = useLibrary(pinia)
  const connect = [...host.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('连接并读取照片'),
  )!
  expect(connect.disabled).toBe(false)
  connect.click()
  await nextTick()
  const dialog = host.querySelector<HTMLDialogElement>('#library-consent-title')!.closest('dialog')!
  expect(dialog.open).toBe(true)

  library.loading = true
  await nextTick()
  expect(connect.disabled).toBe(true)
  expect(host.querySelector('#library-consent-title')!.closest('dialog')).toBe(dialog)
  expect(dialog.open).toBe(true)
  expect(close).not.toHaveBeenCalled()

  library.loading = false
  await nextTick()
  expect(connect.disabled).toBe(false)
  expect(dialog.open).toBe(true)
})
