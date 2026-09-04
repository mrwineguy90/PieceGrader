// Results (spec §7, without timing yet): piano roll with the performance
// overlaid on the reference, then the pitch metrics shown plainly.

import { useState } from 'react'
import PianoRoll from './PianoRoll'
import { bpmLabel, quarterNoteBpm } from './pieces'
import { rangeStartBeat, type SessionResult } from './useSession'

interface Props {
  result: SessionResult
  onPracticeAgain: () => void
  onBack: () => void
}

export default function ResultsScreen({ result, onPracticeAgain, onBack }: Props) {
  const [pixelsPerBeat, setPixelsPerBeat] = useState(30)
  const { config, score } = result
  const percent = Math.round(score.pitchAccuracy * 100)

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">
          {config.piece.title}{' '}
          <span className="text-sm font-normal text-gray-500">
            {config.piece.timeSignature.join('/')} · {bpmLabel(config.bpm, config.piece.timeSignature)}
          </span>
        </h2>
        <div className="flex gap-2">
          <button className={buttonClass} onClick={onBack}>
            Back to pieces
          </button>
          <button className={`${buttonClass} bg-green-100`} onClick={onPracticeAgain}>
            Practice again
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-end gap-8">
        <div>
          <div className="text-5xl font-semibold tabular-nums">{percent}%</div>
          <div className="text-sm text-gray-500">pitch accuracy</div>
        </div>
        <Stat label="correct" value={score.correct} color="text-green-600" />
        <Stat label="wrong" value={score.wrong} color="text-red-600" />
        <Stat label="missed" value={score.missed} color="text-gray-600" />
        <Stat label="extra" value={score.extra} color="text-red-600" />
        <div className="text-sm text-gray-500">of {score.referenceCount} reference notes</div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        Zoom
        <input type="range" min={8} max={80} value={pixelsPerBeat} onChange={(e) => setPixelsPerBeat(Number(e.target.value))} />
      </label>
      <div className="mt-2">
        <PianoRoll
          piece={config.piece}
          includedTracks={config.tracks}
          pixelsPerBeat={pixelsPerBeat}
          overlay={{
            results: score.results,
            bpm: quarterNoteBpm(config.bpm, config.piece.timeSignature),
            startBeat: rangeStartBeat(config),
          }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Gray: reference. Green: correct. Red: wrong or extra. Hollow: missed. Timing colors arrive in phase 4.
      </p>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`text-2xl font-medium tabular-nums ${color}`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}

const buttonClass = 'rounded border border-gray-300 px-3 py-1 hover:bg-gray-100'
