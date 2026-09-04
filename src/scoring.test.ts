// Spec §6 alignment checklist.
import { describe, expect, it } from 'vitest'
import { alignChordSequences, groupPlayedChords, groupReferenceChords, scorePerformance } from './scoring'
import type { PlayedNote, ReferenceNote } from './types'

const BPM = 120
const MS_PER_BEAT = 500

function ref(midi: number, startBeat: number, durationBeats = 1): ReferenceNote {
  return { midi, startBeat, durationBeats, track: 0 }
}

// Two bars of 4/4: four quarters, then G, a C-E-G half-note chord, and A.
const reference: ReferenceNote[] = [
  ref(60, 0),
  ref(62, 1),
  ref(64, 2),
  ref(65, 3),
  ref(67, 4),
  ref(60, 5, 2),
  ref(64, 5, 2),
  ref(67, 5, 2),
  ref(69, 7),
]
const bar1 = reference.slice(0, 4)
const bar2 = reference.slice(4)

// Plays reference notes exactly, optionally shifted in time and pitch.
function play(notes: ReferenceNote[], shiftMs = 0, shiftBeats = 0): PlayedNote[] {
  return notes.map((note) => ({
    midi: note.midi,
    startMs: (note.startBeat + shiftBeats) * MS_PER_BEAT + shiftMs,
    durationMs: note.durationBeats * MS_PER_BEAT * 0.9,
    velocity: 80,
  }))
}

function counts(played: PlayedNote[]) {
  const { correct, wrong, missed, extra, pitchAccuracy } = scorePerformance(reference, played, BPM, 0)
  return { correct, wrong, missed, extra, pitchAccuracy }
}

describe('scorePerformance', () => {
  it('perfect performance: 100% pitch, 0 wrong/missed/extra', () => {
    expect(counts(play(reference))).toEqual({ correct: 9, wrong: 0, missed: 0, extra: 0, pitchAccuracy: 1 })
  })

  it('one wrong note: 1 substitution, everything else matched', () => {
    const played = play(reference)
    played[1].midi = 63 // D♯ instead of D
    const score = scorePerformance(reference, played, BPM, 0)
    expect(counts(played)).toMatchObject({ correct: 8, wrong: 1, missed: 0, extra: 0 })
    const wrong = score.results.find((result) => result.kind === 'wrong')!
    expect(wrong.reference?.midi).toBe(62)
    expect(wrong.played?.midi).toBe(63)
  })

  it('one skipped note: 1 missed, later notes still matched', () => {
    const played = play(reference.filter((note) => note.midi !== 64 || note.startBeat !== 2))
    expect(counts(played)).toMatchObject({ correct: 8, wrong: 0, missed: 1, extra: 0 })
  })

  it('one extra note: 1 extra, later notes still matched', () => {
    const played = [...play(reference), { midi: 61, startMs: 2.5 * MS_PER_BEAT, durationMs: 100, velocity: 80 }]
    expect(counts(played)).toMatchObject({ correct: 9, wrong: 0, missed: 0, extra: 1 })
  })

  it('chord with one wrong note: 2 matched, 1 wrong, chord still aligned', () => {
    const played = play(reference)
    played[6].midi = 63 // the E of the C-E-G chord
    const score = scorePerformance(reference, played, BPM, 0)
    expect(counts(played)).toMatchObject({ correct: 8, wrong: 1, missed: 0, extra: 0 })
    const chordResults = score.results.filter((result) => result.reference?.startBeat === 5)
    expect(chordResults.map((result) => result.kind).sort()).toEqual(['correct', 'correct', 'wrong'])
  })

  it('entire bar skipped: that bar missed, following bar matched', () => {
    const played = play(bar2, 0, -4) // went straight to bar 2 without waiting
    expect(counts(played)).toMatchObject({ correct: 5, wrong: 0, missed: 4, extra: 0 })
  })

  it('bar repeated: the repeat counts as extra, everything else matched', () => {
    const played = [...play(bar1), ...play(bar1, 0, 4), ...play(bar2, 0, 4)]
    expect(counts(played)).toMatchObject({ correct: 9, wrong: 0, missed: 0, extra: 4 })
  })

  it('played everything 20 ms late: 100% pitch, deviations show it', () => {
    const score = scorePerformance(reference, play(reference, 20), BPM, 0)
    expect(score.pitchAccuracy).toBe(1)
    for (const result of score.results) expect(result.deviationMs).toBeCloseTo(20)
  })

  it('measures deviation from the start of the selected range', () => {
    const score = scorePerformance(bar2, play(bar2, 0, -4), BPM, 4)
    for (const result of score.results) expect(result.deviationMs).toBeCloseTo(0)
  })
})

describe('chord grouping', () => {
  it('groups reference notes that start on the same beat', () => {
    expect(groupReferenceChords(reference).map((chord) => chord.notes.length)).toEqual([1, 1, 1, 1, 1, 3, 1])
  })

  it('groups played onsets within 40 ms of the first note of the chord', () => {
    const at = (startMs: number): PlayedNote => ({ midi: 60, startMs, durationMs: 100, velocity: 80 })
    const chords = groupPlayedChords([at(0), at(30), at(45), at(200)])
    expect(chords.map((chord) => chord.notes.length)).toEqual([2, 1, 1])
  })
})

describe('alignChordSequences', () => {
  it('skips a missing reference chord and keeps the rest aligned', () => {
    const chords = groupReferenceChords(bar1)
    const played = groupPlayedChords(play([bar1[0], bar1[2], bar1[3]]))
    const steps = alignChordSequences(chords, played)
    expect(steps.map((step) => [step.reference?.startBeat ?? null, step.played?.startMs ?? null])).toEqual([
      [0, 0],
      [1, null],
      [2, 1000],
      [3, 1500],
    ])
  })
})
