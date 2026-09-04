// Top-level shell: a tab strip and the current screen. The MIDI connection,
// the session, the piece list and the performance history live here so they
// survive switching screens; a running or finished session takes over the
// page until it is dismissed.

import { useState } from 'react'
import HistoryScreen from './HistoryScreen'
import MidiCheck from './MidiCheck'
import PieceLibrary from './PieceLibrary'
import RecordScreen from './RecordScreen'
import ResultsScreen from './ResultsScreen'
import SessionScreen from './SessionScreen'
import type { Score } from './scoring'
import { loadPerformances, loadPieces, savePerformances, savePieces } from './storage'
import type { Performance, Piece } from './types'
import { useMidiInput } from './useMidiInput'
import { useSession, type SessionResult } from './useSession'

type Screen = 'pieces' | 'history' | 'record' | 'keyboard'
const TABS: { screen: Screen; label: string }[] = [
  { screen: 'pieces', label: 'Pieces' },
  { screen: 'history', label: 'History' },
  { screen: 'record', label: 'Record a piece' },
  { screen: 'keyboard', label: 'Keyboard check' },
]

export default function App() {
  const midi = useMidiInput()
  const [screen, setScreen] = useState<Screen>('pieces')
  const [pieces, setPieces] = useState<Piece[]>(loadPieces)
  const [performances, setPerformances] = useState<Performance[]>(loadPerformances)

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

  const { status } = session
  let body
  if (status.phase === 'count-in' || status.phase === 'recording') {
    body = <SessionScreen status={status} positionBeat={session.positionBeat} onStop={session.finish} />
  } else if (status.phase === 'done') {
    body = <ResultsScreen result={status.result} onPractice={session.start} onBack={session.reset} />
  } else if (screen === 'pieces') {
    body = <PieceLibrary pieces={pieces} onChangePieces={changePieces} onStartSession={session.start} />
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
    body = <MidiCheck midi={midi} />
  }

  return (
    <main className="mx-auto max-w-6xl p-6 text-gray-900">
      <div className="flex items-baseline gap-6">
        <h1 className="text-2xl font-semibold">Piece Grader</h1>
        {status.phase === 'idle' && (
          <nav className="flex gap-1 text-sm">
            {TABS.map((tab) => (
              <button
                key={tab.screen}
                className={`rounded px-3 py-1 ${screen === tab.screen ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setScreen(tab.screen)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
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
