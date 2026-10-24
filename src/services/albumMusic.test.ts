import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AlbumMusic } from './albumMusic'
import { musicScores } from '../domain/albumMusic'
class TestAudio extends EventTarget {
  static instances: TestAudio[] = []
  src = ''
  preload = ''
  loop = false
  volume = 1
  onerror: (() => void) | null = null
  onpause: (() => void) | null = null
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  load = vi.fn()
  removeAttribute = vi.fn(() => {
    this.src = ''
  })
  constructor() {
    super()
    TestAudio.instances.push(this)
  }
}
beforeEach(() => {
  TestAudio.instances = []
  vi.stubGlobal('Audio', TestAudio)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('does not connect until asked and releases the recording and decoder on stop', async () => {
  const music = new AlbumMusic()
  expect(TestAudio.instances).toHaveLength(0)
  await music.play('animals')
  const audio = TestAudio.instances[0]!
  expect(audio.src).toBe(musicScores.animals.url)
  expect(audio.preload).toBe('none')
  expect(audio.loop).toBe(true)
  expect(audio.play).toHaveBeenCalledOnce()
  music.stop()
  expect(audio.src).toBe('')
  expect(audio.pause).toHaveBeenCalledOnce()
  expect(audio.load).toHaveBeenCalledOnce()
})
it('cancels buffering without letting a late play resolve resurrect audio', async () => {
  const music = new AlbumMusic()
  const playback = music.play('nature')
  // play's promise is resolved but its microtask has not run yet.
  const rejection = expect(playback).rejects.toThrow('已停止')
  music.stop()
  await rejection
  expect(TestAudio.instances[0]!.src).toBe('')
})
it('surfaces streaming errors and pauses instead of synthesizing a fallback', async () => {
  const interrupted = vi.fn(),
    music = new AlbumMusic(interrupted)
  await music.play('travel')
  TestAudio.instances[0]!.onerror?.()
  expect(interrupted).toHaveBeenCalledOnce()
  expect(TestAudio.instances[0]!.src).toBe('')
})
it('bounds the time spent buffering and cleans up a failed request', async () => {
  vi.useFakeTimers()
  // Override only this constructor's play to model an unavailable provider.
  class BufferingAudio extends TestAudio {
    override play = vi.fn(() => new Promise<void>(() => {}))
  }
  vi.stubGlobal('Audio', BufferingAudio)
  const music = new AlbumMusic()
  const rejection = expect(music.play('life')).rejects.toThrow('连接超时')
  await vi.advanceTimersByTimeAsync(20001)
  await rejection
  expect(TestAudio.instances[0]!.src).toBe('')
  expect(TestAudio.instances[0]!.load).toHaveBeenCalledOnce()
})
