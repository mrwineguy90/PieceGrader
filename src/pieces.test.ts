import { writeMidi, type MidiEvent } from 'midi-file'
import { describe, expect, it } from 'vitest'
import {
  barCount,
  barOfBeat,
  beatsPerBar,
  bpmLabel,
  clickLengthInBeats,
  parseMidiFilePiece,
  quantizeRecording,
  quarterNoteBpm,
  splitAtMiddleC,
} from './pieces'

const TICKS = 480

function note(channel: number, midi: number, lengthTicks: number, delta = 0): MidiEvent[] {
  return [
    { deltaTime: delta, type: 'noteOn', channel, noteNumber: midi, velocity: 80 },
    { deltaTime: lengthTicks, type: 'noteOff', channel, noteNumber: midi, velocity: 0 },
  ]
}

function buildFile(tracks: MidiEvent[][], format: 0 | 1 = 1): Uint8Array {
  const withEnds = tracks.map((events) => [...events, { deltaTime: 0, type: 'endOfTrack' as const }])
  return new Uint8Array(writeMidi({ header: { format, numTracks: withEnds.length, ticksPerBeat: TICKS }, tracks: withEnds }))
}

const conductorTrack: MidiEvent[] = [
  { deltaTime: 0, type: 'setTempo', microsecondsPerBeat: 600_000 }, // 100 BPM
  { deltaTime: 0, type: 'timeSignature', numerator: 3, denominator: 4, metronome: 24, thirtyseconds: 8 },
]

describe('parseMidiFilePiece', () => {
  it('reads notes per track in beats, with tempo and time signature (Format 1)', () => {
    const rightHand: MidiEvent[] = [
      { deltaTime: 0, type: 'trackName', text: 'RH' },
      ...note(0, 60, TICKS),
      ...note(0, 64, TICKS / 2, TICKS), // one beat rest, then an eighth
    ]
    const leftHand: MidiEvent[] = [...note(1, 48, TICKS * 3)]
    const piece = parseMidiFilePiece(buildFile([conductorTrack, rightHand, leftHand]), 'Test')

    expect(piece.defaultBpm).toBe(100)
    expect(piece.timeSignature).toEqual([3, 4])
    expect(piece.trackNames).toEqual(['RH', 'Track 3']) // conductor track dropped
    expect(piece.notes).toEqual([
      { midi: 48, startBeat: 0, durationBeats: 3, track: 1 },
      { midi: 60, startBeat: 0, durationBeats: 1, track: 0 },
      { midi: 64, startBeat: 2, durationBeats: 0.5, track: 0 },
    ])
  })

  it('handles Format 0 and note-on with velocity 0 as note-off', () => {
    const events: MidiEvent[] = [
      ...conductorTrack,
      { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 62, velocity: 90 },
      { deltaTime: TICKS, type: 'noteOn', channel: 0, noteNumber: 62, velocity: 0 },
    ]
    const piece = parseMidiFilePiece(buildFile([events], 0), 'Solo')
    expect(piece.notes).toEqual([{ midi: 62, startBeat: 0, durationBeats: 1, track: 0 }])
    expect(piece.trackNames).toEqual(['Track 1'])
  })

  it('ignores the percussion channel', () => {
    const piece = parseMidiFilePiece(buildFile([[...note(9, 36, TICKS), ...note(0, 60, TICKS)]], 0), 'Drums')
    expect(piece.notes.map((n) => n.midi)).toEqual([60])
  })

  it('keeps 6/8 and converts the quarter-note tempo to eighth-note clicks', () => {
    const events: MidiEvent[] = [
      { deltaTime: 0, type: 'setTempo', microsecondsPerBeat: 750_000 }, // quarter = 80
      { deltaTime: 0, type: 'timeSignature', numerator: 6, denominator: 8, metronome: 24, thirtyseconds: 8 },
      ...note(0, 60, TICKS),
    ]
    const piece = parseMidiFilePiece(buildFile([events], 0), 'Six eight')
    expect(piece.timeSignature).toEqual([6, 8])
    expect(piece.defaultBpm).toBe(160) // eighth = 160
    expect(beatsPerBar(piece)).toBe(3) // still three quarter notes per bar
    expect(clickLengthInBeats(piece.timeSignature)).toBe(0.5)
    expect(quarterNoteBpm(160, piece.timeSignature)).toBe(80)
    expect(bpmLabel(160, piece.timeSignature)).toBe('♪ = 160')
  })

  it('falls back to 120 BPM and 4/4 when the file says nothing', () => {
    const piece = parseMidiFilePiece(buildFile([note(0, 60, TICKS)], 0), 'Bare')
    expect(piece.defaultBpm).toBe(120)
    expect(piece.timeSignature).toEqual([4, 4])
  })

  it('throws when there are no notes', () => {
    expect(() => parseMidiFilePiece(buildFile([conductorTrack]), 'Empty')).toThrow(/No notes/)
  })
})

describe('splitAtMiddleC', () => {
  it('sends middle C and above to track 0, the rest to track 1', () => {
    const piece = parseMidiFilePiece(buildFile([[...note(0, 60, TICKS), ...note(0, 59, TICKS)]], 0), 'One track')
    const split = splitAtMiddleC(piece)
    expect(split.trackNames).toEqual(['Right hand', 'Left hand'])
    expect(split.notes.map((n) => [n.midi, n.track])).toEqual([
      [60, 0],
      [59, 1],
    ])
  })
})

describe('quantizeRecording', () => {
  it('snaps played notes to the nearest 1/16 at the recording tempo', () => {
    // 120 BPM: a quarter is 500 ms, a sixteenth 125 ms.
    const played = [
      { midi: 60, startMs: 0, durationMs: 460, velocity: 80 }, // ≈ one quarter
      { midi: 62, startMs: 510, durationMs: 240, velocity: 80 }, // beat 1, ≈ an eighth
      { midi: 64, startMs: 1130, durationMs: 30, velocity: 80 }, // beat 2.25, too short → shortest
      { midi: 48, startMs: -40, durationMs: 1000, velocity: 80 }, // slightly early → clamped to 0
    ]
    const piece = quantizeRecording(played, 120, [6, 8], 'Recorded thing')
    expect(piece.notes).toEqual([
      { midi: 48, startBeat: 0, durationBeats: 2, track: 0 },
      { midi: 60, startBeat: 0, durationBeats: 1, track: 0 },
      { midi: 62, startBeat: 1, durationBeats: 0.5, track: 0 },
      { midi: 64, startBeat: 2.25, durationBeats: 0.25, track: 0 },
    ])
    expect(piece.source).toBe('recorded')
    expect(piece.trackNames).toEqual(['Recorded'])
    expect(piece.defaultBpm).toBe(240) // quarter = 120 shown as eighth clicks
  })
})

describe('bars', () => {
  it('numbers bars from 1', () => {
    expect(barOfBeat(0, 4)).toBe(1)
    expect(barOfBeat(3.99, 4)).toBe(1)
    expect(barOfBeat(4, 4)).toBe(2)
  })

  it('counts bars up to the end of the last note', () => {
    const piece = parseMidiFilePiece(buildFile([note(0, 60, TICKS * 2, TICKS * 7)], 0), 'Nine beats')
    expect(barCount(piece)).toBe(3) // note ends at beat 9, in bar 3
  })
})
