import { describe, expect, it } from 'vitest'
import { drillToMusicXml, keySignatureAlter, simpleDurationFitting } from './drillNotation'
import type { DrillSpec } from './drillCatalog'
import { generateDrill } from './drills'

const spec = (changes: Partial<DrillSpec>): DrillSpec => ({
  family: 'scale',
  variant: 'major',
  key: 'C',
  hands: 'right',
  octaves: 1,
  notesPerClick: 1,
  ...changes,
})

// Sum of <duration> values inside each staff of each measure, in divisions (16 per bar).
function staffTotals(xml: string): number[][] {
  return [...xml.matchAll(/<measure number="\d+">(.*?)<\/measure>/g)].map((measure) => {
    const [right, left] = measure[1].split('<backup>')
    const total = (part: string) => [...part.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((sum, m) => sum + Number(m[1]), 0)
    return [total(right), total(left.replace(/<duration>16<\/duration><\/backup>/, ''))]
  })
}

describe('drillToMusicXml', () => {
  it('writes a two-staff piano part with key and time signatures', () => {
    const xml = drillToMusicXml(generateDrill(spec({ variant: 'harmonic-minor', key: 'D', hands: 'both' })))
    expect(xml).toContain('<staves>2</staves>')
    expect(xml).toContain('<key><fifths>-1</fifths></key>')
    expect(xml).toContain('<time><beats>4</beats><beat-type>4</beat-type></time>')
    expect(xml).toContain('<work-title>D harmonic minor scale · 1 octave · hands together · quarters</work-title>')
  })

  it('fills every staff of every measure exactly', () => {
    const xml = drillToMusicXml(generateDrill(spec({ hands: 'both', notesPerClick: 2, octaves: 2 })))
    for (const [right, left] of staffTotals(xml)) {
      expect(right).toBe(16)
      expect(left).toBe(16)
    }
  })

  it('rests fill a staff the hand does not play', () => {
    const xml = drillToMusicXml(generateDrill(spec({ hands: 'right' })))
    expect(xml).toContain('<rest measure="yes"/>')
    for (const [, left] of staffTotals(xml)) expect(left).toBe(16)
  })

  it('shows an accidental once per bar and a natural when a note reverts', () => {
    // A harmonic minor: G♯ is not in the key signature (0 flats/sharps), so it needs a sharp.
    // In sixteenths the whole scale fits one bar, so G♯5 up and G♯5 down share a bar: one sharp
    // per bar (short drills repeat, ten bars here).
    const xml = drillToMusicXml(generateDrill(spec({ variant: 'harmonic-minor', key: 'A', notesPerClick: 4 })))
    const firstBar = xml.split('<measure number="2">')[0]
    const gSharps = firstBar.match(/<step>G<\/step><alter>1<\/alter><octave>5<\/octave>.*?<accidental>sharp<\/accidental>/g) ?? []
    expect(gSharps.length).toBe(1)
    // In eighths they fall in different bars: two sharps per two-bar repetition, six repetitions.
    const eighths = drillToMusicXml(generateDrill(spec({ variant: 'harmonic-minor', key: 'A', notesPerClick: 2 })))
    expect((eighths.match(/<accidental>sharp<\/accidental>/g) ?? []).length).toBe(12)
    // Melodic minor: F♯ up, F natural down, in the same bar → natural sign shown.
    const melodic = drillToMusicXml(generateDrill(spec({ variant: 'melodic-minor', key: 'A', notesPerClick: 4 })))
    expect(melodic).toContain('<accidental>natural</accidental>')
  })

  it('writes chords with <chord/> on the notes after the first', () => {
    const xml = drillToMusicXml(generateDrill(spec({ family: 'cadence', hands: 'both' })))
    expect((xml.match(/<chord\/>/g) ?? []).length).toBe(8 * 6) // four 3-note chords in the right hand, repeated to twelve bars
    expect(xml).toContain('<type>half</type>')
  })

  it('helpers', () => {
    expect(simpleDurationFitting(3.5)).toBe(3)
    expect(simpleDurationFitting(0.3)).toBe(0.25)
    expect(keySignatureAlter(2, 'C')).toBe(1)
    expect(keySignatureAlter(2, 'G')).toBe(0)
    expect(keySignatureAlter(-3, 'A')).toBe(-1)
    expect(keySignatureAlter(-3, 'D')).toBe(0)
  })
})
