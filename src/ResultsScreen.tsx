// Results (spec §7): piano roll with the performance overlaid on the
// reference, the pitch and timing metrics shown plainly, and a per-bar strip
// so the weak bars are obvious. Click a bar (or two, for a range) to drill it.

import { useState } from 'react'
import PianoRoll from './PianoRoll'
import { bpmLabel, quarterNoteBpm } from './pieces'
import { meetsPassMark, PASS_ON_TIME, PASS_PITCH } from './ladder'
import { CLOSE_MS, ON_TIME_MS, type BarScore, type Summary } from './scoring'
import { rangeStartBeat, type SessionConfig, type SessionResult } from './useSession'

interface Props {
  result: SessionResult
  onPractice: (config: SessionConfig) => void
  onBack: () => void
}

export default function ResultsScreen({ result, onPractice, onBack }: Props) {
  const [pixelsPerBeat, setPixelsPerBeat] = useState(30)
  const [passIndex, setPassIndex] = useState(result.passes.length - 1)
  const [selectedBars, setSelectedBars] = useState<[number, number] | null>(null)
  const { config, passes } = result
  const pass = passes[passIndex]
  const { score } = pass

  // First click picks a bar, a second click on another bar extends to a range,
  // clicking inside the selection clears it.
  const clickBar = (bar: number) => {
    if (!selectedBars) setSelectedBars([bar, bar])
    else if (bar >= selectedBars[0] && bar <= selectedBars[1]) setSelectedBars(null)
    else setSelectedBars([Math.min(bar, selectedBars[0]), Math.max(bar, selectedBars[1])])
  }

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">
          {config.piece.title}{' '}
          <span className="text-sm font-normal text-gray-500">
            {config.piece.timeSignature.join('/')} · {bpmLabel(config.bpm, config.piece.timeSignature)} · bars {config.barRange[0]}–
            {config.barRange[1]}
          </span>
        </h2>
        <div className="flex gap-2">
          <button className={buttonClass} onClick={onBack}>
            Back to pieces
          </button>
          <button className={`${buttonClass} bg-green-100`} onClick={() => onPractice(config)}>
            {config.loop ? 'Loop again' : 'Practice again'}
          </button>
        </div>
      </div>

      {passes.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1 text-sm">
          {passes.map((each, index) => (
            <button
              key={index}
              className={`rounded px-2 py-1 tabular-nums ${index === passIndex ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setPassIndex(index)}
            >
              Pass {index + 1} · {Math.round(each.score.pitchAccuracy * 100)}%
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-8">
        <div>
          <div className="text-5xl font-semibold tabular-nums">{percent(score.pitchAccuracy)}</div>
          <div className="text-sm text-gray-500">pitch accuracy</div>
        </div>
        <Stat label="correct" value={score.correct} color="text-green-600" />
        <Stat label="wrong" value={score.wrong} color="text-red-600" />
        <Stat label="missed" value={score.missed} color="text-gray-600" />
        <Stat label="extra" value={score.extra} color="text-red-600" />
        <div className="text-sm text-gray-500">of {score.referenceCount} reference notes</div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-8">
        <div>
          <div className="text-5xl font-semibold tabular-nums">{percent(score.timing.onTime)}</div>
          <div className="text-sm text-gray-500">on time (±{ON_TIME_MS} ms)</div>
        </div>
        <Stat label={`close (±${CLOSE_MS} ms)`} value={percent(score.timing.close)} color="text-gray-800" />
        <Stat label="mean |deviation|" value={`${Math.round(score.timing.meanAbsDeviationMs)} ms`} color="text-gray-800" />
        <Stat label="bias" value={biasLabel(score.timing.meanDeviationMs)} color="text-gray-800" />
        <Stat label="evenness (gap error)" value={`${Math.round(score.timing.evennessMs)} ms`} color="text-gray-800" />
      </div>

      {config.piece.source === 'drill' && (
        <p className={`mt-3 text-sm ${meetsPassMark(score) ? 'text-green-700' : 'text-gray-500'}`}>
          {meetsPassMark(score) ? 'Meets the ladder pass mark' : 'Below the ladder pass mark'} ({Math.round(PASS_PITCH * 100)}% pitch,{' '}
          {Math.round(PASS_ON_TIME * 100)}% on time) at ♩ = {config.bpm}.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-1">
        {score.bars.map((bar) => {
          const selected = selectedBars !== null && bar.bar >= selectedBars[0] && bar.bar <= selectedBars[1]
          return (
            <button
              key={bar.bar}
              title={barTooltip(bar)}
              className={`h-10 w-12 rounded text-sm tabular-nums text-white ${barColor(bar)} ${selected ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
              onClick={() => clickBar(bar.bar)}
            >
              {bar.bar}
            </button>
          )
        })}
      </div>
      {selectedBars ? (
        <div className="mt-2 flex items-center gap-2 text-sm">
          Bars {selectedBars[0]}–{selectedBars[1]}:
          <button className={buttonClass} onClick={() => onPractice({ ...config, barRange: selectedBars, loop: false })}>
            Practice this
          </button>
          <button className={buttonClass} onClick={() => onPractice({ ...config, barRange: selectedBars, loop: true })}>
            Loop this
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">Click a bar to drill it; click a second bar to widen the range.</p>
      )}

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
          highlightBars={config.barRange}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Gray: reference. Green: correct and on time. Yellow: correct but off time. Red: wrong or extra. Hollow: missed.
      </p>

      <table className="mt-4 text-sm tabular-nums">
        <thead className="text-left text-gray-500">
          <tr>
            {['Bar', 'Notes', 'Pitch', 'Wrong', 'Missed', 'Extra', 'On time', 'Mean |dev|', 'Bias'].map((heading) => (
              <th key={heading} className="pr-4 font-normal">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {score.bars.map((bar) => (
            <tr key={bar.bar} className={bar.referenceCount === 0 ? 'text-gray-400' : ''}>
              <td className="pr-4">{bar.bar}</td>
              <td className="pr-4">{bar.referenceCount}</td>
              <td className="pr-4">{bar.referenceCount ? percent(bar.pitchAccuracy) : '–'}</td>
              <td className="pr-4">{bar.wrong}</td>
              <td className="pr-4">{bar.missed}</td>
              <td className="pr-4">{bar.extra}</td>
              <td className="pr-4">{bar.timing.count ? percent(bar.timing.onTime) : '–'}</td>
              <td className="pr-4">{bar.timing.count ? `${Math.round(bar.timing.meanAbsDeviationMs)} ms` : '–'}</td>
              <td className="pr-4">{bar.timing.count ? biasLabel(bar.timing.meanDeviationMs) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div>
      <div className={`text-2xl font-medium tabular-nums ${color}`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

function biasLabel(meanDeviationMs: number): string {
  const rounded = Math.round(Math.abs(meanDeviationMs))
  if (rounded < 5) return 'even'
  return `${rounded} ms ${meanDeviationMs > 0 ? 'late' : 'early'}`
}

function barColor(bar: BarScore): string {
  if (bar.referenceCount === 0) return 'bg-gray-300'
  if (bar.pitchAccuracy >= 0.95 && bar.extra === 0) return 'bg-green-500'
  if (bar.pitchAccuracy >= 0.8) return 'bg-yellow-500'
  return 'bg-red-500'
}

function barTooltip(bar: Summary & { bar: number }): string {
  if (bar.referenceCount === 0) return `Bar ${bar.bar}: no notes in the selected tracks`
  return `Bar ${bar.bar}: ${percent(bar.pitchAccuracy)} pitch, ${bar.wrong} wrong, ${bar.missed} missed, ${bar.extra} extra, ${percent(bar.timing.onTime)} on time`
}

const buttonClass = 'rounded border border-gray-300 px-3 py-1 hover:bg-gray-100'
