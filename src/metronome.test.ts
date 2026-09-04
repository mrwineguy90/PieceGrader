import { describe, expect, it } from 'vitest'
import { audioTimeToPerformanceMs } from './metronome'

describe('audioTimeToPerformanceMs', () => {
  it('maps an audio-clock time onto the performance.now() clock via the anchor', () => {
    // Audio context had been running 2.5 s when the page clock read 10 000 ms.
    const anchor = { contextTime: 2.5, performanceTime: 10_000 }
    expect(audioTimeToPerformanceMs(anchor, 2.5)).toBe(10_000)
    expect(audioTimeToPerformanceMs(anchor, 3.0)).toBe(10_500)
    expect(audioTimeToPerformanceMs(anchor, 2.0)).toBe(9_500)
  })
})
