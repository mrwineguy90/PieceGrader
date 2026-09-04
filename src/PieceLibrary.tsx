// The piece library: import .mid files, pick a piece, name its tracks and
// choose which are included, see it as a piano roll.

import { useState } from 'react'
import PianoRoll from './PianoRoll'
import { barCount, parseMidiFilePiece, splitAtMiddleC } from './pieces'
import type { Piece } from './types'

interface Props {
  pieces: Piece[]
  onChangePieces: (pieces: Piece[]) => void
}

export default function PieceLibrary({ pieces, onChangePieces }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(pieces[0]?.id ?? null)
  const [includedTracks, setIncludedTracks] = useState<number[]>([])
  const [pixelsPerBeat, setPixelsPerBeat] = useState(30)
  const [importError, setImportError] = useState<string | null>(null)

  const selected = pieces.find((piece) => piece.id === selectedId) ?? null

  const selectPiece = (piece: Piece) => {
    setSelectedId(piece.id)
    setIncludedTracks(piece.trackNames.map((_, index) => index))
  }

  const updatePiece = (updated: Piece) => {
    onChangePieces(pieces.map((piece) => (piece.id === updated.id ? updated : piece)))
  }

  const importFile = async (file: File) => {
    setImportError(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const piece = parseMidiFilePiece(bytes, file.name.replace(/\.midi?$/i, ''))
      onChangePieces([...pieces, piece])
      selectPiece(piece)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read that file.')
    }
  }

  const deletePiece = (piece: Piece) => {
    if (!window.confirm(`Delete "${piece.title}"?`)) return
    onChangePieces(pieces.filter((other) => other.id !== piece.id))
    if (selectedId === piece.id) setSelectedId(null)
  }

  const toggleTrack = (track: number) => {
    setIncludedTracks(
      includedTracks.includes(track) ? includedTracks.filter((t) => t !== track) : [...includedTracks, track],
    )
  }

  return (
    <div className="mt-6 flex gap-6">
      <aside className="w-64 shrink-0">
        <label className={`${buttonClass} block cursor-pointer text-center`}>
          Import .mid file
          <input
            type="file"
            accept=".mid,.midi"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importFile(file)
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
                onClick={() => selectPiece(piece)}
              >
                {piece.title}
                <span className="block text-xs text-gray-500">
                  {barCount(piece)} bars · {piece.defaultBpm} BPM · {piece.trackNames.length}{' '}
                  {piece.trackNames.length === 1 ? 'track' : 'tracks'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {pieces.length === 0 && <p className="mt-4 text-sm text-gray-500">No pieces yet. Import a .mid file to start.</p>}
      </aside>

      {selected && (
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">{selected.title}</h2>
            <button className="text-sm text-red-600 hover:underline" onClick={() => deletePiece(selected)}>
              Delete
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            {selected.trackNames.map((name, track) => (
              <label key={track} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includedTracks.includes(track)} onChange={() => toggleTrack(track)} />
                <input
                  className="w-32 rounded border border-gray-300 px-2 py-0.5"
                  value={name}
                  onChange={(e) => {
                    const trackNames = [...selected.trackNames]
                    trackNames[track] = e.target.value
                    updatePiece({ ...selected, trackNames })
                  }}
                />
              </label>
            ))}
            {selected.trackNames.length === 1 && (
              <button
                className={buttonClass}
                onClick={() => {
                  updatePiece(splitAtMiddleC(selected))
                  setIncludedTracks([0, 1])
                }}
              >
                Split hands at middle C
              </button>
            )}
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            Zoom
            <input type="range" min={8} max={80} value={pixelsPerBeat} onChange={(e) => setPixelsPerBeat(Number(e.target.value))} />
          </label>
          <div className="mt-2">
            <PianoRoll piece={selected} includedTracks={includedTracks} pixelsPerBeat={pixelsPerBeat} />
          </div>
        </div>
      )}
    </div>
  )
}

const buttonClass = 'rounded border border-gray-300 px-3 py-1 hover:bg-gray-100'
