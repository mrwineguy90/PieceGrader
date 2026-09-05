// Preview of a piece before practising: the piano roll or the score, one at
// a time, switched with a segmented control. Used by the library and the
// drills picker.

import { useState } from 'react'
import PianoRoll from './PianoRoll'
import ScoreView from './ScoreView'
import type { Piece } from './types'

const SCORE_ZOOM = 0.6

interface Props {
  piece: Piece
  includedTracks: number[]
  highlightBars?: [number, number]
}

export default function PiecePreview({ piece, includedTracks, highlightBars }: Props) {
  const [view, setView] = useState<'roll' | 'score'>('score')
  const [pixelsPerBeat, setPixelsPerBeat] = useState(30)
  const showScore = view === 'score' && piece.score !== undefined

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
          <ScoreView score={piece.score} zoom={SCORE_ZOOM} maxHeight="55vh" />
        ) : (
          <PianoRoll piece={piece} includedTracks={includedTracks} pixelsPerBeat={pixelsPerBeat} highlightBars={highlightBars} />
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
