// What drills exist (drills-spec.md): the families and their variants, the
// key lists, and the id that encodes a drill so it never needs storing.
// The notes themselves are generated in drills.ts.

import { HANON_NUMBERS } from './hanon'
import { MAJOR_KEYS, MINOR_KEYS, MINOR_LIKE_KINDS, keyLabel, type ScaleKind } from './pitches'

export type Family = 'scale' | 'contrary' | 'arpeggio' | 'broken' | 'five-finger' | 'cadence' | 'hanon'
export type Hands = 'right' | 'left' | 'both'

export interface DrillSpec {
  family: Family
  variant: string // a ScaleKind for scales/contrary, 'major' | 'minor' for chords, the exercise number for Hanon
  key: string // spelled tonic, e.g. 'F#' or 'Bb'; always 'C' for Hanon
  hands: Hands
  octaves: number // 1, 2 or 4 where the family uses it
  notesPerClick: number // 1, 2 or 4 where the family uses it
}

interface FamilyInfo {
  label: string
  variants: { id: string; label: string }[]
  usesOctaves: boolean
  usesNotesPerClick: boolean
}

const majorMinor = [
  { id: 'major', label: 'major' },
  { id: 'minor', label: 'minor' },
]

export const FAMILIES: Record<Family, FamilyInfo> = {
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
  hanon: {
    label: 'Hanon',
    variants: HANON_NUMBERS.map((number) => ({ id: String(number), label: `No. ${number}` })),
    usesOctaves: false,
    usesNotesPerClick: true,
  },
}

export function isMinorDrill(spec: DrillSpec): boolean {
  return spec.variant === 'minor' || MINOR_LIKE_KINDS.includes(spec.variant as ScaleKind)
}

export function keysFor(spec: DrillSpec): string[] {
  if (spec.family === 'hanon') return ['C']
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

export function drillTitle(spec: DrillSpec): string {
  const family = FAMILIES[spec.family]
  const variant = family.variants.find((each) => each.id === spec.variant)?.label ?? spec.variant
  const parts = [spec.family === 'hanon' ? `Hanon ${variant}` : `${keyLabel(spec.key)} ${variant} ${family.label.toLowerCase()}`]
  if (family.usesOctaves) parts.push(`${spec.octaves} octave${spec.octaves > 1 ? 's' : ''}`)
  parts.push(spec.hands === 'both' ? 'hands together' : `${spec.hands} hand`)
  if (family.usesNotesPerClick) parts.push({ 1: 'quarters', 2: 'eighths', 4: 'sixteenths' }[spec.notesPerClick] ?? `${spec.notesPerClick} per beat`)
  return parts.join(' · ')
}
