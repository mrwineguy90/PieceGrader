// Preview of a piece before practising: the piano roll or the score, one at
// a time, switched with a segmented control, with a playhead while the
// piece is being played back. Used by the library and the drills picker.

import { useEffect, useState } from 'react'
import PianoRoll from './PianoRoll'
import ScoreView from './ScoreView'
import type { Piece } from './types'

const SCORE_ZOOM = 0.6

interface Props {
  piece: Piece
  includedTracks: number[]
  highlightBars?: [number, number]
  positionBeat?: (nowMs: number) => number | null // playhead while playing back; null when idle
}

export default function PiecePreview({ piece, includedTracks, highlightBars, positionBeat }: Props) {
  const [view, setView] = useState<'roll' | 'score'>('score')
  const [pixelsPerBeat, setPixelsPerBeat] = useState(30)
  const [rollPlayhead, setRollPlayhead] = useState<number | undefined>(undefined)
  const showScore = view === 'score' && piece.score !== undefined

  // The score view moves its own line; the roll takes a beat number, so poll for it.
  useEffect(() => {
    if (!positionBeat || showScore) return
    let frame = 0
    const tick = () => {
      setRollPlayhead(positionBeat(performance.now()) ?? undefined)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [positionBeat, showScore])

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex rounded-md bg-line/60 p-0.5 text-sm">
          <SegmentButton active={!showScore} onClick={() => setView('roll')} label="Piano roll" />
          <SegmentButton active={showScore} onClick={() => setView('score')} label="Score" disabled={!piece.score} />
        </div>
        {!showScore && (
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            Zoom
            <input type="range" min={8} max={80} value={pixelsPerBeat} onChange={(e) => setPixelsPerBeat(Number(e.target.value))} />
          </label>
        )}
      </div>
      <div className="mt-3">
        {showScore && piece.score ? (
          <ScoreView score={piece.score} zoom={SCORE_ZOOM} maxHeight="55vh" visibleStaves={includedTracks} positionBeat={positionBeat} />
        ) : (
          <PianoRoll piece={piece} includedTracks={includedTracks} pixelsPerBeat={pixelsPerBeat} highlightBars={highlightBars} playheadBeat={rollPlayhead} />
        )}
      </div>
    </div>
  )
}

function SegmentButton({ active, onClick, label, disabled }: { active: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      className={`rounded px-3 py-1 font-medium transition-colors disabled:opacity-40 ${active ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'No score attached' : undefined}
    >
      {label}
    </button>
  )
}
