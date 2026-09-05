// Renders a piece's attached MusicXML as notation with OpenSheetMusicDisplay
// and draws a playhead that sweeps through it in time with the session.
//
// How the playhead knows where to go: after rendering, every bar's note area
// (left and right edge in pixels, top and height of its system) and its
// beat range are read from OSMD's layout. Bars are laid out at equal width,
// so the line moves across each bar at a constant speed by beat: steady by
// construction, and close to the noteheads. It is moved straight from an
// animation frame loop with a transform, never through React state, so a
// busy frame cannot make it stutter. Assumes the .mid and the MusicXML came
// from the same MuseScore file (same bars, repeats removed).

import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { useEffect, useRef, useState } from 'react'
import { decodeScoreFile } from './pieces'
import type { PieceScore } from './types'

const OSMD_PX_PER_UNIT = 10 // OSMD lays out in its own units; 10 px each at zoom 1
const SCROLL_MARGIN_PX = 40

interface Bar {
  startBeat: number // quarter notes from the start of the score
  beats: number
  left: number // px, where notes begin (after clef / key / time signature)
  right: number // px, the barline
  top: number // px, top of the system
  height: number // px, height of the system
}

interface Props {
  score: PieceScore
  positionBeat?: (nowMs: number) => number | null // current beat; omit for a static preview
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
  const bars = useRef<Bar[]>([])
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
      disableCursor: true,
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
        bars.current = measureBars(instance)
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
  }, [score.base64, dark]) // only reload when the file or theme changes; zoom, staves and position are handled below

  const staffKey = visibleStaves?.join(',') ?? 'all'
  useEffect(() => {
    const instance = osmd.current
    if (!instance || !ready) return
    const changed = applyStaffVisibility(instance, visibleStaves) || instance.zoom !== zoom
    if (!changed) return
    instance.zoom = zoom
    instance.render()
    bars.current = measureBars(instance) // pixel positions changed
    lastScrolledTop.current = null
  }, [zoom, staffKey, ready]) // staffKey stands in for the visibleStaves array

  // The playhead loop: read the clock every frame and move the line directly.
  useEffect(() => {
    const marker = line.current
    const box = scrollBox.current
    if (!marker || !box || !ready || !positionBeat) return
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const beat = positionBeat(performance.now())
      const place = beat === null ? null : linePosition(bars.current, beat)
      if (!place) return
      marker.style.display = ''
      marker.style.transform = `translate3d(${place.x}px, ${place.top}px, 0)`
      marker.style.height = `${place.height}px`
      if (place.top !== lastScrolledTop.current) {
        lastScrolledTop.current = place.top
        box.scrollTo({ top: Math.max(0, place.top - SCROLL_MARGIN_PX), behavior: 'smooth' })
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [positionBeat, ready])

  return (
    <div ref={scrollBox} className="overflow-y-auto" style={{ maxHeight }}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!ready && !error && <p className="text-sm text-ink-muted">Loading score…</p>}
      <div className="relative">
        <div ref={container} className="w-full" />
        <div ref={line} className="pointer-events-none absolute top-0 left-0 w-0.5 bg-red-500 opacity-70 will-change-transform" style={{ display: 'none' }} />
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

// Read every bar's note area and beat range from the rendered layout.
function measureBars(instance: OpenSheetMusicDisplay): Bar[] {
  const pxPerUnit = OSMD_PX_PER_UNIT * instance.zoom
  const collected: Bar[] = []
  instance.Sheet.SourceMeasures.forEach((source, index) => {
    const graphical = instance.GraphicSheet.MeasureList[index]?.find((each) => each) // first drawn staff; hidden ones are gaps
    if (!graphical) return
    const box = graphical.PositionAndShape
    const staffLines = graphical.ParentMusicSystem?.StaffLines ?? []
    const firstStaff = staffLines[0]?.PositionAndShape.AbsolutePosition
    const lastStaff = staffLines[staffLines.length - 1]
    const top = (firstStaff?.y ?? box.AbsolutePosition.y) * pxPerUnit
    const bottom = lastStaff ? (lastStaff.PositionAndShape.AbsolutePosition.y + lastStaff.StaffHeight) * pxPerUnit : top + 4 * pxPerUnit
    collected.push({
      startBeat: source.AbsoluteTimestamp.RealValue * 4, // whole notes → quarters
      beats: source.Duration.RealValue * 4,
      left: (box.AbsolutePosition.x + graphical.beginInstructionsWidth) * pxPerUnit,
      right: (box.AbsolutePosition.x + box.Size.width - graphical.endInstructionsWidth) * pxPerUnit,
      top,
      height: bottom - top,
    })
  })
  return collected
}

// Constant speed across the bar the beat falls in; holds at the ends.
function linePosition(bars: Bar[], beat: number): { x: number; top: number; height: number } | null {
  if (bars.length === 0) return null
  let index = 0
  while (index + 1 < bars.length && bars[index + 1].startBeat <= beat) index += 1
  const bar = bars[index]
  const fraction = bar.beats <= 0 ? 0 : Math.min(1, Math.max(0, (beat - bar.startBeat) / bar.beats))
  return { x: bar.left + fraction * (bar.right - bar.left), top: bar.top, height: bar.height }
}
