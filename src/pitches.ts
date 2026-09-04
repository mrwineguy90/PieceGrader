// Note spelling for generated drills: tonics, scale formulas, key signatures.
// Everything here is about *letters and accidentals*, not just MIDI numbers,
// so the notation can be written the way a scale book writes it.

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

export interface Pitch {
  letter: Letter
  alter: number // -2..2: flats negative, sharps positive
  octave: number // scientific: C4 = middle C
  midi: number
}

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const LETTER_SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const LETTER_FIFTHS: Record<Letter, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 }

// The conventional spelling of each of the twelve keys.
export const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
export const MINOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

export type ScaleKind =
  | 'major'
  | 'natural-minor'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'chromatic'
  | 'pentatonic-major'
  | 'pentatonic-minor'
  | 'blues'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'

// Semitones above the tonic for the seven-note scales (major = ionian, natural minor = aeolian).
const SEVEN_NOTE_FORMULAS: Partial<Record<ScaleKind, number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  'natural-minor': [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
}

// Key signature (fifths, sharps positive) relative to the major key on the same tonic.
const KEY_SIGNATURE_OFFSET: Record<ScaleKind, number> = {
  major: 0,
  lydian: 1,
  mixolydian: -1,
  dorian: -2,
  'natural-minor': -3,
  'harmonic-minor': -3,
  'melodic-minor': -3,
  'pentatonic-minor': -3,
  blues: -3,
  phrygian: -4,
  locrian: -5,
  'pentatonic-major': 0,
  chromatic: 0,
}

export const MINOR_LIKE_KINDS: ScaleKind[] = ['natural-minor', 'harmonic-minor', 'melodic-minor', 'pentatonic-minor', 'blues']

export function parseTonic(name: string): { letter: Letter; alter: number } {
  const suffix = name.slice(1)
  return { letter: name[0] as Letter, alter: suffix === '#' ? 1 : suffix === 'b' ? -1 : 0 }
}

export function pitchAt(letter: Letter, alter: number, octave: number): Pitch {
  return { letter, alter, octave, midi: (octave + 1) * 12 + LETTER_SEMITONES[letter] + alter }
}

export function keyFifths(kind: ScaleKind, tonicName: string): number {
  const tonic = parseTonic(tonicName)
  const fifths = LETTER_FIFTHS[tonic.letter] + tonic.alter * 7 + KEY_SIGNATURE_OFFSET[kind]
  return Math.max(-7, Math.min(7, fifths))
}

// One octave of a seven-note scale starting on the tonic, each degree on the
// next letter, so C♯ major gets E♯ and B♯ rather than F and C.
export function sevenNoteScale(kind: ScaleKind, tonicName: string, octave: number): Pitch[] {
  const formula = SEVEN_NOTE_FORMULAS[kind]
  if (!formula) throw new Error(`${kind} is not a seven-note scale`)
  const tonic = parseTonic(tonicName)
  const start = LETTERS.indexOf(tonic.letter)
  const tonicMidi = pitchAt(tonic.letter, tonic.alter, octave).midi
  return formula.map((semitones, degree) => {
    const letter = LETTERS[(start + degree) % 7]
    const letterOctave = octave + Math.floor((start + degree) / 7)
    return pitchAt(letter, tonicMidi + semitones - pitchAt(letter, 0, letterOctave).midi, letterOctave)
  })
}

// Scale degree `index` (0 = tonic) of a seven-note scale, any number of octaves up or down.
export function scaleDegree(scale: Pitch[], index: number): Pitch {
  const within = ((index % 7) + 7) % 7
  const pitch = scale[within]
  return pitchAt(pitch.letter, pitch.alter, pitch.octave + Math.floor(index / 7))
}

// One octave of any scale kind, tonic included, top tonic excluded.
export function scaleOctave(kind: ScaleKind, tonicName: string, octave: number): Pitch[] {
  if (kind === 'chromatic') return chromaticOctave(tonicName, octave, 'up')
  if (kind === 'pentatonic-major') return pick(sevenNoteScale('major', tonicName, octave), [0, 1, 2, 4, 5])
  const minor = sevenNoteScale('natural-minor', tonicName, octave)
  if (kind === 'pentatonic-minor') return pick(minor, [0, 2, 3, 4, 6])
  if (kind === 'blues') {
    const fifth = minor[4]
    return [minor[0], minor[2], minor[3], pitchAt(fifth.letter, fifth.alter - 1, fifth.octave), minor[4], minor[6]]
  }
  return sevenNoteScale(kind, tonicName, octave)
}

function pick(scale: Pitch[], degrees: number[]): Pitch[] {
  return degrees.map((degree) => scale[degree])
}

// Twelve semitones from the tonic: sharps on the way up, flats on the way
// down, the tonic keeping its own spelling either way.
export function chromaticOctave(tonicName: string, octave: number, direction: 'up' | 'down'): Pitch[] {
  const tonic = parseTonic(tonicName)
  const tonicPitch = pitchAt(tonic.letter, tonic.alter, octave)
  const pitches: Pitch[] = [tonicPitch]
  for (let step = 1; step < 12; step++) {
    const midi = direction === 'up' ? tonicPitch.midi + step : tonicPitch.midi - step
    pitches.push(spellChromatic(midi, direction))
  }
  return pitches
}

function spellChromatic(midi: number, direction: 'up' | 'down'): Pitch {
  const octave = Math.floor(midi / 12) - 1
  const pitchClass = midi % 12
  const natural = LETTERS.find((letter) => LETTER_SEMITONES[letter] === pitchClass)
  if (natural) return pitchAt(natural, 0, octave)
  const neighbour = direction === 'up' ? pitchClass - 1 : pitchClass + 1
  const letter = LETTERS.find((candidate) => LETTER_SEMITONES[candidate] === neighbour)!
  return pitchAt(letter, direction === 'up' ? 1 : -1, octave)
}

// Going up `octaves` from the tonic and back down, top note once. Melodic
// minor comes down as natural minor; chromatic comes down in flats.
export function scaleUpAndDown(kind: ScaleKind, tonicName: string, startOctave: number, octaves: number): Pitch[] {
  const up: Pitch[] = []
  for (let octave = 0; octave < octaves; octave++) up.push(...scaleOctave(kind, tonicName, startOctave + octave))
  const tonic = parseTonic(tonicName)
  up.push(pitchAt(tonic.letter, tonic.alter, startOctave + octaves))

  let down: Pitch[]
  if (kind === 'melodic-minor') down = scaleUpAndDown('natural-minor', tonicName, startOctave, octaves).slice(octaves * 7 + 1)
  else if (kind === 'chromatic') {
    down = []
    for (let octave = octaves - 1; octave >= 0; octave--) {
      const octaveDown = chromaticOctave(tonicName, startOctave + octave + 1, 'down')
      down.push(...octaveDown.slice(1))
    }
    down.push(pitchAt(tonic.letter, tonic.alter, startOctave))
  } else down = [...up].reverse().slice(1)
  return [...up, ...down]
}

export function keyLabel(tonicName: string): string {
  return tonicName.replace('#', '♯').replace('b', '♭')
}
