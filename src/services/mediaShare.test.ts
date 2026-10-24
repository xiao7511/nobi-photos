import { beforeEach, expect, it, vi } from 'vitest'
import { cleanShareCache, shareFile, shareMedia } from './mediaShare'
const mocks = vi.hoisted(() => ({
  native: false,
  write: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  share: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native } }))
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: mocks.write, deleteFile: mocks.remove, readdir: mocks.list },
}))
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.native = false
  mocks.write.mockResolvedValue({ uri: 'file:///cache/nobi-share/nobi-fixture.jpg' })
  mocks.remove.mockResolvedValue(undefined)
  mocks.share.mockResolvedValue({ activityType: 'test' })
})
it('refuses invalid exports and files that were not prepared by the application', async () => {
  expect(() => shareFile(new Blob(['x'], { type: 'image/svg+xml' }))).toThrow()
  expect(() => shareFile(new Blob([], { type: 'image/jpeg' }))).toThrow()
  await expect(
    shareMedia(new File(['x'], 'nobi-123.jpg', { type: 'image/jpeg' }), ''),
  ).rejects.toThrow()
  expect(mocks.write).not.toHaveBeenCalled()
})
it('leaves unsupported web sharing to the download fallback without native file writes', async () => {
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false })
  await expect(
    shareMedia(shareFile(new Blob(['jpeg'], { type: 'image/jpeg' })), 'draft'),
  ).rejects.toThrow('浏览器')
  expect(mocks.write).not.toHaveBeenCalled()
})
it('shares only a generated private-cache copy and retains it for the receiver to read', async () => {
  mocks.native = true
  const file = shareFile(new Blob(['jpeg'], { type: 'image/jpeg' }))
  await shareMedia(file, 'x'.repeat(400))
  expect(mocks.write).toHaveBeenCalledWith(
    expect.objectContaining({
      directory: 'CACHE',
      path: `nobi-share/${file.name}`,
      recursive: true,
    }),
  )
  expect(mocks.share).toHaveBeenCalledWith(
    expect.objectContaining({
      files: ['file:///cache/nobi-share/nobi-fixture.jpg'],
      text: 'x'.repeat(300),
    }),
  )
  expect(mocks.remove).not.toHaveBeenCalled()
})
it('removes only its generated file when the native chooser is cancelled', async () => {
  mocks.native = true
  mocks.share.mockRejectedValueOnce(new Error('cancelled'))
  const file = shareFile(new Blob(['jpeg'], { type: 'image/jpeg' }))
  await expect(shareMedia(file, '')).rejects.toThrow('cancelled')
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({
    directory: 'CACHE',
    path: `nobi-share/${file.name}`,
  })
})
it('cleans only expired generated files in the dedicated cache directory', async () => {
  mocks.native = true
  mocks.list.mockResolvedValue({
    files: [
      { name: 'nobi-abc.jpg', mtime: Date.now() - 86400001 },
      { name: 'nobi-def.jpg', mtime: Date.now() },
      { name: 'other.jpg', mtime: 0 },
    ],
  })
  await cleanShareCache()
  expect(mocks.list).toHaveBeenCalledWith({ directory: 'CACHE', path: 'nobi-share' })
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({
    directory: 'CACHE',
    path: 'nobi-share/nobi-abc.jpg',
  })
})
