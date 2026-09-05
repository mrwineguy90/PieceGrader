// Drills (drills-spec.md): the picker first, then a preview, then the
// progression ladder. Choose family, variant, key, hands, octaves, notes per
// click and tempo, or click a ladder step to load it; the generated piece
// goes to the same session as an imported one.

import { useEffect, useMemo, useState } from 'react'
import { drillTitle, FAMILIES, keysFor, parseDrillId, type DrillSpec, type Family, type Hands } from './drillCatalog'
import { drillToPiece, generateDrill } from './drills'
import { nextStep, type LadderStep } from './ladder'
import LadderView from './LadderView'
import PiecePreview from './PiecePreview'
import { barCount } from './pieces'
import { keyLabel } from './pitches'
import type { Playback } from './playback'
import { referenceNotesInRange, type SessionConfig } from './sessionConfig'
import type { Performance } from './types'

const MIN_BPM = 30
const MAX_BPM = 240
const HANDS: { id: Hands; label: string }[] = [
  { id: 'right', label: 'Right hand' },
  { id: 'left', label: 'Left hand' },
  { id: 'both', label: 'Hands together' },
]

interface Props {
  performances: Performance[]
  playback: Playback
  onStartSession: (config: SessionConfig) => void
}

export default function DrillsScreen({ performances, playback, onStartSession }: Props) {
  const [spec, setSpec] = useState<DrillSpec>({ family: 'scale', variant: 'major', key: 'C', hands: 'right', octaves: 1, notesPerClick: 1 })
  const [bpm, setBpm] = useState(60)
  const [waitForKey, setWaitForKey] = useState(true)
  const family = FAMILIES[spec.family]
  const drill = useMemo(() => generateDrill(spec), [spec])
  const piece = useMemo(() => drillToPiece(drill), [drill])
  const next = nextStep(performances)

  // Changing family or variant can change which key list applies; keep the
  // key valid by falling back to the same position in the new list.
  const update = (changes: Partial<DrillSpec>) => {
    const nextSpec = { ...spec, ...changes }
    if (changes.family) nextSpec.variant = FAMILIES[nextSpec.family].variants[0].id
    const keys = keysFor(nextSpec)
    if (!keys.includes(nextSpec.key)) nextSpec.key = keys[keysFor(spec).indexOf(spec.key)] ?? keys[0]
    setSpec(nextSpec)
  }

  const pickStep = (step: LadderStep) => {
    const stepSpec = parseDrillId(step.id)
    if (!stepSpec) return
    setSpec(stepSpec)
    setBpm(step.bpm)
  }

  // Track 0 is the right hand, track 1 the left; the preview and the session show only the chosen hands.
  const tracks = spec.hands === 'right' ? [0] : spec.hands === 'left' ? [1] : [0, 1]
  const config = (loop: boolean): SessionConfig => ({ piece, tracks, bpm, barRange: [1, barCount(piece)], loop, waitForKey })
  const start = (loop: boolean) => onStartSession(config(loop))

  const [previewing, setPreviewing] = useState(false)
  const togglePreview = () => {
    if (previewing) {
      playback.stop()
      setPreviewing(false)
      return
    }
    playback.start(referenceNotesInRange(config(false)), bpm, 0, () => setPreviewing(false)) // drills are in 4/4, so clicks are quarters
    setPreviewing(true)
  }
  useEffect(() => {
    playback.stop() // a new drill or tempo ends any preview in progress
    setPreviewing(false)
  }, [playback, piece, bpm])
  useEffect(() => () => playback.stop(), [playback]) // leaving the screen stops the sound

  return (
    <div className="mt-6 space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{piece.title}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {barCount(piece)} {barCount(piece) === 1 ? 'bar' : 'bars'}
              {next && (
                <>
                  {' · next on the ladder: '}
                  <button className="text-accent hover:underline" onClick={() => pickStep(next.step)}>
                    {drillTitle(parseDrillId(next.step.id)!)} · ♩ = {next.step.bpm}
                  </button>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={togglePreview}>
              {previewing ? '■ Stop' : '▶ Preview'}
            </button>
            <button className="btn" onClick={() => start(true)}>
              Loop
            </button>
            <button className="btn btn-primary px-5" onClick={() => start(false)}>
              Practice
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <Field label="Drill">
            <select className="field" value={spec.family} onChange={(e) => update({ family: e.target.value as Family })}>
              {(Object.keys(FAMILIES) as Family[]).map((id) => (
                <option key={id} value={id}>
                  {FAMILIES[id].label}
                </option>
              ))}
            </select>
            <select className="field" value={spec.variant} onChange={(e) => update({ variant: e.target.value })}>
              {family.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Key">
            <select className="field" value={spec.key} onChange={(e) => update({ key: e.target.value })}>
              {keysFor(spec).map((key) => (
                <option key={key} value={key}>
                  {keyLabel(key)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hands">
            <select className="field" value={spec.hands} onChange={(e) => update({ hands: e.target.value as Hands })}>
              {HANDS.map((hands) => (
                <option key={hands.id} value={hands.id}>
                  {hands.label}
                </option>
              ))}
            </select>
          </Field>
          {family.usesOctaves && (
            <Field label="Octaves">
              <select className="field" value={spec.octaves} onChange={(e) => update({ octaves: Number(e.target.value) })}>
                {[1, 2, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {family.usesNotesPerClick && (
            <Field label="Per click">
              <select className="field" value={spec.notesPerClick} onChange={(e) => update({ notesPerClick: Number(e.target.value) })}>
                <option value={1}>quarters</option>
                <option value={2}>eighths</option>
                <option value={4}>sixteenths</option>
              </select>
            </Field>
          )}
          <Field label="Tempo">
            <button className="btn" onClick={() => setBpm(Math.max(MIN_BPM, bpm - 5))}>
              −5
            </button>
            <span className="w-20 text-center text-xl tabular-nums">♩ = {bpm}</span>
            <button className="btn" onClick={() => setBpm(Math.min(MAX_BPM, bpm + 5))}>
              +5
            </button>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={waitForKey} onChange={(e) => setWaitForKey(e.target.checked)} />
            Wait for a key press before the count-in
          </label>
        </div>
      </div>

      <PiecePreview piece={piece} includedTracks={tracks} positionBeat={previewing ? (nowMs) => playback.positionBeat(nowMs) : undefined} />

      <LadderView performances={performances} selectedId={drill.id} onPick={pickStep} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 flex items-center gap-2">{children}</div>
    </div>
  )
}
