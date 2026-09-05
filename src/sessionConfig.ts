// What a practice session is set up with, and the pure helpers that read it:
// the beat the range starts on, the reference notes inside it, and the
// opening note(s) the player must press when waiting for a key.

import { beatsPerBar } from './pieces'
import type { Piece, ReferenceNote } from './types'

export interface SessionConfig {
  piece: Piece
  tracks: number[]
  bpm: number // clicks per minute of the time signature's note (see pieces.ts)
  barRange: [number, number] // 1-based, inclusive
  loop: boolean
  waitForKey: boolean // hold the count-in until the opening note(s) are pressed, so hands can be placed first
}

// Beat 1 of the first selected bar, in quarter notes: played time 0 is here.
export function rangeStartBeat(config: SessionConfig): number {
  return (config.barRange[0] - 1) * beatsPerBar(config.piece)
}

export function referenceNotesInRange(config: SessionConfig): ReferenceNote[] {
  const startBeat = rangeStartBeat(config)
  const endBeat = config.barRange[1] * beatsPerBar(config.piece)
  return config.piece.notes.filter(
    (note) => config.tracks.includes(note.track) && note.startBeat >= startBeat && note.startBeat < endBeat,
  )
}

// The pitches that sound first in the selected bars and tracks: what the
// player must press to start the count-in when waiting for a key.
export function firstChordOf(config: SessionConfig): number[] {
  const notes = referenceNotesInRange(config)
  if (notes.length === 0) return []
  const firstBeat = Math.min(...notes.map((note) => note.startBeat))
  return [...new Set(notes.filter((note) => note.startBeat === firstBeat).map((note) => note.midi))].sort((a, b) => a - b)
}
