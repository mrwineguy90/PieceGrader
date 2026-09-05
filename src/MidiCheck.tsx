// Keyboard check screen (phase 1): connection status, metronome, live piano
// roll. Proves the keyboard talks to the app and that MIDI timestamps line up
// with the metronome clicks.

import { useEffect, useState } from 'react'
import LivePianoRoll from './LivePianoRoll'
import { Metronome } from './metronome'
import { bpmLabel } from './pieces'
import type { MidiInputState } from './useMidiInput'

const MIN_BPM = 30
const MAX_BPM = 240
const RECENT_NOTE_MS = 3000 // how long the "receiving" light stays green after a note

export default function MidiCheck({ midi, soundLatencyMs }: { midi: MidiInputState; soundLatencyMs: number | null }) {
  const [metronome] = useState(() => new Metronome())
  const [bpm, setBpm] = useState(80)
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4])
  const [clicksPerBar] = timeSignature
  const [metronomeRunning, setMetronomeRunning] = useState(false)
  // Coarse clock for the text indicators; the piano roll has its own frame loop.
  const [nowMs, setNowMs] = useState(() => performance.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => metronome.stop(), [metronome]) // silence when leaving the screen

  const toggleMetronome = () => {
    if (metronomeRunning) metronome.stop()
    else metronome.start(bpm, clicksPerBar)
    setMetronomeRunning(!metronomeRunning)
  }

  const changeBpm = (delta: number) => {
    const next = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm + delta))
    setBpm(next)
    if (metronomeRunning) metronome.start(next, clicksPerBar)
  }

  const changeTimeSignature = (next: [number, number]) => {
    setTimeSignature(next)
    if (metronomeRunning) metronome.start(bpm, next[0])
  }

  const beat = metronomeRunning ? metronome.currentBeat(nowMs) : null

  return (
    <div className="mt-6">
      <section className="card">
        <h2 className="font-medium">Keyboard</h2>
        <MidiStatusLine midi={midi} nowMs={nowMs} />
        {soundLatencyMs !== null && (
          <p className="mt-1 text-sm text-ink-muted">
            Computer sound is on: about {soundLatencyMs} ms from key to ear on this output. Under 10 is unnoticeable, 10–20 fine, above 30 lags. Bluetooth
            headphones will read far higher; use wired.
          </p>
        )}
        {midi.inputs.length > 0 && (
          <select
            className="field mt-2"
            value={midi.selectedId ?? ''}
            onChange={(e) => midi.selectInput(e.target.value)}
          >
            {midi.inputs.map((input) => (
              <option key={input.id} value={input.id}>
                {input.name}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="mt-4 card">
        <h2 className="font-medium">Metronome</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button className={buttonClass} onClick={() => changeBpm(-5)}>
            −5
          </button>
          <span className="w-24 text-center text-xl tabular-nums">{bpmLabel(bpm, timeSignature)}</span>
          <button className={buttonClass} onClick={() => changeBpm(5)}>
            +5
          </button>
          <label className="ml-4 flex items-center gap-2 text-sm">
            Time signature <TimeSignatureInput value={timeSignature} onChange={changeTimeSignature} />
          </label>
          <button
            className={`btn ml-4 ${metronomeRunning ? '' : 'btn-primary'}`}
            onClick={toggleMetronome}
          >
            {metronomeRunning ? 'Stop' : 'Start'}
          </button>
          <div className="ml-4 flex items-center gap-2">
            {Array.from({ length: clicksPerBar }, (_, i) => {
              const active = beat !== null && beat.index % clicksPerBar === i
              const color = !active ? 'bg-line' : i === 0 ? 'bg-red-500' : 'bg-accent'
              return <span key={i} className={`inline-block h-4 w-4 rounded-full ${color}`} />
            })}
            <span className="ml-2 w-16 text-sm tabular-nums text-ink-muted">
              {beat ? `Bar ${Math.floor(beat.index / clicksPerBar) + 1}` : ''}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">
            Live piano roll <span className="ml-2 text-sm font-normal text-ink-muted">{midi.recorder.notes.length} notes</span>
          </h2>
          <button className={buttonClass} onClick={() => midi.recorder.clear()}>
            Clear
          </button>
        </div>
        <LivePianoRoll recorder={midi.recorder} metronome={metronome} windowMs={8000} heightPx={360} />
        <p className="mt-2 text-xs text-ink-muted">
          Play along with the clicks: note starts should sit on the beat lines. A steady offset means the clocks disagree.
        </p>
      </section>
    </div>
  )
}

const buttonClass = 'btn'

const MAX_TOP_NUMBER = 32
const BOTTOM_NUMBERS = [2, 4, 8, 16]

// Top number typed, bottom number picked. Also used by the piece library.
export function TimeSignatureInput({ value, onChange }: { value: [number, number]; onChange: (next: [number, number]) => void }) {
  const [top, bottom] = value
  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={MAX_TOP_NUMBER}
        className="field w-14"
        value={top}
        onChange={(e) => {
          const next = Math.round(Number(e.target.value))
          if (next >= 1 && next <= MAX_TOP_NUMBER) onChange([next, bottom])
        }}
      />
      /
      <select className="field" value={bottom} onChange={(e) => onChange([top, Number(e.target.value)])}>
        {BOTTOM_NUMBERS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </span>
  )
}

function MidiStatusLine({ midi, nowMs }: { midi: MidiInputState; nowMs: number }) {
  if (midi.status === 'unsupported') return <p className="text-sm text-red-600">Web MIDI is not available. Use Chrome.</p>
  if (midi.status === 'requesting') return <p className="text-sm text-ink-muted">Asking for MIDI permission…</p>
  if (midi.status === 'denied') {
    return <p className="text-sm text-red-600">MIDI permission denied. Allow it from the address bar and reload.</p>
  }
  if (midi.inputs.length === 0) return <p className="text-sm text-amber-600">No MIDI inputs found. Plug in the keyboard.</p>

  const sinceNoteMs = midi.lastNoteAtMs === null ? null : nowMs - midi.lastNoteAtMs
  const receiving = sinceNoteMs !== null && sinceNoteMs < RECENT_NOTE_MS
  return (
    <p className="mt-1 flex items-center gap-2 text-sm">
      <span className={`inline-block h-3 w-3 rounded-full ${receiving ? 'bg-green-500' : 'bg-line'}`} />
      {sinceNoteMs === null ? 'Connected. No notes received yet.' : `Connected. Last note ${(sinceNoteMs / 1000).toFixed(1)} s ago.`}
    </p>
  )
}
