import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDemoPhotos } from '../data/demo'
const mocks = vi.hoisted(() => ({ preview: vi.fn(), decode: vi.fn() }))
vi.mock('../services/localPreview', () => ({
  localPreview: mocks.preview,
  decodePixels: mocks.decode,
}))
import { useAnalysis } from './analysis'
function pixels() {
  const data = new Uint8ClampedArray(288)
  for (let i = 0; i < 72; i++) {
    data[i * 4] = i * 3
    data[i * 4 + 1] = (i % 9) * 25
    data[i * 4 + 2] = 200
    data[i * 4 + 3] = 255
  }
  return data
}
describe('explicit local analysis lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
    mocks.preview.mockResolvedValue('/art/mountains.svg')
    mocks.decode.mockResolvedValue(pixels())
  })
  it('starts idle, analyzes only on request and resets session reviews', async () => {
    const store = useAnalysis()
    expect(mocks.preview).not.toHaveBeenCalled()
    expect(store.completed).toBe(false)
    const photos = createDemoPhotos().filter((p) => ['demo-1', 'demo-10'].includes(p.id))
    await store.analyze(photos)
    expect(store.groups).toHaveLength(1)
    expect(store.completed).toBe(true)
    store.keep(store.groups[0]!.id)
    expect(store.reviewed).toHaveLength(1)
    store.reset()
    expect(store.groups).toEqual([])
    expect(store.reviewed).toEqual([])
  })
  it('does not publish incomplete results after cancellation', async () => {
    const store = useAnalysis()
    let release: ((value: Uint8ClampedArray) => void) | undefined
    mocks.decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    const pending = store.analyze(createDemoPhotos())
    await vi.waitFor(() => expect(release).toBeDefined())
    store.cancel()
    release!(pixels())
    await pending
    expect(store.completed).toBe(false)
    expect(store.groups).toEqual([])
    expect(store.error).toContain('取消')
  })
  it('counts unavailable previews instead of claiming verified duplicates', async () => {
    mocks.preview.mockRejectedValue(new Error('unavailable'))
    const store = useAnalysis()
    await store.analyze(createDemoPhotos().slice(0, 2))
    expect(store.skipped).toBe(2)
    expect(store.groups).toEqual([])
  })
  it('limits analysis to 500 photos and never writes storage or requests the network', async () => {
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    try {
      const store = useAnalysis()
      await store.analyze(
        Array.from({ length: 501 }, (_, i) => ({ ...createDemoPhotos()[0]!, id: String(i) })),
      )
      expect(store.processed).toBe(500)
      expect(store.limited).toBe(true)
      expect(network).not.toHaveBeenCalled()
      expect(write).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
