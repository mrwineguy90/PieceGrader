// Web Audio metronome. Clicks are scheduled a little ahead on the AudioContext
// clock so they land exactly on the beat regardless of what the main thread
// is doing (the standard "lookahead scheduler" pattern).

export interface Beat {
  index: number // 0-based count of beats since start
  isDownbeat: boolean
}

// Clock reconciliation (spec §2).
// Web MIDI stamps events on the performance.now() clock. Web Audio schedules
// on AudioContext.currentTime, which starts at 0 when the context is created
// and runs on the audio hardware clock. To put a click and a played note on
// the same timeline we need one pairing of the two clocks, taken at the same
// instant. getOutputTimestamp() gives exactly that: the context time of the
// sample now leaving the speakers and the performance.now() at which it left,
// so output latency is accounted for.
//
// Gotcha: on a context that has only just been created, getOutputTimestamp()
// returns zeros for both clocks until the audio thread has produced output,
// often for the first ~100 ms. So the anchor is re-captured on each scheduler
// tick until a few readings in a row agree, then frozen: re-reading it forever
// would let the pairing's tick-to-tick jitter shake the playhead. Nothing
// caches beat times computed before it settled; callers ask beatTimeMs().
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
const ANCHOR_AGREEMENT_MS = 1 // consecutive readings this close count as settled
const ANCHOR_SETTLED_AFTER = 3 // how many agreeing readings freeze the anchor

export class Metronome {
  running = false
  beats: Beat[] = [] // every beat scheduled so far, for drawing beat lines
  private context: AudioContext | null = null
  private anchor: ClockAnchor = { contextTime: 0, performanceTime: 0 }
  private anchorSettled = false
  private agreeingReadings = 0
  private timer: number | null = null
  private bpm = 60
  private beatsPerBar = 4
  private firstBeatAudioTime = 0
  private nextBeatAudioTime = 0
  private nextBeatIndex = 0

  // Create and wake the audio context inside a user gesture (a button click),
  // so a later start() triggered by a MIDI note is allowed to make sound.
  warmUp(): void {
    this.context ??= new AudioContext()
    void this.context.resume()
  }

  start(bpm: number, beatsPerBar: number): void {
    this.stop()
    this.context ??= new AudioContext()
    void this.context.resume() // contexts start suspended until a user gesture
    this.bpm = bpm
    this.beatsPerBar = beatsPerBar
    this.beats = []
    this.nextBeatIndex = 0
    this.firstBeatAudioTime = this.context.currentTime + FIRST_BEAT_DELAY_SEC
    this.nextBeatAudioTime = this.firstBeatAudioTime
    this.anchor = this.captureAnchor()
    this.anchorSettled = false
    this.agreeingReadings = 0
    this.running = true
    this.timer = window.setInterval(() => this.scheduleDueBeats(), TICK_MS)
    this.scheduleDueBeats()
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.running = false
  }

  // When beat `index` falls, on the performance.now() clock. Beats are evenly
  // spaced from the first, so this is known before the beat is scheduled; the
  // session uses it to fix "time 0" on the first beat after the count-in.
  beatTimeMs(index: number): number {
    return audioTimeToPerformanceMs(this.anchor, this.firstBeatAudioTime + (index * 60) / this.bpm)
  }

  // The beat most recently heard at nowMs (performance.now() clock), or null
  // before the first click.
  currentBeat(nowMs: number): Beat | null {
    let latest: Beat | null = null
    for (const beat of this.beats) {
      if (this.beatTimeMs(beat.index) > nowMs) break
      latest = beat
    }
    return latest
  }

  private captureAnchor(): ClockAnchor {
    const context = this.context!
    const stamp = context.getOutputTimestamp?.()
    if (stamp?.contextTime && stamp.performanceTime) {
      return { contextTime: stamp.contextTime, performanceTime: stamp.performanceTime }
    }
    // Not producing output yet (or no getOutputTimestamp): pair the clocks
    // ourselves. Close enough until the real stamp arrives a tick or two later.
    return { contextTime: context.currentTime, performanceTime: performance.now() }
  }

  // Re-read the clock pairing until three readings in a row agree, then keep it.
  private settleAnchor(): void {
    if (this.anchorSettled) return
    const context = this.context!
    const stamp = context.getOutputTimestamp?.()
    if (!stamp?.contextTime || !stamp.performanceTime) return // not producing output yet
    const fresh = { contextTime: stamp.contextTime, performanceTime: stamp.performanceTime }
    const offsetOf = (anchor: ClockAnchor) => anchor.performanceTime - anchor.contextTime * 1000
    this.agreeingReadings = Math.abs(offsetOf(fresh) - offsetOf(this.anchor)) <= ANCHOR_AGREEMENT_MS ? this.agreeingReadings + 1 : 0
    this.anchor = fresh
    if (this.agreeingReadings >= ANCHOR_SETTLED_AFTER) this.anchorSettled = true
  }

  private scheduleDueBeats(): void {
    const context = this.context!
    this.settleAnchor()
    while (this.nextBeatAudioTime < context.currentTime + LOOKAHEAD_SEC) {
      const isDownbeat = this.nextBeatIndex % this.beatsPerBar === 0
      this.playClick(this.nextBeatAudioTime, isDownbeat)
      this.beats.push({ index: this.nextBeatIndex, isDownbeat })
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
