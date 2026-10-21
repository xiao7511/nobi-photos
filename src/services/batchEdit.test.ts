import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoOrganizationRepository } from './demoOrganization'
import { LocalPhotoRepository, METADATA_KEY } from './localRepository'
import { planBatch } from '../domain/batchEdit'
import { createDemoPhotos } from '../data/demo'

beforeEach(() => localStorage.clear())
describe('atomic browser batch organization', () => {
  it('adds and removes only requested manual tags and album memberships', async () => {
    const org = new DemoOrganizationRepository(localStorage)
    const photos = new LocalPhotoRepository(localStorage)
    await org.saveAlbum({ id: 'user:a', name: '周末', photoIds: ['demo-3'] })
    await org.saveTags('demo-1', ['Keep', 'Travel'])
    await org.editBatch(['demo-1', 'demo-2', 'demo-1'], {
      kind: 'tags',
      mode: 'add',
      tags: ['travel', '新标签'],
    })
    expect((await photos.list())[0]?.manualTags).toEqual(['Keep', 'Travel', '新标签'])
    await org.editBatch(['demo-1', 'demo-2'], { kind: 'tags', mode: 'remove', tags: ['TRAVEL'] })
    expect((await photos.list())[0]?.manualTags).toEqual(['Keep', '新标签'])
    expect((await photos.list())[0]?.tags).toContain('山')
    await org.editBatch(['demo-1', 'demo-2'], { kind: 'album', mode: 'add', albumId: 'user:a' })
    expect((await org.listAlbums())[0]?.photoIds).toEqual(['demo-3', 'demo-1', 'demo-2'])
    await org.editBatch(['demo-1'], { kind: 'album', mode: 'remove', albumId: 'user:a' })
    expect((await org.listAlbums())[0]?.photoIds).toEqual(['demo-3', 'demo-2'])
    expect(await photos.list()).toHaveLength(12)
  })
  it('preserves organization while setting favorites with one storage write', async () => {
    const org = new DemoOrganizationRepository(localStorage)
    await org.saveTags('demo-1', ['纪念'])
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await org.editBatch(['demo-1', 'demo-2'], { kind: 'favorite', value: false })
    expect(write).toHaveBeenCalledTimes(1)
    const fresh = await new LocalPhotoRepository(localStorage).list()
    expect(fresh.slice(0, 2).every((p) => !p.favorite)).toBe(true)
    expect(fresh[0]?.manualTags).toEqual(['纪念'])
    expect(localStorage.getItem(METADATA_KEY)).not.toMatch(/data:image|thumbnail/)
  })
  it('rejects the whole batch if one photo exceeds the tag limit or is inaccessible', async () => {
    const org = new DemoOrganizationRepository(localStorage)
    await org.saveTags(
      'demo-2',
      Array.from({ length: 20 }, (_, i) => `tag${i}`),
    )
    const before = localStorage.getItem(METADATA_KEY)
    await expect(
      org.editBatch(['demo-1', 'demo-2'], { kind: 'tags', mode: 'add', tags: ['extra'] }),
    ).rejects.toThrow('20')
    await expect(
      org.editBatch(['demo-1', 'missing'], { kind: 'favorite', value: true }),
    ).rejects.toThrow('不可访问')
    await expect(
      org.editBatch(['demo-1'], { kind: 'album', mode: 'add', albumId: 'user:missing' }),
    ).rejects.toThrow('不存在')
    expect(localStorage.getItem(METADATA_KEY)).toBe(before)
  })
  it('surfaces quota failure without partially persisting a batch', async () => {
    const org = new DemoOrganizationRepository(localStorage)
    await org.saveTags('demo-1', ['保留'])
    const before = localStorage.getItem(METADATA_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await expect(
      org.editBatch(['demo-1', 'demo-2'], { kind: 'tags', mode: 'add', tags: ['新'] }),
    ).rejects.toThrow('quota')
    expect(localStorage.getItem(METADATA_KEY)).toBe(before)
  })
  it('enforces selection and tag input limits before any storage work', () => {
    const photos = createDemoPhotos()
    expect(() => planBatch([], { kind: 'favorite', value: true }, photos, [])).toThrow('1–500')
    expect(() =>
      planBatch(
        Array.from({ length: 501 }, (_, i) => `id${i}`),
        { kind: 'favorite', value: true },
        photos,
        [],
      ),
    ).toThrow('1–500')
    expect(() =>
      planBatch(['demo-1'], { kind: 'tags', mode: 'remove', tags: [' '] }, photos, []),
    ).toThrow('至少')
  })
})
