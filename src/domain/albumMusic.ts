import type { Photo } from './models'
// Original recordings from the composer's official CC BY 4.0 library, unmodified.
const base = 'https://incompetech.com/music/royalty-free/'
const recording = (id: string, title: string, isrc: string) => ({
  id,
  kind: 'online' as const,
  title,
  url: `${base}mp3-royaltyfree/${encodeURIComponent(title)}.mp3`,
  page: `${base}index.html?isrc=${isrc}&Search=Search`,
  artist: 'Kevin MacLeod',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
})
const dream = recording('dream', 'Dream Culture', 'USUAN1300046')
const riley = recording('riley', 'Life of Riley', 'USUAN1400054')
const carefree = recording('carefree', 'Carefree', 'USUAN1400037')
const stroll = recording('stroll', 'Long Stroll', 'USUAN1100174')
export const musicCatalog = [dream, riley, carefree, stroll] as const
export type OnlineMusicTrack = (typeof musicCatalog)[number]
export interface LocalMusicTrack {
  id: 'local'
  kind: 'local'
  title: string
  url: string
  artist: '本机音频'
}
export type MusicTrack = OnlineMusicTrack | LocalMusicTrack
export const musicScores = {
  nature: { ...dream, mood: '自然 · 梦幻钢琴' },
  travel: { ...riley, mood: '旅行 · 轻快吉他' },
  city: { ...stroll, mood: '城市 · 爵士漫步' },
  life: { ...carefree, mood: '生活 · 轻松日常' },
  animals: { ...carefree, mood: '动物 · 活泼木琴' },
  food: { ...stroll, mood: '美食 · 咖啡爵士' },
  documents: { ...dream, mood: '文档 · 舒缓钢琴' },
} as const
export type MusicTheme = keyof typeof musicScores
const categories: Record<Photo['category'], MusicTheme> = {
  自然: 'nature',
  旅行: 'travel',
  建筑: 'city',
  生活: 'life',
  未分类: 'life',
}
export function albumMusicTheme(albumId: string, photos: Photo[]): MusicTheme {
  const topic = albumId.startsWith('user:smart:') ? albumId.slice('user:smart:'.length) : ''
  if (Object.prototype.hasOwnProperty.call(musicScores, topic)) return topic as MusicTheme
  const category = albumId.startsWith('category:') ? albumId.slice(9) : ''
  if (Object.prototype.hasOwnProperty.call(categories, category))
    return categories[category as Photo['category']]
  const votes = new Map<MusicTheme, number>()
  for (const photo of photos) {
    const theme = categories[photo.category]
    votes.set(theme, (votes.get(theme) ?? 0) + 1)
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'life'
}
