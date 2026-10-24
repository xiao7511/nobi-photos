import type { Photo } from './models'
export const musicScores = {
  nature: {
    title: '山林微风',
    bpm: 64,
    root: 60,
    wave: 'sine',
    melody: [12, 16, 19, 16, 14, 12, 7, 14],
    chords: [0, 5, 9, 7],
  },
  travel: {
    title: '向远方',
    bpm: 92,
    root: 62,
    wave: 'triangle',
    melody: [12, 14, 16, 19, 21, 19, 16, 14],
    chords: [0, 7, 9, 5],
  },
  city: {
    title: '城市漫步',
    bpm: 84,
    root: 57,
    wave: 'triangle',
    melody: [12, 15, 19, 22, 19, 15, 17, 19],
    chords: [0, 5, 8, 7],
  },
  life: {
    title: '日常小确幸',
    bpm: 76,
    root: 60,
    wave: 'sine',
    melody: [16, 19, 21, 19, 16, 14, 12, 7],
    chords: [0, 9, 5, 7],
  },
  animals: {
    title: '小小伙伴',
    bpm: 104,
    root: 65,
    wave: 'triangle',
    melody: [12, 19, 16, 19, 21, 16, 14, 12],
    chords: [0, 5, 7, 0],
  },
  food: {
    title: '午后咖啡',
    bpm: 72,
    root: 62,
    wave: 'sine',
    melody: [12, 16, 19, 23, 21, 19, 16, 14],
    chords: [0, 5, 2, 7],
  },
  documents: {
    title: '纸上时光',
    bpm: 60,
    root: 57,
    wave: 'sine',
    melody: [12, 15, 19, 15, 17, 15, 12, 7],
    chords: [0, 8, 5, 7],
  },
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
  if (Object.prototype.hasOwnProperty.call(categories, category)) return categories[category as Photo['category']]
  const votes = new Map<MusicTheme, number>()
  for (const photo of photos) {
    const theme = categories[photo.category]
    votes.set(theme, (votes.get(theme) ?? 0) + 1)
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'life'
}
