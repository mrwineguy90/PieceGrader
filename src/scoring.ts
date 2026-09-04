// Scoring (spec §6): group notes into chords, align the two chord sequences,
// match notes by pitch inside each aligned pair, then summarise pitch and
// timing overall and per bar.
//
// Why alignment rather than nearest-timestamp matching: one early note would
// otherwise shift every later note onto the wrong reference note and the whole
// performance reads as "wrong". Sequence alignment lets a skipped bar, a
// repeated bar or an extra note cost exactly one gap and leaves the rest lined up.

import { barOfBeat } from './pieces'
import type { PlayedNote, ReferenceNote } from './types'

const CHORD_WINDOW_MS = 40 // played onsets this close together are one chord
const SAME_BEAT_EPSILON = 1e-6 // reference beats come from integer ticks, so this is only float paranoia
const GAP_COST = 1 // one missed or extra chord
export const ON_TIME_MS = 60
export const CLOSE_MS = 120

export interface ReferenceChord {
  startBeat: number
  notes: ReferenceNote[]
}

export interface PlayedChord {
  startMs: number
  notes: PlayedNote[]
}

export function groupReferenceChords(notes: ReferenceNote[]): ReferenceChord[] {
  const chords: ReferenceChord[] = []
  for (const note of [...notes].sort((a, b) => a.startBeat - b.startBeat)) {
    const last = chords[chords.length - 1]
    if (last && Math.abs(note.startBeat - last.startBeat) < SAME_BEAT_EPSILON) last.notes.push(note)
    else chords.push({ startBeat: note.startBeat, notes: [note] })
  }
  return chords
}

export function groupPlayedChords(notes: PlayedNote[]): PlayedChord[] {
  const chords: PlayedChord[] = []
  for (const note of [...notes].sort((a, b) => a.startMs - b.startMs)) {
    const last = chords[chords.length - 1]
    // Measured from the chord's first note, so a slow roll can't chain forever.
    if (last && note.startMs - last.startMs <= CHORD_WINDOW_MS) last.notes.push(note)
    else chords.push({ startMs: note.startMs, notes: [note] })
  }
  return chords
}

// One step of the alignment: both present = matched (maybe with wrong notes),
// played missing = the reference chord was skipped, reference missing = extra chord.
export interface AlignmentStep {
  reference: ReferenceChord | null
  played: PlayedChord | null
}

// Needleman–Wunsch. cost[i][j] is the cheapest way to align the first i
// reference chords with the first j played chords.
export function alignChordSequences(reference: ReferenceChord[], played: PlayedChord[]): AlignmentStep[] {
  const cost: number[][] = []
  const cameFrom: ('match' | 'skip-reference' | 'skip-played')[][] = []
  for (let i = 0; i <= reference.length; i++) {
    cost.push(new Array<number>(played.length + 1).fill(0))
    cameFrom.push(new Array(played.length + 1).fill('match'))
  }
  for (let i = 1; i <= reference.length; i++) {
    cost[i][0] = i * GAP_COST
    cameFrom[i][0] = 'skip-reference'
  }
  for (let j = 1; j <= played.length; j++) {
    cost[0][j] = j * GAP_COST
    cameFrom[0][j] = 'skip-played'
  }
  for (let i = 1; i <= reference.length; i++) {
    for (let j = 1; j <= played.length; j++) {
      const match = cost[i - 1][j - 1] + mismatchCost(reference[i - 1], played[j - 1])
      const skipReference = cost[i - 1][j] + GAP_COST
      const skipPlayed = cost[i][j - 1] + GAP_COST
      // Ties prefer matching so partially-right chords stay aligned.
      if (match <= skipReference && match <= skipPlayed) {
        cost[i][j] = match
        cameFrom[i][j] = 'match'
      } else if (skipReference <= skipPlayed) {
        cost[i][j] = skipReference
        cameFrom[i][j] = 'skip-reference'
      } else {
        cost[i][j] = skipPlayed
        cameFrom[i][j] = 'skip-played'
      }
    }
  }

  const steps: AlignmentStep[] = []
  let i = reference.length
  let j = played.length
  while (i > 0 || j > 0) {
    const move = cameFrom[i][j]
    if (move === 'match') steps.push({ reference: reference[--i], played: played[--j] })
    else if (move === 'skip-reference') steps.push({ reference: reference[--i], played: null })
    else steps.push({ reference: null, played: played[--j] })
  }
  return steps.reverse()
}

// 0 when the pitch sets are identical, 1 when nothing overlaps. A wholly wrong
// chord therefore costs the same as one gap, so it aligns as a substitution
// rather than a skip plus an extra.
function mismatchCost(reference: ReferenceChord, played: PlayedChord): number {
  const referencePitches = new Set(reference.notes.map((note) => note.midi))
  const shared = played.notes.filter((note) => referencePitches.has(note.midi)).length
  return 1 - shared / Math.max(referencePitches.size, played.notes.length)
}

export interface NoteResult {
  kind: 'correct' | 'wrong' | 'missed' | 'extra'
  reference: ReferenceNote | null // null for extra
  played: PlayedNote | null // null for missed
  deviationMs: number | null // correct notes only: positive = late
  bar: number // 1-based; from the reference note, or from the played time for extras
}

// Over the correct notes only; percents are 0..1.
export interface TimingSummary {
  count: number
  onTime: number // fraction within ±ON_TIME_MS
  close: number // fraction within ±CLOSE_MS
  meanAbsDeviationMs: number
  meanDeviationMs: number // negative = early on average, positive = late
}

export interface Summary {
  referenceCount: number
  correct: number
  wrong: number
  missed: number
  extra: number
  pitchAccuracy: number // correct / referenceCount, 0..1
  timing: TimingSummary
}

export interface BarScore extends Summary {
  bar: number
}

export interface Score extends Summary {
  results: NoteResult[]
  bars: BarScore[] // one per bar in the range, in order
}

export interface ScoringContext {
  quarterBpm: number
  rangeStartBeat: number // the beat that played time 0 corresponds to
  quartersPerBar: number
  barRange: [number, number]
}

export function scorePerformance(reference: ReferenceNote[], played: PlayedNote[], context: ScoringContext): Score {
  const msPerQuarter = 60_000 / context.quarterBpm
  const barOfPlayed = (note: PlayedNote) => barOfBeat(context.rangeStartBeat + note.startMs / msPerQuarter, context.quartersPerBar)
  const steps = alignChordSequences(groupReferenceChords(reference), groupPlayedChords(played))
  const results: NoteResult[] = []
  for (const step of steps) {
    if (step.reference && step.played) results.push(...matchNotesInChord(step.reference, step.played))
    else if (step.reference) results.push(...step.reference.notes.map((note) => noteResult('missed', note, null)))
    else if (step.played) results.push(...step.played.notes.map((note) => noteResult('extra', null, note)))
  }
  for (const result of results) {
    if (result.kind === 'correct' && result.reference && result.played) {
      result.deviationMs = result.played.startMs - (result.reference.startBeat - context.rangeStartBeat) * msPerQuarter
    }
    result.bar = result.reference ? barOfBeat(result.reference.startBeat, context.quartersPerBar) : barOfPlayed(result.played!)
  }
  const bars: BarScore[] = []
  for (let bar = context.barRange[0]; bar <= context.barRange[1]; bar++) {
    bars.push({ bar, ...summarize(results.filter((result) => result.bar === bar)) })
  }
  return { ...summarize(results), results, bars }
}

function summarize(results: NoteResult[]): Summary {
  const count = (kind: NoteResult['kind']) => results.filter((result) => result.kind === kind).length
  const referenceCount = results.filter((result) => result.reference !== null).length
  const correct = count('correct')
  const deviations = results.flatMap((result) => (result.deviationMs === null ? [] : [result.deviationMs]))
  const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length)
  const fractionWithin = (limitMs: number) =>
    deviations.length === 0 ? 0 : deviations.filter((deviation) => Math.abs(deviation) <= limitMs).length / deviations.length
  return {
    referenceCount,
    correct,
    wrong: count('wrong'),
    missed: count('missed'),
    extra: count('extra'),
    pitchAccuracy: referenceCount === 0 ? 0 : correct / referenceCount,
    timing: {
      count: deviations.length,
      onTime: fractionWithin(ON_TIME_MS),
      close: fractionWithin(CLOSE_MS),
      meanAbsDeviationMs: mean(deviations.map(Math.abs)),
      meanDeviationMs: mean(deviations),
    },
  }
}

// Same pitch = correct. Leftovers pair off as wrong notes (played X instead
// of Y); anything still unpaired is missed or extra.
function matchNotesInChord(reference: ReferenceChord, played: PlayedChord): NoteResult[] {
  const results: NoteResult[] = []
  const unmatchedPlayed = [...played.notes]
  const unmatchedReference: ReferenceNote[] = []
  for (const note of reference.notes) {
    const index = unmatchedPlayed.findIndex((candidate) => candidate.midi === note.midi)
    if (index === -1) unmatchedReference.push(note)
    else results.push(noteResult('correct', note, unmatchedPlayed.splice(index, 1)[0]))
  }
  unmatchedReference.sort((a, b) => a.midi - b.midi)
  unmatchedPlayed.sort((a, b) => a.midi - b.midi)
  while (unmatchedReference.length > 0 && unmatchedPlayed.length > 0) {
    results.push(noteResult('wrong', unmatchedReference.shift()!, unmatchedPlayed.shift()!))
  }
  results.push(...unmatchedReference.map((note) => noteResult('missed', note, null)))
  results.push(...unmatchedPlayed.map((note) => noteResult('extra', null, note)))
  return results
}

function noteResult(kind: NoteResult['kind'], reference: ReferenceNote | null, played: PlayedNote | null): NoteResult {
  return { kind, reference, played, deviationMs: null, bar: 0 } // deviation and bar filled in by scorePerformance
}
