// A practice session (spec §5): one bar of count-in, record until one click
// after the last reference note (or Esc), then score.

import { useEffect, useRef, useState } from 'react'
import { Metronome } from './metronome'
import { NoteRecorder } from './midi'
import { beatsPerBar, clickLengthInBeats, quarterNoteBpm } from './pieces'
import { scorePerformance, type Score } from './scoring'
import type { Piece, PlayedNote, ReferenceNote } from './types'
import type { MidiInputState } from './useMidiInput'

const EARLY_GRACE_MS = 150 // a note this early on beat 1 still counts as beat 1
const TICK_MS = 100

export interface SessionConfig {
  piece: Piece
  tracks: number[]
  bpm: number // clicks per minute of the time signature's note (see pieces.ts)
  barRange: [number, number] // 1-based, inclusive
}

export interface SessionResult {
  config: SessionConfig
  played: PlayedNote[]
  score: Score
}

export type SessionStatus =
  | { phase: 'idle' }
  | { phase: 'count-in'; config: SessionConfig; beatInBar: number }
  | { phase: 'recording'; config: SessionConfig; bar: number; beatInBar: number }
  | { phase: 'done'; result: SessionResult }

// Beat 1 of the first selected bar, in quarter notes: played time 0 is here.
export function rangeStartBeat(config: SessionConfig): number {
  return (config.barRange[0] - 1) * beatsPerBar(config.piece)
}

export function referenceNotesInRange(config: SessionConfig): ReferenceNote[] {
  const startBeat = rangeStartBeat(config)
  const endBeat = config.barRange[1] * beatsPerBar(config.piece)
  return config.piece.notes.filter(
    (note) => config.tracks.includes(note.track) && note.startBeat >= startBeat && note.startBeat < endBeat,
  )
}

interface ActiveSession {
  config: SessionConfig
  recorder: NoteRecorder
  originMs: number // performance.now() of beat 1 after the count-in
  endMs: number // when recording stops on its own
}

export function useSession(midi: MidiInputState) {
  const [metronome] = useState(() => new Metronome())
  const [status, setStatus] = useState<SessionStatus>({ phase: 'idle' })
  const active = useRef<ActiveSession | null>(null)
  const running = status.phase === 'count-in' || status.phase === 'recording'

  const start = (config: SessionConfig) => {
    const [clicksPerBar] = config.piece.timeSignature
    metronome.start(config.bpm, clicksPerBar)
    const originMs = metronome.beatTimeMs(clicksPerBar) // click index clicksPerBar = first beat after count-in
    const msPerClick = 60_000 / config.bpm
    const msPerQuarter = msPerClick * clickLengthInBeats(config.piece.timeSignature)
    const notes = referenceNotesInRange(config)
    const lastNoteEndBeat = Math.max(0, ...notes.map((note) => note.startBeat + note.durationBeats)) - rangeStartBeat(config)
    active.current = {
      config,
      recorder: new NoteRecorder(originMs),
      originMs,
      endMs: originMs + lastNoteEndBeat * msPerQuarter + msPerClick,
    }
    setStatus({ phase: 'count-in', config, beatInBar: 1 })
  }

  const finish = () => {
    const session = active.current
    if (!session) return
    active.current = null
    metronome.stop()
    session.recorder.finish(performance.now())
    const { config } = session
    const played = session.recorder.notes
    const bpm = quarterNoteBpm(config.bpm, config.piece.timeSignature)
    const score = scorePerformance(referenceNotesInRange(config), played, bpm, rangeStartBeat(config))
    setStatus({ phase: 'done', result: { config, played, score } })
  }

  const reset = () => {
    active.current = null
    metronome.stop()
    setStatus({ phase: 'idle' })
  }

  // Feed keyboard events into the session's recorder; ignore count-in noodling.
  useEffect(
    () =>
      midi.subscribe((event) => {
        const session = active.current
        if (session && event.timeMs >= session.originMs - EARLY_GRACE_MS) session.recorder.push(event)
      }),
    [midi.subscribe],
  )

  // Bar/beat display and the automatic stop.
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const session = active.current
      if (!session) return
      const nowMs = performance.now()
      if (nowMs >= session.endMs) {
        finish()
        return
      }
      const { config } = session
      const [clicksPerBar] = config.piece.timeSignature
      const clickIndex = metronome.currentBeat(nowMs)?.index ?? 0
      const beatInBar = (clickIndex % clicksPerBar) + 1
      if (clickIndex < clicksPerBar) setStatus({ phase: 'count-in', config, beatInBar })
      else setStatus({ phase: 'recording', config, bar: config.barRange[0] + Math.floor(clickIndex / clicksPerBar) - 1, beatInBar })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [running]) // finish/metronome are stable; only the running flag matters

  useEffect(() => {
    if (!running) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [running]) // finish/metronome are stable; only the running flag matters

  return { status, start, finish, reset }
}
