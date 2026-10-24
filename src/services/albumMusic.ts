import { musicScores, type MusicTheme } from '../domain/albumMusic'

// Original instrumental scores synthesized locally. No audio download, microphone or telemetry.
export class AlbumMusic {
  constructor(private interrupted: () => void = () => {}) {}
  private context?: AudioContext
  private master?: GainNode
  private timer?: ReturnType<typeof setInterval>
  private nodes = new Set<OscillatorNode>()
  private generation = 0
  private time = 0
  private step = 0
  async play(theme: MusicTheme) {
    this.stop()
    const generation = this.generation
    const context = new AudioContext()
    this.context = context
    const master = context.createGain()
    master.gain.value = 0.18
    master.connect(context.destination)
    this.master = master
    try {
      await context.resume()
      if (generation !== this.generation) return
      if (context.state !== 'running') throw new Error('请再次点击开启配乐')
      this.time = context.currentTime + 0.05
      this.step = 0
      const schedule = () => {
        if (generation !== this.generation) return
        // Never schedule a backlog after a delayed timer or an interrupted audio session.
        if (context.state !== 'running' || document.hidden) {
          this.stop()
          this.interrupted()
          return
        }
        if (this.time < context.currentTime) this.time = context.currentTime + 0.05
        while (this.time < context.currentTime + 0.5) {
          const score = musicScores[theme],
            beat = 60 / score.bpm
          const chord = score.chords[Math.floor(this.step / 8) % score.chords.length]!
          const minor = theme === 'city' || theme === 'documents'
          if (this.step % 8 === 0) {
            for (const offset of [0, minor ? 3 : 4, 7])
              this.note(
                context,
                master,
                score.root + chord + offset,
                this.time,
                beat * 3.8,
                0.13,
                'sine',
              )
            this.note(context, master, score.root + chord - 12, this.time, beat * 3.8, 0.18, 'sine')
          }
          this.note(
            context,
            master,
            score.root + score.melody[this.step % 8]!,
            this.time,
            beat * 0.8,
            0.3,
            score.wave,
          )
          this.time += beat / 2
          this.step++
        }
      }
      schedule()
      if (generation === this.generation) this.timer = setInterval(schedule, 120)
    } catch (error) {
      if (generation === this.generation) this.stop()
      throw error
    }
  }
  private note(
    context: AudioContext,
    master: GainNode,
    midi: number,
    start: number,
    duration: number,
    volume: number,
    wave: OscillatorType,
  ) {
    const oscillator = context.createOscillator(),
      gain = context.createGain()
    oscillator.type = wave
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.04, duration / 4))
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(master)
    this.nodes.add(oscillator)
    oscillator.onended = () => {
      this.nodes.delete(oscillator)
      oscillator.disconnect()
      gain.disconnect()
    }
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }
  stop() {
    ++this.generation
    clearInterval(this.timer)
    this.timer = undefined
    for (const node of this.nodes) {
      node.onended = null
      try {
        node.stop()
      } catch {
        /* Already ended. */
      }
      node.disconnect()
    }
    this.nodes.clear()
    this.master?.disconnect()
    this.master = undefined
    const context = this.context
    this.context = undefined
    if (context && context.state !== 'closed') void context.close().catch(() => {})
  }
}
