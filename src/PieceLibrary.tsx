// The piece library and session setup: import .mid files, pick a piece, name
// its tracks and choose which are included, set the BPM, see the piano roll,
// start practising.

import { useState } from 'react'
import { TimeSignatureInput } from './MidiCheck'
import PianoRoll from './PianoRoll'
import { barCount, bpmLabel, clickLengthInBeats, parseMidiFilePiece, quarterNoteBpm, splitAtMiddleC } from './pieces'
import type { Piece } from './types'
import type { SessionConfig } from './useSession'

const MIN_BPM = 30
const MAX_BPM = 240

interface Props {
  pieces: Piece[]
  onChangePieces: (pieces: Piece[]) => void
  onStartSession: (config: SessionConfig) => void
}

export default function PieceLibrary({ pieces, onChangePieces, onStartSession }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(pieces[0]?.id ?? null)
  const [includedTracks, setIncludedTracks] = useState<number[]>(() => allTracks(pieces[0]))
  const [bpm, setBpm] = useState(pieces[0]?.defaultBpm ?? 100)
  const [barRange, setBarRange] = useState<[number, number]>(() => wholePiece(pieces[0]))
  const [loop, setLoop] = useState(false)
  const [pixelsPerBeat, setPixelsPerBeat] = useState(30)
  const [importError, setImportError] = useState<string | null>(null)

  const selected = pieces.find((piece) => piece.id === selectedId) ?? null

  const selectPiece = (piece: Piece) => {
    setSelectedId(piece.id)
    setIncludedTracks(allTracks(piece))
    setBpm(piece.defaultBpm)
    setBarRange(wholePiece(piece))
  }

  // Keep 1 ≤ from ≤ to ≤ last bar while the user types.
  const changeBarRange = (piece: Piece, from: number, to: number) => {
    const last = barCount(piece)
    const clampedFrom = Math.min(last, Math.max(1, from || 1))
    const clampedTo = Math.min(last, Math.max(clampedFrom, to || last))
    setBarRange([clampedFrom, clampedTo])
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

  const setBpmClamped = (next: number) => setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(next))))

  // BPM counts the bottom number's note, so re-express both tempos when the
  // signature changes: quarter = 80 stays quarter = 80 whether shown as ♩ = 80 or ♪ = 160.
  const changeTimeSignature = (piece: Piece, next: [number, number]) => {
    const toNewClicks = (bpm: number) => Math.round(quarterNoteBpm(bpm, piece.timeSignature) / clickLengthInBeats(next))
    updatePiece({ ...piece, timeSignature: next, defaultBpm: toNewClicks(piece.defaultBpm) })
    setBpm(toNewClicks(bpm))
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
                  {barCount(piece)} bars · {piece.timeSignature.join('/')} · {bpmLabel(piece.defaultBpm, piece.timeSignature)} ·{' '}
                  {piece.trackNames.length}{' '}
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
            <label className="flex items-center gap-2 text-sm">
              Time signature{' '}
              <TimeSignatureInput value={selected.timeSignature} onChange={(next) => changeTimeSignature(selected, next)} />
            </label>
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className={buttonClass} onClick={() => setBpmClamped(bpm - 5)}>
              −5
            </button>
            <span className="w-28 text-center text-xl tabular-nums">{bpmLabel(bpm, selected.timeSignature)}</span>
            <button className={buttonClass} onClick={() => setBpmClamped(bpm + 5)}>
              +5
            </button>
            {[50, 75, 100].map((percent) => (
              <button key={percent} className={`${buttonClass} text-sm`} onClick={() => setBpmClamped((selected.defaultBpm * percent) / 100)}>
                {percent}%
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            Bars
            <input
              type="number"
              min={1}
              max={barCount(selected)}
              className="w-16 rounded border border-gray-300 px-2 py-1"
              value={barRange[0]}
              onChange={(e) => changeBarRange(selected, Number(e.target.value), barRange[1])}
            />
            to
            <input
              type="number"
              min={1}
              max={barCount(selected)}
              className="w-16 rounded border border-gray-300 px-2 py-1"
              value={barRange[1]}
              onChange={(e) => changeBarRange(selected, barRange[0], Number(e.target.value))}
            />
            <button className={buttonClass} onClick={() => setBarRange(wholePiece(selected))}>
              All {barCount(selected)}
            </button>
            <label className="ml-4 flex items-center gap-2">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              Loop (repeat with a one-bar gap, each pass graded)
            </label>
            <button
              className={`${buttonClass} ml-6 bg-green-100 font-medium disabled:opacity-40`}
              disabled={includedTracks.length === 0}
              onClick={() => onStartSession({ piece: selected, tracks: includedTracks, bpm, barRange, loop })}
            >
              Practice
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            Zoom
            <input type="range" min={8} max={80} value={pixelsPerBeat} onChange={(e) => setPixelsPerBeat(Number(e.target.value))} />
          </label>
          <div className="mt-2">
            <PianoRoll piece={selected} includedTracks={includedTracks} pixelsPerBeat={pixelsPerBeat} highlightBars={barRange} />
          </div>
        </div>
      )}
    </div>
  )
}

function allTracks(piece: Piece | undefined): number[] {
  return piece ? piece.trackNames.map((_, index) => index) : []
}

function wholePiece(piece: Piece | undefined): [number, number] {
  return [1, piece ? barCount(piece) : 1]
}

const buttonClass = 'rounded border border-gray-300 px-3 py-1 hover:bg-gray-100'
