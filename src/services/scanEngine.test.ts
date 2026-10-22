import { describe, expect, it, vi } from 'vitest'
import { ScanEngine } from './scanEngine'
import type { PhotoLibraryBridge, ScanRepository, DevicePhoto } from '../native/contracts'
const photo: DevicePhoto = {
  assetId: 'a',
  title: 'local',
  takenAt: '2026-10-21T00:00:00Z',
  modifiedAt: '2026-10-21T00:00:00Z',
  width: 10,
  height: 10,
  bytes: 0,
  bytesKnown: false,
}
function setup() {
  const bridge: PhotoLibraryBridge = {
    original: vi.fn(),
    releaseOriginal: vi.fn(),
    getAccess: vi.fn(async () => ({ status: 'granted' as const })),
    requestAccess: vi.fn(),
    openSettings: vi.fn(),
    beginSnapshot: vi.fn(async () => ({ sessionId: 'test', total: 1 })),
    readPage: vi.fn(async () => ({ photos: [photo], nextOffset: 1, done: true })),
    endSnapshot: vi.fn(async () => {}),
    filterAccessible: vi.fn(),
    thumbnail: vi.fn(),
  }
  const repo: ScanRepository = {
    beginScan: vi.fn(async () => {}),
    stagePage: vi.fn(async () => {}),
    commitScan: vi.fn(async () => {}),
    discardScan: vi.fn(async () => {}),
  }
  const engine = new ScanEngine(bridge, repo)
  return { bridge, repo, engine }
}
describe('foreground scanner safety', () => {
  it('never requests permission or opens a snapshot if access is denied', async () => {
    const { bridge, repo, engine } = setup()
    vi.mocked(bridge.getAccess).mockResolvedValue({ status: 'denied' })
    await engine.scan()
    expect(engine.state.status).toBe('error')
    expect(bridge.requestAccess).not.toHaveBeenCalled()
    expect(bridge.beginSnapshot).not.toHaveBeenCalled()
    expect(repo.commitScan).not.toHaveBeenCalled()
  })
  it('commits a complete scan and closes its native snapshot', async () => {
    const { bridge, repo, engine } = setup()
    await engine.scan()
    expect(engine.state).toMatchObject({ status: 'completed', processed: 1, total: 1 })
    expect(repo.stagePage).toHaveBeenCalledWith('test', [photo])
    expect(repo.commitScan).toHaveBeenCalledOnce()
    expect(repo.discardScan).not.toHaveBeenCalled()
    expect(bridge.endSnapshot).toHaveBeenCalledWith({ sessionId: 'test' })
  })
  it('handles empty granted libraries as complete snapshots', async () => {
    const { bridge, repo, engine } = setup()
    vi.mocked(bridge.beginSnapshot).mockResolvedValue({ sessionId: 'empty', total: 0 })
    vi.mocked(bridge.readPage).mockResolvedValue({ photos: [], nextOffset: 0, done: true })
    await engine.scan()
    expect(engine.state.status).toBe('completed')
    expect(repo.commitScan).toHaveBeenCalledWith('empty')
  })
  it('supports limited access, rejecting changed access before commit', async () => {
    const { bridge, repo, engine } = setup()
    vi.mocked(bridge.getAccess)
      .mockResolvedValueOnce({ status: 'granted' })
      .mockResolvedValueOnce({ status: 'limited' })
    await engine.scan()
    expect(engine.state.status).toBe('error')
    expect(repo.commitScan).not.toHaveBeenCalled()
    expect(repo.discardScan).toHaveBeenCalledOnce()
    vi.mocked(bridge.getAccess).mockResolvedValue({ status: 'limited' })
    await engine.scan()
    expect(engine.state.status).toBe('completed')
  })
  it('cancels between pages without changing the committed index', async () => {
    const { bridge, repo, engine } = setup()
    vi.mocked(bridge.readPage).mockImplementation(async () => {
      engine.cancel()
      return { photos: [photo], nextOffset: 1, done: true }
    })
    await engine.scan()
    expect(engine.state.status).toBe('cancelled')
    expect(repo.commitScan).not.toHaveBeenCalled()
    expect(repo.stagePage).not.toHaveBeenCalled()
    expect(repo.discardScan).toHaveBeenCalledOnce()
    expect(bridge.endSnapshot).toHaveBeenCalledOnce()
  })
  it.each(['read', 'write', 'commit'])(
    'discards %s failures and closes the native session',
    async (mode) => {
      const { bridge, repo, engine } = setup()
      if (mode === 'read') vi.mocked(bridge.readPage).mockRejectedValue(new Error('read'))
      if (mode === 'write') vi.mocked(repo.stagePage).mockRejectedValue(new Error('write'))
      if (mode === 'commit') vi.mocked(repo.commitScan).mockRejectedValue(new Error('commit'))
      await engine.scan()
      expect(engine.state.status).toBe('error')
      expect(repo.discardScan).toHaveBeenCalledOnce()
      expect(bridge.endSnapshot).toHaveBeenCalledOnce()
    },
  )
  it('rejects broken cursors and serializes scan requests', async () => {
    const { bridge, repo, engine } = setup()
    let release: (() => void) | undefined
    vi.mocked(bridge.readPage).mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return { photos: [], nextOffset: 0, done: false }
    })
    const pending = engine.scan()
    await vi.waitFor(() => expect(release).toBeDefined())
    await expect(engine.scan()).rejects.toThrow('正在进行')
    release!()
    await pending
    expect(engine.state.status).toBe('error')
    expect(repo.commitScan).not.toHaveBeenCalled()
  })
})
