// Piano roll of a reference piece: time in beats along x, pitch along y,
// bar lines with bar numbers along the top. With an overlay, the reference
// turns gray and the scored performance is drawn on top. SVG so bars can be
// clicked later (phase 4). Scrolls sideways inside its box.

import type { Piece } from './types'
import { barCount, beatsPerBar, clickLengthInBeats } from './pieces'
import { ON_TIME_MS, type NoteResult } from './scoring'

const ROW_HEIGHT = 8
const HEADER_HEIGHT = 18
const LABEL_GUTTER = 32
const PITCH_PADDING = 2 // rows of space above and below the piece's range
const TRACK_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981']
const EXCLUDED_COLOR = '#e5e7eb'
const REFERENCE_COLOR = '#9ca3af' // reference under an overlay
const OFF_TIME_COLOR = '#eab308' // correct pitch, more than ON_TIME_MS off
const RESULT_COLORS: Record<NoteResult['kind'], string> = {
  correct: '#22c55e',
  wrong: '#ef4444',
  extra: '#ef4444',
  missed: '#6b7280',
}

export interface Overlay {
  results: NoteResult[]
  bpm: number
  startBeat: number // the beat that played time 0 corresponds to
}

interface Props {
  piece: Piece
  includedTracks: number[]
  pixelsPerBeat: number
  overlay?: Overlay
  highlightBars?: [number, number] // bars outside this range are dimmed
}

export default function PianoRoll({ piece, includedTracks, pixelsPerBeat, overlay, highlightBars }: Props) {
  const bars = barCount(piece)
  const quartersPerBar = beatsPerBar(piece)
  const clickBeats = clickLengthInBeats(piece.timeSignature) // one line per metronome click
  const midis = piece.notes.map((note) => note.midi)
  const lowest = Math.min(...midis) - PITCH_PADDING
  const highest = Math.max(...midis) + PITCH_PADDING
  const rows = highest - lowest + 1
  const width = LABEL_GUTTER + bars * quartersPerBar * pixelsPerBeat
  const height = HEADER_HEIGHT + rows * ROW_HEIGHT
  const xForBeat = (beat: number) => LABEL_GUTTER + beat * pixelsPerBeat
  const yForMidi = (midi: number) => HEADER_HEIGHT + (highest - midi) * ROW_HEIGHT
  const noteWidth = (beats: number) => Math.max(2, beats * pixelsPerBeat - 1)

  const octaveLines = []
  for (let midi = Math.ceil(lowest / 12) * 12; midi <= highest; midi += 12) {
    const y = yForMidi(midi) + ROW_HEIGHT
    octaveLines.push(
      <g key={midi}>
        <line x1={LABEL_GUTTER} x2={width} y1={y} y2={y} stroke={midi === 60 ? '#9ca3af' : '#e5e7eb'} />
        <text x={4} y={y - 1} fontSize={9} fill="#6b7280">
          C{midi / 12 - 1}
        </text>
      </g>,
    )
  }

  const beatLines = []
  for (let beat = 0; beat <= bars * quartersPerBar; beat += clickBeats) {
    const isBarLine = beat % quartersPerBar === 0
    const x = xForBeat(beat)
    beatLines.push(
      <g key={beat}>
        <line x1={x} x2={x} y1={isBarLine ? 0 : HEADER_HEIGHT} y2={height} stroke={isBarLine ? '#6b7280' : '#e5e7eb'} />
        {isBarLine && beat < bars * quartersPerBar && (
          <text x={x + 3} y={12} fontSize={10} fill="#374151">
            {beat / quartersPerBar + 1}
          </text>
        )}
      </g>,
    )
  }

  const referenceFill = (track: number) => {
    if (!includedTracks.includes(track)) return EXCLUDED_COLOR
    return overlay ? REFERENCE_COLOR : TRACK_COLORS[track % TRACK_COLORS.length]
  }

  // Played notes are in ms from the range start; convert back to beats to draw.
  const msPerBeat = overlay ? 60_000 / overlay.bpm : 1
  const playedRects = (overlay?.results ?? []).map((result, index) => {
    if (result.kind === 'missed') {
      const note = result.reference!
      return (
        <rect
          key={index}
          x={xForBeat(note.startBeat)}
          y={yForMidi(note.midi) + 1}
          width={noteWidth(note.durationBeats)}
          height={ROW_HEIGHT - 2}
          rx={1}
          fill="none"
          stroke={RESULT_COLORS.missed}
          strokeWidth={1.5}
        />
      )
    }
    const note = result.played!
    const startBeat = overlay!.startBeat + note.startMs / msPerBeat
    const offTime = result.kind === 'correct' && Math.abs(result.deviationMs ?? 0) > ON_TIME_MS
    return (
      <rect
        key={index}
        x={xForBeat(startBeat)}
        y={yForMidi(note.midi) + 1}
        width={noteWidth(note.durationMs / msPerBeat)}
        height={ROW_HEIGHT - 2}
        rx={1}
        fill={offTime ? OFF_TIME_COLOR : RESULT_COLORS[result.kind]}
        opacity={result.kind === 'extra' ? 0.6 : 0.9}
      />
    )
  })

  // Dim everything outside the selected bar range.
  const dimmed = highlightBars
    ? [
        [0, highlightBars[0] - 1],
        [highlightBars[1], bars],
      ].filter(([from, to]) => to > from)
    : []

  return (
    <div className="overflow-x-auto rounded border border-gray-300 bg-white">
      <svg width={width} height={height} className="block">
        {octaveLines}
        {beatLines}
        {piece.notes.map((note, index) => (
          <rect
            key={index}
            x={xForBeat(note.startBeat)}
            y={yForMidi(note.midi) + 1}
            width={noteWidth(note.durationBeats)}
            height={ROW_HEIGHT - 2}
            rx={1}
            fill={referenceFill(note.track)}
          />
        ))}
        {playedRects}
        {dimmed.map(([fromBar, toBar]) => (
          <rect
            key={fromBar}
            x={xForBeat(fromBar * quartersPerBar)}
            y={HEADER_HEIGHT}
            width={(toBar - fromBar) * quartersPerBar * pixelsPerBeat}
            height={height - HEADER_HEIGHT}
            fill="#ffffff"
            opacity={0.7}
          />
        ))}
      </svg>
    </div>
  )
}
