// What's on screen while playing: bar counter, beat dots, and the score with
// a moving cursor when the piece has one attached, otherwise the reference
// roll with a playhead. (Spec §5 asked for the counter and dots only; the
// score was added on request.) In loop mode, one line with the previous
// pass's result.

import { useEffect, useState } from 'react'
import PianoRoll from './PianoRoll'
import ScoreView from './ScoreView'
import { bpmLabel } from './pieces'
import type { SessionStatus } from './useSession'

const ROLL_PIXELS_PER_BEAT = 40

interface Props {
  status: Extract<SessionStatus, { phase: 'count-in' | 'recording' }>
  positionBeat: (nowMs: number) => number | null
  onStop: () => void
}

export default function SessionScreen({ status, positionBeat, onStop }: Props) {
  const { config, lastScore } = status
  const [clicksPerBar] = config.piece.timeSignature
  const trackNames = config.tracks.map((track) => config.piece.trackNames[track]).join(', ')
  const [playheadBeat, setPlayheadBeat] = useState<number | undefined>(undefined)
  const [scoreZoom, setScoreZoom] = useState(0.8)

  // Smooth playhead: read the clock every frame rather than on the hook's 100 ms tick.
  useEffect(() => {
    let frame = 0
    const tick = () => {
      setPlayheadBeat(positionBeat(performance.now()) ?? undefined)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [positionBeat])

  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      <p className="text-gray-500">
        {config.piece.title} · {config.piece.timeSignature.join('/')} · {bpmLabel(config.bpm, config.piece.timeSignature)} · {trackNames} ·
        bars {config.barRange[0]}–{config.barRange[1]}
        {config.loop && ' · loop'}
      </p>

      <div className="flex items-center gap-10">
        <div className="text-6xl font-semibold tabular-nums">
          {status.phase === 'count-in' ? <span className="text-gray-400">Ready</span> : `Bar ${status.bar}`}
        </div>
        <div className="flex gap-4">
          {Array.from({ length: clicksPerBar }, (_, i) => {
            const active = status.beatInBar === i + 1
            const color = !active ? 'bg-gray-200' : i === 0 ? 'bg-red-500' : 'bg-gray-800'
            return <span key={i} className={`inline-block h-8 w-8 rounded-full ${color}`} />
          })}
        </div>
        {config.loop && (
          <p className="text-lg tabular-nums text-gray-600">
            Pass {status.pass}
            {lastScore && ` · last: ${Math.round(lastScore.pitchAccuracy * 100)}% pitch, ${Math.round(lastScore.timing.onTime * 100)}% on time`}
          </p>
        )}
        <button className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100" onClick={onStop}>
          Stop (Esc)
        </button>
        {config.piece.score && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Zoom
            <input type="range" min={0.5} max={1.3} step={0.05} value={scoreZoom} onChange={(e) => setScoreZoom(Number(e.target.value))} />
          </label>
        )}
      </div>

      {config.piece.score ? (
        <div className="w-full rounded border border-gray-300 p-2">
          <ScoreView score={config.piece.score} positionBeat={playheadBeat} zoom={scoreZoom} maxHeight="75vh" />
        </div>
      ) : (
        <div className="w-full">
          <PianoRoll
            piece={config.piece}
            includedTracks={config.tracks}
            pixelsPerBeat={ROLL_PIXELS_PER_BEAT}
            highlightBars={config.barRange}
            playheadBeat={playheadBeat}
          />
        </div>
      )}
    </div>
  )
}
