// History (spec §8): per piece, the list of saved passes and a line chart of
// pitch accuracy and on-time percentage over time. No achievements, no streaks.

import { useState } from 'react'
import { bpmLabel } from './pieces'
import type { Performance, Piece } from './types'

const CHART_WIDTH = 720
const CHART_HEIGHT = 220
const CHART_PADDING = { top: 12, right: 16, bottom: 28, left: 40 }
const PITCH_COLOR = '#2563eb'
const TIMING_COLOR = '#d97706'

interface Props {
  pieces: Piece[]
  performances: Performance[]
  onDelete: (id: string) => void
}

export default function HistoryScreen({ pieces, performances, onDelete }: Props) {
  const firstWithHistory = pieces.find((piece) => performances.some((p) => p.pieceId === piece.id)) ?? pieces[0]
  const [pieceId, setPieceId] = useState<string | null>(firstWithHistory?.id ?? null)
  const piece = pieces.find((each) => each.id === pieceId) ?? null
  const history = performances.filter((p) => p.pieceId === pieceId) // oldest first, as stored

  if (pieces.length === 0) return <p className="mt-6 text-sm text-gray-500">No pieces yet.</p>

  return (
    <div className="mt-6">
      <label className="text-sm">
        Piece{' '}
        <select className="rounded border border-gray-300 px-2 py-1" value={pieceId ?? ''} onChange={(e) => setPieceId(e.target.value)}>
          {pieces.map((each) => (
            <option key={each.id} value={each.id}>
              {each.title}
            </option>
          ))}
        </select>
      </label>

      {piece && history.length === 0 && <p className="mt-4 text-sm text-gray-500">No performances of this piece yet.</p>}

      {piece && history.length > 0 && (
        <>
          <TrendChart history={history} />
          <table className="mt-4 text-sm tabular-nums">
            <thead className="text-left text-gray-500">
              <tr>
                {['When', 'Tempo', 'Bars', 'Tracks', 'Pitch', 'On time', 'Wrong', 'Missed', 'Extra', ''].map((heading, index) => (
                  <th key={index} className="pr-4 font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((p) => (
                <tr key={p.id}>
                  <td className="pr-4">{new Date(p.playedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="pr-4">{bpmLabel(p.bpm, piece.timeSignature)}</td>
                  <td className="pr-4">
                    {p.barRange[0]}–{p.barRange[1]}
                  </td>
                  <td className="pr-4">{p.tracksIncluded.map((track) => piece.trackNames[track] ?? `Track ${track + 1}`).join(', ')}</td>
                  <td className="pr-4">{percent(p.score.pitchAccuracy)}</td>
                  <td className="pr-4">{p.score.timing.count ? percent(p.score.timing.onTime) : '–'}</td>
                  <td className="pr-4">{p.score.wrong}</td>
                  <td className="pr-4">{p.score.missed}</td>
                  <td className="pr-4">{p.score.extra}</td>
                  <td>
                    <button className="text-red-600 hover:underline" onClick={() => onDelete(p.id)}>
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// Two lines on one 0–100% axis, oldest on the left. Each point carries a
// tooltip with its date and values.
function TrendChart({ history }: { history: Performance[] }) {
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  const xFor = (index: number) => CHART_PADDING.left + (history.length === 1 ? plotWidth / 2 : (index / (history.length - 1)) * plotWidth)
  const yFor = (fraction: number) => CHART_PADDING.top + (1 - fraction) * plotHeight
  const series = [
    { label: 'Pitch accuracy', color: PITCH_COLOR, value: (p: Performance) => p.score.pitchAccuracy },
    { label: 'On time', color: TIMING_COLOR, value: (p: Performance) => p.score.timing.onTime },
  ]

  return (
    <div className="mt-4">
      <div className="flex gap-6 text-sm text-gray-600">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg width={CHART_WIDTH} height={CHART_HEIGHT} className="mt-1 block">
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <line x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={yFor(fraction)} y2={yFor(fraction)} stroke="#e5e7eb" />
              <text x={CHART_PADDING.left - 6} y={yFor(fraction) + 4} fontSize={11} textAnchor="end" fill="#6b7280">
                {fraction * 100}%
              </text>
            </g>
          ))}
          <text x={CHART_PADDING.left} y={CHART_HEIGHT - 8} fontSize={11} fill="#6b7280">
            oldest
          </text>
          <text x={CHART_WIDTH - CHART_PADDING.right} y={CHART_HEIGHT - 8} fontSize={11} textAnchor="end" fill="#6b7280">
            latest
          </text>
          {series.map((s) => (
            <g key={s.label}>
              {history.length > 1 && (
                <polyline
                  points={history.map((p, index) => `${xFor(index)},${yFor(s.value(p))}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                />
              )}
              {history.map((p, index) => (
                <circle key={p.id} cx={xFor(index)} cy={yFor(s.value(p))} r={4} fill={s.color} stroke="#ffffff" strokeWidth={2}>
                  <title>
                    {new Date(p.playedAt).toLocaleString()}: {s.label} {percent(s.value(p))}
                  </title>
                </circle>
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}
