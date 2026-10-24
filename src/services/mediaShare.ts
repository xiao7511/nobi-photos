import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
const directory = 'nobi-share'
const generated = /^nobi-[a-f0-9-]+\.jpg$/
let sharing = false
const prepared = new WeakSet<File>()
export async function cleanShareCache() {
  if (!Capacitor.isNativePlatform() || sharing) return
  let files
  try {
    files = (await Filesystem.readdir({ path: directory, directory: Directory.Cache })).files
  } catch {
    return
  }
  for (const file of files) {
    if (generated.test(file.name) && Date.now() - file.mtime > 24 * 60 * 60 * 1000)
      await Filesystem.deleteFile({
        path: `${directory}/${file.name}`,
        directory: Directory.Cache,
      }).catch(() => {})
  }
}
export function shareFile(blob: Blob) {
  if (blob.type !== 'image/jpeg' || !blob.size || blob.size > 12 * 1024 * 1024)
    throw new Error('仅可分享本地生成且不超过 12MiB 的 JPEG 成品')
  const file = new File([blob], `nobi-${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' })
  prepared.add(file)
  return file
}
export async function shareMedia(file: File, text: string) {
  if (sharing) throw new Error('分享界面已打开')
  if (
    !prepared.has(file) ||
    !generated.test(file.name) ||
    file.type !== 'image/jpeg' ||
    file.size > 12 * 1024 * 1024
  )
    throw new Error('分享成品无效')
  if (!Capacitor.isNativePlatform()) {
    if (!navigator.canShare?.({ files: [file] }))
      throw new Error('此浏览器不支持图片分享，请下载成品后手动发布')
    await navigator.share({ files: [file], text: text.slice(0, 300), title: 'NOBI Photos' })
    return
  }
  sharing = true
  const path = `${directory}/${file.name}`
  try {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1]!)
      reader.onerror = () => reject(new Error('无法准备分享图片'))
      reader.readAsDataURL(file)
    })
    const written = await Filesystem.writeFile({
      directory: Directory.Cache,
      path,
      data,
      recursive: true,
    })
    await Share.share({
      files: [written.uri],
      text: text.slice(0, 300),
      title: 'NOBI Photos',
      dialogTitle: '选择分享应用，再确认发布',
    })
    // Android resolves when a target is chosen, before that target necessarily reads the URI.
    // Keep only this generated copy in private cache for up to 24h; clean on subsequent foreground.
  } catch (error) {
    await Filesystem.deleteFile({ directory: Directory.Cache, path }).catch(() => {})
    throw error
  } finally {
    sharing = false
  }
}
