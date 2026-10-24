import type { LocalMusicTrack, MusicTrack } from '../domain/albumMusic'
import { musicCatalog } from '../domain/albumMusic'
const localURLs = new Set<string>()
export const MAX_MUSIC_BYTES = 100 * 1024 * 1024
export function localMusic(file: File): LocalMusicTrack {
  if (!file.size || file.size > MAX_MUSIC_BYTES)
    throw new Error('请选择非空且不超过 100MB 的音频文件。')
  if (
    !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name) ||
    (file.type && file.type !== 'application/octet-stream' && !file.type.startsWith('audio/'))
  )
    throw new Error('请选择 MP3、M4A、AAC、WAV 等音频文件。')
  const url = URL.createObjectURL(file)
  localURLs.add(url)
  return { id: 'local', kind: 'local', title: file.name, url, artist: '本机音频' }
}
export function releaseLocalMusic(track?: LocalMusicTrack) {
  if (track && localURLs.delete(track.url)) URL.revokeObjectURL(track.url)
}
export function validMusic(track: MusicTrack) {
  return track.kind === 'local'
    ? localURLs.has(track.url)
    : musicCatalog.some((candidate) => candidate.id === track.id && candidate.url === track.url)
}
