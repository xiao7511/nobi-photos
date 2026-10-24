import { Capacitor } from '@capacitor/core'
import type { Photo } from '../domain/models'
import { photoBridge } from '../native/bridge'
import { localPreview } from './localPreview'

// Each viewer owns at most two temporary files during a slide. Neither the URI nor image bytes enter SQLite/storage.
export async function originalPhoto(photo: Photo, signal: AbortSignal) {
  if (signal.aborted) throw new Error('已取消')
  if (photo.source !== 'device')
    return { source: await localPreview(photo), release: async () => {} }
  if (!photo.assetId) throw new Error('照片标识缺失')
  const leaseId = crypto.randomUUID()
  const release = async () => {
    await photoBridge.releaseOriginal({ leaseId })
  }
  const cancel = () => {
    void release().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    const { fileUri } = await photoBridge.original({ assetId: photo.assetId, leaseId })
    if (signal.aborted) throw new Error('已取消')
    if (!/^file:\/\/\/[^?#]+\/nobi-viewer\/[a-f0-9-]+\.[a-z0-9]+$/i.test(fileUri))
      throw new Error('本机原图地址无效')
    return {
      source: Capacitor.convertFileSrc(fileUri),
      release: async () => {
        signal.removeEventListener('abort', cancel)
        await release()
      },
    }
  } catch (error) {
    signal.removeEventListener('abort', cancel)
    await release().catch(() => {})
    throw error
  }
}
