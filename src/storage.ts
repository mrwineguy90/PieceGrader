// All persistence goes through here so the localStorage schema lives in one file.
//
// Schema:
//   "piece-grader:midiInputId" -> string, id of the MIDI input the user picked
//   "piece-grader:pieces"      -> Piece[] (see types.ts)

import type { Piece } from './types'

const MIDI_INPUT_KEY = 'piece-grader:midiInputId'
const PIECES_KEY = 'piece-grader:pieces'

export function loadMidiInputId(): string | null {
  return localStorage.getItem(MIDI_INPUT_KEY)
}

export function saveMidiInputId(id: string): void {
  localStorage.setItem(MIDI_INPUT_KEY, id)
}

export function loadPieces(): Piece[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PIECES_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.map(migratePiece) : []
  } catch {
    return []
  }
}

// Pieces saved before the time signature existed stored beatsPerBar (quarter
// notes per bar); read them as n/4 so nothing needs re-importing.
function migratePiece(stored: Piece & { beatsPerBar?: number }): Piece {
  if (stored.timeSignature) return stored
  const { beatsPerBar, ...rest } = stored
  return { ...rest, timeSignature: [beatsPerBar ?? 4, 4] }
}

export function savePieces(pieces: Piece[]): void {
  localStorage.setItem(PIECES_KEY, JSON.stringify(pieces))
}
