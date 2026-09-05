// History (spec §8): a recent-activity strip, then a filterable sidebar with
// one entry per piece or per drill (a drill's hands / octaves / note value
// are variants of the same entry), and a detail view for the chosen entry:
// variant chips, the trend chart and the attempts for the chosen variant.
// All of it is a view over the saved performances; nothing extra is stored.

import { useState } from 'react'
import { drillBaseId, drillBaseTitle, drillVariantLabel, FAMILIES, parseDrillId } from './drillCatalog'
import { meetsPassMark } from './ladder'
import { bpmLabel } from './pieces'
import TrendChart, { percent } from './TrendChart'
import type { Performance, Piece } from './types'

const RECENT_DAYS = 7
const RECENT_ROWS = 8

interface Entry {
  id: string
  title: string
  group: string // 'Pieces' or a drill family label
  timeSignature: [number, number]
  performances: Performance[] // oldest first
}

interface Variant {
  key: string
  label: string
  performances: Performance[]
}

interface Props {
  pieces: Piece[]
  performances: Performance[]
  onDelete: (id: string) => void
}

// One entry per piece, or per drill base ("F♯ harmonic minor scale").
function buildEntries(pieces: Piece[], performances: Performance[]): Entry[] {
  const entries = new Map<string, Entry>()
  for (const p of performances) {
    const spec = parseDrillId(p.pieceId)
    const piece = pieces.find((each) => each.id === p.pieceId)
    const id = spec ? drillBaseId(spec) : p.pieceId
    const entry = entries.get(id) ?? {
      id,
      title: spec ? drillBaseTitle(spec) : (piece?.title ?? 'Deleted piece'),
      group: spec ? FAMILIES[spec.family].label : 'Pieces',
      timeSignature: piece?.timeSignature ?? [4, 4],
      performances: [],
    }
    entry.performances.push(p)
    entries.set(id, entry)
  }
  return [...entries.values()].sort((a, b) => lastPlayed(b).localeCompare(lastPlayed(a)))
}

const lastPlayed = (entry: Entry) => entry.performances[entry.performances.length - 1].playedAt

// Within an entry: for drills, the hands / octaves / note value; for pieces, the tracks and bars.
function variantsOf(entry: Entry, pieces: Piece[]): Variant[] {
  const variants = new Map<string, Variant>()
  for (const p of entry.performances) {
    const spec = parseDrillId(p.pieceId)
    const piece = pieces.find((each) => each.id === p.pieceId)
    const key = spec ? p.pieceId : `${p.tracksIncluded.join(',')}|${p.barRange.join('-')}`
    const label = spec
      ? drillVariantLabel(spec)
      : `${p.tracksIncluded.map((track) => piece?.trackNames[track] ?? `Track ${track + 1}`).join(' + ')} · bars ${p.barRange[0]}–${p.barRange[1]}`
    const variant = variants.get(key) ?? { key, label, performances: [] }
    variant.performances.push(p)
    variants.set(key, variant)
  }
  return [...variants.values()].sort((a, b) => b.performances[b.performances.length - 1].playedAt.localeCompare(a.performances[a.performances.length - 1].playedAt))
}

const best = (list: Performance[], value: (p: Performance) => number) => Math.max(...list.map(value))
const fastestPass = (list: Performance[]) => list.filter((p) => meetsPassMark(p.score)).reduce((top, p) => Math.max(top, p.bpm), 0)
const dayOf = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

export default function HistoryScreen({ pieces, performances, onDelete }: Props) {
  const entries = buildEntries(pieces, performances)
  const [filter, setFilter] = useState('')
  const [entryId, setEntryId] = useState<string | null>(entries[0]?.id ?? null)
  const [variantKey, setVariantKey] = useState<string | null>(null)
  const entry = entries.find((each) => each.id === entryId) ?? entries[0] ?? null
  const variants = entry ? variantsOf(entry, pieces) : []
  const variant = variants.find((each) => each.key === variantKey) ?? variants[0] ?? null
  const shown = entries.filter((each) => `${each.title} ${each.group}`.toLowerCase().includes(filter.trim().toLowerCase()))
  const groups = ['Pieces', ...Object.values(FAMILIES).map((family) => family.label)].filter((group) => shown.some((each) => each.group === group))

  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000).toISOString()
  const recent = entries
    .flatMap((each) => each.performances.filter((p) => p.playedAt >= cutoff).map((p) => ({ entry: each, day: dayOf(p.playedAt), p })))
    .reduce<{ entry: Entry; day: string; passes: Performance[] }[]>((rows, { entry: each, day, p }) => {
      const row = rows.find((r) => r.entry === each && r.day === day)
      if (row) row.passes.push(p)
      else rows.push({ entry: each, day, passes: [p] })
      return rows
    }, [])
    .sort((a, b) => b.passes[b.passes.length - 1].playedAt.localeCompare(a.passes[a.passes.length - 1].playedAt))
    .slice(0, RECENT_ROWS)

  if (entries.length === 0) {
    return <p className="mt-6 text-sm text-ink-muted">Nothing yet. Every pass of a piece or a drill is saved here once you press Practice.</p>
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="card">
        <div className="label">Last {RECENT_DAYS} days</div>
        <ul className="mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {recent.length === 0 && <li className="text-ink-muted">No practice in the last week.</li>}
          {recent.map((row) => (
            <li key={`${row.entry.id}|${row.day}`} className="flex items-baseline gap-3">
              <span className="w-24 shrink-0 text-ink-muted">{row.day}</span>
              <button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => { setEntryId(row.entry.id); setVariantKey(null) }}>
                {row.entry.title}
              </button>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {row.passes.length} {row.passes.length === 1 ? 'pass' : 'passes'} · best {percent(best(row.passes, (p) => p.score.pitchAccuracy))} /{' '}
                {percent(best(row.passes, (p) => p.score.timing.onTime))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-6">
        <aside className="w-72 shrink-0">
          <input className="field w-full" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {groups.map((group) => (
            <div key={group} className="mt-4">
              <div className="label">{group}</div>
              <ul className="mt-1 space-y-0.5">
                {shown.filter((each) => each.group === group).map((each) => (
                  <li key={each.id}>
                    <button
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-line/60 ${each.id === entry?.id ? 'bg-accent-soft font-medium' : ''}`}
                      onClick={() => { setEntryId(each.id); setVariantKey(null) }}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${each.performances.some((p) => meetsPassMark(p.score)) ? 'bg-green-500' : 'bg-line'}`} />
                        <span className="truncate">{each.title}</span>
                      </span>
                      <span className="block pl-4 text-xs text-ink-muted">
                        {each.performances.length} {each.performances.length === 1 ? 'pass' : 'passes'} · last {dayOf(lastPlayed(each))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {shown.length === 0 && <p className="mt-3 text-sm text-ink-muted">Nothing matches.</p>}
        </aside>

        {entry && variant && (
          <div className="min-w-0 flex-1 space-y-4">
            <div className="card">
              <h2 className="text-lg font-semibold">{entry.title}</h2>
              <div className="mt-3 flex flex-wrap gap-1">
                {variants.map((each) => (
                  <button
                    key={each.key}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${each.key === variant.key ? 'bg-accent text-accent-ink' : 'bg-line/60 text-ink-muted hover:text-ink'}`}
                    onClick={() => setVariantKey(each.key)}
                  >
                    {each.label}
                  </button>
                ))}
              </div>
              <table className="mt-4 text-sm tabular-nums">
                <thead className="text-left text-ink-muted">
                  <tr>
                    {['Variant', 'Passes', 'Best pitch', 'Best on time', 'Fastest pass'].map((heading) => (
                      <th key={heading} className="pr-6 font-normal">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((each) => (
                    <tr key={each.key} className={each.key === variant.key ? 'font-medium' : ''}>
                      <td className="pr-6">{each.label}</td>
                      <td className="pr-6">{each.performances.length}</td>
                      <td className="pr-6">{percent(best(each.performances, (p) => p.score.pitchAccuracy))}</td>
                      <td className="pr-6">{percent(best(each.performances, (p) => p.score.timing.onTime))}</td>
                      <td className="pr-6">{fastestPass(each.performances) ? bpmLabel(fastestPass(each.performances), entry.timeSignature) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="label">{variant.label}</div>
              <div className="mt-3">
                <TrendChart history={variant.performances} />
              </div>
              <table className="mt-4 text-sm tabular-nums">
                <thead className="text-left text-ink-muted">
                  <tr>
                    {['When', 'Tempo', 'Pitch', 'On time', 'Wrong', 'Missed', 'Extra', ''].map((heading, index) => (
                      <th key={index} className="pr-4 font-normal">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...variant.performances].reverse().map((p) => (
                    <tr key={p.id}>
                      <td className="pr-4">{new Date(p.playedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td className="pr-4">{bpmLabel(p.bpm, entry.timeSignature)}</td>
                      <td className="pr-4">{percent(p.score.pitchAccuracy)}</td>
                      <td className="pr-4">{p.score.timing.count ? percent(p.score.timing.onTime) : '–'}</td>
                      <td className="pr-4">{p.score.wrong}</td>
                      <td className="pr-4">{p.score.missed}</td>
                      <td className="pr-4">{p.score.extra}</td>
                      <td>
                        <button className="text-red-600 hover:underline" onClick={() => onDelete(p.id)}>delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
