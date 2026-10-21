import { nextTick, ref } from 'vue'
import { expect, it } from 'vitest'
import { createDemoPhotos } from '../data/demo'
import { usePhotoSelection } from './usePhotoSelection'
it('prunes selection when filters or permissions change and clears it on background removal', async () => {
  const photos = ref(createDemoPhotos())
  const selection = usePhotoSelection(photos)
  selection.selecting.value = true
  selection.toggle('demo-1')
  selection.toggle('demo-2')
  photos.value = photos.value.slice(1)
  await nextTick()
  expect(selection.selectedIds.value).toEqual(['demo-2'])
  photos.value = []
  await nextTick()
  expect(selection.selectedIds.value).toEqual([])
  expect(selection.selecting.value).toBe(false)
})
it('caps select all and subsequent individual selection at 500', () => {
  const template = createDemoPhotos()[0]!
  const photos = ref(Array.from({ length: 501 }, (_, i) => ({ ...template, id: String(i) })))
  const selection = usePhotoSelection(photos)
  selection.selectVisible()
  selection.toggle('500')
  expect(selection.selectedIds.value).toHaveLength(500)
  selection.toggle('0')
  selection.toggle('500')
  expect(selection.selectedIds.value).toContain('500')
})
