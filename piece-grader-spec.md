# Piece Grader — Build Spec

A practice tool that listens to a piano piece played on a MIDI keyboard, compares it against a reference, and grades pitch and timing. Personal use, run in Chrome on a Mac with the keyboard connected over USB.

Companion to Clef Trainer. Same stack, same working rules, separate repo.

---

## 0. Working agreement (read first)

Identical to Clef Trainer, with one more allowed dependency. Full rules live in `CLAUDE.md`. Summary:

- **Allowed dependencies:** `react`, `react-dom`, `vite`, `typescript`, `tailwindcss`, `vite-plugin-pwa`, `vitest`, `midi-file`. Anything else → ask.
- No state library, router, component library, or notation-rendering library.
- Under 20 source files, none over 250 lines. Descriptive names, comment the *why*.
- One build phase at a time (§9). Stop, summarize briefly, wait.
- Ask before: new dependency, data model or storage schema change, restructuring, deviating from spec, deleting anything.

---

## 1. Platform & stack

- **Vite + React + TypeScript + Tailwind**, PWA via `vite-plugin-pwa` so it can be installed from Chrome as a desktop app
- **Web MIDI API** for input. Chrome only (Safari lacks it). Requires HTTPS or `localhost`, and the user must grant the permission prompt.
- **No backend.** Reference pieces and performance history in `localStorage`; a performance is a few hundred note events, so size is not a concern.
- **Deploy: Cloudflare Pages**

### Deliberate scope cuts
- **The app does not render sheet music.** The user reads from their own printed score or a PDF on the iPad. The app shows a piano-roll timeline only. This removes the single largest source of complexity.
- **No audio pitch detection.** MIDI only.
- **No dynamics grading in v1.** Velocity is recorded and can be displayed, but not scored.
- **Sustain pedal (CC 64) is recorded but ignored** for grading in v1.

---

## 2. MIDI input

- On load, call `navigator.requestMIDIAccess()`, list inputs, let the user pick one, remember the choice.
- Handle `noteon` with velocity 0 as `noteoff` (common keyboard behavior).
- Timestamps: use the `MIDIMessageEvent.timeStamp` (a `DOMHighResTimeStamp` on the `performance.now()` clock), not `Date.now()`. Metronome clicks are scheduled on the `AudioContext` clock; record the `performance.now()` offset at start so both clocks can be reconciled.
- Show a live "connected / last note received" indicator so it's obvious when the keyboard isn't talking.

---

## 3. Data model

```ts
// A note in a reference piece, in musical time
interface ReferenceNote {
  midi: number          // 21–108
  startBeat: number     // absolute beat from start of piece, quarter note = 1
  durationBeats: number
  track: number         // which MIDI track it came from
}

// A note the user played, in wall-clock time
interface PlayedNote {
  midi: number
  startMs: number       // relative to the first beat after count-in
  durationMs: number
  velocity: number
}

interface Piece {
  id: string
  title: string
  notes: ReferenceNote[]
  beatsPerBar: number       // from time signature; default 4
  defaultBpm: number        // from file tempo; user can override
  trackNames: string[]      // for hand selection
  source: 'midi-file' | 'recorded'
}

interface Performance {
  id: string
  pieceId: string
  playedAt: string          // ISO date
  bpm: number
  tracksIncluded: number[]
  barRange: [number, number]
  played: PlayedNote[]
  score: Score              // see §6
}
```

Musical time (beats) for references, wall-clock time (ms) for performances. Convert at scoring time using the chosen BPM. Never store performances in beats — that would bake in the tempo.

---

## 4. Getting pieces in

**Import a `.mid` file.** Parse with `midi-file`, extract note-on/off pairs per track into `ReferenceNote[]`, read the time signature and initial tempo. Handle Format 0 (one track) and Format 1 (multiple tracks). Ignore percussion channel 10.

Let the user name each track ("Right hand", "Left hand") and toggle which tracks are included in a practice session. Many piano MIDI files split hands across two tracks; some don't. If a file has one track, offer a split at Middle C as a fallback.

**Record a reference** (phase 5). Play the piece cleanly at a chosen BPM with the metronome, and the app quantizes it to the nearest 1/16 beat and saves it as a piece. Useful for anything without a MIDI file available.

### Getting a `.mid` for a piece (workflow, not app code)

The app does **not** do optical music recognition. Converting a PDF score to MIDI is a one-time prep step done outside the app, in this order:

1. **Find an existing transcription.** For classical repertoire, check musescore.com (public domain scores download free with an account), the Mutopia Project, or IMSLP. Download MIDI directly, or download the MuseScore file and export MIDI from the free MuseScore desktop app.
2. **OMR the PDF.** This is the path for copyrighted method-book pages. Full steps below.
3. **Record it.** Use the app's record-a-reference mode (phase 5): play it correctly and slowly with the metronome.

#### PDF → MIDI workflow (Audiveris + MuseScore)

Two free desktop apps: **Audiveris** (optical music recognition) and **MuseScore Studio** (notation editor for fixing and exporting).

1. **Install both (once).** Audiveris: macOS installer from `github.com/Audiveris/audiveris/releases`; it's unsigned, so right-click → Open on first launch. MuseScore Studio: from `musescore.org` (the `.org` site is the free app; `.com` is the score-sharing site).
2. **Run OMR.** In Audiveris: File → Input, pick the PDF, then Transcribe (or Book → Transcribe Book). Under a minute per page on a clean engraved score. Skim, don't fix — MuseScore is the better editor.
3. **Export MusicXML.** Book → Export Book. Produces a `.mxl` in Audiveris's output folder.
4. **Fix misreads in MuseScore.** Open the `.mxl`. Press Space to play it back and listen for wrong notes. Check clef, key signature, and time signature first. Then look for measures with stray rests or extra notes — that's where OMR misread. Delete any non-piano staves. Expect 5–15 minutes per page.
5. **Prep for export.** Two-staff piano part, right hand on top — each staff becomes its own MIDI track, which is what the app uses for hand selection. Set a sensible tempo. Consider removing repeat signs so bar numbers in the app match the printed page.
6. **Export.** File → Export → MIDI. Also save the `.mscz` so fixes never require redoing the OMR. Import the `.mid` into the app.

Input quality matters most: use the original PDF, not a phone photo. If scanning paper, 300 dpi minimum. Skewed or low-res input degrades results sharply.

Document this in the README so it's findable later.

---

## 5. Practice session

**Setup screen:** choose piece, tracks (hands), bar range, BPM (default from file, adjustable in 5-BPM steps, plus quick 50/75/100% buttons).

**Play:**
1. Metronome plays one full bar of count-in (Web Audio click, accented downbeat)
2. Recording starts on beat 1 of the first selected bar
3. Metronome continues throughout. A bar counter and a simple beat indicator are shown — nothing else that pulls the eye off the sheet music.
4. Recording stops automatically 1 beat after the last reference note's end, or on Esc.

**Loop mode:** repeat the selected bar range continuously, with a one-bar gap between repeats, grading each pass separately. This is the drill tool for a hard passage.

---

## 6. Scoring

### Alignment
This is the core and the part to get right. Do **not** match notes by nearest timestamp — one early note cascades into everything being "wrong."

Instead:
1. Group notes into **chords**: reference notes sharing a `startBeat`; played notes with onsets within 40 ms of each other.
2. Align the two chord sequences with **sequence alignment (Needleman–Wunsch style dynamic programming)**. Each step is a match, a substitution (wrong chord), an insertion (extra played chord), or a deletion (missed reference chord). Match cost is based on pitch-set overlap so a chord with one wrong note still aligns.
3. Within each matched chord pair, match individual notes by pitch. Leftovers are wrong/missing/extra notes.

Alignment must work when the player skips a bar, repeats a bar, or adds an extra note. Write unit tests for each (see checklist below).

### Metrics
- **Pitch accuracy**: matched correct notes ÷ reference notes in range
- **Wrong / missed / extra** counts
- **Timing**: for each matched note, deviation in ms from its expected position at the session BPM. Report % within ±60 ms ("on time"), % within ±120 ms ("close"), and mean absolute deviation. Also report early vs late bias.
- **Per-bar breakdown** of all the above, so the weak bars are obvious

Show the components plainly. A single composite grade is fine as a headline but must never be the only thing shown.

### Alignment test checklist
| Input | Expected result |
|---|---|
| Perfect performance | 100% pitch, 0 wrong/missed/extra |
| One wrong note | 1 substitution, everything else matched |
| One skipped note | 1 missed, later notes still matched |
| One extra note | 1 extra, later notes still matched |
| Chord with one wrong note | 2 matched, 1 wrong, chord still aligned |
| Entire bar skipped | That bar's notes missed, following bars matched |
| Played everything 20 ms late | 100% pitch, timing shows late bias |

---

## 7. Results screen

**Piano roll** with reference notes as gray bars, played notes overlaid: green (correct, on time), yellow (correct, off time), red (wrong pitch), hollow gray outline (missed). Bar lines and bar numbers along the top. Horizontally scrollable, zoomable with a slider.

Below it: the metrics from §6, and a per-bar strip colored by accuracy so the eye goes straight to the trouble spots. Clicking a bar sets the loop range to that bar and offers "practice this."

---

## 8. History

Per piece: list of performances with date, BPM, pitch %, timing %. A simple line chart of pitch accuracy and timing accuracy over time. That's it — no achievements, no streaks.

---

## 9. Build phases

Ship each phase working before starting the next.

1. **MIDI in** — connect keyboard, live piano-roll of what's being played, clock reconciliation. Verify timestamps are sane by playing along with a metronome and eyeballing the roll.
2. **Pieces** — `.mid` import, track naming/selection, bar counting, piece library. Show the reference as a piano roll.
3. **Session & pitch scoring** — metronome with count-in, recording, chord grouping, alignment, pitch metrics, results screen without timing colors. Unit tests against §6 checklist.
4. **Timing & drilling** — timing metrics, colored overlay, per-bar strip, bar range selection, loop mode.
5. **Polish** — history and trend chart, record-a-reference, PWA install, deploy to Cloudflare Pages.

---

## 10. Context on the player

Self-taught adult beginner with a strong notation background (trumpet), now learning piano on a Williams Legato Plus. Reads from sheet music on a stand. The goal is honest feedback on wrong notes and rhythm while learning classical pieces — a practice mirror, not a game. Default to hands-separate practice at reduced tempo, since that's how a beginner actually works through a piece.
