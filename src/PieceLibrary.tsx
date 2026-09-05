// The piece library and session setup: pick a piece, name its tracks and
// choose which are included, set time signature, BPM, bar range and loop,
// attach a MusicXML score, see the piano roll, start practising.

import { useState } from 'react'
import { TimeSignatureInput } from './MidiCheck'
import PianoRoll from './PianoRoll'
import PieceList from './PieceList'
import ScoreView from './ScoreView'
import {
  barCount,
  bpmLabel,
  clickLengthInBeats,
  encodeScoreFile,
  parseMidiFilePiece,
  quarterNoteBpm,
  splitAtMiddleC,
} from './pieces'
import type { Piece } from './types'
import type { SessionConfig } from './useSession'

const MIN_BPM = 30
const MAX_BPM = 240
const PREVIEW_SCORE_ZOOM = 0.6

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

  const attachScore = async (piece: Piece, file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    updatePiece({ ...piece, score: { fileName: file.name, base64: encodeScoreFile(bytes) } })
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

  // Keep 1 ≤ from ≤ to ≤ last bar while the user types.
  const changeBarRange = (piece: Piece, from: number, to: number) => {
    const last = barCount(piece)
    const clampedFrom = Math.min(last, Math.max(1, from || 1))
    const clampedTo = Math.min(last, Math.max(clampedFrom, to || last))
    setBarRange([clampedFrom, clampedTo])
  }

  return (
    <div className="mt-6 flex gap-6">
      <PieceList pieces={pieces} selectedId={selectedId} importError={importError} onSelect={selectPiece} onImportFile={(file) => void importFile(file)} />

      {selected && (
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">{selected.title}</h2>
            <div className="flex items-center gap-4 text-sm">
              {selected.score ? (
                <span className="text-ink-muted">
                  Score: {selected.score.fileName}{' '}
                  <button className="text-red-600 hover:underline" onClick={() => updatePiece({ ...selected, score: undefined })}>
                    remove
                  </button>
                </span>
              ) : (
                <label className={`${buttonClass} cursor-pointer`}>
                  Attach score (.mxl / .musicxml)
                  <input
                    type="file"
                    accept=".mxl,.musicxml,.xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void attachScore(selected, file)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
              <button className="text-red-600 hover:underline" onClick={() => deletePiece(selected)}>
                Delete
              </button>
            </div>
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
                  className="field w-32 py-0.5"
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
              className="field w-16"
              value={barRange[0]}
              onChange={(e) => changeBarRange(selected, Number(e.target.value), barRange[1])}
            />
            to
            <input
              type="number"
              min={1}
              max={barCount(selected)}
              className="field w-16"
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
              className="btn btn-primary ml-6"
              disabled={includedTracks.length === 0}
              onClick={() => onStartSession({ piece: selected, tracks: includedTracks, bpm, barRange, loop })}
            >
              Practice
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
            Zoom
            <input type="range" min={8} max={80} value={pixelsPerBeat} onChange={(e) => setPixelsPerBeat(Number(e.target.value))} />
          </label>
          <div className="mt-2">
            <PianoRoll piece={selected} includedTracks={includedTracks} pixelsPerBeat={pixelsPerBeat} highlightBars={barRange} />
          </div>

          {selected.score && (
            <div className="card mt-4 p-2">
              <ScoreView score={selected.score} zoom={PREVIEW_SCORE_ZOOM} maxHeight="50vh" />
            </div>
          )}
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

const buttonClass = 'btn'
