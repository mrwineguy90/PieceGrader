// The progression ladder (drills-spec.md): levels of steps, each a drill at
// a target tempo. Nothing about progress is stored: a step is passed when
// any saved performance of that drill, at or above the tempo, met the
// thresholds. A level opens when the level before it is fully passed.

import { drillId, type DrillSpec, type Hands } from './drillCatalog'
import type { Performance } from './types'

// Pass mark: pitch accuracy, and the share of correct notes inside the
// "close" window (±CLOSE_MS in scoring.ts, 120 ms). The tighter ±60 ms
// "on time" figure is shown for information but not required: it proved
// hard to reach even when a scale sounded right (changed 2026-09-05).
export const PASS_PITCH = 0.95
export const PASS_CLOSE = 0.9

export interface LadderStep {
  id: string // drill id
  bpm: number // quarter-note clicks per minute
}

export interface LadderLevel {
  name: string
  description: string
  steps: LadderStep[]
  opensAfter: number // index of the level that must be complete first; -1 = always open
}

export type StepStatus = 'passed' | 'tried' | 'untried'

const ALL_MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const ALL_MINOR = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
const LEVEL_1_MAJOR = ['C', 'G', 'D', 'F']
const LEVEL_1_MINOR = ['A', 'E', 'D']
const LEVEL_2_MAJOR = [...LEVEL_1_MAJOR, 'A', 'E', 'Bb', 'Eb']
const LEVEL_2_MINOR = [...LEVEL_1_MINOR, 'B', 'F#', 'G', 'C']
const SEPARATE: Hands[] = ['right', 'left']

// Shorthand for building steps: one per key, per hand.
function steps(
  bpm: number,
  family: DrillSpec['family'],
  variant: string,
  keys: string[],
  hands: Hands[],
  octaves = 1,
  notesPerClick = 1,
): LadderStep[] {
  return keys.flatMap((key) => hands.map((hand) => ({ id: drillId({ family, variant, key, hands: hand, octaves, notesPerClick }), bpm })))
}

function hanon(bpm: number, numbers: number[], notesPerClick: number): LadderStep[] {
  return numbers.map((n) => ({ id: drillId({ family: 'hanon', variant: String(n), key: 'C', hands: 'both', octaves: 1, notesPerClick }), bpm }))
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

export const LADDER: LadderLevel[] = [
  {
    name: 'Level 1',
    description: 'First keys, one octave, hands separate, quarters at ♩ = 60.',
    opensAfter: -1,
    steps: [
      ...steps(60, 'scale', 'major', LEVEL_1_MAJOR, SEPARATE),
      ...steps(60, 'scale', 'harmonic-minor', LEVEL_1_MINOR, SEPARATE),
      ...steps(60, 'five-finger', 'major', LEVEL_1_MAJOR, SEPARATE),
      ...steps(60, 'five-finger', 'minor', LEVEL_1_MINOR, SEPARATE),
      ...steps(60, 'arpeggio', 'major', ['C', 'G', 'F'], SEPARATE),
      ...steps(60, 'cadence', 'major', ['C', 'G', 'F'], ['both'], 1, 1),
      ...hanon(60, [1, 2], 1),
    ],
  },
  {
    name: 'Level 2',
    description: 'Hands together, more keys, melodic minors, contrary motion, eighths at ♩ = 60.',
    opensAfter: 0,
    steps: [
      ...steps(60, 'scale', 'major', LEVEL_2_MAJOR, ['both'], 1, 2),
      ...steps(60, 'scale', 'harmonic-minor', LEVEL_2_MINOR, ['both'], 1, 2),
      ...steps(60, 'scale', 'melodic-minor', LEVEL_2_MINOR, ['both'], 1, 2),
      ...steps(60, 'contrary', 'major', ['C', 'G'], ['both'], 1, 2),
      ...steps(60, 'arpeggio', 'major', LEVEL_2_MAJOR, ['both'], 1, 2),
      ...steps(60, 'arpeggio', 'minor', LEVEL_2_MINOR, ['both'], 1, 2),
      ...hanon(60, [3, 4, 5, 6], 2),
    ],
  },
  {
    name: 'Level 3',
    description: 'All twelve keys, two octaves, hands together, eighths at ♩ = 72. Chromatic and broken chords.',
    opensAfter: 1,
    steps: [
      ...steps(72, 'scale', 'major', ALL_MAJOR, ['both'], 2, 2),
      ...steps(72, 'scale', 'harmonic-minor', ALL_MINOR, ['both'], 2, 2),
      ...steps(72, 'scale', 'melodic-minor', ALL_MINOR, ['both'], 2, 2),
      ...steps(72, 'scale', 'chromatic', ['C'], ['both'], 2, 2),
      ...steps(72, 'broken', 'major', ALL_MAJOR, ['both'], 1, 2),
      ...steps(72, 'broken', 'minor', ALL_MINOR, ['both'], 1, 2),
      ...steps(72, 'arpeggio', 'major', ALL_MAJOR, ['both'], 2, 2),
      ...steps(72, 'arpeggio', 'minor', ALL_MINOR, ['both'], 2, 2),
      ...hanon(72, range(7, 12), 2),
    ],
  },
  {
    name: 'Level 4',
    description: 'Two octaves at ♩ = 96, four-octave scales, Hanon in sixteenths.',
    opensAfter: 2,
    steps: [
      ...steps(96, 'scale', 'major', ALL_MAJOR, ['both'], 2, 2),
      ...steps(96, 'scale', 'harmonic-minor', ALL_MINOR, ['both'], 2, 2),
      ...steps(96, 'scale', 'melodic-minor', ALL_MINOR, ['both'], 2, 2),
      ...steps(72, 'scale', 'major', ALL_MAJOR, ['both'], 4, 2),
      ...steps(96, 'arpeggio', 'major', ALL_MAJOR, ['both'], 2, 2),
      ...steps(96, 'arpeggio', 'minor', ALL_MINOR, ['both'], 2, 2),
      ...hanon(60, range(13, 20), 4),
    ],
  },
  {
    name: 'Extras',
    description: 'Pentatonic, blues and the modes in all keys. Opens with Level 3.',
    opensAfter: 2,
    steps: [
      ...steps(72, 'scale', 'pentatonic-major', ALL_MAJOR, ['both'], 1, 2),
      ...steps(72, 'scale', 'pentatonic-minor', ALL_MINOR, ['both'], 1, 2),
      ...steps(72, 'scale', 'blues', ALL_MINOR, ['both'], 1, 2),
      ...['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'].flatMap((mode) => steps(72, 'scale', mode, ALL_MAJOR, ['both'], 1, 2)),
    ],
  },
]

export function meetsPassMark(score: Performance['score']): boolean {
  return score.pitchAccuracy >= PASS_PITCH && score.timing.close >= PASS_CLOSE
}

export function stepStatus(step: LadderStep, performances: Performance[]): StepStatus {
  const attempts = performances.filter((p) => p.pieceId === step.id)
  if (attempts.some((p) => p.bpm >= step.bpm && meetsPassMark(p.score))) return 'passed'
  return attempts.length > 0 ? 'tried' : 'untried'
}

export function passedCount(level: LadderLevel, performances: Performance[]): number {
  return level.steps.filter((step) => stepStatus(step, performances) === 'passed').length
}

export function isLevelComplete(level: LadderLevel, performances: Performance[]): boolean {
  return passedCount(level, performances) === level.steps.length
}

export function isLevelOpen(levelIndex: number, performances: Performance[]): boolean {
  const { opensAfter } = LADDER[levelIndex]
  return opensAfter < 0 || isLevelComplete(LADDER[opensAfter], performances)
}

// The first step not yet passed in the first open level that is not complete.
export function nextStep(performances: Performance[]): { levelIndex: number; step: LadderStep } | null {
  for (let levelIndex = 0; levelIndex < LADDER.length; levelIndex++) {
    if (!isLevelOpen(levelIndex, performances)) continue
    const step = LADDER[levelIndex].steps.find((each) => stepStatus(each, performances) !== 'passed')
    if (step) return { levelIndex, step }
  }
  return null
}
