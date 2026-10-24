import type { Photo } from '../domain/models'
import { compositionCells, cropRect, editPixels, type Crop, type Look } from '../domain/mediaStudio'
import { originalPhoto } from './originalPhoto'

async function decoded(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    const cancel = () => {
      image.src = ''
      finish()
      reject(new Error('创作已取消'))
    }
    const finish = () => {
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', cancel)
    }
    image.onload = () => {
      finish()
      resolve()
    }
    image.onerror = () => {
      finish()
      reject(new Error('照片暂时无法解码'))
    }
    if (signal.aborted) return cancel()
    signal.addEventListener('abort', cancel, { once: true })
    image.src = source
  })
  return image
}
export async function renderMedia(
  photos: Photo[],
  options: { look: Look; amount: number; crop: Crop; collage: boolean },
  signal: AbortSignal,
) {
  if (!photos.length || photos.length > 9 || (!options.collage && photos.length !== 1))
    throw new Error('单图需选择一张，拼图最多九张照片')
  const canvas = document.createElement('canvas')
  let result: Blob
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('当前设备不支持本地图片创作')
    const paint = (
      image: HTMLImageElement,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const drawnWidth = image.naturalWidth * scale,
        drawnHeight = image.naturalHeight * scale
      context.save()
      context.beginPath()
      context.rect(x, y, width, height)
      context.clip()
      // Draw the complete image then clip. SVGs without explicit dimensions can use
      // viewBox units for source cropping, unlike their naturalWidth/naturalHeight.
      context.drawImage(
        image,
        x + (width - drawnWidth) / 2,
        y + (height - drawnHeight) / 2,
        drawnWidth,
        drawnHeight,
      )
      context.restore()
    }
    if (options.collage) {
      canvas.width = canvas.height = 2160
      context.fillStyle = '#f6f7f2'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    const cells = options.collage ? compositionCells(photos.length) : []
    for (let i = 0; i < photos.length; i++) {
      signal.throwIfAborted()
      const lease = await originalPhoto(photos[i]!, signal)
      let image: HTMLImageElement | undefined
      try {
        image = await decoded(lease.source, signal)
        signal.throwIfAborted()
        const rect = cropRect(
          image.naturalWidth,
          image.naturalHeight,
          options.collage ? 'square' : options.crop,
        )
        if (!options.collage) {
          const scale = Math.min(1, 2400 / Math.max(rect.width, rect.height))
          canvas.width = Math.max(1, Math.round(rect.width * scale))
          canvas.height = Math.max(1, Math.round(rect.height * scale))
          paint(image, 0, 0, canvas.width, canvas.height)
        } else {
          const cell = cells[i]!
          paint(image, cell.x, cell.y, cell.width, cell.height)
        }
      } finally {
        if (image) image.src = ''
        await lease.release()
      }
    }
    signal.throwIfAborted()
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    editPixels(pixels.data, options.look, options.amount)
    context.putImageData(pixels, 0, 0)
    result = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('图片生成失败'))),
        'image/jpeg',
        0.92,
      ),
    )
    signal.throwIfAborted()
    if (result.size > 12 * 1024 * 1024) throw new Error('成品超出大小限制，请减少照片数量')
    return { blob: result, width: canvas.width, height: canvas.height }
  } finally {
    canvas.width = canvas.height = 0
  }
}
