// Renders a piece's attached MusicXML as notation with OpenSheetMusicDisplay
// and draws a playhead that glides through it in time with the session.
//
// How the playhead knows where to go: after rendering, OSMD's own cursor is
// stepped through the whole score once (hidden from the user by the end) and
// each step's beat and pixel position are remembered. During a session the
// line sits on the last step at or before the current beat and slides toward
// the next step, or toward the barline when the next step starts a new bar,
// so it never leaps across a line break early. This assumes the .mid and the
// MusicXML came from the same MuseScore file (same bars, repeats removed).

import { CursorType, OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { useEffect, useRef, useState } from 'react'
import { decodeScoreFile } from './pieces'
import type { PieceScore } from './types'

const OSMD_PX_PER_UNIT = 10 // OSMD lays out in its own units; 10 px each at zoom 1
const CURSOR_HALF_WIDTH_UNITS = 1.5 // the standard cursor is a 3-unit box centred on the note
const SCROLL_MARGIN_PX = 40

interface Step {
  beat: number // quarter notes from the start of the score
  x: number // px, note centre
  top: number // px, top of the system
  height: number // px, height of the system
  measureIndex: number
  measureRight: number // px, right edge of the bar this step is in
}

interface Props {
  score: PieceScore
  positionBeat?: number // quarter notes from the start of the piece; omit for a static preview
  zoom: number // 1 = OSMD's default size
  maxHeight: string // CSS length; the score scrolls inside this
}

export default function ScoreView({ score, positionBeat, zoom, maxHeight }: Props) {
  const scrollBox = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLDivElement>(null)
  const osmd = useRef<OpenSheetMusicDisplay | null>(null)
  const steps = useRef<Step[]>([])
  const lastScrolledTop = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return
    let cancelled = false
    setReady(false)
    setError(null)
    const instance = new OpenSheetMusicDisplay(element, {
      autoResize: true,
      drawTitle: false,
      drawPartNames: false,
      autoBeam: true, // generated drill notation carries no beams; real scores keep their own
      followCursor: false,
      cursorsOptions: [{ type: CursorType.Standard, color: '#000000', alpha: 0, follow: false }],
    })
    instance.zoom = zoom
    instance
      .load(new Blob([decodeScoreFile(score.base64).buffer as ArrayBuffer]))
      .then(() => {
        if (cancelled) return
        instance.render()
        steps.current = collectSteps(instance)
        lastScrolledTop.current = null
        osmd.current = instance
        setReady(true)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not read the score file.')
      })
    return () => {
      cancelled = true
      osmd.current = null
      instance.clear()
    }
  }, [score.base64]) // only reload when the file changes; zoom and position are handled below

  useEffect(() => {
    const instance = osmd.current
    if (!instance || !ready || instance.zoom === zoom) return
    instance.zoom = zoom
    instance.render()
    steps.current = collectSteps(instance) // pixel positions changed
    lastScrolledTop.current = null
  }, [zoom, ready])

  // Move the line directly in the DOM: this runs every animation frame.
  useEffect(() => {
    const marker = line.current
    const box = scrollBox.current
    if (!marker || !box || !ready || positionBeat === undefined) return
    const place = linePosition(steps.current, positionBeat)
    if (!place) return
    marker.style.display = ''
    marker.style.left = `${place.x}px`
    marker.style.top = `${place.top}px`
    marker.style.height = `${place.height}px`
    if (place.top !== lastScrolledTop.current) {
      lastScrolledTop.current = place.top
      box.scrollTo({ top: Math.max(0, place.top - SCROLL_MARGIN_PX), behavior: 'smooth' })
    }
  }, [positionBeat, ready])

  return (
    <div ref={scrollBox} className="overflow-y-auto" style={{ maxHeight }}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!ready && !error && <p className="text-sm text-gray-500">Loading score…</p>}
      <div className="relative">
        <div ref={container} className="w-full" />
        <div ref={line} className="pointer-events-none absolute w-0.5 bg-red-500 opacity-70" style={{ display: 'none' }} />
      </div>
    </div>
  )
}

// Walk OSMD's cursor front to back, reading where it lands each step. The
// cursor only positions itself while shown, so show it (fully transparent)
// and hide it again after.
function collectSteps(instance: OpenSheetMusicDisplay): Step[] {
  const { cursor, zoom } = instance
  const pxPerUnit = OSMD_PX_PER_UNIT * zoom
  const collected: Step[] = []
  cursor.show()
  cursor.reset()
  while (!cursor.iterator.EndReached) {
    const element = cursor.cursorElement
    const measureIndex = cursor.iterator.CurrentMeasureIndex
    const measure = instance.GraphicSheet.MeasureList[measureIndex]?.[0]
    const measureBox = measure?.PositionAndShape
    const x = parseFloat(element.style.left) + CURSOR_HALF_WIDTH_UNITS * pxPerUnit
    // Vertical extent from the layout, not from the cursor image: its height
    // attribute is not reliable on the first pass after rendering.
    const staffLines = measure?.ParentMusicSystem?.StaffLines ?? []
    const firstStaff = staffLines[0]?.PositionAndShape.AbsolutePosition
    const lastStaff = staffLines[staffLines.length - 1]
    const top = firstStaff ? firstStaff.y * pxPerUnit : parseFloat(element.style.top)
    const bottom = lastStaff ? (lastStaff.PositionAndShape.AbsolutePosition.y + lastStaff.StaffHeight) * pxPerUnit : top + 4 * pxPerUnit
    collected.push({
      beat: cursor.iterator.CurrentEnrolledTimestamp.RealValue * 4, // whole notes → quarters
      x,
      top,
      height: bottom - top,
      measureIndex,
      measureRight: measureBox ? (measureBox.AbsolutePosition.x + measureBox.Size.width) * pxPerUnit : x,
    })
    cursor.next()
  }
  cursor.reset()
  cursor.hide()
  return collected
}

function linePosition(steps: Step[], beat: number): { x: number; top: number; height: number } | null {
  if (steps.length === 0) return null
  let index = 0
  while (index + 1 < steps.length && steps[index + 1].beat <= beat) index += 1
  const step = steps[index]
  const next = steps[index + 1]
  if (!next) return step // hold on the last note
  const span = next.beat - step.beat
  const fraction = span <= 0 ? 0 : Math.min(1, (beat - step.beat) / span)
  const targetX = next.measureIndex === step.measureIndex ? next.x : step.measureRight
  return { x: step.x + fraction * (targetX - step.x), top: step.top, height: step.height }
}
