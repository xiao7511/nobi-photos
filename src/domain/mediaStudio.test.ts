import { expect, it } from 'vitest'
import { cropRect, editPixels, mediaCaption } from './mediaStudio'
it('center crops within the original boundaries and preserves original aspect', () => {
  expect(cropRect(4000, 3000, 'square')).toEqual({ x: 500, y: 0, width: 3000, height: 3000 })
  expect(cropRect(4000, 3000, 'portrait')).toEqual({ x: 800, y: 0, width: 2400, height: 3000 })
  expect(cropRect(4000, 3000, 'original')).toEqual({ x: 0, y: 0, width: 4000, height: 3000 })
  expect(() => cropRect(0, 3000, 'square')).toThrow()
})
it('applies luminance grayscale while preserving alpha and honoring intensity', () => {
  const pixels = new Uint8ClampedArray([180, 120, 60, 125])
  editPixels(pixels, 'mono', 100)
  expect(pixels[0]).toBe(pixels[1])
  expect(pixels[1]).toBe(pixels[2])
  expect(pixels[3]).toBe(125)
  const unchanged = new Uint8ClampedArray([180, 120, 60, 125])
  editPixels(unchanged, 'warm', 0)
  expect([...unchanged]).toEqual([180, 120, 60, 125])
  editPixels(unchanged, 'warm', 100)
  expect([...unchanged]).toEqual([196, 124, 48, 125])
})
it('clamps brightness and creates drafts without including private context', () => {
  const pixels = new Uint8ClampedArray([255, 250, 0, 255])
  editPixels(pixels, 'bright', 200)
  expect([...pixels]).toEqual([255, 255, 14, 255])
  expect(mediaCaption('私人相册名称', 'simple')).not.toContain('私人')
  expect(mediaCaption('自然', 'travel')).toContain('风景')
})
