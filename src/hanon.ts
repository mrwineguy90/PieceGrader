// Hanon, The Virtuoso Pianist, exercises 1–20, as data. Every exercise is
// groups of eight sixteenths: ascending groups whose start rises one white
// key per group, then descending groups falling one white key per group,
// then a final note. `pattern` is the group's shape as white-key steps from
// the group's regular start; a few groups deviate (Hanon's lead-ins and
// irregular first groups) and are listed as overrides by group index.
//
// Transcribed mechanically from the Mutopia Project engraving (CC BY-SA 4.0,
// Javier Ruiz-Alma) of the 1873 public-domain edition; not typed from memory.
// Indexes are white keys with C3 = 0, the right hand's starting note. The left
// hand plays the same an octave lower.

import { pitchAt, type Letter, type Pitch } from './pitches'

interface Run {
  start: number // regular start of the first group, in white keys from C3
  pattern: number[] // eight steps from the group's regular start
  groups: number
  overrides?: Record<number, number[]> // group index → its own eight steps
}

interface Exercise {
  up: Run
  down: Run
  final: number[] // one note, or a chord
}

// prettier-ignore
export const HANON: Record<number, Exercise> = {
  1: { up: { start: 0, pattern: [0,2,3,4,5,4,3,2], groups: 14 }, down: { start: 18, pattern: [0,-2,-3,-4,-5,-4,-3,-2], groups: 15 }, final: [0] },
  2: { up: { start: 0, pattern: [0,2,5,4,3,4,3,2], groups: 14 }, down: { start: 18, pattern: [0,-3,-5,-4,-3,-4,-3,-2], groups: 14 }, final: [0] },
  3: { up: { start: 0, pattern: [0,2,5,4,3,2,3,4], groups: 14 }, down: { start: 18, pattern: [0,-3,-5,-4,-3,-2,-3,-4], groups: 14 }, final: [0] },
  4: { up: { start: 0, pattern: [0,1,0,2,5,4,3,2], groups: 14 }, down: { start: 18, pattern: [0,-1,0,-3,-5,-4,-3,-2], groups: 14 }, final: [0] },
  5: { up: { start: 0, pattern: [0,5,4,5,3,4,2,3], groups: 14 }, down: { start: 14, pattern: [0,1,0,2,1,3,2,4], groups: 14 }, final: [0] },
  6: { up: { start: 0, pattern: [0,5,4,5,3,5,2,5], groups: 14, overrides: { 13: [0,5,4,5,3,5,2,1] } }, down: { start: 18, pattern: [0,-5,-4,-5,-3,-5,-2,-5], groups: 14, overrides: { 13: [0,-5,-4,-5,-3,-5,-2,-3] } }, final: [0] },
  7: { up: { start: 0, pattern: [0,2,1,3,2,4,3,2], groups: 14 }, down: { start: 18, pattern: [0,-2,-1,-3,-2,-4,-3,-2], groups: 14 }, final: [0] },
  8: { up: { start: 0, pattern: [0,2,4,5,3,4,2,3], groups: 14 }, down: { start: 18, pattern: [0,-2,-4,-5,-3,-4,-2,-3], groups: 14 }, final: [0] },
  9: { up: { start: 0, pattern: [0,2,3,2,4,3,5,4], groups: 14 }, down: { start: 18, pattern: [0,-2,-3,-2,-4,-3,-5,-4], groups: 14, overrides: { 13: [0,-2,-3,-2,-4,-3,-4,-3] } }, final: [0] },
  10: { up: { start: 0, pattern: [0,5,4,3,2,3,2,3], groups: 14 }, down: { start: 18, pattern: [0,-5,-4,-3,-2,-3,-2,-3], groups: 14 }, final: [0] },
  11: { up: { start: 0, pattern: [0,2,5,4,5,4,3,4], groups: 14 }, down: { start: 18, pattern: [0,-3,-5,-4,-5,-4,-3,-4], groups: 14 }, final: [0] },
  12: { up: { start: 5, pattern: [0,-5,-3,-4,-5,-4,-3,-5], groups: 14, overrides: { 0: [-1,-5,-3,-4,-5,-4,-3,-5], 13: [0,-5,-3,-4,-5,-4,-3,-2] } }, down: { start: 13, pattern: [0,5,3,4,5,4,3,5], groups: 15, overrides: { 14: [1,5,3,4,5,4,3,4] } }, final: [0] },
  13: { up: { start: 2, pattern: [0,-2,1,-1,2,0,1,2], groups: 14 }, down: { start: 16, pattern: [0,2,-1,1,0,-2,-1,0], groups: 14 }, final: [0] },
  14: { up: { start: 0, pattern: [0,1,3,2,3,2,4,3], groups: 14 }, down: { start: 18, pattern: [0,-1,-3,-2,-3,-2,-4,-3], groups: 14 }, final: [0] },
  15: { up: { start: 0, pattern: [0,2,1,3,2,4,3,5], groups: 14, overrides: { 13: [0,2,1,3,2,4,3,4] } }, down: { start: 18, pattern: [0,-2,-1,-3,-2,-4,-3,-5], groups: 14, overrides: { 13: [0,-2,-1,-3,-2,-4,-3,-4] } }, final: [0] },
  16: { up: { start: 0, pattern: [0,2,1,2,5,4,3,4], groups: 14 }, down: { start: 18, pattern: [0,-3,-2,-3,-5,-4,-3,-4], groups: 14 }, final: [0] },
  17: { up: { start: 0, pattern: [0,2,5,4,6,5,4,5], groups: 14, overrides: { 13: [0,2,5,4,6,5,4,3] } }, down: { start: 18, pattern: [0,-3,-5,-4,-6,-5,-4,-6], groups: 13, overrides: { 12: [0,-3,-5,-4,-6,-5,-4,-5] } }, final: [0] },
  18: { up: { start: 0, pattern: [0,1,3,2,4,3,1,2], groups: 14 }, down: { start: 18, pattern: [0,-1,-3,-2,-4,-3,-1,-2], groups: 14 }, final: [0] },
  19: { up: { start: 0, pattern: [0,5,3,4,5,3,2,4], groups: 14 }, down: { start: 18, pattern: [0,-5,-3,-4,-5,-3,-2,-4], groups: 14 }, final: [0] },
  20: { up: { start: 2, pattern: [0,2,5,7,5,4,5,3], groups: 15, overrides: { 14: [0,2,5,7,5,4,5,2] } }, down: { start: 23, pattern: [0,-2,-5,-7,-5,-6,-5,-7], groups: 15, overrides: { 14: [0,-2,-5,-7,-5,-6,-5,-6] } }, final: [2, 7] },
}

export const HANON_NUMBERS = Object.keys(HANON).map(Number)

const WHITE_KEYS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

// White key `index` counted from C in `baseOctave`.
function whiteKey(index: number, baseOctave: number): Pitch {
  const octave = baseOctave + Math.floor(index / 7)
  return pitchAt(WHITE_KEYS[((index % 7) + 7) % 7], 0, octave)
}

function expand(run: Run, direction: 1 | -1): number[] {
  const indexes: number[] = []
  for (let group = 0; group < run.groups; group++) {
    const start = run.start + group * direction
    for (const step of run.overrides?.[group] ?? run.pattern) indexes.push(start + step)
  }
  return indexes
}

// The whole exercise as pitches, plus its final note or chord, for a hand
// whose C3 sits in `baseOctave` (3 for the right hand, 2 for the left).
export function hanonPitches(number: number, baseOctave: number): { sequence: Pitch[]; final: Pitch[] } {
  const exercise = HANON[number]
  const indexes = [...expand(exercise.up, 1), ...expand(exercise.down, -1)]
  return {
    sequence: indexes.map((index) => whiteKey(index, baseOctave)),
    final: exercise.final.map((index) => whiteKey(index, baseOctave)),
  }
}
