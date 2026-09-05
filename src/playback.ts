// Plays a piece or drill's reference notes through the synth, so it can be
// heard before practising. Notes are scheduled a little ahead on the audio
// clock (the same lookahead pattern as the metronome), so timing is exact;
// positionBeat() gives the playhead its place on the page clock.

import type { Synth } from './synth'
import type { ReferenceNote } from './types'

const LOOKAHEAD_SEC = 0.15
const TICK_MS = 25
const START_DELAY_SEC = 0.1
const PREVIEW_VELOCITY = 90
const RELEASE_GAP = 0.9 // play each note for this share of its written length

export class Playback {
  private timer: number | null = null
  private notes: ReferenceNote[] = []
  private nextIndex = 0
  private startAudio = 0 // audio clock time of beat `startBeat`
  private startPerfMs = 0 // the same instant on performance.now()
  private startBeat = 0
  private endBeat = 0
  private msPerQuarter = 500
  private onDone: (() => void) | null = null

  constructor(private synth: Synth) {}

  get playing(): boolean {
    return this.timer !== null
  }

  // Call from a click. Plays `notes` (quarter-note beats) from `startBeat`
  // at `quarterBpm`, then calls onDone.
  start(notes: ReferenceNote[], quarterBpm: number, startBeat: number, onDone: () => void): void {
    this.stop()
    this.synth.enable()
    const nowAudio = this.synth.nowAudio()
    if (nowAudio === null) return
    this.notes = [...notes].sort((a, b) => a.startBeat - b.startBeat)
    this.nextIndex = 0
    this.msPerQuarter = 60_000 / quarterBpm
    this.startBeat = startBeat
    this.endBeat = Math.max(startBeat, ...notes.map((note) => note.startBeat + note.durationBeats))
    this.startAudio = nowAudio + START_DELAY_SEC
    this.startPerfMs = performance.now() + START_DELAY_SEC * 1000
    this.onDone = onDone
    this.timer = window.setInterval(() => this.scheduleDue(), TICK_MS)
    this.scheduleDue()
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.onDone = null
  }

  // Current beat for the playhead, or null when not playing.
  positionBeat(nowMs: number): number | null {
    if (this.timer === null) return null
    const beat = this.startBeat + (nowMs - this.startPerfMs) / this.msPerQuarter
    return Math.min(this.endBeat, Math.max(this.startBeat, beat))
  }

  private audioTimeOf(beat: number): number {
    return this.startAudio + ((beat - this.startBeat) * this.msPerQuarter) / 1000
  }

  private scheduleDue(): void {
    const nowAudio = this.synth.nowAudio()
    if (nowAudio === null) return
    while (this.nextIndex < this.notes.length && this.audioTimeOf(this.notes[this.nextIndex].startBeat) < nowAudio + LOOKAHEAD_SEC) {
      const note = this.notes[this.nextIndex]
      const at = this.audioTimeOf(note.startBeat)
      const seconds = (note.durationBeats * this.msPerQuarter) / 1000
      this.synth.playNote(note.midi, PREVIEW_VELOCITY, Math.max(at, nowAudio), Math.max(0.05, seconds * RELEASE_GAP))
      this.nextIndex += 1
    }
    if (nowAudio >= this.audioTimeOf(this.endBeat) + 0.3) {
      const done = this.onDone
      this.stop()
      done?.()
    }
  }
}
