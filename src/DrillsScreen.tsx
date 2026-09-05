// Drills (drills-spec.md): the progression ladder and the free picker.
// Choose family, variant, key, hands, octaves, notes per click and tempo, or
// click a ladder step to load it; the generated piece goes to the same
// session as an imported one.

import { useMemo, useState } from 'react'
import { FAMILIES, keysFor, parseDrillId, type DrillSpec, type Family, type Hands } from './drillCatalog'
import { drillToPiece, generateDrill } from './drills'
import LadderView from './LadderView'
import type { LadderStep } from './ladder'
import PianoRoll from './PianoRoll'
import { barCount } from './pieces'
import ScoreView from './ScoreView'
import type { Performance } from './types'
import type { SessionConfig } from './useSession'

const MIN_BPM = 30
const MAX_BPM = 240
const PREVIEW_SCORE_ZOOM = 0.6
const HANDS: { id: Hands; label: string }[] = [
  { id: 'right', label: 'Right hand' },
  { id: 'left', label: 'Left hand' },
  { id: 'both', label: 'Hands together' },
]

interface Props {
  performances: Performance[]
  onStartSession: (config: SessionConfig) => void
}

export default function DrillsScreen({ performances, onStartSession }: Props) {
  const [spec, setSpec] = useState<DrillSpec>({ family: 'scale', variant: 'major', key: 'C', hands: 'right', octaves: 1, notesPerClick: 1 })
  const [bpm, setBpm] = useState(60)
  const [pixelsPerBeat, setPixelsPerBeat] = useState(30)
  const family = FAMILIES[spec.family]
  const drill = useMemo(() => generateDrill(spec), [spec])
  const piece = useMemo(() => drillToPiece(drill), [drill])

  // Changing family or variant can change which key list applies; keep the
  // key valid by falling back to the same position in the new list.
  const update = (changes: Partial<DrillSpec>) => {
    const next = { ...spec, ...changes }
    if (changes.family) next.variant = FAMILIES[next.family].variants[0].id
    const keys = keysFor(next)
    if (!keys.includes(next.key)) next.key = keys[keysFor(spec).indexOf(spec.key)] ?? keys[0]
    setSpec(next)
  }

  const pickStep = (step: LadderStep) => {
    const stepSpec = parseDrillId(step.id)
    if (!stepSpec) return
    setSpec(stepSpec)
    setBpm(step.bpm)
  }

  const start = (loop: boolean) => onStartSession({ piece, tracks: [0, 1], bpm, barRange: [1, barCount(piece)], loop })

  return (
    <div className="mt-6 space-y-4">
      <LadderView performances={performances} onPick={pickStep} />

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Drill
          <select className={selectClass} value={spec.family} onChange={(e) => update({ family: e.target.value as Family })}>
            {(Object.keys(FAMILIES) as Family[]).map((id) => (
              <option key={id} value={id}>
                {FAMILIES[id].label}
              </option>
            ))}
          </select>
        </label>
        <select className={selectClass} value={spec.variant} onChange={(e) => update({ variant: e.target.value })}>
          {family.variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          Key
          <select className={selectClass} value={spec.key} onChange={(e) => update({ key: e.target.value })}>
            {keysFor(spec).map((key) => (
              <option key={key} value={key}>
                {key.replace('#', '♯').replace('b', '♭')}
              </option>
            ))}
          </select>
        </label>
        <select className={selectClass} value={spec.hands} onChange={(e) => update({ hands: e.target.value as Hands })}>
          {HANDS.map((hands) => (
            <option key={hands.id} value={hands.id}>
              {hands.label}
            </option>
          ))}
        </select>
        {family.usesOctaves && (
          <label className="flex items-center gap-2">
            Octaves
            <select className={selectClass} value={spec.octaves} onChange={(e) => update({ octaves: Number(e.target.value) })}>
              {[1, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {family.usesNotesPerClick && (
          <label className="flex items-center gap-2">
            Per click
            <select className={selectClass} value={spec.notesPerClick} onChange={(e) => update({ notesPerClick: Number(e.target.value) })}>
              <option value={1}>quarters</option>
              <option value={2}>eighths</option>
              <option value={4}>sixteenths</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className={buttonClass} onClick={() => setBpm(Math.max(MIN_BPM, bpm - 5))}>
          −5
        </button>
        <span className="w-24 text-center text-xl tabular-nums">♩ = {bpm}</span>
        <button className={buttonClass} onClick={() => setBpm(Math.min(MAX_BPM, bpm + 5))}>
          +5
        </button>
        <button className={`${buttonClass} ml-6 bg-green-100 font-medium`} onClick={() => start(false)}>
          Practice
        </button>
        <button className={buttonClass} onClick={() => start(true)}>
          Loop
        </button>
        <span className="ml-4 text-sm text-gray-500">
          {piece.title} · {barCount(piece)} {barCount(piece) === 1 ? 'bar' : 'bars'}
        </span>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        Zoom
        <input type="range" min={8} max={80} value={pixelsPerBeat} onChange={(e) => setPixelsPerBeat(Number(e.target.value))} />
      </label>
      <PianoRoll piece={piece} includedTracks={[0, 1]} pixelsPerBeat={pixelsPerBeat} />
      {piece.score && (
        <div className="rounded border border-gray-300 p-2">
          <ScoreView score={piece.score} zoom={PREVIEW_SCORE_ZOOM} maxHeight="45vh" />
        </div>
      )}
    </div>
  )
}

const selectClass = 'rounded border border-gray-300 px-2 py-1'
const buttonClass = 'rounded border border-gray-300 px-3 py-1 hover:bg-gray-100'
