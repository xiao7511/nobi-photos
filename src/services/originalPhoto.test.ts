import { expect, it, vi, beforeEach } from 'vitest'
import { originalPhoto } from './originalPhoto'
import { photoBridge } from '../native/bridge'
import { createDemoPhotos } from '../data/demo'
vi.mock('../native/bridge', () => ({
  photoBridge: { original: vi.fn(), releaseOriginal: vi.fn(async () => {}) },
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    convertFileSrc: (value: string) =>
      value.replace('file://', 'https://localhost/_capacitor_file_'),
  },
}))
beforeEach(() => vi.clearAllMocks())
const photo = { ...createDemoPhotos()[0]!, source: 'device' as const, assetId: '17' }
it('uses a local file lease and releases it without storing photo data', async () => {
  vi.mocked(photoBridge.original).mockResolvedValue({
    fileUri: 'file:///cache/nobi-viewer/123-ab.jpg',
  })
  const controller = new AbortController()
  const result = await originalPhoto(photo, controller.signal)
  expect(result.source).toBe('https://localhost/_capacitor_file_/cache/nobi-viewer/123-ab.jpg')
  await result.release()
  expect(photoBridge.releaseOriginal).toHaveBeenCalledWith({
    leaseId: vi.mocked(photoBridge.original).mock.calls[0]![0].leaseId,
  })
})
it('cleans up a pending original when the viewer closes, including a late completion', async () => {
  let finish!: (value: { fileUri: string }) => void
  vi.mocked(photoBridge.original).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const controller = new AbortController()
  const pending = originalPhoto(photo, controller.signal)
  controller.abort()
  finish({ fileUri: 'file:///cache/nobi-viewer/123-ab.jpg' })
  await expect(pending).rejects.toThrow('已取消')
  expect(photoBridge.releaseOriginal).toHaveBeenCalledTimes(2)
})
it('rejects remote or unrelated native file URLs and releases their lease', async () => {
  for (const fileUri of ['https://example.com/photo.jpg', 'file:///private/other.jpg']) {
    vi.mocked(photoBridge.original).mockResolvedValue({ fileUri })
    await expect(originalPhoto(photo, new AbortController().signal)).rejects.toThrow('地址无效')
  }
  expect(photoBridge.releaseOriginal).toHaveBeenCalledTimes(2)
})
