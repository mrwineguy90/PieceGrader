// Web Audio metronome. Clicks are scheduled a little ahead on the AudioContext
// clock so they land exactly on the beat regardless of what the main thread
// is doing (the standard "lookahead scheduler" pattern).

export interface Beat {
  index: number // 0-based count of beats since start
  isDownbeat: boolean
  timeMs: number // on the performance.now() clock, see ClockAnchor
}

// Clock reconciliation (spec §2).
// Web MIDI stamps events on the performance.now() clock. Web Audio schedules
// on AudioContext.currentTime, which starts at 0 when the context is created
// and runs on the audio hardware clock. To draw a click and a played note on
// the same timeline we need one pairing of the two clocks, taken at the same
// instant. getOutputTimestamp() gives exactly that: the context time of the
// sample now leaving the speakers and the performance.now() at which it left,
// so output latency is accounted for. Captured once at start; any drift over a
// few minutes is far below the ±60 ms grading window.
export interface ClockAnchor {
  contextTime: number // seconds, AudioContext clock
  performanceTime: number // ms, performance.now() clock
}

export function audioTimeToPerformanceMs(anchor: ClockAnchor, audioTime: number): number {
  return anchor.performanceTime + (audioTime - anchor.contextTime) * 1000
}

const LOOKAHEAD_SEC = 0.1 // schedule clicks this far ahead
const TICK_MS = 25 // how often the scheduler wakes up
const FIRST_BEAT_DELAY_SEC = 0.1 // so the first click isn't already late

export class Metronome {
  running = false
  beats: Beat[] = [] // every beat scheduled so far, for drawing beat lines
  private context: AudioContext | null = null
  private anchor: ClockAnchor = { contextTime: 0, performanceTime: 0 }
  private timer: number | null = null
  private bpm = 60
  private beatsPerBar = 4
  private nextBeatAudioTime = 0
  private nextBeatIndex = 0

  start(bpm: number, beatsPerBar: number): void {
    this.stop()
    this.context ??= new AudioContext()
    void this.context.resume() // contexts start suspended until a user gesture
    this.bpm = bpm
    this.beatsPerBar = beatsPerBar
    this.beats = []
    this.nextBeatIndex = 0
    this.nextBeatAudioTime = this.context.currentTime + FIRST_BEAT_DELAY_SEC
    this.anchor = this.captureAnchor()
    this.running = true
    this.timer = window.setInterval(() => this.scheduleDueBeats(), TICK_MS)
    this.scheduleDueBeats()
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.running = false
  }

  // The beat most recently heard at nowMs (performance.now() clock), or null
  // before the first click.
  currentBeat(nowMs: number): Beat | null {
    let latest: Beat | null = null
    for (const beat of this.beats) {
      if (beat.timeMs > nowMs) break
      latest = beat
    }
    return latest
  }

  private captureAnchor(): ClockAnchor {
    const context = this.context!
    const stamp = context.getOutputTimestamp?.()
    if (stamp && stamp.contextTime !== undefined && stamp.performanceTime !== undefined) {
      return { contextTime: stamp.contextTime, performanceTime: stamp.performanceTime }
    }
    return { contextTime: context.currentTime, performanceTime: performance.now() }
  }

  private scheduleDueBeats(): void {
    const context = this.context!
    while (this.nextBeatAudioTime < context.currentTime + LOOKAHEAD_SEC) {
      const isDownbeat = this.nextBeatIndex % this.beatsPerBar === 0
      this.playClick(this.nextBeatAudioTime, isDownbeat)
      this.beats.push({
        index: this.nextBeatIndex,
        isDownbeat,
        timeMs: audioTimeToPerformanceMs(this.anchor, this.nextBeatAudioTime),
      })
      this.nextBeatIndex += 1
      this.nextBeatAudioTime += 60 / this.bpm
    }
  }

  private playClick(audioTime: number, isDownbeat: boolean): void {
    const context = this.context!
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = isDownbeat ? 1200 : 800
    gain.gain.setValueAtTime(isDownbeat ? 0.6 : 0.35, audioTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.05)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(audioTime)
    oscillator.stop(audioTime + 0.05)
  }
}
