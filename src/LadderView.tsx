// The progression ladder on the Drills tab: next step, then each level with
// its steps and their status. Locked levels show only a one-line note.
// Clicking a step loads it into the picker.

import { useState } from 'react'
import { drillTitle, parseDrillId } from './drillCatalog'
import { isLevelOpen, LADDER, nextStep, PASS_ON_TIME, PASS_PITCH, passedCount, stepStatus, type LadderStep, type StepStatus } from './ladder'
import type { Performance } from './types'

const STATUS_COLORS: Record<StepStatus, string> = { passed: 'bg-green-500', tried: 'bg-yellow-400', untried: 'bg-gray-300' }

interface Props {
  performances: Performance[]
  onPick: (step: LadderStep) => void
}

export default function LadderView({ performances, onPick }: Props) {
  const next = nextStep(performances)
  const [openLevel, setOpenLevel] = useState<number | null>(next?.levelIndex ?? 0)
  const label = (step: LadderStep) => `${drillTitle(parseDrillId(step.id)!)} · ♩ = ${step.bpm}`

  return (
    <div className="rounded border border-gray-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Progression</h2>
        <span className="text-xs text-gray-500">
          A step passes at {Math.round(PASS_PITCH * 100)}% pitch and {Math.round(PASS_ON_TIME * 100)}% on time, at or above its tempo.
        </span>
      </div>

      {next ? (
        <p className="mt-2 text-sm">
          Next up: <span className="font-medium">{label(next.step)}</span>{' '}
          <button className="ml-2 rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100" onClick={() => onPick(next.step)}>
            Load
          </button>
        </p>
      ) : (
        <p className="mt-2 text-sm text-green-700">Every step passed.</p>
      )}

      <ul className="mt-3 space-y-1">
        {LADDER.map((level, levelIndex) => {
          const open = isLevelOpen(levelIndex, performances)
          const passed = passedCount(level, performances)
          if (!open) {
            return (
              <li key={level.name} className="text-sm text-gray-400">
                {level.name} · locked until {LADDER[level.opensAfter].name} is complete
              </li>
            )
          }
          const expanded = openLevel === levelIndex
          return (
            <li key={level.name} className="text-sm">
              <button className="flex w-full items-baseline gap-3 rounded px-1 py-0.5 text-left hover:bg-gray-100" onClick={() => setOpenLevel(expanded ? null : levelIndex)}>
                <span className="font-medium">{level.name}</span>
                <span className="text-gray-500">{level.description}</span>
                <span className="ml-auto tabular-nums text-gray-500">
                  {passed} / {level.steps.length}
                </span>
              </button>
              {expanded && (
                <ul className="mt-1 grid gap-x-6 gap-y-0.5 pl-3 sm:grid-cols-2">
                  {level.steps.map((step) => {
                    const status = stepStatus(step, performances)
                    const isNext = next?.step.id === step.id && next.step.bpm === step.bpm
                    return (
                      <li key={step.id}>
                        <button
                          className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-gray-100 ${isNext ? 'bg-blue-50' : ''}`}
                          onClick={() => onPick(step)}
                        >
                          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLORS[status]}`} />
                          <span className={status === 'passed' ? 'text-gray-500' : ''}>{label(step)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
