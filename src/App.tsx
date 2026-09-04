// Top-level shell: a tab strip and the current screen. The MIDI connection
// and the session live here so they survive switching screens; a running or
// finished session takes over the page until it is dismissed.

import { useState } from 'react'
import MidiCheck from './MidiCheck'
import PieceLibrary from './PieceLibrary'
import ResultsScreen from './ResultsScreen'
import SessionScreen from './SessionScreen'
import { loadPieces, savePieces } from './storage'
import type { Piece } from './types'
import { useMidiInput } from './useMidiInput'
import { useSession } from './useSession'

type Screen = 'pieces' | 'keyboard'

export default function App() {
  const midi = useMidiInput()
  const session = useSession(midi)
  const [screen, setScreen] = useState<Screen>('pieces')
  const [pieces, setPieces] = useState<Piece[]>(loadPieces)

  const changePieces = (next: Piece[]) => {
    setPieces(next)
    savePieces(next)
  }

  const { status } = session
  let body
  if (status.phase === 'count-in' || status.phase === 'recording') {
    body = <SessionScreen status={status} onStop={session.finish} />
  } else if (status.phase === 'done') {
    body = <ResultsScreen result={status.result} onPracticeAgain={() => session.start(status.result.config)} onBack={session.reset} />
  } else if (screen === 'pieces') {
    body = <PieceLibrary pieces={pieces} onChangePieces={changePieces} onStartSession={session.start} />
  } else {
    body = <MidiCheck midi={midi} />
  }

  return (
    <main className="mx-auto max-w-6xl p-6 text-gray-900">
      <div className="flex items-baseline gap-6">
        <h1 className="text-2xl font-semibold">Piece Grader</h1>
        {status.phase === 'idle' && (
          <nav className="flex gap-1 text-sm">
            <TabButton label="Pieces" active={screen === 'pieces'} onClick={() => setScreen('pieces')} />
            <TabButton label="Keyboard check" active={screen === 'keyboard'} onClick={() => setScreen('keyboard')} />
          </nav>
        )}
      </div>
      {body}
    </main>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`rounded px-3 py-1 ${active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
