// The progression ladder on the Drills tab: each level with a progress bar,
// its steps grouped by drill so the keys read as a row of chips, and the
// next step highlighted. Locked levels show only a one-line note. Clicking
// a chip loads that step into the picker.

import { useState } from 'react'
import { drillTitle, parseDrillId, type DrillSpec } from './drillCatalog'
import { isLevelOpen, LADDER, nextStep, PASS_ON_TIME, PASS_PITCH, passedCount, stepStatus, type LadderLevel, type LadderStep, type StepStatus } from './ladder'
import { keyLabel } from './pitches'
import type { Performance } from './types'

const CHIP_COLORS: Record<StepStatus, string> = {
  passed: 'bg-green-500/15 text-green-700 dark:text-green-400',
  tried: 'bg-yellow-400/20 text-yellow-700 dark:text-yellow-300',
  untried: 'bg-line/60 text-ink-muted',
}

interface Props {
  performances: Performance[]
  selectedId: string // the drill currently loaded in the picker; its chip is filled with the accent
  onPick: (step: LadderStep) => void
}

// Steps that differ only by key (or Hanon number) sit on one row.
interface Group {
  title: string
  steps: { step: LadderStep; chip: string }[]
}

function groupSteps(level: LadderLevel): Group[] {
  const groups = new Map<string, Group>()
  for (const step of level.steps) {
    const spec = parseDrillId(step.id)!
    const isHanon = spec.family === 'hanon'
    const title = `${drillTitle(spec).replace(isHanon ? /No\. \d+ · / : `${keyLabel(spec.key)} `, '')} · ♩ = ${step.bpm}`
    const chip = isHanon ? `No. ${spec.variant}` : keyLabel(spec.key)
    const group = groups.get(title) ?? { title, steps: [] }
    group.steps.push({ step, chip })
    groups.set(title, group)
  }
  return [...groups.values()]
}

export default function LadderView({ performances, selectedId, onPick }: Props) {
  const next = nextStep(performances)
  const [openLevel, setOpenLevel] = useState<number | null>(next?.levelIndex ?? 0)

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Progression</h2>
        <span className="text-xs text-ink-muted">
          A step passes at {Math.round(PASS_PITCH * 100)}% pitch and {Math.round(PASS_ON_TIME * 100)}% on time, at or above its tempo.
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">Chips: gray not tried, yellow tried, green passed. Ring = next step. Solid = loaded in the picker.</p>
      {!next && <p className="mt-2 text-sm text-green-700">Every step passed.</p>}

      <ul className="mt-3 space-y-2">
        {LADDER.map((level, levelIndex) => {
          const open = isLevelOpen(levelIndex, performances)
          const passed = passedCount(level, performances)
          if (!open) {
            return (
              <li key={level.name} className="text-sm text-ink-muted/70">
                {level.name} · locked until {LADDER[level.opensAfter].name} is complete
              </li>
            )
          }
          const expanded = openLevel === levelIndex
          return (
            <li key={level.name}>
              <button className="flex w-full items-center gap-3 rounded-md px-1 py-1 text-left text-sm hover:bg-line/60" onClick={() => setOpenLevel(expanded ? null : levelIndex)}>
                <span className="w-16 shrink-0 font-medium">{level.name}</span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">{level.description}</span>
                <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-green-500" style={{ width: `${(passed / level.steps.length) * 100}%` }} />
                </span>
                <span className="w-14 shrink-0 text-right tabular-nums text-ink-muted">
                  {passed}/{level.steps.length}
                </span>
              </button>
              {expanded && (
                <ul className="mt-1 space-y-1.5 pl-1">
                  {groupSteps(level).map((group) => (
                    <li key={group.title} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="inline-block w-[26rem] shrink-0 text-ink-muted first-letter:uppercase">{group.title}</span>
                      <span className="flex flex-wrap gap-1">
                        {group.steps.map(({ step, chip }) => {
                          const status = stepStatus(step, performances)
                          const isNext = next?.step.id === step.id // ring = suggested next step
                          const isLoaded = step.id === selectedId // solid = what the picker holds now
                          return (
                            <button
                              key={step.id}
                              title={drillTitle(parseDrillId(step.id) as DrillSpec)}
                              className={`rounded px-2 py-0.5 text-xs font-medium ${isLoaded ? 'bg-accent text-accent-ink' : CHIP_COLORS[status]} ${isNext ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface-raised' : ''}`}
                              onClick={() => onPick(step)}
                            >
                              {chip}
                            </button>
                          )
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
