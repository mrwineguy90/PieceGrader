// What's on screen while playing: bar counter and beat dots, nothing else
// that pulls the eye off the sheet music (spec §5).

import { bpmLabel } from './pieces'
import type { SessionStatus } from './useSession'

interface Props {
  status: Extract<SessionStatus, { phase: 'count-in' | 'recording' }>
  onStop: () => void
}

export default function SessionScreen({ status, onStop }: Props) {
  const { config } = status
  const [clicksPerBar] = config.piece.timeSignature
  const trackNames = config.tracks.map((track) => config.piece.trackNames[track]).join(', ')

  return (
    <div className="mt-6 flex flex-col items-center gap-8 py-12">
      <p className="text-gray-500">
        {config.piece.title} · {config.piece.timeSignature.join('/')} · {bpmLabel(config.bpm, config.piece.timeSignature)} · {trackNames} ·
        bars {config.barRange[0]}–{config.barRange[1]}
      </p>

      <div className="text-8xl font-semibold tabular-nums">
        {status.phase === 'count-in' ? <span className="text-gray-400">Ready</span> : `Bar ${status.bar}`}
      </div>

      <div className="flex gap-4">
        {Array.from({ length: clicksPerBar }, (_, i) => {
          const active = status.beatInBar === i + 1
          const color = !active ? 'bg-gray-200' : i === 0 ? 'bg-red-500' : 'bg-gray-800'
          return <span key={i} className={`inline-block h-8 w-8 rounded-full ${color}`} />
        })}
      </div>

      <button className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100" onClick={onStop}>
        Stop (Esc)
      </button>
    </div>
  )
}
