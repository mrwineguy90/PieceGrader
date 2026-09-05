import { describe, expect, it } from 'vitest'
import { drillBaseId, drillBaseTitle, drillId, drillVariantLabel, parseDrillId, type DrillSpec } from './drillCatalog'
import { drillToPiece, generateDrill } from './drills'
import { HANON, hanonPitches } from './hanon'
import { chromaticOctave, keyFifths, scaleUpAndDown, sevenNoteScale } from './pitches'
import { barCount } from './pieces'

const name = (pitch: { letter: string; alter: number; octave: number }) =>
  `${pitch.letter}${pitch.alter === 2 ? 'x' : pitch.alter === 1 ? '#' : pitch.alter === -1 ? 'b' : pitch.alter === -2 ? 'bb' : ''}${pitch.octave}`

const spec = (changes: Partial<DrillSpec>): DrillSpec => ({
  family: 'scale',
  variant: 'major',
  key: 'C',
  hands: 'right',
  octaves: 1,
  notesPerClick: 1,
  ...changes,
})

describe('spelling', () => {
  it('spells each scale degree on the next letter', () => {
    expect(sevenNoteScale('major', 'F#', 4).map(name)).toEqual(['F#4', 'G#4', 'A#4', 'B4', 'C#5', 'D#5', 'E#5'])
    expect(sevenNoteScale('harmonic-minor', 'Bb', 3).map(name)).toEqual(['Bb3', 'C4', 'Db4', 'Eb4', 'F4', 'Gb4', 'A4'])
    expect(sevenNoteScale('harmonic-minor', 'G#', 4).map(name)).toEqual(['G#4', 'A#4', 'B4', 'C#5', 'D#5', 'E5', 'Fx5'])
    expect(sevenNoteScale('dorian', 'D', 4).map(name)).toEqual(['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'])
  })

  it('melodic minor comes down as natural minor', () => {
    expect(scaleUpAndDown('melodic-minor', 'A', 4, 1).map(name)).toEqual([
      'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G#5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4',
    ])
  })

  it('chromatic goes up in sharps and down in flats, keeping the tonic spelling', () => {
    expect(chromaticOctave('C', 4, 'up').map(name)).toEqual(['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4'])
    const down = scaleUpAndDown('chromatic', 'F#', 4, 1).slice(12)
    expect(down.map(name)).toEqual(['F#5', 'F5', 'E5', 'Eb5', 'D5', 'Db5', 'C5', 'B4', 'Bb4', 'A4', 'Ab4', 'G4', 'F#4'])
  })

  it('blues and pentatonic scales pick the right degrees', () => {
    expect(scaleUpAndDown('blues', 'C', 4, 1).slice(0, 7).map(name)).toEqual(['C4', 'Eb4', 'F4', 'Gb4', 'G4', 'Bb4', 'C5'])
    expect(scaleUpAndDown('pentatonic-major', 'G', 4, 1).slice(0, 6).map(name)).toEqual(['G4', 'A4', 'B4', 'D5', 'E5', 'G5'])
  })

  it('key signatures follow the mode', () => {
    expect(keyFifths('major', 'D')).toBe(2)
    expect(keyFifths('harmonic-minor', 'D')).toBe(-1)
    expect(keyFifths('dorian', 'D')).toBe(0)
    expect(keyFifths('major', 'Db')).toBe(-5)
  })
})

describe('generateDrill', () => {
  it('lays a one-octave scale out in quarters with the top note once and the last note held', () => {
    const drill = generateDrill(spec({}))
    const first = drill.notes.slice(0, 15) // the first of the repetitions
    expect(first.map((note) => note.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60])
    expect(first.map((note) => note.startBeat)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(first[14].durationBeats).toBe(2) // beat 14 of a 4/4 bar: half note to the bar line
    expect(drill.notes[15].startBeat).toBe(16) // the next repetition starts on the following bar line
    expect(drill.notes.every((note) => note.hand === 0)).toBe(true)
  })

  it('hands together adds the left hand an octave lower', () => {
    const drill = generateDrill(spec({ hands: 'both', notesPerClick: 2 }))
    const right = drill.notes.filter((note) => note.hand === 0)
    const left = drill.notes.filter((note) => note.hand === 1)
    expect(left.map((note) => note.midi)).toEqual(right.map((note) => note.midi - 12))
    expect(left.map((note) => note.startBeat)).toEqual(right.map((note) => note.startBeat))
    expect(right[1].startBeat).toBe(0.5)
  })

  it('contrary motion sends the left hand down while the right goes up', () => {
    const drill = generateDrill(spec({ family: 'contrary', hands: 'both' }))
    const right = drill.notes.filter((note) => note.hand === 0).map((note) => note.midi)
    const left = drill.notes.filter((note) => note.hand === 1).map((note) => note.midi)
    expect(right.slice(0, 3)).toEqual([60, 62, 64])
    expect(left.slice(0, 3)).toEqual([60, 59, 57])
    expect(left[left.length - 1]).toBe(60)
  })

  it('arpeggios, broken chords, five-finger patterns and cadences use the triad', () => {
    expect(generateDrill(spec({ family: 'arpeggio', variant: 'minor', key: 'A', octaves: 2 })).notes.slice(0, 13).map((n) => n.midi)).toEqual([
      69, 72, 76, 81, 84, 88, 93, 88, 84, 81, 76, 72, 69,
    ])
    expect(generateDrill(spec({ family: 'broken' })).notes.slice(0, 9).map((n) => n.midi)).toEqual([60, 64, 67, 64, 67, 72, 67, 72, 76])
    const fiveFinger = generateDrill(spec({ family: 'five-finger', variant: 'minor', key: 'D' }))
    expect(fiveFinger.notes.slice(0, 5).map((n) => n.midi)).toEqual([62, 64, 65, 67, 69])
    expect(fiveFinger.notes.slice(9, 12).map((n) => [n.midi, n.startBeat])).toEqual([
      [62, 9],
      [65, 9],
      [69, 9],
    ])
    const cadence = generateDrill(spec({ family: 'cadence', hands: 'both' }))
    const chordAt = (beat: number) => cadence.notes.filter((n) => n.startBeat === beat).map((n) => n.midi).sort((a, b) => a - b)
    expect(chordAt(0)).toEqual([48, 60, 64, 67]) // C3 + C E G
    expect(chordAt(2)).toEqual([53, 60, 65, 69]) // F3 + C F A
    expect(chordAt(4)).toEqual([55, 59, 62, 67]) // G3 + B D G
  })

  it('repeats every drill until it is at least twelve bars', () => {
    // One octave in eighths is two bars: six repetitions make twelve.
    const short = generateDrill(spec({ notesPerClick: 2 }))
    expect(short.notes.length).toBe(15 * 6)
    expect(short.notes.filter((note) => note.midi === 60 && note.startBeat % 8 === 0).length).toBe(6) // a fresh start every two bars
    expect(barCount(drillToPiece(short))).toBe(12)
    // Cadence: two bars of half notes → six times.
    expect(barCount(drillToPiece(generateDrill(spec({ family: 'cadence', hands: 'both' }))))).toBe(12)
    // One octave in quarters is four bars → three times.
    expect(generateDrill(spec({})).notes.length).toBe(15 * 3)
    // Hanon is long (29 groups of sixteenths, two per bar): left alone.
    expect(barCount(drillToPiece(generateDrill(spec({ family: 'hanon', variant: '1', hands: 'both', notesPerClick: 4 }))))).toBe(15)
  })

  it('four-octave drills start an octave lower so they stay on the keyboard', () => {
    const drill = generateDrill(spec({ key: 'B', octaves: 4 }))
    expect(Math.max(...drill.notes.map((note) => note.midi))).toBeLessThanOrEqual(108)
  })
})

describe('hanon', () => {
  it('No. 1 is C E F G A G F E stepping up from C3, with 233 notes in all', () => {
    const { sequence, final } = hanonPitches(1, 3)
    expect(sequence.slice(0, 16).map((p) => p.midi)).toEqual([48, 52, 53, 55, 57, 55, 53, 52, 50, 53, 55, 57, 59, 57, 55, 53])
    expect(sequence.length).toBe((14 + 15) * 8)
    expect(sequence[14 * 8].midi).toBe(79) // descent starts on G5
    expect(final.map((p) => p.midi)).toEqual([48])
  })

  it('honours the irregular groups and the final chord', () => {
    expect(hanonPitches(12, 3).sequence.slice(0, 8).map((p) => p.midi)).toEqual([55, 48, 52, 50, 48, 50, 52, 48]) // G C E D C D E C
    expect(hanonPitches(20, 3).final.map((p) => p.midi)).toEqual([52, 60]) // E3 + C4
    for (const number of Object.keys(HANON).map(Number)) {
      const { sequence } = hanonPitches(number, 3)
      expect(sequence.length % 8).toBe(0)
      expect(Math.max(...sequence.map((p) => p.midi))).toBeLessThanOrEqual(96)
    }
  })

  it('lays out as a drill with the left hand an octave below', () => {
    const drill = generateDrill(spec({ family: 'hanon', variant: '3', hands: 'both', notesPerClick: 4 }))
    const right = drill.notes.filter((n) => n.hand === 0)
    const left = drill.notes.filter((n) => n.hand === 1)
    expect(right[0].midi).toBe(48)
    expect(left[0].midi).toBe(36)
    expect(right[1].startBeat).toBe(0.25)
    expect(drill.title).toBe('Hanon No. 3 · hands together · sixteenths')
    expect(drill.keyFifths).toBe(0)
  })
})

describe('ids and pieces', () => {
  it('round-trips a spec through its id', () => {
    const original = spec({ family: 'contrary', variant: 'harmonic-minor', key: 'F#', hands: 'both', octaves: 2, notesPerClick: 2 })
    expect(parseDrillId(drillId(original))).toEqual(original)
    expect(parseDrillId('not-a-drill')).toBeNull()
  })

  it('splits a drill into a base (for history) and a variant', () => {
    const scale = spec({ variant: 'harmonic-minor', key: 'F#', hands: 'both', octaves: 2, notesPerClick: 2 })
    expect(drillBaseId(scale)).toBe('drill:scale:harmonic-minor:F#')
    expect(drillBaseTitle(scale)).toBe('F♯ harmonic minor scale')
    expect(drillVariantLabel(scale)).toBe('2 octaves · hands together · eighths')
    const hanon = spec({ family: 'hanon', variant: '7', key: 'C', hands: 'both', notesPerClick: 4 })
    expect(drillBaseTitle(hanon)).toBe('Hanon No. 7')
    expect(drillVariantLabel(hanon)).toBe('hands together · sixteenths')
  })

  it('builds a piece with a generated score and a sensible title', () => {
    const piece = drillToPiece(generateDrill(spec({ variant: 'harmonic-minor', key: 'F#', hands: 'both', octaves: 2, notesPerClick: 2 })))
    expect(piece.title).toBe('F♯ harmonic minor scale · 2 octaves · hands together · eighths')
    expect(piece.source).toBe('drill')
    expect(piece.timeSignature).toEqual([4, 4])
    expect(barCount(piece)).toBe(12) // two octaves in eighths is four bars, repeated three times
    expect(piece.score?.fileName.endsWith('.musicxml')).toBe(true)
  })
})
