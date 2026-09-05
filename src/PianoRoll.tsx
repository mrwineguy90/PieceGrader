// Piano roll of a reference piece: time in beats along x, pitch along y,
// bar lines with bar numbers along the top. With an overlay, the reference
// turns gray and the scored performance is drawn on top. With a playhead,
// a red line marks the current beat and the box scrolls to keep it in view.
// Scrolls sideways inside its box.

import { useEffect, useRef } from 'react'
import type { Piece } from './types'
import { barCount, beatsPerBar, clickLengthInBeats } from './pieces'
import { ON_TIME_MS, type NoteResult } from './scoring'

const DEFAULT_ROW_HEIGHT = 8
const HEADER_HEIGHT = 18
const LABEL_GUTTER = 32
const PITCH_PADDING = 2 // rows of space above and below the piece's range
const TRACK_COLORS = ['#6366f1', '#f59e0b', '#ec4899', '#10b981'] // right hand indigo, left hand amber
const EXCLUDED_COLOR = 'var(--roll-grid)'
const REFERENCE_COLOR = 'var(--roll-grid-strong)' // reference under an overlay
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
  playheadBeat?: number // current position in quarter notes, while a session runs
  rowHeight?: number // px per semitone; the session screen uses a taller roll
}

const SCROLL_MARGIN_PX = 80 // the playhead flips the page this close to the right edge

export default function PianoRoll({ piece, includedTracks, pixelsPerBeat, overlay, highlightBars, playheadBeat, rowHeight = DEFAULT_ROW_HEIGHT }: Props) {
  const bars = barCount(piece)
  const scrollBox = useRef<HTMLDivElement>(null)

  // Page-flip scrolling: the roll stays put while the playhead crosses it,
  // then jumps when the line nears the right edge, so the eye can read ahead.
  useEffect(() => {
    const box = scrollBox.current
    if (!box || playheadBeat === undefined) return
    const x = LABEL_GUTTER + playheadBeat * pixelsPerBeat
    const visibleRight = box.scrollLeft + box.clientWidth - SCROLL_MARGIN_PX
    if (x > visibleRight || x < box.scrollLeft) box.scrollLeft = Math.max(0, x - SCROLL_MARGIN_PX)
  }, [playheadBeat, pixelsPerBeat])
  const quartersPerBar = beatsPerBar(piece)
  const clickBeats = clickLengthInBeats(piece.timeSignature) // one line per metronome click
  const midis = piece.notes.map((note) => note.midi)
  const lowest = Math.min(...midis) - PITCH_PADDING
  const highest = Math.max(...midis) + PITCH_PADDING
  const rows = highest - lowest + 1
  const width = LABEL_GUTTER + bars * quartersPerBar * pixelsPerBeat
  const height = HEADER_HEIGHT + rows * rowHeight
  const xForBeat = (beat: number) => LABEL_GUTTER + beat * pixelsPerBeat
  const yForMidi = (midi: number) => HEADER_HEIGHT + (highest - midi) * rowHeight
  const noteWidth = (beats: number) => Math.max(2, beats * pixelsPerBeat - 1)

  const octaveLines = []
  for (let midi = Math.ceil(lowest / 12) * 12; midi <= highest; midi += 12) {
    const y = yForMidi(midi) + rowHeight
    octaveLines.push(
      <g key={midi}>
        <line x1={LABEL_GUTTER} x2={width} y1={y} y2={y} stroke={midi === 60 ? 'var(--roll-grid-strong)' : 'var(--roll-grid)'} />
        <text x={4} y={y - 1} fontSize={9} fill="var(--ink-muted)">
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
        <line x1={x} x2={x} y1={isBarLine ? 0 : HEADER_HEIGHT} y2={height} stroke={isBarLine ? 'var(--roll-grid-strong)' : 'var(--roll-grid)'} />
        {isBarLine && beat < bars * quartersPerBar && (
          <text x={x + 3} y={12} fontSize={10} fill="var(--ink)">
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
          height={rowHeight - 2}
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
        height={rowHeight - 2}
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
    <div ref={scrollBox} className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
      <svg width={width} height={height} className="block">
        {octaveLines}
        {beatLines}
        {piece.notes.map((note, index) => (
          <rect
            key={index}
            x={xForBeat(note.startBeat)}
            y={yForMidi(note.midi) + 1}
            width={noteWidth(note.durationBeats)}
            height={rowHeight - 2}
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
            fill="var(--surface-raised)"
            opacity={0.7}
          />
        ))}
        {playheadBeat !== undefined && (
          <line x1={xForBeat(playheadBeat)} x2={xForBeat(playheadBeat)} y1={0} y2={height} stroke="#ef4444" strokeWidth={2} />
        )}
      </svg>
    </div>
  )
}
