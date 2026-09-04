// Turning a .mid file into a Piece, plus small helpers about bars and tracks.

import { parseMidi, type MidiEvent } from 'midi-file'
import type { Piece, ReferenceNote } from './types'

const PERCUSSION_CHANNEL = 9 // "channel 10" in 1-based MIDI talk; drums, never piano
const DEFAULT_BPM = 120
const DEFAULT_BEATS_PER_BAR = 4

export function parseMidiFilePiece(bytes: Uint8Array, title: string): Piece {
  const midi = parseMidi(bytes)
  const ticksPerBeat = midi.header.ticksPerBeat
  if (!ticksPerBeat) throw new Error('This file uses SMPTE timing, which is not supported.')

  let defaultBpm = DEFAULT_BPM
  let beatsPerBar = DEFAULT_BEATS_PER_BAR
  const namedTracks: { name: string; notes: ReferenceNote[] }[] = []

  midi.tracks.forEach((events, fileTrackIndex) => {
    let name = `Track ${fileTrackIndex + 1}`
    const notes: ReferenceNote[] = []
    let tick = 0
    // Key "channel:note" so the same pitch on two channels doesn't collide.
    const openNotes = new Map<string, { startTick: number }>()

    for (const event of events) {
      tick += event.deltaTime
      if (event.type === 'trackName') name = event.text
      // Only the first tempo and time signature count; mid-piece changes are
      // out of scope for v1 (the metronome runs at one BPM anyway).
      if (event.type === 'setTempo' && defaultBpm === DEFAULT_BPM) {
        defaultBpm = Math.round(60_000_000 / event.microsecondsPerBeat)
      }
      if (event.type === 'timeSignature' && beatsPerBar === DEFAULT_BEATS_PER_BAR) {
        // In quarter-note beats, since startBeat is in quarter notes: 3/4 -> 3, 6/8 -> 3, 2/2 -> 4.
        beatsPerBar = (event.numerator * 4) / event.denominator
      }
      if (!isNoteEvent(event) || event.channel === PERCUSSION_CHANNEL) continue

      const key = `${event.channel}:${event.noteNumber}`
      const isNoteOn = event.type === 'noteOn' && event.velocity > 0
      const open = openNotes.get(key)
      if (open) {
        // A note-on while the same note is held ends it (same as live playing).
        notes.push({
          midi: event.noteNumber,
          startBeat: open.startTick / ticksPerBeat,
          durationBeats: (tick - open.startTick) / ticksPerBeat,
          track: 0, // renumbered below once empty tracks are dropped
        })
        openNotes.delete(key)
      }
      if (isNoteOn) openNotes.set(key, { startTick: tick })
    }
    if (notes.length > 0) namedTracks.push({ name, notes })
  })

  if (namedTracks.length === 0) throw new Error('No notes found in this file.')

  // Format 1 files usually have a notes-free conductor track first; dropping
  // empty tracks means track numbers match what the user sees in the list.
  const notes = namedTracks.flatMap((track, index) => track.notes.map((note) => ({ ...note, track: index })))
  notes.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi)

  return {
    id: crypto.randomUUID(),
    title,
    notes,
    beatsPerBar,
    defaultBpm,
    trackNames: namedTracks.map((track) => track.name),
    source: 'midi-file',
  }
}

function isNoteEvent(event: MidiEvent): event is Extract<MidiEvent, { type: 'noteOn' | 'noteOff' }> {
  return event.type === 'noteOn' || event.type === 'noteOff'
}

// Fallback for files that put both hands in one track (spec §4).
export function splitAtMiddleC(piece: Piece): Piece {
  return {
    ...piece,
    notes: piece.notes.map((note) => ({ ...note, track: note.midi >= 60 ? 0 : 1 })),
    trackNames: ['Right hand', 'Left hand'],
  }
}

// Bars are 1-based, like a printed score.
export function barOfBeat(beat: number, beatsPerBar: number): number {
  return Math.floor(beat / beatsPerBar) + 1
}

export function barCount(piece: Piece): number {
  const lastBeat = Math.max(0, ...piece.notes.map((note) => note.startBeat + note.durationBeats))
  return Math.ceil(lastBeat / piece.beatsPerBar)
}
