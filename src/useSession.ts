// A practice session (spec §5): one bar of count-in, then one pass through
// the selected bars, or in loop mode pass after pass with a one-bar gap
// between them, each pass scored on its own.
//
// Timeline in metronome clicks:   [count-in bar][pass 1][gap bar][pass 2][gap bar]...
// A single (non-loop) session is pass 1 alone, ending one click after the
// last reference note.

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
  loop: boolean
}

export interface Pass {
  played: PlayedNote[]
  score: Score
}

export interface SessionResult {
  config: SessionConfig
  passes: Pass[]
}

export type SessionStatus =
  | { phase: 'idle' }
  | { phase: 'count-in'; config: SessionConfig; beatInBar: number; pass: number; lastScore: Score | null }
  | { phase: 'recording'; config: SessionConfig; bar: number; beatInBar: number; pass: number; lastScore: Score | null }
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
  recorder: NoteRecorder // raw performance.now() times; pass windows are cut out at scoring time
  msPerClick: number
  clicksPerBar: number
  passClicks: number // how long each pass records
  cycleClicks: number // pass plus the gap bar
  passes: Pass[]
}

// Where we are on the session timeline, in clicks since the metronome started.
function timeline(session: ActiveSession, nowMs: number, firstClickMs: number) {
  const { clicksPerBar, passClicks, cycleClicks } = session
  const clicksElapsed = (nowMs - firstClickMs) / session.msPerClick
  const sincePassOne = clicksElapsed - clicksPerBar
  const passIndex = Math.max(0, Math.floor(sincePassOne / cycleClicks))
  return {
    clicksElapsed,
    sincePassOne, // negative during the count-in
    passIndex,
    withinPass: sincePassOne - passIndex * cycleClicks, // beyond passClicks means the gap bar
    completedPasses: Math.max(0, Math.floor((sincePassOne - passClicks) / cycleClicks) + 1),
  }
}

// onResult is called once per finished session, for saving history. Kept in a
// ref so the interval and key handlers below always see the latest callback.
export function useSession(midi: MidiInputState, onResult?: (result: SessionResult) => void) {
  const [metronome] = useState(() => new Metronome())
  const [status, setStatus] = useState<SessionStatus>({ phase: 'idle' })
  const active = useRef<ActiveSession | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const running = status.phase === 'count-in' || status.phase === 'recording'

  const start = (config: SessionConfig) => {
    const { timeSignature } = config.piece
    const [clicksPerBar] = timeSignature
    metronome.start(config.bpm, clicksPerBar)
    const notes = referenceNotesInRange(config)
    const lastNoteEndBeat = Math.max(0, ...notes.map((note) => note.startBeat + note.durationBeats)) - rangeStartBeat(config)
    const passClicks = config.loop
      ? (config.barRange[1] - config.barRange[0] + 1) * clicksPerBar
      : lastNoteEndBeat / clickLengthInBeats(timeSignature) + 1
    active.current = {
      config,
      recorder: new NoteRecorder(),
      msPerClick: 60_000 / config.bpm,
      clicksPerBar,
      passClicks,
      cycleClicks: passClicks + clicksPerBar,
      passes: [],
    }
    setStatus({ phase: 'count-in', config, beatInBar: 1, pass: 1, lastScore: null })
  }

  // Beat 1 of pass 1 on the performance.now() clock: the first click after the
  // count-in bar. Asked for fresh each time because the metronome's clock
  // anchor settles a few ticks after start (see metronome.ts).
  const originMs = (session: ActiveSession) => metronome.beatTimeMs(session.clicksPerBar)

  const scorePass = (session: ActiveSession, passIndex: number, nowMs: number): Pass => {
    const { config } = session
    const fromMs = originMs(session) + passIndex * session.cycleClicks * session.msPerClick
    const toMs = fromMs + session.passClicks * session.msPerClick
    // Shift the window back by the grace so an early first note is included,
    // then shift the times forward again so the pass still starts at 0.
    const played = session.recorder
      .notesStartingBetween(fromMs - EARLY_GRACE_MS, toMs - EARLY_GRACE_MS, nowMs)
      .map((note) => ({ ...note, startMs: note.startMs - EARLY_GRACE_MS }))
    const score = scorePerformance(referenceNotesInRange(config), played, {
      quarterBpm: quarterNoteBpm(config.bpm, config.piece.timeSignature),
      rangeStartBeat: rangeStartBeat(config),
      quartersPerBar: beatsPerBar(config.piece),
      barRange: config.barRange,
    })
    return { played, score }
  }

  const finish = () => {
    const session = active.current
    if (!session) return
    active.current = null
    metronome.stop()
    // The pass in progress counts unless this is a loop and nothing was played in it.
    const inProgress = scorePass(session, session.passes.length, performance.now())
    if (!session.config.loop || inProgress.played.length > 0 || session.passes.length === 0) session.passes.push(inProgress)
    const result = { config: session.config, passes: session.passes }
    setStatus({ phase: 'done', result })
    onResultRef.current?.(result)
  }

  const reset = () => {
    active.current = null
    metronome.stop()
    setStatus({ phase: 'idle' })
  }

  // Current place in the piece in quarter notes, for the playhead on the
  // session screen. Sits at the start of the range during the count-in and
  // the gap bar; null when no session is running.
  const positionBeat = (nowMs: number): number | null => {
    const session = active.current
    if (!session) return null
    const { sincePassOne, withinPass } = timeline(session, nowMs, metronome.beatTimeMs(0))
    const start = rangeStartBeat(session.config)
    if (sincePassOne < 0 || withinPass >= session.passClicks) return start
    return start + withinPass * clickLengthInBeats(session.config.piece.timeSignature)
  }

  // Feed keyboard events into the session's recorder; ignore count-in noodling.
  useEffect(
    () =>
      midi.subscribe((event) => {
        const session = active.current
        if (session && event.timeMs >= originMs(session) - EARLY_GRACE_MS) session.recorder.push(event)
      }),
    [midi.subscribe],
  )

  // Bar/beat display, scoring finished passes, and the automatic stop.
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const session = active.current
      if (!session) return
      const { config, clicksPerBar, passClicks } = session
      const nowMs = performance.now()
      const { clicksElapsed, sincePassOne, passIndex, withinPass, completedPasses } = timeline(session, nowMs, metronome.beatTimeMs(0))
      if (!config.loop && completedPasses > 0) {
        finish()
        return
      }
      while (session.passes.length < completedPasses) session.passes.push(scorePass(session, session.passes.length, nowMs))

      const beatInBar = (((Math.floor(clicksElapsed) % clicksPerBar) + clicksPerBar) % clicksPerBar) + 1
      const lastScore = session.passes[session.passes.length - 1]?.score ?? null
      if (sincePassOne < 0) setStatus({ phase: 'count-in', config, beatInBar, pass: 1, lastScore })
      else if (withinPass >= passClicks) setStatus({ phase: 'count-in', config, beatInBar, pass: passIndex + 2, lastScore }) // gap bar
      else {
        const bar = config.barRange[0] + Math.floor(withinPass / clicksPerBar)
        setStatus({ phase: 'recording', config, bar, beatInBar, pass: passIndex + 1, lastScore })
      }
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

  return { status, start, finish, reset, positionBeat }
}
