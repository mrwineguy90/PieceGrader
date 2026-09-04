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

export interface Piece {
  id: string
  title: string
  notes: ReferenceNote[]
  beatsPerBar: number // from time signature; default 4
  defaultBpm: number // from file tempo; user can override
  trackNames: string[] // for hand selection
  source: 'midi-file' | 'recorded'
}
