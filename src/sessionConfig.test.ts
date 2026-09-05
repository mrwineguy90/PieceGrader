import { describe, expect, it } from 'vitest'
import type { Piece } from './types'
import { firstChordOf, referenceNotesInRange, type SessionConfig } from './sessionConfig'

const piece: Piece = {
  id: 'p',
  title: 'Test',
  notes: [
    { midi: 48, startBeat: 0, durationBeats: 2, track: 1 }, // left hand C3 under the opening
    { midi: 60, startBeat: 0, durationBeats: 1, track: 0 },
    { midi: 64, startBeat: 0, durationBeats: 1, track: 0 },
    { midi: 67, startBeat: 1, durationBeats: 1, track: 0 },
    { midi: 72, startBeat: 4, durationBeats: 1, track: 0 }, // bar 2
    { midi: 55, startBeat: 4.5, durationBeats: 1, track: 1 },
  ],
  timeSignature: [4, 4],
  defaultBpm: 60,
  trackNames: ['Right', 'Left'],
  source: 'midi-file',
}

const config = (changes: Partial<SessionConfig>): SessionConfig => ({ piece, tracks: [0, 1], bpm: 60, barRange: [1, 2], loop: false, waitForKey: true, ...changes })

describe('firstChordOf', () => {
  it('is every pitch sounding at the first onset of the selected tracks and bars', () => {
    expect(firstChordOf(config({}))).toEqual([48, 60, 64])
    expect(firstChordOf(config({ tracks: [0] }))).toEqual([60, 64])
    expect(firstChordOf(config({ tracks: [1] }))).toEqual([48])
  })

  it('follows the bar range, so drilling bar 2 waits for bar 2\'s first note', () => {
    expect(firstChordOf(config({ barRange: [2, 2] }))).toEqual([72])
    expect(referenceNotesInRange(config({ barRange: [2, 2] })).map((n) => n.midi)).toEqual([72, 55])
  })

  it('is empty when nothing is selected, so the session starts at once', () => {
    expect(firstChordOf(config({ tracks: [] }))).toEqual([])
  })
})
