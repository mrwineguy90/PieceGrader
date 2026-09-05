// Generated drills (drills-spec.md): scales, contrary-motion scales,
// arpeggios, broken chords, five-finger patterns, cadences and Hanon
// exercises, laid out in 4/4 as spelled notes. The catalogue of what exists
// is in drillCatalog.ts; this file turns a spec into notes and a Piece.

import { drillId, drillTitle, parseDrillId, type DrillSpec } from './drillCatalog'
import { drillToMusicXml, simpleDurationFitting } from './drillNotation'
import { hanonPitches } from './hanon'
import { encodeScoreFile } from './pieces'
import { keyFifths, scaleDegree, scaleUpAndDown, sevenNoteScale, type Pitch, type ScaleKind } from './pitches'
import type { Piece } from './types'

export interface DrillNote extends Pitch {
  startBeat: number
  durationBeats: number
  hand: 0 | 1 // 0 = right (track 0), 1 = left (track 1)
}

export interface Drill {
  spec: DrillSpec
  id: string
  title: string
  keyFifths: number
  notes: DrillNote[]
}

const BEATS_PER_BAR = 4 // every drill is written in 4/4
const DEFAULT_BPM = 60
// A two-bar scale proves nothing: every drill is repeated back to back until
// it is at least this long, and graded as one pass. (Hanon is longer anyway.)
const MIN_DRILL_BARS = 12

export function generateDrill(spec: DrillSpec): Drill {
  const kindForKey: ScaleKind = spec.variant === 'minor' ? 'harmonic-minor' : spec.family === 'hanon' ? 'major' : (spec.variant as ScaleKind)
  return { spec, id: drillId(spec), title: drillTitle(spec), keyFifths: keyFifths(kindForKey, spec.key), notes: repeatShortDrill(buildNotes(spec)) }
}

// Each repetition starts on the bar line after the previous one ends (the
// last note is already held to the end of its bar, so they join cleanly).
function repeatShortDrill(notes: DrillNote[]): DrillNote[] {
  const lastBeat = Math.max(0, ...notes.map((note) => note.startBeat + note.durationBeats))
  const bars = Math.ceil(lastBeat / BEATS_PER_BAR)
  if (bars === 0 || bars >= MIN_DRILL_BARS) return notes
  const repetitions = Math.ceil(MIN_DRILL_BARS / bars)
  const repeated: DrillNote[] = []
  for (let repetition = 0; repetition < repetitions; repetition++) {
    const offset = repetition * bars * BEATS_PER_BAR
    repeated.push(...notes.map((note) => ({ ...note, startBeat: note.startBeat + offset })))
  }
  return repeated
}

// Right hand starts at the tonic in octave 4 (3 for four-octave drills so the
// top stays on the keyboard); the left hand plays the same an octave lower.
function rightHandOctave(spec: DrillSpec): number {
  return spec.octaves > 2 ? 3 : 4
}

// Consecutive notes from beat 0. The last note is held with the longest
// plain value that fits before the bar line, so the notation needs no ties.
function line(pitches: Pitch[], hand: 0 | 1, notesPerClick: number, holdLast = true): DrillNote[] {
  const duration = 1 / notesPerClick
  return pitches.map((pitch, index) => {
    const startBeat = index * duration
    const isLast = index === pitches.length - 1
    return { ...pitch, startBeat, durationBeats: isLast && holdLast ? heldToBarEnd(startBeat, duration) : duration, hand }
  })
}

function heldToBarEnd(startBeat: number, minimum: number): number {
  const remaining = BEATS_PER_BAR - (startBeat % BEATS_PER_BAR)
  return Math.max(minimum, simpleDurationFitting(remaining))
}

// A run of notes followed by a chord (or single note) on the next slot, held.
function lineThenChord(run: Pitch[], chord: Pitch[], hand: 0 | 1, notesPerClick: number): DrillNote[] {
  const notes = line(run, hand, notesPerClick, false)
  const chordStart = run.length / notesPerClick
  return [...notes, ...chord.map((pitch) => ({ ...pitch, startBeat: chordStart, durationBeats: heldToBarEnd(chordStart, 1), hand }))]
}

// The same material in each selected hand, the left hand an octave lower.
function forHands(spec: DrillSpec, build: (startOctave: number, hand: 0 | 1) => DrillNote[]): DrillNote[] {
  const octave = rightHandOctave(spec)
  const notes: DrillNote[] = []
  if (spec.hands !== 'left') notes.push(...build(octave, 0))
  if (spec.hands !== 'right') notes.push(...build(octave - 1, 1))
  return notes
}

function triadScale(spec: DrillSpec, octave: number): Pitch[] {
  return sevenNoteScale(spec.variant === 'minor' ? 'harmonic-minor' : 'major', spec.key, octave)
}

function buildNotes(spec: DrillSpec): DrillNote[] {
  const kind = spec.variant as ScaleKind
  const { notesPerClick } = spec
  switch (spec.family) {
    case 'scale':
      return forHands(spec, (octave, hand) => line(scaleUpAndDown(kind, spec.key, octave, spec.octaves), hand, notesPerClick))
    case 'contrary': {
      // Both hands start on the same tonic: right goes up and back, left goes down and back.
      const up = scaleUpAndDown(kind, spec.key, 4 - spec.octaves, spec.octaves)
      const climb = up.slice(0, (up.length + 1) / 2) // tonic below → tonic 4
      const notes: DrillNote[] = []
      if (spec.hands !== 'left') notes.push(...line(scaleUpAndDown(kind, spec.key, 4, spec.octaves), 0, notesPerClick))
      if (spec.hands !== 'right') notes.push(...line([...climb].reverse().concat(climb.slice(1)), 1, notesPerClick))
      return notes
    }
    case 'arpeggio':
      return forHands(spec, (octave, hand) => {
        const scale = triadScale(spec, octave)
        const up: Pitch[] = []
        for (let o = 0; o < spec.octaves; o++) up.push(...[0, 2, 4].map((degree) => scaleDegree(scale, degree + 7 * o)))
        up.push(scaleDegree(scale, 7 * spec.octaves))
        return line([...up, ...[...up].reverse().slice(1)], hand, notesPerClick)
      })
    case 'broken':
      // ABRSM-style: 1-3-5, 3-5-8, 5-8-10, then back down to the tonic.
      return forHands(spec, (octave, hand) => {
        const scale = triadScale(spec, octave)
        return line([0, 2, 4, 2, 4, 7, 4, 7, 9, 9, 7, 4, 7, 4, 2, 4, 2, 0].map((degree) => scaleDegree(scale, degree)), hand, notesPerClick)
      })
    case 'five-finger':
      // Five notes up and down, then the tonic chord held.
      return forHands(spec, (octave, hand) => {
        const scale = triadScale(spec, octave)
        const run = [0, 1, 2, 3, 4, 3, 2, 1, 0].map((degree) => scaleDegree(scale, degree))
        return lineThenChord(run, [0, 2, 4].map((degree) => scaleDegree(scale, degree)), hand, notesPerClick)
      })
    case 'cadence': {
      // Right hand: I, IV in second inversion, V in first inversion, I. Left hand: roots. Half notes.
      const notes: DrillNote[] = []
      const rightScale = triadScale(spec, 4)
      const leftScale = triadScale(spec, 3)
      const chords = [
        [0, 2, 4],
        [0, 3, 5],
        [-1, 1, 4],
        [0, 2, 4],
      ]
      const roots = [0, 3, 4, 0]
      chords.forEach((degrees, index) => {
        const startBeat = index * 2
        if (spec.hands !== 'left') notes.push(...degrees.map((degree) => ({ ...scaleDegree(rightScale, degree), startBeat, durationBeats: 2, hand: 0 as const })))
        if (spec.hands !== 'right') notes.push({ ...scaleDegree(leftScale, roots[index]), startBeat, durationBeats: 2, hand: 1 })
      })
      return notes
    }
    case 'hanon':
      // Hanon's right hand starts on C3, an octave below the other drills.
      return forHands(spec, (octave, hand) => {
        const { sequence, final } = hanonPitches(Number(spec.variant), octave - 1)
        return lineThenChord(sequence, final, hand, notesPerClick)
      })
  }
}

export function drillToPiece(drill: Drill): Piece {
  const xml = drillToMusicXml(drill)
  const notes = drill.notes
    .map((note) => ({ midi: note.midi, startBeat: note.startBeat, durationBeats: note.durationBeats, track: note.hand }))
    .sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi)
  return {
    id: drill.id,
    title: drill.title,
    notes,
    timeSignature: [4, 4],
    defaultBpm: DEFAULT_BPM,
    trackNames: ['Right hand', 'Left hand'],
    source: 'drill',
    score: { fileName: `${drill.id}.musicxml`, base64: encodeScoreFile(new TextEncoder().encode(xml)) },
  }
}

// History stores only the id; the piece is rebuilt on demand.
export function pieceForDrillId(id: string): Piece | null {
  const spec = parseDrillId(id)
  return spec ? drillToPiece(generateDrill(spec)) : null
}
