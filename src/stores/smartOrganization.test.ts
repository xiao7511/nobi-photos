import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDemoPhotos } from '../data/demo'
const mocks = vi.hoisted(() => ({
  classify: vi.fn(),
  getAccess: vi.fn(),
  filterAccessible: vi.fn(),
}))
vi.mock('../native/bridge', () => ({ isNative: true, photoBridge: mocks }))
import { useSmartOrganization } from './smartOrganization'
const photos = () =>
  createDemoPhotos()
    .slice(0, 2)
    .map((p, i) => ({ ...p, source: 'device' as const, assetId: String(i) }))
describe('explicit native AI analysis', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    mocks.getAccess.mockResolvedValue({ status: 'granted' })
    mocks.filterAccessible.mockImplementation(async ({ assetIds }) => ({ assetIds }))
    mocks.classify.mockResolvedValue({
      engine: 'test-native',
      labels: [{ label: 'cat', confidence: 0.9 }],
    })
  })
  it('never starts automatically; publishes only final validated suggestions without persistence', async () => {
    const store = useSmartOrganization()
    expect(mocks.classify).not.toHaveBeenCalled()
    await store.analyze(photos())
    expect(store.completed).toBe(true)
    expect(store.suggestions[0]?.photoIds).toHaveLength(2)
    expect(store.engine).toBe('test-native')
    store.reset()
    expect(store.suggestions).toEqual([])
  })
  it('discards an in-flight result when entering background or cancelling', async () => {
    let resolve: ((value: unknown) => void) | undefined
    mocks.classify.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const store = useSmartOrganization(),
      pending = store.analyze(photos())
    await vi.waitFor(() => expect(resolve).toBeDefined())
    store.reset()
    resolve!({ engine: 'test', labels: [{ label: 'cat', confidence: 1 }] })
    await pending
    expect(store.completed).toBe(false)
    expect(store.suggestions).toEqual([])
  })
  it('discards all results when limited access shrinks during analysis', async () => {
    mocks.filterAccessible.mockResolvedValue({ assetIds: ['0'] })
    const store = useSmartOrganization()
    await store.analyze(photos())
    expect(store.completed).toBe(false)
    expect(store.suggestions).toEqual([])
    expect(store.error).toContain('不可访问')
  })
  it('does not guess labels for previews that cannot be read or classified', async () => {
    mocks.classify.mockRejectedValue(new Error('unavailable'))
    const store = useSmartOrganization()
    await store.analyze(photos())
    expect(store.skipped).toBe(2)
    expect(store.suggestions).toEqual([])
  })
})
