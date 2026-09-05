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
  // Which staves to draw, by index from the top (track 0 = top staff, track 1
  // = bottom), so the score mirrors the piano roll's hand selection. Omit, or
  // pass indexes that don't exist in the file, and every staff is drawn.
  visibleStaves?: number[]
}

export default function ScoreView({ score, positionBeat, zoom, maxHeight, visibleStaves }: Props) {
  const scrollBox = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLDivElement>(null)
  const osmd = useRef<OpenSheetMusicDisplay | null>(null)
  const steps = useRef<Step[]>([])
  const lastScrolledTop = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Ink colour follows the OS theme (the page background stays transparent so
  // the card shows through); reload the score if the theme changes mid-session.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

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
      defaultColorMusic: dark ? '#f4f4f5' : '#18181b',
      followCursor: false,
      cursorsOptions: [{ type: CursorType.Standard, color: '#000000', alpha: 0, follow: false }],
    })
    instance.zoom = zoom
    // Every bar the same width (the widest one), so the playhead moves at a
    // steady speed instead of racing through bars with few notes.
    instance.EngravingRules.FixedMeasureWidth = true
    instance
      .load(new Blob([decodeScoreFile(score.base64).buffer as ArrayBuffer]))
      .then(() => {
        if (cancelled) return
        applyStaffVisibility(instance, visibleStaves)
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
  }, [score.base64, dark]) // only reload when the file or theme changes; zoom and position are handled below

  const staffKey = visibleStaves?.join(',') ?? 'all'
  useEffect(() => {
    const instance = osmd.current
    if (!instance || !ready) return
    const changed = applyStaffVisibility(instance, visibleStaves) || instance.zoom !== zoom
    if (!changed) return
    instance.zoom = zoom
    instance.render()
    steps.current = collectSteps(instance) // pixel positions changed
    lastScrolledTop.current = null
  }, [zoom, staffKey, ready]) // eslint-free: staffKey stands in for the visibleStaves array

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
      {!ready && !error && <p className="text-sm text-ink-muted">Loading score…</p>}
      <div className="relative">
        <div ref={container} className="w-full" />
        <div ref={line} className="pointer-events-none absolute w-0.5 bg-red-500 opacity-70" style={{ display: 'none' }} />
      </div>
    </div>
  )
}

// Each measure's opening instructions (clef, key, time) per staff, as read
// from the file, so they can be reordered for hidden staves and put back.
const originalOpeningInstructions = new WeakMap<object, unknown[]>()

// Show only the requested staves; returns whether anything changed. Falls
// back to showing everything when the request matches no staff at all.
function applyStaffVisibility(instance: OpenSheetMusicDisplay, visibleStaves: number[] | undefined): boolean {
  const staves = instance.Sheet.Staves
  const requested = visibleStaves?.filter((index) => index < staves.length) ?? []
  const wanted = (index: number) => requested.length === 0 || requested.includes(index)
  let changed = false
  staves.forEach((staff, index) => {
    if (staff.Visible !== wanted(index)) {
      staff.Visible = wanted(index)
      changed = true
    }
  })
  if (!changed) return false

  // OSMD 2.1 draws the clef at the start of a system from the opening
  // instructions at the *visible* staff index, while it positions notes by the
  // staff's own clef. With the top staff hidden that puts a treble clef on the
  // bass staff. Reordering the instructions into visible order fixes the
  // glyph without touching note placement (verified by measuring the SVG).
  const order = staves.map((_, index) => index).sort((a, b) => Number(!wanted(a)) - Number(!wanted(b)))
  for (const measure of instance.Sheet.SourceMeasures) {
    const entries = measure.FirstInstructionsStaffEntries
    if (!entries || entries.length === 0) continue
    const original = originalOpeningInstructions.get(measure) ?? [...entries]
    originalOpeningInstructions.set(measure, original)
    order.forEach((absolute, position) => {
      entries[position] = original[absolute] as (typeof entries)[number]
    })
  }
  return true
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
    const measure = instance.GraphicSheet.MeasureList[measureIndex]?.find((each) => each) // first drawn staff; hidden ones are gaps
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
