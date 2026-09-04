// Top-level shell: a tab strip and the current screen. The MIDI connection
// lives here so it survives switching screens.

import { useState } from 'react'
import MidiCheck from './MidiCheck'
import PieceLibrary from './PieceLibrary'
import { loadPieces, savePieces } from './storage'
import type { Piece } from './types'
import { useMidiInput } from './useMidiInput'

type Screen = 'pieces' | 'keyboard'

export default function App() {
  const midi = useMidiInput()
  const [screen, setScreen] = useState<Screen>('pieces')
  const [pieces, setPieces] = useState<Piece[]>(loadPieces)

  const changePieces = (next: Piece[]) => {
    setPieces(next)
    savePieces(next)
  }

  return (
    <main className="mx-auto max-w-6xl p-6 text-gray-900">
      <div className="flex items-baseline gap-6">
        <h1 className="text-2xl font-semibold">Piece Grader</h1>
        <nav className="flex gap-1 text-sm">
          <TabButton label="Pieces" active={screen === 'pieces'} onClick={() => setScreen('pieces')} />
          <TabButton label="Keyboard check" active={screen === 'keyboard'} onClick={() => setScreen('keyboard')} />
        </nav>
      </div>

      {screen === 'pieces' && <PieceLibrary pieces={pieces} onChangePieces={changePieces} />}
      {screen === 'keyboard' && <MidiCheck midi={midi} />}
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
