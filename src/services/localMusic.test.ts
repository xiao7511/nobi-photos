import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { localMusic, releaseLocalMusic, validMusic, MAX_MUSIC_BYTES } from './localMusic'
import { musicCatalog } from '../domain/albumMusic'
import { useMusicSelection } from '../stores/music'
let counter = 0
const create = vi.fn(() => `blob:https://localhost/test-${++counter}`),
  revoke = vi.fn()
beforeEach(() => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create
      static revokeObjectURL = revoke
    },
  )
  setActivePinia(createPinia())
  create.mockClear()
  revoke.mockClear()
})
afterEach(() => {
  useMusicSelection().reset()
  vi.unstubAllGlobals()
})
const file = (name = 'my-song.mp3', type = 'audio/mpeg') => new File(['fixture'], name, { type })
it('only accepts a user-selected audio file and revokes its temporary capability', () => {
  const track = localMusic(file())
  expect(validMusic(track)).toBe(true)
  expect(track.url).toMatch(/^blob:/)
  releaseLocalMusic(track)
  expect(validMusic(track)).toBe(false)
  releaseLocalMusic(track)
  expect(revoke).toHaveBeenCalledOnce()
})
it('rejects non-audio, empty and oversized files before allocating a URL', () => {
  expect(() => localMusic(file('photo.jpg', 'image/jpeg'))).toThrow('音频文件')
  expect(() => localMusic(new File([], 'empty.mp3'))).toThrow('非空')
  const large = file()
  vi.spyOn(large, 'size', 'get').mockReturnValue(MAX_MUSIC_BYTES + 1)
  expect(() => localMusic(large)).toThrow('100MB')
  expect(create).not.toHaveBeenCalled()
})
it('rejects arbitrary remote URLs and unregistered blob URLs', () => {
  expect(validMusic({ ...musicCatalog[0], url: 'https://example.com/private.mp3' })).toBe(false)
  expect(
    validMusic({
      id: 'local',
      kind: 'local',
      title: 'x',
      url: 'blob:https://localhost/forged',
      artist: '本机音频',
    }),
  ).toBe(false)
})
it('keeps the previous selection on failure, releases replacements and restores recommendation on clear', () => {
  const music = useMusicSelection()
  music.selectFile(file())
  const first = music.track('nature')
  music.selectFile(file('invalid.txt', 'text/plain'))
  expect(music.track('nature')).toBe(first)
  expect(music.error).not.toBe('')
  music.selectFile(file('replacement.wav', 'audio/wav'))
  expect(validMusic(first)).toBe(false)
  const second = music.track('nature')
  music.clearLocal()
  expect(validMusic(second)).toBe(false)
  expect(music.choice).toBe('auto')
  expect(music.track('nature').id).toBe('dream')
})
it('does not persist filenames or selection, and releases music at session reset', () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  const music = useMusicSelection()
  music.selectFile(file('private-name.m4a', 'audio/mp4'))
  music.select('stroll')
  expect(music.track('nature').id).toBe('stroll')
  music.select('https://untrusted.test/song')
  expect(music.choice).toBe('stroll')
  music.reset()
  expect(music.local).toBeUndefined()
  expect(music.choice).toBe('auto')
  expect(revoke).toHaveBeenCalledOnce()
  expect(setItem).not.toHaveBeenCalled()
})
