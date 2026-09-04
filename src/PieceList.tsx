// Sidebar of the library: import button and the list of pieces.

import { barCount, bpmLabel } from './pieces'
import type { Piece } from './types'

interface Props {
  pieces: Piece[]
  selectedId: string | null
  importError: string | null
  onSelect: (piece: Piece) => void
  onImportFile: (file: File) => void
}

export default function PieceList({ pieces, selectedId, importError, onSelect, onImportFile }: Props) {
  return (
    <aside className="w-64 shrink-0">
      <label className="block cursor-pointer rounded border border-gray-300 px-3 py-1 text-center hover:bg-gray-100">
        Import .mid file
        <input
          type="file"
          accept=".mid,.midi"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportFile(file)
            e.target.value = '' // so the same file can be imported again
          }}
        />
      </label>
      {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
      <ul className="mt-4 space-y-1">
        {pieces.map((piece) => (
          <li key={piece.id}>
            <button
              className={`w-full rounded px-2 py-1 text-left hover:bg-gray-100 ${piece.id === selectedId ? 'bg-blue-50 font-medium' : ''}`}
              onClick={() => onSelect(piece)}
            >
              {piece.title}
              <span className="block text-xs text-gray-500">
                {barCount(piece)} bars · {piece.timeSignature.join('/')} · {bpmLabel(piece.defaultBpm, piece.timeSignature)} ·{' '}
                {piece.trackNames.length} {piece.trackNames.length === 1 ? 'track' : 'tracks'}
                {piece.score && ' · score'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pieces.length === 0 && <p className="mt-4 text-sm text-gray-500">No pieces yet. Import a .mid file to start.</p>}
    </aside>
  )
}
