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
    return Array.isArray(parsed) ? (parsed as Piece[]) : []
  } catch {
    return []
  }
}

export function savePieces(pieces: Piece[]): void {
  localStorage.setItem(PIECES_KEY, JSON.stringify(pieces))
}
