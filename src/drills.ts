// Generated drills (drills-spec.md): scales, contrary-motion scales,
// arpeggios, broken chords, five-finger patterns and cadences, laid out in
// 4/4 as spelled notes. A drill is never stored: its id encodes every
// parameter, so history can regenerate it.

import { drillToMusicXml, simpleDurationFitting } from './drillNotation'
import { encodeScoreFile } from './pieces'
import {
  keyFifths,
  keyLabel,
  MAJOR_KEYS,
  MINOR_KEYS,
  MINOR_LIKE_KINDS,
  scaleDegree,
  scaleUpAndDown,
  sevenNoteScale,
  type Pitch,
  type ScaleKind,
} from './pitches'
import type { Piece } from './types'

export type Family = 'scale' | 'contrary' | 'arpeggio' | 'broken' | 'five-finger' | 'cadence'
export type Hands = 'right' | 'left' | 'both'

export interface DrillSpec {
  family: Family
  variant: string // a ScaleKind for scales/contrary, 'major' | 'minor' for the rest
  key: string // spelled tonic, e.g. 'F#' or 'Bb'
  hands: Hands
  octaves: number // 1, 2 or 4 where the family uses it
  notesPerClick: number // 1, 2 or 4 where the family uses it
}

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
const majorMinor = [
  { id: 'major', label: 'major' },
  { id: 'minor', label: 'minor' },
]

export const FAMILIES: Record<Family, { label: string; variants: { id: string; label: string }[]; usesOctaves: boolean; usesNotesPerClick: boolean }> = {
  scale: {
    label: 'Scale',
    variants: [
      { id: 'major', label: 'major' },
      { id: 'natural-minor', label: 'natural minor' },
      { id: 'harmonic-minor', label: 'harmonic minor' },
      { id: 'melodic-minor', label: 'melodic minor' },
      { id: 'chromatic', label: 'chromatic' },
      { id: 'pentatonic-major', label: 'major pentatonic' },
      { id: 'pentatonic-minor', label: 'minor pentatonic' },
      { id: 'blues', label: 'blues' },
      { id: 'dorian', label: 'dorian' },
      { id: 'phrygian', label: 'phrygian' },
      { id: 'lydian', label: 'lydian' },
      { id: 'mixolydian', label: 'mixolydian' },
      { id: 'locrian', label: 'locrian' },
    ],
    usesOctaves: true,
    usesNotesPerClick: true,
  },
  contrary: {
    label: 'Contrary-motion scale',
    variants: [
      { id: 'major', label: 'major' },
      { id: 'harmonic-minor', label: 'harmonic minor' },
    ],
    usesOctaves: true,
    usesNotesPerClick: true,
  },
  arpeggio: { label: 'Arpeggio', variants: majorMinor, usesOctaves: true, usesNotesPerClick: true },
  broken: { label: 'Broken chords', variants: majorMinor, usesOctaves: false, usesNotesPerClick: true },
  'five-finger': { label: 'Five-finger pattern', variants: majorMinor, usesOctaves: false, usesNotesPerClick: true },
  cadence: { label: 'Cadence I–IV–V–I', variants: majorMinor, usesOctaves: false, usesNotesPerClick: false },
}

export function isMinorDrill(spec: DrillSpec): boolean {
  return spec.variant === 'minor' || MINOR_LIKE_KINDS.includes(spec.variant as ScaleKind)
}

export function keysFor(spec: DrillSpec): string[] {
  return isMinorDrill(spec) ? MINOR_KEYS : MAJOR_KEYS
}

export function drillId(spec: DrillSpec): string {
  return ['drill', spec.family, spec.variant, spec.key, spec.hands, spec.octaves, spec.notesPerClick].join(':')
}

export function parseDrillId(id: string): DrillSpec | null {
  const [prefix, family, variant, key, hands, octaves, notesPerClick] = id.split(':')
  if (prefix !== 'drill' || !(family in FAMILIES)) return null
  return { family: family as Family, variant, key, hands: hands as Hands, octaves: Number(octaves), notesPerClick: Number(notesPerClick) }
}

export function generateDrill(spec: DrillSpec): Drill {
  const notes = buildNotes(spec)
  const kindForKey: ScaleKind = spec.variant === 'minor' ? 'harmonic-minor' : (spec.variant as ScaleKind)
  return { spec, id: drillId(spec), title: titleFor(spec), keyFifths: keyFifths(kindForKey, spec.key), notes }
}

function titleFor(spec: DrillSpec): string {
  const family = FAMILIES[spec.family]
  const variant = family.variants.find((each) => each.id === spec.variant)?.label ?? spec.variant
  const parts = [`${keyLabel(spec.key)} ${variant} ${family.label.toLowerCase()}`]
  if (family.usesOctaves) parts.push(`${spec.octaves} octave${spec.octaves > 1 ? 's' : ''}`)
  parts.push(spec.hands === 'both' ? 'hands together' : `${spec.hands} hand`)
  if (family.usesNotesPerClick) parts.push({ 1: 'quarters', 2: 'eighths', 4: 'sixteenths' }[spec.notesPerClick] ?? `${spec.notesPerClick} per beat`)
  return parts.join(' · ')
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

// The same line in each selected hand, the left hand an octave lower.
function forHands(spec: DrillSpec, pitchesFrom: (startOctave: number) => Pitch[]): DrillNote[] {
  const octave = rightHandOctave(spec)
  const notes: DrillNote[] = []
  if (spec.hands !== 'left') notes.push(...line(pitchesFrom(octave), 0, spec.notesPerClick))
  if (spec.hands !== 'right') notes.push(...line(pitchesFrom(octave - 1), 1, spec.notesPerClick))
  return notes
}

function triadScale(spec: DrillSpec, octave: number): Pitch[] {
  return sevenNoteScale(spec.variant === 'minor' ? 'harmonic-minor' : 'major', spec.key, octave)
}

function buildNotes(spec: DrillSpec): DrillNote[] {
  const kind = spec.variant as ScaleKind
  switch (spec.family) {
    case 'scale':
      return forHands(spec, (octave) => scaleUpAndDown(kind, spec.key, octave, spec.octaves))
    case 'contrary': {
      // Both hands start on the same tonic: right goes up and back, left goes down and back.
      const up = scaleUpAndDown(kind, spec.key, 4 - spec.octaves, spec.octaves)
      const climb = up.slice(0, (up.length + 1) / 2) // tonic below → tonic 4
      const notes: DrillNote[] = []
      if (spec.hands !== 'left') notes.push(...line(scaleUpAndDown(kind, spec.key, 4, spec.octaves), 0, spec.notesPerClick))
      if (spec.hands !== 'right') notes.push(...line([...climb].reverse().concat(climb.slice(1)), 1, spec.notesPerClick))
      return notes
    }
    case 'arpeggio':
      return forHands(spec, (octave) => {
        const scale = triadScale(spec, octave)
        const up: Pitch[] = []
        for (let o = 0; o < spec.octaves; o++) up.push(...[0, 2, 4].map((degree) => scaleDegree(scale, degree + 7 * o)))
        up.push(scaleDegree(scale, 7 * spec.octaves))
        return [...up, ...[...up].reverse().slice(1)]
      })
    case 'broken':
      // ABRSM-style: 1-3-5, 3-5-8, 5-8-10, then back down to the tonic.
      return forHands(spec, (octave) => {
        const scale = triadScale(spec, octave)
        return [0, 2, 4, 2, 4, 7, 4, 7, 9, 9, 7, 4, 7, 4, 2, 4, 2, 0].map((degree) => scaleDegree(scale, degree))
      })
    case 'five-finger': {
      // Five notes up and down, then the tonic chord held.
      const notes: DrillNote[] = []
      const hands: (0 | 1)[] = spec.hands === 'both' ? [0, 1] : spec.hands === 'right' ? [0] : [1]
      for (const hand of hands) {
        const scale = triadScale(spec, rightHandOctave(spec) - hand)
        const run = line([0, 1, 2, 3, 4, 3, 2, 1, 0].map((degree) => scaleDegree(scale, degree)), hand, spec.notesPerClick, false)
        const chordStart = run.length / spec.notesPerClick
        const chord = [0, 2, 4].map((degree) => ({ ...scaleDegree(scale, degree), startBeat: chordStart, durationBeats: heldToBarEnd(chordStart, 1), hand }))
        notes.push(...run, ...chord)
      }
      return notes
    }
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
