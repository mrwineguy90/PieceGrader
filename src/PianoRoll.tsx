// Piano roll of a reference piece: time in beats along x, pitch along y,
// bar lines with bar numbers along the top. SVG so bars can later be clicked
// and played notes overlaid (phases 3 and 4). Scrolls sideways inside its box.

import type { Piece } from './types'
import { barCount } from './pieces'

const ROW_HEIGHT = 8
const HEADER_HEIGHT = 18
const LABEL_GUTTER = 32
const PITCH_PADDING = 2 // rows of space above and below the piece's range
const TRACK_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981']
const EXCLUDED_COLOR = '#e5e7eb'

interface Props {
  piece: Piece
  includedTracks: number[]
  pixelsPerBeat: number
}

export default function PianoRoll({ piece, includedTracks, pixelsPerBeat }: Props) {
  const bars = barCount(piece)
  const midis = piece.notes.map((note) => note.midi)
  const lowest = Math.min(...midis) - PITCH_PADDING
  const highest = Math.max(...midis) + PITCH_PADDING
  const rows = highest - lowest + 1
  const width = LABEL_GUTTER + bars * piece.beatsPerBar * pixelsPerBeat
  const height = HEADER_HEIGHT + rows * ROW_HEIGHT
  const xForBeat = (beat: number) => LABEL_GUTTER + beat * pixelsPerBeat
  const yForMidi = (midi: number) => HEADER_HEIGHT + (highest - midi) * ROW_HEIGHT

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
  for (let beat = 0; beat <= bars * piece.beatsPerBar; beat++) {
    const isBarLine = beat % piece.beatsPerBar === 0
    const x = xForBeat(beat)
    beatLines.push(
      <g key={beat}>
        <line x1={x} x2={x} y1={isBarLine ? 0 : HEADER_HEIGHT} y2={height} stroke={isBarLine ? '#6b7280' : '#e5e7eb'} />
        {isBarLine && beat < bars * piece.beatsPerBar && (
          <text x={x + 3} y={12} fontSize={10} fill="#374151">
            {beat / piece.beatsPerBar + 1}
          </text>
        )}
      </g>,
    )
  }

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
            width={Math.max(2, note.durationBeats * pixelsPerBeat - 1)}
            height={ROW_HEIGHT - 2}
            rx={1}
            fill={includedTracks.includes(note.track) ? TRACK_COLORS[note.track % TRACK_COLORS.length] : EXCLUDED_COLOR}
          />
        ))}
      </svg>
    </div>
  )
}
