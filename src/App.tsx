// Top-level shell: a tab strip and the current screen. The MIDI connection,
// the session, the piece list and the performance history live here so they
// survive switching screens; a running or finished session takes over the
// page until it is dismissed.

import { useEffect, useState } from 'react'
import DrillsScreen from './DrillsScreen'
import HistoryScreen from './HistoryScreen'
import MidiCheck from './MidiCheck'
import PieceLibrary from './PieceLibrary'
import RecordScreen from './RecordScreen'
import ResultsScreen from './ResultsScreen'
import SessionScreen from './SessionScreen'
import type { Score } from './scoring'
import { Playback } from './playback'
import { loadPerformances, loadPieces, savePerformances, savePieces } from './storage'
import { Synth } from './synth'
import type { Performance, Piece } from './types'
import type { SessionConfig } from './sessionConfig'
import { useMidiInput } from './useMidiInput'
import { useSession, type SessionResult } from './useSession'

type Screen = 'pieces' | 'drills' | 'history' | 'record' | 'keyboard'
const TABS: { screen: Screen; label: string }[] = [
  { screen: 'pieces', label: 'Pieces' },
  { screen: 'drills', label: 'Drills' },
  { screen: 'history', label: 'History' },
  { screen: 'record', label: 'Record a piece' },
  { screen: 'keyboard', label: 'Keyboard check' },
]

export default function App() {
  const midi = useMidiInput()
  const [screen, setScreen] = useState<Screen>('pieces')
  const [pieces, setPieces] = useState<Piece[]>(loadPieces)
  const [performances, setPerformances] = useState<Performance[]>(loadPerformances)
  const [synth] = useState(() => new Synth())
  const [playback] = useState(() => new Playback(synth))
  const [soundOn, setSoundOn] = useState(false) // play the keyboard through this computer; off each launch until asked to remember it

  // While sound is on, every keyboard event also goes to the synth.
  useEffect(() => {
    if (!soundOn) return
    const unsubscribe = midi.subscribe((event) => synth.handle(event))
    return () => {
      unsubscribe()
      synth.allOff()
    }
  }, [soundOn, midi.subscribe, synth])

  const changePieces = (next: Piece[]) => {
    setPieces(next)
    persist(() => savePieces(next))
  }

  const changePerformances = (next: Performance[]) => {
    setPerformances(next)
    persist(() => savePerformances(next))
  }

  // Every finished session adds one history entry per pass.
  const recordResult = (result: SessionResult) => {
    const { config } = result
    const saved: Performance[] = result.passes.map((pass) => ({
      id: crypto.randomUUID(),
      pieceId: config.piece.id,
      playedAt: new Date().toISOString(),
      bpm: config.bpm,
      tracksIncluded: config.tracks,
      barRange: config.barRange,
      played: pass.played,
      score: withoutResults(pass.score),
    }))
    changePerformances([...performances, ...saved])
  }
  const session = useSession(midi, recordResult)
  const startSession = (config: SessionConfig) => {
    playback.stop() // a preview must not play over a session
    session.start(config)
  }

  const { status } = session
  let body
  if (status.phase === 'armed' || status.phase === 'count-in' || status.phase === 'recording') {
    body = <SessionScreen status={status} positionBeat={session.positionBeat} onStop={session.finish} />
  } else if (status.phase === 'done') {
    body = <ResultsScreen result={status.result} onPractice={startSession} onBack={session.reset} />
  } else if (screen === 'pieces') {
    body = <PieceLibrary pieces={pieces} playback={playback} onChangePieces={changePieces} onStartSession={startSession} />
  } else if (screen === 'drills') {
    body = <DrillsScreen performances={performances} playback={playback} onStartSession={startSession} />
  } else if (screen === 'history') {
    body = (
      <HistoryScreen
        pieces={pieces}
        performances={performances}
        onDelete={(id) => changePerformances(performances.filter((p) => p.id !== id))}
      />
    )
  } else if (screen === 'record') {
    body = (
      <RecordScreen
        midi={midi}
        onCancel={() => setScreen('pieces')}
        onSave={(piece) => {
          changePieces([piece, ...pieces]) // first in the list, so the library opens on it
          setScreen('pieces')
        }}
      />
    )
  } else {
    body = <MidiCheck midi={midi} soundLatencyMs={soundOn ? synth.latencyMs() : null} />
  }

  const toggleSound = (on: boolean) => {
    if (on) synth.enable() // inside the click, so the browser allows audio
    setSoundOn(on)
  }

  return (
    <main className={`mx-auto p-6 ${status.phase === 'idle' ? 'max-w-6xl' : 'max-w-[1500px]'}`}>
      <div className="flex items-baseline gap-6">
        <h1 className="text-xl font-semibold tracking-tight">Piece Grader</h1>
        {status.phase === 'idle' && (
          <nav className="flex gap-1 text-sm">
            {TABS.map((tab) => (
              <button
                key={tab.screen}
                className={`rounded-md px-3 py-1 font-medium ${screen === tab.screen ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:bg-line/60 hover:text-ink'}`}
                onClick={() => setScreen(tab.screen)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted" title="Hear the keyboard through this computer's audio (use wired headphones; Bluetooth adds too much delay)">
          <input type="checkbox" checked={soundOn} onChange={(e) => toggleSound(e.target.checked)} />
          Play notes through this computer
        </label>
      </div>
      {body}
    </main>
  )
}

// History keeps the summary and per-bar numbers, not every note result.
function withoutResults(score: Score): Performance['score'] {
  const copy: Partial<Score> = { ...score }
  delete copy.results
  return copy as Performance['score']
}

// localStorage is capped around 5 MB; attached scores and a long history are
// the only things big enough to hit it.
function persist(write: () => void) {
  try {
    write()
  } catch {
    window.alert('Could not save: browser storage is full. Remove a score (use .mxl, it is much smaller), old performances, or a piece.')
  }
}
