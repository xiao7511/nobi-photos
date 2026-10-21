export interface VisualFingerprint {
  id: string
  hash: string
  aspect: number
  color: [number, number, number]
  contrast: number
}
export interface SimilarGroup {
  id: string
  photoIds: string[]
  distance: number
}
export function fingerprint(
  id: string,
  pixels: Uint8ClampedArray,
  aspect: number,
): VisualFingerprint | null {
  if (pixels.length !== 9 * 8 * 4 || !Number.isFinite(aspect) || aspect <= 0)
    throw new Error('缩略图像素无效')
  const luminance: number[] = []
  const color: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]! / 255
    const rgb = [0, 1, 2].map((c) => pixels[i + c]! * alpha + 255 * (1 - alpha))
    luminance.push(rgb[0]! * 0.299 + rgb[1]! * 0.587 + rgb[2]! * 0.114)
    for (let c = 0; c < 3; c++) color[c] = color[c]! + rgb[c]! / 72
  }
  const mean = luminance.reduce((a, b) => a + b, 0) / 72
  const contrast = Math.sqrt(luminance.reduce((sum, v) => sum + (v - mean) ** 2, 0) / 72)
  if (contrast < 8) return null
  let bits = 0n
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      bits = (bits << 1n) | (luminance[y * 9 + x]! > luminance[y * 9 + x + 1]! ? 1n : 0n)
  return { id, hash: bits.toString(16).padStart(16, '0'), aspect, color, contrast }
}
export function hamming(a: string, b: string) {
  if (!/^[a-f0-9]{16}$/.test(a) || !/^[a-f0-9]{16}$/.test(b)) throw new Error('图像指纹无效')
  let bits = BigInt('0x' + a) ^ BigInt('0x' + b),
    count = 0
  while (bits) {
    bits &= bits - 1n
    count++
  }
  return count
}
export function distance(a: VisualFingerprint, b: VisualFingerprint): number | null {
  if (
    a.contrast < 8 ||
    b.contrast < 8 ||
    Math.abs(Math.log(a.aspect / b.aspect)) > 0.12 ||
    a.color.reduce((sum, v, i) => sum + Math.abs(v - b.color[i]!), 0) > 90
  )
    return null
  const value = hamming(a.hash, b.hash)
  return value <= 6 ? value : null
}
export function groupSimilar(features: VisualFingerprint[]): SimilarGroup[] {
  const groups: { reference: VisualFingerprint; members: string[]; distance: number }[] = []
  const seen = new Set<string>()
  for (const item of [...features].sort((a, b) => a.id.localeCompare(b.id))) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    let match: (typeof groups)[number] | undefined,
      best = 65
    for (const group of groups) {
      const value = distance(item, group.reference)
      if (value !== null && value < best) {
        match = group
        best = value
      }
    }
    if (match) {
      match.members.push(item.id)
      match.distance = Math.max(match.distance, best)
    } else groups.push({ reference: item, members: [item.id], distance: 0 })
  }
  return groups
    .filter((g) => g.members.length > 1)
    .map((g, i) => ({ id: `similar-${i + 1}`, photoIds: g.members, distance: g.distance }))
}
