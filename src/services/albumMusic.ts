import { musicScores, type MusicTheme } from '../domain/albumMusic'

// Only a user gesture starts a request. No album/photo data enters the fixed media URL.
export class AlbumMusic {
  constructor(private interrupted: () => void = () => {}) {}
  private audio?: HTMLAudioElement
  private cancel?: () => void
  async play(theme: MusicTheme) {
    this.stop()
    const audio = new Audio()
    this.audio = audio
    audio.preload = 'none'
    audio.loop = true
    audio.volume = 0.55
    audio.src = musicScores[theme].url
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (error?: Error) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          audio.removeEventListener('error', failed)
          this.cancel = undefined
          if (error) reject(error)
          else resolve()
        }
        const failed = () => finish(new Error('音乐暂不可用'))
        const timer = setTimeout(() => finish(new Error('音乐连接超时')), 20000)
        this.cancel = () => finish(new Error('已停止'))
        audio.addEventListener('error', failed)
        // Keep play synchronous with the click for iOS user activation.
        audio.play().then(
          () => finish(),
          () => failed(),
        )
      })
      if (this.audio !== audio) return
      audio.onerror = () => {
        this.stop()
        this.interrupted()
      }
      audio.onpause = () => {
        if (this.audio === audio) {
          this.stop()
          this.interrupted()
        }
      }
    } catch (error) {
      if (this.audio === audio) this.stop()
      throw error
    }
  }
  stop() {
    const audio = this.audio
    this.audio = undefined
    this.cancel?.()
    this.cancel = undefined
    if (!audio) return
    audio.onerror = null
    audio.onpause = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load() // Abort downloading and release the decoder, even while buffering.
  }
}
