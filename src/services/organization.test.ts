import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoOrganizationRepository } from './demoOrganization'
import { LocalPhotoRepository, METADATA_KEY } from './localRepository'
import { normalizeName, normalizeTags } from '../domain/organization'
import { LocalPhotoService } from './photoService'
beforeEach(() => localStorage.clear())
describe('offline organization and existing demo metadata', () => {
  it('renames AI albums without replacing membership and keeps the title on subsequent AI merges', async () => {
    const org = new DemoOrganizationRepository(localStorage)
    await org.saveSmartAlbums([
      { key: 'nature', name: 'ignored', photoIds: ['demo-1'], confidence: 0.9 },
    ])
    await org.renameAlbum('user:smart:nature', '  我的山海  ')
    await org.saveSmartAlbums([
      { key: 'nature', name: 'ignored', photoIds: ['demo-2'], confidence: 0.9 },
    ])
    expect(await org.listAlbums()).toEqual([
      { id: 'user:smart:nature', name: '我的山海', photoIds: ['demo-1', 'demo-2'] },
    ])
    await expect(org.renameAlbum('user:smart:nature', '   ')).rejects.toThrow('1–40')
    await expect(org.renameAlbum('user:missing', '名称')).rejects.toThrow('不存在')
    expect((await org.listAlbums())[0]?.name).toBe('我的山海')
  })
  function setup() {
    return {
      photos: new LocalPhotoRepository(localStorage),
      org: new DemoOrganizationRepository(localStorage),
    }
  }
  it('loads existing v1 records and preserves albums and tags when toggling favorites', async () => {
    localStorage.setItem(METADATA_KEY, JSON.stringify({ cleared: false, favorites: ['demo-1'] }))
    const { photos, org } = setup()
    expect(await org.listAlbums()).toEqual([])
    await org.saveAlbum({
      id: 'user:a',
      name: '  周末  ',
      photoIds: ['demo-1', 'demo-1', 'demo-2'],
    })
    await org.saveTags('demo-1', ['  纪念  ', '纪念', 'TRAVEL', 'travel'])
    await photos.setFavorite('demo-2', true)
    const fresh = setup()
    expect(await fresh.org.listAlbums()).toEqual([
      { id: 'user:a', name: '周末', photoIds: ['demo-1', 'demo-2'] },
    ])
    expect((await fresh.photos.list())[0]).toMatchObject({
      manualTags: ['纪念', 'TRAVEL'],
      favorite: true,
    })
    expect((await fresh.photos.list())[1]?.favorite).toBe(true)
    expect(await new LocalPhotoService(fresh.photos).list({ text: '纪念' })).toHaveLength(1)
    expect(localStorage.getItem(METADATA_KEY)).not.toMatch(/thumbnail|data:image|base64/)
  })
  it('renames and edits membership, removing an album without changing photos or tags', async () => {
    const { photos, org } = setup()
    await org.saveAlbum({ id: 'user:a', name: '旅行', photoIds: ['demo-1'] })
    await org.saveTags('demo-1', ['值得收藏'])
    await org.saveAlbum({ id: 'user:a', name: '新的名字', photoIds: ['demo-2'] })
    expect((await org.listAlbums())[0]).toMatchObject({ name: '新的名字', photoIds: ['demo-2'] })
    await org.deleteAlbum('user:a')
    expect(await org.listAlbums()).toEqual([])
    expect(await photos.list()).toHaveLength(12)
    expect((await photos.list())[0]?.tags).toContain('值得收藏')
    await org.saveTags('demo-1', [])
    expect((await photos.list())[0]?.manualTags).toEqual([])
  })
  it('clears organization with demo records and refuses missing photos or unsafe input', async () => {
    const { photos, org } = setup()
    await org.saveAlbum({ id: 'user:a', name: '相册', photoIds: ['demo-1'] })
    await expect(
      org.saveAlbum({ id: 'user:b', name: '不存在', photoIds: ['missing'] }),
    ).rejects.toThrow('不可访问')
    await expect(org.saveTags('missing', ['test'])).rejects.toThrow('未找到')
    await photos.clearMetadata()
    expect(await org.listAlbums()).toEqual([])
    await expect(org.saveTags('demo-1', ['test'])).rejects.toThrow('未找到')
    await photos.restoreDemo()
    expect(await org.listAlbums()).toEqual([])
    expect(() => normalizeName('  ')).toThrow()
    expect(() => normalizeName('x'.repeat(41))).toThrow()
    expect(() => normalizeTags(['x'.repeat(25)])).toThrow()
    expect(() => normalizeTags(Array.from({ length: 21 }, (_, i) => String(i)))).toThrow()
  })
  it('leaves previous persisted state unchanged when storage denies a write', async () => {
    const { org } = setup()
    await org.saveAlbum({ id: 'user:a', name: '保留', photoIds: [] })
    const before = localStorage.getItem(METADATA_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await expect(org.saveAlbum({ id: 'user:a', name: '不应保存', photoIds: [] })).rejects.toThrow(
      'quota',
    )
    expect(localStorage.getItem(METADATA_KEY)).toBe(before)
  })
})
