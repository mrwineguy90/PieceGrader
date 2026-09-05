import { describe, expect, it } from 'vitest'
import { parseDrillId } from './drillCatalog'
import { generateDrill } from './drills'
import { isLevelOpen, LADDER, meetsPassMark, nextStep, passedCount, stepStatus, type LadderStep } from './ladder'
import type { Performance } from './types'

function performance(step: LadderStep, bpm: number, pitchAccuracy: number, onTime: number): Performance {
  return {
    id: crypto.randomUUID(),
    pieceId: step.id,
    playedAt: '2026-09-04T10:00:00Z',
    bpm,
    tracksIncluded: [0, 1],
    barRange: [1, 4],
    played: [],
    score: {
      referenceCount: 20,
      correct: Math.round(20 * pitchAccuracy),
      wrong: 0,
      missed: 0,
      extra: 0,
      pitchAccuracy,
      timing: { count: 20, onTime, close: 1, meanAbsDeviationMs: 30, meanDeviationMs: 0, evennessMs: 10 },
      bars: [],
    },
  }
}

const passAll = (level: number) => LADDER[level].steps.map((step) => performance(step, step.bpm, 1, 1))

describe('ladder', () => {
  it('has five levels whose steps are all valid drills', () => {
    expect(LADDER.map((level) => level.name)).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Extras'])
    for (const level of LADDER) {
      expect(level.steps.length).toBeGreaterThan(0)
      for (const step of level.steps) {
        const spec = parseDrillId(step.id)
        expect(spec).not.toBeNull()
        expect(generateDrill(spec!).notes.length).toBeGreaterThan(0)
      }
    }
  })

  it('passes a step only at or above the target tempo with both thresholds met', () => {
    const step = LADDER[0].steps[0]
    expect(stepStatus(step, [])).toBe('untried')
    expect(stepStatus(step, [performance(step, 60, 0.9, 1)])).toBe('tried') // pitch too low
    expect(stepStatus(step, [performance(step, 60, 1, 0.7)])).toBe('tried') // timing too low
    expect(stepStatus(step, [performance(step, 50, 1, 1)])).toBe('tried') // too slow
    expect(stepStatus(step, [performance(step, 60, 0.95, 0.8)])).toBe('passed')
    expect(stepStatus(step, [performance(step, 80, 1, 1)])).toBe('passed') // faster counts
    expect(meetsPassMark(performance(step, 60, 0.95, 0.8).score)).toBe(true)
  })

  it('opens levels in order and the extras with level 3', () => {
    expect(isLevelOpen(0, [])).toBe(true)
    expect(isLevelOpen(1, [])).toBe(false)
    const afterLevel1 = passAll(0)
    expect(isLevelOpen(1, afterLevel1)).toBe(true)
    expect(isLevelOpen(2, afterLevel1)).toBe(false)
    expect(isLevelOpen(4, afterLevel1)).toBe(false)
    const afterLevel3 = [...passAll(0), ...passAll(1), ...passAll(2)]
    expect(isLevelOpen(3, afterLevel3)).toBe(true)
    expect(isLevelOpen(4, afterLevel3)).toBe(true)
    expect(passedCount(LADDER[2], afterLevel3)).toBe(LADDER[2].steps.length)
  })

  it('suggests the first unpassed step of the first open incomplete level', () => {
    expect(nextStep([])).toEqual({ levelIndex: 0, step: LADDER[0].steps[0] })
    const first = LADDER[0].steps[0]
    expect(nextStep([performance(first, 60, 1, 1)])).toEqual({ levelIndex: 0, step: LADDER[0].steps[1] })
    expect(nextStep(passAll(0))).toEqual({ levelIndex: 1, step: LADDER[1].steps[0] })
  })
})
