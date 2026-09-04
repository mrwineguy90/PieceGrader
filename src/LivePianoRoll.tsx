// Scrolling piano roll of what is being played right now, with metronome beat
// lines on the same timeline. Drawn on a canvas every animation frame; the
// notes are read straight from the NoteRecorder rather than React state.

import { useEffect, useRef } from 'react'
import type { NoteRecorder } from './midi'
import type { Metronome } from './metronome'

const LOWEST_MIDI = 21 // A0
const HIGHEST_MIDI = 108 // C8
const PITCH_ROWS = HIGHEST_MIDI - LOWEST_MIDI + 1
const LABEL_GUTTER_PX = 40
const NOW_FRACTION = 0.8 // the "now" line sits this far across the plot; the rest is the near future

interface Props {
  recorder: NoteRecorder
  metronome: Metronome
  windowMs: number // how much time the plot spans
  heightPx: number
}

export default function LivePianoRoll({ recorder, metronome, windowMs, heightPx }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let frame = 0
    const draw = () => {
      paint(canvas, recorder, metronome, windowMs, performance.now())
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [recorder, metronome, windowMs])

  return <canvas ref={canvasRef} className="w-full rounded border border-gray-300" style={{ height: heightPx }} />
}

function paint(canvas: HTMLCanvasElement, recorder: NoteRecorder, metronome: Metronome, windowMs: number, nowMs: number) {
  const context = canvas.getContext('2d')
  if (!context) return
  // Keep the bitmap matched to the CSS size so it stays crisp on Retina.
  const pixelRatio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== width * pixelRatio || canvas.height !== height * pixelRatio) {
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, width, height)

  const plotWidth = width - LABEL_GUTTER_PX
  const leftEdgeMs = nowMs - windowMs * NOW_FRACTION
  const rowHeight = height / PITCH_ROWS
  const xForTime = (timeMs: number) => LABEL_GUTTER_PX + ((timeMs - leftEdgeMs) / windowMs) * plotWidth
  const yForMidi = (midi: number) => height - (midi - LOWEST_MIDI + 1) * rowHeight

  // Octave guide lines with C labels
  context.font = '10px sans-serif'
  context.textBaseline = 'middle'
  for (let midi = 24; midi <= HIGHEST_MIDI; midi += 12) {
    const y = yForMidi(midi) + rowHeight
    context.strokeStyle = midi === 60 ? '#9ca3af' : '#e5e7eb'
    context.beginPath()
    context.moveTo(LABEL_GUTTER_PX, y)
    context.lineTo(width, y)
    context.stroke()
    context.fillStyle = '#6b7280'
    context.fillText(`C${midi / 12 - 1}`, 4, y - rowHeight / 2)
  }

  // Beat lines from the metronome (downbeats heavier)
  for (const beat of metronome.beats) {
    if (beat.timeMs < leftEdgeMs || beat.timeMs > leftEdgeMs + windowMs) continue
    const x = xForTime(beat.timeMs)
    context.strokeStyle = beat.isDownbeat ? '#4b5563' : '#d1d5db'
    context.lineWidth = beat.isDownbeat ? 1.5 : 1
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
  context.lineWidth = 1

  // Finished notes, then notes still held (drawn up to now)
  context.fillStyle = '#3b82f6'
  for (const note of recorder.notes) {
    const endMs = note.startMs + note.durationMs
    if (endMs < leftEdgeMs) continue
    context.fillRect(xForTime(note.startMs), yForMidi(note.midi), Math.max(2, xForTime(endMs) - xForTime(note.startMs)), rowHeight)
  }
  context.fillStyle = '#1d4ed8'
  for (const note of recorder.activeNotes()) {
    context.fillRect(xForTime(note.startMs), yForMidi(note.midi), Math.max(2, xForTime(nowMs) - xForTime(note.startMs)), rowHeight)
  }

  // The "now" line
  const nowX = xForTime(nowMs)
  context.strokeStyle = '#ef4444'
  context.beginPath()
  context.moveTo(nowX, 0)
  context.lineTo(nowX, height)
  context.stroke()
}
