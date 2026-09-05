// What's on screen while playing: one compact strip with the bar counter,
// beat dots and the session facts, then the score with a moving playhead
// (or the reference roll when no score is attached) filling the page.
// Spec §5 asked for the counter and dots only; the score was added on
// request. Sized to read from a music stand: big bar number, little else.

import { useEffect, useState } from 'react'
import PianoRoll from './PianoRoll'
import ScoreView from './ScoreView'
import { bpmLabel } from './pieces'
import { midiName } from './pitches'
import type { SessionStatus } from './useSession'

const ROLL_PIXELS_PER_BEAT = 48
const ROLL_ROW_HEIGHT = 12
const DEFAULT_SCORE_ZOOM = 0.9

interface Props {
  status: Extract<SessionStatus, { phase: 'armed' | 'count-in' | 'recording' }>
  positionBeat: (nowMs: number) => number | null
  onStop: () => void
}

export default function SessionScreen({ status, positionBeat, onStop }: Props) {
  const { config } = status
  const lastScore = status.phase === 'armed' ? null : status.lastScore
  const beatInBar = status.phase === 'armed' ? 0 : status.beatInBar
  const [clicksPerBar] = config.piece.timeSignature
  const trackNames = config.tracks.map((track) => config.piece.trackNames[track]).join(', ')
  const [playheadBeat, setPlayheadBeat] = useState<number | undefined>(undefined)
  const [scoreZoom, setScoreZoom] = useState(DEFAULT_SCORE_ZOOM)

  // Piano-roll fallback only: the score view runs its own frame loop and moves
  // its line directly, so it never goes through React state.
  useEffect(() => {
    if (config.piece.score) return
    let frame = 0
    const tick = () => {
      setPlayheadBeat(positionBeat(performance.now()) ?? undefined)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [positionBeat, config.piece.score])

  return (
    <div className="mt-4 space-y-3">
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
        <div className="min-w-44 text-5xl leading-none font-semibold tabular-nums">
          {status.phase === 'armed' && <span className="text-accent">Play {status.firstChord.map(midiName).join(' + ')}</span>}
          {status.phase === 'count-in' && <span className="text-ink-muted">Ready</span>}
          {status.phase === 'recording' && `Bar ${status.bar}`}
        </div>
        <div className="flex gap-2.5">
          {Array.from({ length: clicksPerBar }, (_, i) => {
            const active = beatInBar === i + 1
            const color = !active ? 'bg-line' : i === 0 ? 'bg-red-500' : 'bg-accent'
            return <span key={i} className={`inline-block h-5 w-5 rounded-full transition-colors ${color}`} />
          })}
        </div>
        <div className="min-w-0 flex-1 truncate text-sm text-ink-muted">
          {status.phase === 'armed' && (
            <span className="mr-2 text-ink">Place your hands and play the opening {status.firstChord.length > 1 ? 'chord' : 'note'} to start the count-in. Wrong keys do nothing.</span>
          )}
          <span className="font-medium text-ink">{config.piece.title}</span> · {config.piece.timeSignature.join('/')} ·{' '}
          {bpmLabel(config.bpm, config.piece.timeSignature)} · {trackNames} · bars {config.barRange[0]}–{config.barRange[1]}
          {config.loop && ' · loop'}
        </div>
        {config.loop && status.phase !== 'armed' && (
          <div className="text-sm tabular-nums text-ink-muted">
            Pass {status.pass}
            {lastScore && ` · last ${Math.round(lastScore.pitchAccuracy * 100)}% pitch, ${Math.round(lastScore.timing.onTime * 100)}% on time`}
          </div>
        )}
        {config.piece.score && (
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            Size
            <input type="range" min={0.5} max={1.4} step={0.05} value={scoreZoom} onChange={(e) => setScoreZoom(Number(e.target.value))} />
          </label>
        )}
        <button className="btn" onClick={onStop}>
          Stop <kbd className="ml-1 rounded border border-line px-1 text-xs text-ink-muted">Esc</kbd>
        </button>
      </div>

      {config.piece.score ? (
        <div className="card p-3">
          <ScoreView score={config.piece.score} positionBeat={positionBeat} zoom={scoreZoom} maxHeight="78vh" visibleStaves={config.tracks} />
        </div>
      ) : (
        <PianoRoll
          piece={config.piece}
          includedTracks={config.tracks}
          pixelsPerBeat={ROLL_PIXELS_PER_BEAT}
          rowHeight={ROLL_ROW_HEIGHT}
          highlightBars={config.barRange}
          playheadBeat={playheadBeat}
        />
      )}
    </div>
  )
}
