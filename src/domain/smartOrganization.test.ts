import { describe, expect, it } from 'vitest'
import { classifyTopic, planSmartAlbums, smartSuggestions } from './smartOrganization'
import { createDemoPhotos } from '../data/demo'
describe('offline classification suggestions', () => {
  it('accepts confident general topics and rejects uncertain or sensitive/unmapped predictions', () => {
    expect(classifyTopic([{ label: 'tabby, tabby_cat', confidence: 0.91 }])?.key).toBe('animals')
    expect(classifyTopic([{ label: 'hotdog', confidence: 0.9 }])?.key).toBe('food')
    expect(classifyTopic([{ label: 'catamaran', confidence: 0.9 }])).toBeUndefined()
    expect(classifyTopic([{ label: 'landscape', confidence: 0.54 }])).toBeUndefined()
    expect(classifyTopic([{ label: 'military_uniform', confidence: 0.99 }])).toBeUndefined()
    expect(
      classifyTopic([
        { label: 'cat', confidence: NaN },
        { label: 'cat', confidence: 1.1 },
      ]),
    ).toBeUndefined()
  })
  it('chooses the highest matching model score, deduplicates members and reports minimum score', () => {
    const suggestions = smartSuggestions([
      {
        photoId: 'a',
        labels: [
          { label: 'cat', confidence: 0.61 },
          { label: 'pizza', confidence: 0.82 },
        ],
      },
      { photoId: 'a', labels: [{ label: 'pizza', confidence: 0.9 }] },
      { photoId: 'b', labels: [{ label: 'coffee', confidence: 0.72 }] },
    ])
    expect(suggestions).toEqual([
      { key: 'food', name: '美食与饮品', photoIds: ['a', 'b'], confidence: 0.72 },
    ])
  })
  it('merges reviewed members and preserves a renamed smart album', () => {
    const photos = createDemoPhotos()
    const plan = planSmartAlbums(
      [{ key: 'nature', name: 'untrusted', photoIds: [photos[0]!.id], confidence: 0.9 }],
      photos,
      [{ id: 'user:smart:nature', name: '我的山海', photoIds: [photos[1]!.id] }],
    )
    expect(plan.added).toBe(0)
    expect(plan.albums[0]).toEqual({
      id: 'user:smart:nature',
      name: '我的山海',
      photoIds: [photos[1]!.id, photos[0]!.id],
    })
  })
  it('rejects stale photos and album-limit overflow before writing', () => {
    const photos = createDemoPhotos()
    expect(() =>
      planSmartAlbums(
        [{ key: 'nature', name: 'x', photoIds: ['missing'], confidence: 1 }],
        photos,
        [],
      ),
    ).toThrow('不可访问')
    expect(() =>
      planSmartAlbums(
        [{ key: 'nature', name: 'x', photoIds: [photos[0]!.id], confidence: 1 }],
        photos,
        Array.from({ length: 200 }, (_, i) => ({ id: `user:${i}`, name: 'x', photoIds: [] })),
      ),
    ).toThrow('200')
  })
})
