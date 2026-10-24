export type Look = 'natural' | 'bright' | 'warm' | 'clear' | 'mono'
export type Crop = 'original' | 'square' | 'portrait'
export const looks: { id: Look; name: string }[] = [
  { id: 'natural', name: '原色' },
  { id: 'bright', name: '明亮' },
  { id: 'warm', name: '暖色' },
  { id: 'clear', name: '清透' },
  { id: 'mono', name: '黑白' },
]
export function editPixels(pixels: Uint8ClampedArray, look: Look, amount: number) {
  const strength = Math.max(0, Math.min(1, amount / 100))
  if (look === 'natural' || !strength) return
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]!,
      g = pixels[i + 1]!,
      b = pixels[i + 2]!
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
    let next = [r, g, b]
    if (look === 'bright') next = [r, g, b].map((v) => v * 1.06 + 14)
    if (look === 'warm') next = [r + 16, g + 4, b - 12]
    if (look === 'clear') next = [r, g, b].map((v) => (gray + (v - gray) * 1.16 - 128) * 1.06 + 132)
    if (look === 'mono') next = [gray, gray, gray]
    for (let c = 0; c < 3; c++) pixels[i + c] = [r, g, b][c]! * (1 - strength) + next[c]! * strength
  }
}
export function cropRect(width: number, height: number, crop: Crop) {
  if (width <= 0 || height <= 0) throw new Error('照片尺寸无效')
  const ratio = crop === 'square' ? 1 : crop === 'portrait' ? 4 / 5 : width / height
  const w = Math.min(width, height * ratio),
    h = w / ratio
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h }
}
export function mediaCaption(category: string, style: 'simple' | 'warm' | 'travel') {
  // No filenames, places, dates or AI requests; the user can edit this offline draft.
  if (style === 'travel') return '把沿途的风景，收藏进今天。'
  if (style === 'warm') return '平凡日子里，也有想认真珍藏的光。'
  return category === '自然' ? '与自然相遇，把这一刻留住。' : '一些想分享的美好瞬间。'
}
