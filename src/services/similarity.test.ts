import { describe, expect, it } from 'vitest'
import { fingerprint, hamming, groupSimilar } from './similarity'
import type { VisualFingerprint } from './similarity'
function feature(id: string, hash = '0000000000000000'): VisualFingerprint {
  return { id, hash, aspect: 1, color: [100, 120, 100], contrast: 30 }
}
describe('local perceptual suggestions', () => {
  it('creates deterministic 64 bit fingerprints and excludes near blank previews', () => {
    const pixels = new Uint8ClampedArray(9 * 8 * 4)
    for (let i = 0; i < 72; i++) {
      pixels[i * 4] = i * 3
      pixels[i * 4 + 1] = (i % 9) * 25
      pixels[i * 4 + 2] = 200
      pixels[i * 4 + 3] = 255
    }
    expect(fingerprint('a', pixels, 1)?.hash).toMatch(/^[a-f0-9]{16}$/)
    expect(fingerprint('a', pixels, 1)).toEqual(fingerprint('a', pixels, 1))
    pixels.fill(255)
    expect(fingerprint('blank', pixels, 1)).toBeNull()
    expect(() => fingerprint('bad', new Uint8ClampedArray(4), 1)).toThrow('无效')
    expect(() => fingerprint('bad', pixels, 0)).toThrow('无效')
  })
  it('checks bit distance without treating distant, different aspect or color photos as similar', () => {
    expect(hamming('ffffffffffffffff', '0000000000000000')).toBe(64)
    expect(() => hamming('bad', '0000000000000000')).toThrow('无效')
    const groups = groupSimilar([
      feature('a'),
      feature('b', '000000000000000f'),
      feature('c', 'ffffffffffffffff'),
      { ...feature('wide'), aspect: 2 },
      { ...feature('red'), color: [255, 0, 0] },
    ])
    expect(groups).toEqual([{ id: 'similar-1', photoIds: ['a', 'b'], distance: 4 }])
  })
  it('does not chain distant photos through intermediates and ignores repeated identifiers', () => {
    const groups = groupSimilar([
      feature('a'),
      feature('b', '000000000000003f'),
      feature('c', '0000000000000fff'),
      feature('b'),
    ])
    expect(groups[0]?.photoIds).toEqual(['a', 'b'])
    expect(groups[0]?.distance).toBe(6)
  })
})
