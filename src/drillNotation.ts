// Writes a generated drill as MusicXML: one piano part on two staves, key
// signature, 4/4, accidentals shown the way a scale book shows them (once
// per bar, naturals when a note reverts). Rendered by ScoreView like any
// attached score.

import type { Drill, DrillNote } from './drills'

const DIVISIONS = 4 // per quarter note, so a sixteenth is 1
const BEATS_PER_BAR = 4
const MEASURE_DIVISIONS = BEATS_PER_BAR * DIVISIONS
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const ACCIDENTAL_NAMES: Record<number, string> = { [-2]: 'flat-flat', [-1]: 'flat', 0: 'natural', 1: 'sharp', 2: 'double-sharp' }

// Durations that are one plain note value (with or without a dot). The
// generator only ever produces these, so no ties are needed.
const SIMPLE_DURATIONS: { beats: number; type: string; dotted: boolean }[] = [
  { beats: 4, type: 'whole', dotted: false },
  { beats: 3, type: 'half', dotted: true },
  { beats: 2, type: 'half', dotted: false },
  { beats: 1.5, type: 'quarter', dotted: true },
  { beats: 1, type: 'quarter', dotted: false },
  { beats: 0.5, type: 'eighth', dotted: false },
  { beats: 0.25, type: '16th', dotted: false },
]

// The longest plain note value that fits in `beats`.
export function simpleDurationFitting(beats: number): number {
  return SIMPLE_DURATIONS.find((duration) => duration.beats <= beats + 1e-9)?.beats ?? 0.25
}

export function drillToMusicXml(drill: Drill): string {
  const lastBeat = Math.max(0, ...drill.notes.map((note) => note.startBeat + note.durationBeats))
  const bars = Math.max(1, Math.ceil(lastBeat / BEATS_PER_BAR - 1e-9))
  const measures: string[] = []
  for (let index = 0; index < bars; index++) measures.push(measureXml(drill, index))
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    `<score-partwise version="4.0"><work><work-title>${escapeXml(drill.title)}</work-title></work>` +
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
    `<part id="P1">${measures.join('')}</part></score-partwise>`
  )
}

function measureXml(drill: Drill, index: number): string {
  const attributes =
    index === 0
      ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${drill.keyFifths}</fifths></key>` +
        '<time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>' +
        '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>'
      : ''
  const measureStart = index * BEATS_PER_BAR
  const inMeasure = (hand: 0 | 1) =>
    drill.notes.filter((note) => note.hand === hand && note.startBeat >= measureStart && note.startBeat < measureStart + BEATS_PER_BAR)
  return (
    `<measure number="${index + 1}">${attributes}` +
    staffXml(inMeasure(0), 1, measureStart, drill.keyFifths) +
    `<backup><duration>${MEASURE_DIVISIONS}</duration></backup>` +
    staffXml(inMeasure(1), 2, measureStart, drill.keyFifths) +
    '</measure>'
  )
}

// One staff's worth of a bar: chords in time order, rests in the gaps.
function staffXml(notes: DrillNote[], staff: number, measureStart: number, fifths: number): string {
  if (notes.length === 0) {
    return `<note><rest measure="yes"/><duration>${MEASURE_DIVISIONS}</duration><voice>${staff}</voice><staff>${staff}</staff></note>`
  }
  const accidentals = new Map<string, number>() // "C4" -> alter in force, from the key signature or earlier in the bar
  const alterInForce = (note: DrillNote) => accidentals.get(`${note.letter}${note.octave}`) ?? keySignatureAlter(fifths, note.letter)
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi)
  const measureEnd = measureStart + BEATS_PER_BAR
  let xml = ''
  let cursor = measureStart
  let index = 0
  while (index < sorted.length) {
    const start = sorted[index].startBeat
    const chord = sorted.filter((note) => note.startBeat === start)
    if (start > cursor + 1e-9) xml += restsXml(start - cursor, staff)
    const beats = Math.min(chord[0].durationBeats, measureEnd - start)
    chord.forEach((note, position) => {
      const accidental = note.alter !== alterInForce(note) ? `<accidental>${ACCIDENTAL_NAMES[note.alter]}</accidental>` : ''
      accidentals.set(`${note.letter}${note.octave}`, note.alter)
      xml +=
        `<note>${position > 0 ? '<chord/>' : ''}<pitch><step>${note.letter}</step>` +
        (note.alter !== 0 ? `<alter>${note.alter}</alter>` : '') +
        `<octave>${note.octave}</octave></pitch>${durationXml(beats, staff, accidental)}</note>`
    })
    cursor = start + beats
    index += chord.length
  }
  if (cursor < measureEnd - 1e-9) xml += restsXml(measureEnd - cursor, staff)
  return xml
}

function restsXml(beats: number, staff: number): string {
  let xml = ''
  let remaining = beats
  while (remaining > 1e-9) {
    const piece = simpleDurationFitting(remaining)
    xml += `<note><rest/>${durationXml(piece, staff, '')}</note>`
    remaining -= piece
  }
  return xml
}

// duration, voice, type, dot, accidental, staff: MusicXML wants them in this order.
function durationXml(beats: number, staff: number, accidental: string): string {
  const simple = SIMPLE_DURATIONS.find((duration) => Math.abs(duration.beats - beats) < 1e-9) ?? SIMPLE_DURATIONS[4]
  return (
    `<duration>${Math.round(beats * DIVISIONS)}</duration><voice>${staff}</voice><type>${simple.type}</type>` +
    (simple.dotted ? '<dot/>' : '') +
    accidental +
    `<staff>${staff}</staff>`
  )
}

// What the key signature does to a letter: sharps are added F C G D A E B, flats the reverse.
export function keySignatureAlter(fifths: number, letter: string): number {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0
  if (fifths < 0) return [...SHARP_ORDER].reverse().slice(0, -fifths).includes(letter) ? -1 : 0
  return 0
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
