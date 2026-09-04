// Raw MIDI bytes -> events, and events -> notes with durations.
// Nothing here touches the Web MIDI API itself; that lives in useMidiInput.ts
// so these parts can be unit tested.

import type { PlayedNote } from './types'

export type MidiEvent =
  | { kind: 'noteon'; midi: number; velocity: number; timeMs: number }
  | { kind: 'noteoff'; midi: number; timeMs: number }
  | { kind: 'sustain'; down: boolean; timeMs: number }

const NOTE_OFF = 0x80
const NOTE_ON = 0x90
const CONTROL_CHANGE = 0xb0
const SUSTAIN_PEDAL = 64

// timeMs is the MIDIMessageEvent.timeStamp: a performance.now() value, which is
// the clock everything else in the app is reconciled to.
export function parseMidiMessage(data: ArrayLike<number>, timeMs: number): MidiEvent | null {
  if (data.length < 3) return null
  const messageType = data[0] & 0xf0 // low nibble is the channel; we don't care which
  const midi = data[1]
  const value = data[2]

  // Many keyboards send note-on with velocity 0 instead of a real note-off.
  if (messageType === NOTE_ON && value > 0) return { kind: 'noteon', midi, velocity: value, timeMs }
  if (messageType === NOTE_ON || messageType === NOTE_OFF) return { kind: 'noteoff', midi, timeMs }
  if (messageType === CONTROL_CHANGE && midi === SUSTAIN_PEDAL) {
    return { kind: 'sustain', down: value >= 64, timeMs }
  }
  return null
}

export interface ActiveNote {
  midi: number
  startMs: number
  velocity: number
}

// Pairs note-on with the matching note-off to build PlayedNotes.
// Times are stored relative to originMs so a session can make "0" mean the
// first beat after the count-in (spec §3).
export class NoteRecorder {
  notes: PlayedNote[] = []
  sustainDown = false
  private openNotes = new Map<number, ActiveNote>()

  constructor(private originMs = 0) {}

  push(event: MidiEvent): void {
    const timeMs = event.timeMs - this.originMs
    if (event.kind === 'sustain') {
      this.sustainDown = event.down
      return
    }
    // A note-on for a key that is already down means we missed the note-off
    // (or the keyboard re-triggered); end the old one where the new one starts.
    const open = this.openNotes.get(event.midi)
    if (open) this.close(open, timeMs)
    if (event.kind === 'noteon') {
      this.openNotes.set(event.midi, { midi: event.midi, startMs: timeMs, velocity: event.velocity })
    }
  }

  // Keys currently held down, for drawing notes that haven't ended yet.
  activeNotes(): ActiveNote[] {
    return [...this.openNotes.values()]
  }

  // Ends every held note at the given time; used when a recording stops.
  finish(timeMs: number): void {
    for (const open of this.openNotes.values()) this.close(open, timeMs - this.originMs)
  }

  // Notes starting inside [fromMs, toMs) (origin-relative), re-based so fromMs
  // is 0. Keys still held are included, cut off at nowMs, so one loop pass can
  // be scored while the next is already being played.
  notesStartingBetween(fromMs: number, toMs: number, nowMs: number): PlayedNote[] {
    const held = this.activeNotes().map((open) => ({
      midi: open.midi,
      startMs: open.startMs,
      durationMs: Math.max(0, nowMs - this.originMs - open.startMs),
      velocity: open.velocity,
    }))
    return [...this.notes, ...held]
      .filter((note) => note.startMs >= fromMs && note.startMs < toMs)
      .map((note) => ({ ...note, startMs: note.startMs - fromMs }))
  }

  clear(): void {
    this.notes = []
    this.openNotes.clear()
  }

  private close(open: ActiveNote, endMs: number): void {
    this.openNotes.delete(open.midi)
    this.notes.push({
      midi: open.midi,
      startMs: open.startMs,
      durationMs: Math.max(0, endMs - open.startMs),
      velocity: open.velocity,
    })
  }
}
