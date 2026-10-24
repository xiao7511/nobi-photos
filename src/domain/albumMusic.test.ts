import { expect, it } from 'vitest'
import { albumMusicTheme, musicScores } from './albumMusic'
import { createDemoPhotos } from '../data/demo'
it('keeps AI album music tied to its stable topic after a title change', () => {
  expect(albumMusicTheme('user:smart:animals', createDemoPhotos())).toBe('animals')
  expect(albumMusicTheme('user:smart:food', [])).toBe('food')
  expect(albumMusicTheme('user:smart:__proto__', [])).toBe('life')
  expect(albumMusicTheme('category:自然', [])).toBe('nature')
  expect(albumMusicTheme('category:旅行', [])).toBe('travel')
  expect(albumMusicTheme('category:建筑', [])).toBe('city')
})
it('uses the dominant category for manual albums and a calm fallback for empty albums', () => {
  const photos = createDemoPhotos().filter((p) => p.category === '自然')
  expect(albumMusicTheme('user:manual', photos)).toBe('nature')
  expect(albumMusicTheme('user:manual', [])).toBe('life')
  expect(new Set(Object.values(musicScores).map((s) => s.title)).size).toBe(7)
})
