// Sidebar of the library: import button and the list of pieces.

import { barCount, bpmLabel } from './pieces'
import type { Piece } from './types'

// The browser's "could not be read" usually means a file a sync layer still
// holds (fresh files in ~/Documents on a Mac), or one moved after it was picked.
export function describeFileError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotReadableError') {
    return 'The browser could not read that file. Fresh files in synced folders such as Documents can do this: wait a minute, or export to Downloads and import from there.'
  }
  return error instanceof Error ? error.message : 'Could not read that file.'
}

interface Props {
  pieces: Piece[]
  selectedId: string | null
  importError: string | null
  onSelect: (piece: Piece) => void
  onImportFile: (file: File) => Promise<void>
}

export default function PieceList({ pieces, selectedId, importError, onSelect, onImportFile }: Props) {
  return (
    <aside className="w-64 shrink-0">
      <label className="btn w-full cursor-pointer">
        Import .mid file
        <input
          type="file"
          accept=".mid,.midi"
          className="hidden"
          onChange={(e) => {
            const input = e.target
            const file = input.files?.[0]
            if (!file) return
            // Reset only after the read has finished: clearing the input while
            // the browser is still opening the file can fail the read.
            void onImportFile(file).finally(() => {
              input.value = '' // so the same file can be imported again
            })
          }}
        />
      </label>
      {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
      <ul className="mt-4 space-y-1">
        {pieces.map((piece) => (
          <li key={piece.id}>
            <button
              className={`w-full rounded-md px-2 py-1.5 text-left hover:bg-line/60 ${piece.id === selectedId ? 'bg-accent-soft font-medium' : ''}`}
              onClick={() => onSelect(piece)}
            >
              {piece.title}
              <span className="block text-xs text-ink-muted">
                {barCount(piece)} bars · {piece.timeSignature.join('/')} · {bpmLabel(piece.defaultBpm, piece.timeSignature)} ·{' '}
                {piece.trackNames.length} {piece.trackNames.length === 1 ? 'track' : 'tracks'}
                {piece.score && ' · score'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pieces.length === 0 && <p className="mt-4 text-sm text-ink-muted">No pieces yet. Import a .mid file to start.</p>}
    </aside>
  )
}
