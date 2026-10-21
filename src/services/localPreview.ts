import type { Photo } from '../domain/models'
import { photoBridge } from '../native/bridge'
export async function localPreview(photo: Photo): Promise<string> {
  if (photo.source === 'device') {
    if (!photo.assetId) throw new Error('照片标识缺失')
    const { dataUrl } = await photoBridge.thumbnail({ assetId: photo.assetId })
    if (dataUrl.length > 1_500_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl))
      throw new Error('本地缩略图不可用')
    return dataUrl
  }
  if (!/^\/art\/[a-z-]+\.svg$/.test(photo.thumbnail)) throw new Error('只允许本地示例插画')
  return photo.thumbnail
}
export function decodePixels(source: string, signal: AbortSignal): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const finish = () => {
      signal.removeEventListener('abort', cancel)
      image.onload = null
      image.onerror = null
      image.src = ''
    }
    const cancel = () => {
      finish()
      reject(new Error('分析已取消'))
    }
    if (signal.aborted) {
      cancel()
      return
    }
    signal.addEventListener('abort', cancel, { once: true })
    image.onerror = () => {
      finish()
      reject(new Error('缩略图解码失败'))
    }
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 9
        canvas.height = 8
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('当前设备不支持本地图像分析')
        context.drawImage(image, 0, 0, 9, 8)
        const pixels = context.getImageData(0, 0, 9, 8).data
        finish()
        resolve(pixels)
      } catch (error) {
        finish()
        reject(error)
      }
    }
    image.src = source
  })
}
