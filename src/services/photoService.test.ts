import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalPhotoRepository, METADATA_KEY } from './localRepository'
import { LocalPhotoService } from './photoService'
import { PRIVACY_POLICY } from '../domain/models'
describe('local photo service and privacy boundary', () => {
  beforeEach(() => localStorage.clear())
  function setup() {
    const repository = new LocalPhotoRepository(localStorage)
    return { repository, service: new LocalPhotoService(repository) }
  }
  it('provides only bundled demo assets and no account requirement', async () => {
    const { service } = setup()
    const photos = await service.list()
    expect(photos).toHaveLength(12)
    expect(photos.every((p) => p.source === 'demo' && p.thumbnail.startsWith('/art/'))).toBe(true)
    expect(Object.values(PRIVACY_POLICY).every((v) => v === false)).toBe(true)
    expect(Object.isFrozen(PRIVACY_POLICY)).toBe(true)
    expect(localStorage.length).toBe(0)
  })
  it('searches locally with AND terms and category/favorite filters', async () => {
    const { service } = setup()
    const results = await service.list({ text: '  山  绿色 ', category: '自然' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.map((p) => p.id)).toEqual(['demo-1', 'demo-4', 'demo-8', 'demo-10'])
    expect(await service.list({ text: '不存在的照片' })).toEqual([])
    expect(await service.list({ favoritesOnly: true })).toHaveLength(3)
  })
  it('persists favorite metadata across repository instances', async () => {
    const { service } = setup()
    await service.setFavorite('demo-2', true)
    const fresh = setup()
    expect((await fresh.service.list({ favoritesOnly: true })).map((p) => p.id)).toContain('demo-2')
    await fresh.service.setFavorite('demo-2', false)
    expect((await fresh.service.list({ favoritesOnly: true })).map((p) => p.id)).not.toContain(
      'demo-2',
    )
    expect(localStorage.getItem(METADATA_KEY)).not.toContain('thumbnail')
  })
  it('does not mutate repository state when callers mutate a returned object', async () => {
    const { service } = setup()
    const photos = await service.list()
    photos[0]!.tags.push('changed')
    expect((await service.list())[0]!.tags).not.toContain('changed')
  })
  it('rejects unknown assets and malformed persisted metadata', async () => {
    const { service } = setup()
    await expect(service.setFavorite('missing', true)).rejects.toThrow('未找到')
    localStorage.setItem(METADATA_KEY, '{')
    await expect(service.list()).rejects.toThrow()
    localStorage.setItem(METADATA_KEY, JSON.stringify({ cleared: false, favorites: [1] }))
    await expect(service.list()).rejects.toThrow('格式异常')
  })
  it('clears only app demo records and can recover corrupted data explicitly', async () => {
    const { repository, service } = setup()
    localStorage.setItem('other-app', 'untouched')
    localStorage.setItem('nobi.photos.theme.v1', 'dark')
    await repository.clearMetadata()
    expect(await service.list()).toEqual([])
    expect(localStorage.getItem('other-app')).toBe('untouched')
    expect(localStorage.getItem('nobi.photos.theme.v1')).toBe('dark')
    localStorage.setItem(METADATA_KEY, 'corrupt')
    await repository.restoreDemo()
    expect(await service.list()).toHaveLength(12)
  })
  it('surfaces storage failure without silently claiming a successful save', async () => {
    const repository = new LocalPhotoRepository({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    await expect(repository.setFavorite('demo-1', false)).rejects.toThrow('quota')
    await expect(repository.clearMetadata()).rejects.toThrow('quota')
  })
  it('cannot request native library access, delete originals or use the network', async () => {
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    try {
      const { service } = setup()
      await service.list({ text: '海' })
      await service.cleanupCandidates()
      await service.setFavorite('demo-2', true)
      await expect(service.requestLibraryAccess()).rejects.toThrow('Phase 2')
      await expect(service.deleteOriginals(['demo-1'])).rejects.toThrow('不支持删除')
      expect(await service.list()).toHaveLength(12)
      expect(network).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
