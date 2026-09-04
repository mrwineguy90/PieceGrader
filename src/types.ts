import type { Score } from './scoring'

// Data model from spec §3. References live in musical time (beats) and
// performances in wall-clock time (ms); they meet only at scoring time, at the
// BPM chosen for that session. Never store a performance in beats — that would
// bake the tempo into it.

// A note in a reference piece, in musical time
export interface ReferenceNote {
  midi: number // 21–108
  startBeat: number // absolute beat from start of piece, quarter note = 1
  durationBeats: number
  track: number // which MIDI track it came from
}

// A note the user played, in wall-clock time
export interface PlayedNote {
  midi: number
  startMs: number // relative to the first beat after count-in
  durationMs: number
  velocity: number
}

// A MusicXML file (.musicxml or compressed .mxl) shown as notation during a
// session. Stored as the raw file bytes in base64; .mxl is ~10× smaller.
export interface PieceScore {
  fileName: string
  base64: string
}

// One scored pass, saved for history (spec §3). The score keeps the summary
// and per-bar numbers but not the note-level results, to keep localStorage
// small; results can be recomputed from `played` and the piece.
export interface Performance {
  id: string
  pieceId: string
  playedAt: string // ISO date
  bpm: number // clicks per minute of the time signature's note
  tracksIncluded: number[]
  barRange: [number, number]
  played: PlayedNote[]
  score: Omit<Score, 'results'>
}

export interface Piece {
  id: string
  title: string
  notes: ReferenceNote[]
  score?: PieceScore // optional; the app grades from `notes`, this is only for display
  // Deviation from spec §3 (which stored beatsPerBar): the metronome clicks the
  // note the bottom number names, so 6/8 gets six eighth-note clicks per bar.
  timeSignature: [number, number] // e.g. [3, 4] or [6, 8]; default [4, 4]
  defaultBpm: number // clicks of that note per minute, from the file tempo; user can override
  trackNames: string[] // for hand selection
  source: 'midi-file' | 'recorded' | 'drill' // drills are generated on demand and never stored (drills-spec.md)
}
