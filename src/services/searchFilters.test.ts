import { describe, expect, it } from 'vitest'
import { createDemoPhotos } from '../data/demo'
import { filterPhotos } from './photoService'
describe('combined local photo filters', () => {
  it('combines all conditions and includes both date boundaries', () => {
    const photos = createDemoPhotos().map((p) => ({ ...p, manualTags: ['Travel', '纪念'] }))
    const results = filterPhotos(photos, {
      fromDate: '2026-10-18',
      toDate: '2026-10-18',
      favoritesOnly: true,
      manualTags: ['travel', '纪念'],
      orientation: 'portrait',
      photoIds: ['demo-1', 'demo-2', 'demo-5'],
      text: '山 绿色',
    })
    expect(results.map((p) => p.id)).toEqual(['demo-1'])
    expect(filterPhotos(photos, { photoIds: [] })).toEqual([])
    expect(filterPhotos(photos, { manualTags: ['Trav'] })).toEqual([])
  })
  it('distinguishes square, landscape and portrait without changing the source array', () => {
    const photos = createDemoPhotos()
    expect(filterPhotos(photos, { orientation: 'square' }).map((p) => p.id)).toEqual([
      'demo-3',
      'demo-9',
    ])
    expect(
      filterPhotos(photos, { orientation: 'landscape' }).every((p) => p.width > p.height),
    ).toBe(true)
    expect(photos).toHaveLength(12)
  })
  it('rejects impossible dates and reversed ranges, accepts leap day', () => {
    expect(() => filterPhotos([], { fromDate: '2026-02-29' })).toThrow('有效')
    expect(() => filterPhotos([], { fromDate: 'not-a-date' })).toThrow('有效')
    expect(() => filterPhotos([], { fromDate: '2026-10-19', toDate: '2026-10-18' })).toThrow(
      '不能晚于',
    )
    expect(filterPhotos([], { fromDate: '2024-02-29' })).toEqual([])
  })
})
