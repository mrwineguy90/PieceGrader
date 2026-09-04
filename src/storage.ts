// All persistence goes through here so the localStorage schema lives in one file.
//
// Schema:
//   "piece-grader:midiInputId"  -> string, id of the MIDI input the user picked
//   "piece-grader:pieces"       -> Piece[] (see types.ts)
//   "piece-grader:performances" -> Performance[] (see types.ts), oldest first
//
// localStorage is capped around 5 MB. Attached scores and long histories are
// the only things that can reach it; callers catch the failure and tell the user.

import type { Performance, Piece } from './types'

const MIDI_INPUT_KEY = 'piece-grader:midiInputId'
const PIECES_KEY = 'piece-grader:pieces'
const PERFORMANCES_KEY = 'piece-grader:performances'

function readArray(key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadMidiInputId(): string | null {
  return localStorage.getItem(MIDI_INPUT_KEY)
}

export function saveMidiInputId(id: string): void {
  localStorage.setItem(MIDI_INPUT_KEY, id)
}

export function loadPieces(): Piece[] {
  return readArray(PIECES_KEY).map((stored) => migratePiece(stored as Piece & { beatsPerBar?: number }))
}

export function savePieces(pieces: Piece[]): void {
  localStorage.setItem(PIECES_KEY, JSON.stringify(pieces))
}

// Pieces saved before the time signature existed stored beatsPerBar (quarter
// notes per bar); read them as n/4 so nothing needs re-importing.
function migratePiece(stored: Piece & { beatsPerBar?: number }): Piece {
  if (stored.timeSignature) return stored
  const { beatsPerBar, ...rest } = stored
  return { ...rest, timeSignature: [beatsPerBar ?? 4, 4] }
}

export function loadPerformances(): Performance[] {
  return readArray(PERFORMANCES_KEY) as Performance[]
}

export function savePerformances(performances: Performance[]): void {
  localStorage.setItem(PERFORMANCES_KEY, JSON.stringify(performances))
}
