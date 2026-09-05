// Record a reference (spec §4): pick a title, time signature and tempo, play
// the piece cleanly with the metronome, stop, and it is quantized to the
// nearest 1/16 note and saved as a piece.

import { useEffect, useState } from 'react'
import { TimeSignatureInput } from './MidiCheck'
import { Metronome } from './metronome'
import { NoteRecorder } from './midi'
import { bpmLabel, quantizeRecording, quarterNoteBpm } from './pieces'
import type { Piece } from './types'
import type { MidiInputState } from './useMidiInput'

const MIN_BPM = 30
const MAX_BPM = 240
const EARLY_GRACE_MS = 150 // a note this early on beat 1 still counts as beat 1
const TICK_MS = 100

interface Props {
  midi: MidiInputState
  onSave: (piece: Piece) => void
  onCancel: () => void
}

export default function RecordScreen({ midi, onSave, onCancel }: Props) {
  const [metronome] = useState(() => new Metronome())
  const [recorder] = useState(() => new NoteRecorder())
  const [title, setTitle] = useState('Recorded piece')
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4])
  const [bpm, setBpm] = useState(60)
  const [recording, setRecording] = useState(false)
  const [nowMs, setNowMs] = useState(() => performance.now())
  const [clicksPerBar] = timeSignature
  const originMs = () => metronome.beatTimeMs(clicksPerBar) // first click after the count-in bar

  const start = () => {
    recorder.clear()
    metronome.start(bpm, clicksPerBar)
    setRecording(true)
  }

  const stop = () => {
    metronome.stop()
    setRecording(false)
    const stoppedAt = performance.now()
    recorder.finish(stoppedAt)
    const played = recorder.notes.map((note) => ({ ...note, startMs: note.startMs - originMs() }))
    if (played.length === 0) return
    onSave(quantizeRecording(played, quarterNoteBpm(bpm, timeSignature), timeSignature, title.trim() || 'Recorded piece'))
  }

  useEffect(
    () =>
      midi.subscribe((event) => {
        if (recording && event.timeMs >= originMs() - EARLY_GRACE_MS) recorder.push(event)
      }),
    [midi.subscribe, recording], // metronome/recorder are stable; only the recording flag matters
  )

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setNowMs(performance.now()), TICK_MS)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [recording]) // metronome/recorder are stable; only the recording flag matters

  useEffect(() => () => metronome.stop(), [metronome]) // silence when leaving the screen

  const beat = recording ? metronome.currentBeat(nowMs) : null
  const countingIn = beat === null || beat.index < clicksPerBar
  const bar = beat === null ? 0 : Math.floor(beat.index / clicksPerBar) // bar 0 = count-in

  return (
    <div className="mt-6 flex flex-col items-center gap-6">
      {!recording ? (
        <>
          <p className="text-sm text-ink-muted">
            Play the piece cleanly and slowly with the metronome. One bar of count-in, then recording starts on beat 1. Press Esc or Stop when done.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Title <input className="field w-56" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              Time signature <TimeSignatureInput value={timeSignature} onChange={setTimeSignature} />
            </label>
            <button className={buttonClass} onClick={() => setBpm(Math.max(MIN_BPM, bpm - 5))}>
              −5
            </button>
            <span className="w-24 text-center text-xl tabular-nums">{bpmLabel(bpm, timeSignature)}</span>
            <button className={buttonClass} onClick={() => setBpm(Math.min(MAX_BPM, bpm + 5))}>
              +5
            </button>
          </div>
          <div className="flex gap-2">
            <button className={buttonClass} onClick={onCancel}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={start}>
              Record
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-ink-muted">
            Recording “{title}” · {timeSignature.join('/')} · {bpmLabel(bpm, timeSignature)}
          </p>
          <div className="flex items-center gap-10">
            <div className="text-6xl font-semibold tabular-nums">{countingIn ? <span className="text-ink-muted">Ready</span> : `Bar ${bar}`}</div>
            <div className="flex gap-4">
              {Array.from({ length: clicksPerBar }, (_, i) => {
                const active = beat !== null && beat.index % clicksPerBar === i
                const color = !active ? 'bg-line' : i === 0 ? 'bg-red-500' : 'bg-accent'
                return <span key={i} className={`inline-block h-8 w-8 rounded-full ${color}`} />
              })}
            </div>
            <span className="text-sm text-ink-muted">{recorder.notes.length + recorder.activeNotes().length} notes</span>
          </div>
          <button className={buttonClass} onClick={stop}>
            Stop and save (Esc)
          </button>
        </>
      )}
    </div>
  )
}

const buttonClass = 'btn'
