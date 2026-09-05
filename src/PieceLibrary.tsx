// The piece library and session setup: pick a piece, then a setup card
// (tracks and time signature, tempo, bars and loop) with Practice on top,
// and a preview of the roll or the score.

import { useState } from 'react'
import { TimeSignatureInput } from './MidiCheck'
import PieceList from './PieceList'
import PiecePreview from './PiecePreview'
import { barCount, bpmLabel, clickLengthInBeats, encodeScoreFile, parseMidiFilePiece, quarterNoteBpm, splitAtMiddleC } from './pieces'
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
    setIncludedTracks(includedTracks.includes(track) ? includedTracks.filter((t) => t !== track) : [...includedTracks, track])
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

      {!selected && pieces.length > 0 && <p className="mt-2 text-sm text-ink-muted">Pick a piece on the left.</p>}

      {selected && (
        <div className="min-w-0 flex-1 space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {barCount(selected)} bars · {selected.timeSignature.join('/')} ·{' '}
                  {selected.score ? (
                    <>
                      score {selected.score.fileName}{' '}
                      <button className="text-red-600 hover:underline" onClick={() => updatePiece({ ...selected, score: undefined })}>
                        remove
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer text-accent hover:underline">
                      attach a score (.mxl / .musicxml)
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
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-sm text-ink-muted hover:text-red-600" onClick={() => deletePiece(selected)}>
                  Delete
                </button>
                <button
                  className="btn btn-primary px-5"
                  disabled={includedTracks.length === 0}
                  onClick={() => onStartSession({ piece: selected, tracks: includedTracks, bpm, barRange, loop })}
                >
                  {loop ? 'Loop' : 'Practice'}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-3">
              <div>
                <div className="label">Tracks</div>
                <div className="mt-2 space-y-2 text-sm">
                  {selected.trackNames.map((name, track) => (
                    <label key={track} className="flex items-center gap-2">
                      <input type="checkbox" checked={includedTracks.includes(track)} onChange={() => toggleTrack(track)} />
                      <input
                        className="field w-36 py-0.5"
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
                      className="btn"
                      onClick={() => {
                        updatePiece(splitAtMiddleC(selected))
                        setIncludedTracks([0, 1])
                      }}
                    >
                      Split hands at middle C
                    </button>
                  )}
                  <label className="flex items-center gap-2 pt-1">
                    Time signature <TimeSignatureInput value={selected.timeSignature} onChange={(next) => changeTimeSignature(selected, next)} />
                  </label>
                </div>
              </div>

              <div>
                <div className="label">Tempo</div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="btn" onClick={() => setBpmClamped(bpm - 5)}>
                    −5
                  </button>
                  <span className="w-24 text-center text-xl tabular-nums">{bpmLabel(bpm, selected.timeSignature)}</span>
                  <button className="btn" onClick={() => setBpmClamped(bpm + 5)}>
                    +5
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  {[50, 75, 100].map((percent) => (
                    <button key={percent} className="btn px-2 py-1 text-xs" onClick={() => setBpmClamped((selected.defaultBpm * percent) / 100)}>
                      {percent}%
                    </button>
                  ))}
                  <span className="self-center text-xs text-ink-muted">of {bpmLabel(selected.defaultBpm, selected.timeSignature)}</span>
                </div>
              </div>

              <div>
                <div className="label">Bars</div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <input type="number" min={1} max={barCount(selected)} className="field w-16" value={barRange[0]} onChange={(e) => changeBarRange(selected, Number(e.target.value), barRange[1])} />
                  to
                  <input type="number" min={1} max={barCount(selected)} className="field w-16" value={barRange[1]} onChange={(e) => changeBarRange(selected, barRange[0], Number(e.target.value))} />
                  <button className="btn px-2 py-1 text-xs" onClick={() => setBarRange(wholePiece(selected))}>
                    All {barCount(selected)}
                  </button>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                  Loop the range, one-bar gap, each pass graded
                </label>
              </div>
            </div>
          </div>

          <PiecePreview piece={selected} includedTracks={includedTracks} highlightBars={barRange} />
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
