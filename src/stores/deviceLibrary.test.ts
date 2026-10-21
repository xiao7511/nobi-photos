import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDemoPhotos } from '../data/demo'
import type { LibraryAccess } from '../native/contracts'
const mocks = vi.hoisted(() => ({
  bridge: {
    getAccess: vi.fn(),
    requestAccess: vi.fn(),
    openSettings: vi.fn(),
    beginSnapshot: vi.fn(),
    readPage: vi.fn(),
    endSnapshot: vi.fn(),
    filterAccessible: vi.fn(),
    thumbnail: vi.fn(),
  },
  repo: {
    list: vi.fn(),
    listAlbums: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    removeInaccessible: vi.fn(),
    clearMetadata: vi.fn(),
    setFavorite: vi.fn(),
    beginScan: vi.fn(),
    stagePage: vi.fn(),
    commitScan: vi.fn(),
    discardScan: vi.fn(),
  },
}))
vi.mock('../native/bridge', () => ({ isNative: true, photoBridge: mocks.bridge }))
vi.mock('../db/nativeDatabase', () => ({ openDeviceRepository: async () => mocks.repo }))
import { useDeviceLibrary } from './deviceLibrary'
import { useLibrary } from './library'
const photos = createDemoPhotos()
  .slice(0, 2)
  .map((p, i) => ({ ...p, source: 'device' as const, assetId: String(i), id: `device:${i}` }))
describe('native UI authorization and privacy guards', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
    mocks.bridge.getAccess.mockResolvedValue({ status: 'granted' })
    mocks.bridge.filterAccessible.mockImplementation(
      async ({ assetIds }: { assetIds: string[] }) => ({ assetIds }),
    )
    mocks.repo.list.mockResolvedValue(photos)
    mocks.repo.listAlbums.mockResolvedValue([])
    mocks.repo.getSetting.mockResolvedValue(undefined)
  })
  it('never prompts or scans at launch and defaults automatic scanning to off', async () => {
    const store = useDeviceLibrary()
    expect(store.autoScan).toBe(false)
    expect(await store.readPhotos()).toHaveLength(2)
    expect(store.autoScan).toBe(false)
    expect(mocks.bridge.requestAccess).not.toHaveBeenCalled()
    expect(mocks.bridge.beginSnapshot).not.toHaveBeenCalled()
  })
  it.each(['denied', 'prompt'] as LibraryAccess[])(
    'hides and purges stored metadata for %s access',
    async (status) => {
      mocks.bridge.getAccess.mockResolvedValue({ status })
      const store = useDeviceLibrary()
      store.autoScan = true
      expect(await store.readPhotos()).toEqual([])
      expect(store.autoScan).toBe(false)
      expect(mocks.repo.clearMetadata).toHaveBeenCalledOnce()
      expect(mocks.bridge.filterAccessible).not.toHaveBeenCalled()
    },
  )
  it('revalidates limited selections and removes inaccessible identifiers before display', async () => {
    mocks.bridge.getAccess.mockResolvedValue({ status: 'limited' })
    mocks.bridge.filterAccessible.mockResolvedValue({ assetIds: ['1'] })
    const store = useDeviceLibrary()
    expect((await store.readPhotos()).map((p) => p.assetId)).toEqual(['1'])
    expect(mocks.repo.removeInaccessible).toHaveBeenCalledWith(['0'])
  })
  it('validates in bounded batches and does not show data if permission validation fails', async () => {
    mocks.repo.list.mockResolvedValue(
      Array.from({ length: 401 }, (_, i) => ({
        ...photos[0],
        assetId: String(i),
        id: `device:${i}`,
      })),
    )
    const store = useDeviceLibrary()
    expect(await store.readPhotos()).toHaveLength(401)
    expect(mocks.bridge.filterAccessible.mock.calls.map((c) => c[0].assetIds.length)).toEqual([
      200, 200, 1,
    ])
    mocks.bridge.filterAccessible.mockRejectedValue(new Error('revoked'))
    const library = useLibrary()
    await library.load()
    expect(library.photos).toEqual([])
    expect(library.error).toBeTruthy()
  })
  it('saves automatic scanning only with granted access and after a successful write', async () => {
    const store = useDeviceLibrary()
    await store.setAutoScan(true)
    expect(store.autoScan).toBe(true)
    mocks.repo.setSetting.mockRejectedValue(new Error('disk full'))
    await expect(store.setAutoScan(false)).rejects.toThrow('disk full')
    expect(store.autoScan).toBe(true)
    mocks.bridge.getAccess.mockResolvedValue({ status: 'denied' })
    await expect(store.setAutoScan(true)).rejects.toThrow('先连接')
    expect(mocks.bridge.requestAccess).not.toHaveBeenCalled()
  })
  it('clears device index and disables automatic scanning without requesting native deletion', async () => {
    const store = useDeviceLibrary()
    store.autoScan = true
    await store.clearIndex()
    expect(store.autoScan).toBe(false)
    expect(mocks.repo.clearMetadata).toHaveBeenCalledOnce()
    expect(mocks.bridge.requestAccess).not.toHaveBeenCalled()
    expect(mocks.bridge.beginSnapshot).not.toHaveBeenCalled()
  })
  it('drops late loads after backgrounding and remains hidden until activation', async () => {
    const library = useLibrary()
    let release: ((value: typeof photos) => void) | undefined
    mocks.repo.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    const pending = library.load()
    await vi.waitFor(() => expect(release).toBeDefined())
    library.suspend()
    release!(photos)
    await pending
    expect(library.photos).toEqual([])
    await library.load()
    expect(library.photos).toEqual([])
    library.activate()
    await library.load()
    expect(library.photos).toHaveLength(2)
  })
})
