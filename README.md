# Piece Grader

Listens to a piano piece played on a MIDI keyboard, compares it against a reference, and grades pitch and timing. Chrome on a Mac, keyboard over USB. Spec: `piece-grader-spec.md`. Working rules: `CLAUDE.md`.

```
npm install
npm run dev      # local dev server (Web MIDI works on localhost)
npm test         # unit tests (vitest)
npm run build    # type-check + production build to dist/
```

## Status

All five phases built. Import a `.mid` (optionally attach a MusicXML score), pick tracks, bar range and BPM, press Practice: one bar of count-in, play along with the score or piano roll, and get pitch and timing results with a per-bar strip. Loop mode repeats a range and grades each pass. History keeps every pass with a trend chart. Record a piece plays it in when no file exists. Installs as a desktop PWA.

## Deploy (Cloudflare Pages)

1. Push `main` to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
3. Build settings: framework preset **Vite**, build command `npm run build`, output directory `dist`.
4. Environment variable `NODE_VERSION` = `20`.
5. Save and deploy. Every push to `main` redeploys.

In Chrome: open the Pages URL → address bar install icon → **Install**. Web MIDI needs HTTPS (Pages provides it) or `localhost`, and Chrome will ask for MIDI permission once.

## File map

| File | What it does |
|---|---|
| `index.html` | Page shell |
| `vite.config.ts` | Vite + React + Tailwind plugins, PWA manifest + service worker, vitest config |
| `public/favicon.svg` | App icon |
| `src/main.tsx` | Mounts `App` into `#root` |
| `src/index.css` | Design tokens (light on `:root`, dark under `prefers-color-scheme`), exposed to Tailwind via `@theme inline`; the `btn`, `btn-primary`, `field`, `card`, `label` component classes; no text selection |
| `src/App.tsx` | Tab shell (Pieces, History, Record a piece, Keyboard check); owns the MIDI connection, pieces, performance history and the session; saves one history entry per finished pass; shows the session or results screen while one is active |
| `src/DrillsScreen.tsx` | Drills tab: picker card (family, variant, key, hands, octaves, notes per click, tempo, Practice / Loop, next ladder step), the preview, then the ladder |
| `src/LadderView.tsx` | The progression ladder: levels with progress bars, steps grouped by drill with the keys as status-coloured chips, next step ringed; locked levels shown as one line; click a chip to load it |
| `src/ladder.ts` | Ladder data (five levels of drill id + tempo) and the rules: pass mark, step status from history, level locking, next step |
| `src/drillCatalog.ts` | Which drills exist: families and variants, key lists, the id that encodes a drill, titles |
| `src/drills.ts` | Drill generator: scales, contrary motion, arpeggios, broken chords, five-finger patterns, cadences and Hanon as spelled notes in 4/4; drill → `Piece` with a generated score |
| `src/hanon.ts` | Hanon 1–20 as data (group pattern, group counts, lead-in overrides), transcribed mechanically from the Mutopia engraving; expands to pitches |
| `src/pitches.ts` | Note spelling: tonics, scale formulas for every family, key signatures, chromatic spelling, scale degrees |
| `src/drillNotation.ts` | Drill → MusicXML: two staves, key signature, chords, rests, accidentals once per bar |
| `src/HistoryScreen.tsx` | Last-7-days strip; filterable sidebar with one entry per piece or per drill (hands / octaves / note value are variants); detail with variant chips, per-variant bests and fastest passing tempo, then the chart and passes for the chosen variant |
| `src/TrendChart.tsx` | SVG line chart of pitch accuracy and on-time % per pass |
| `src/RecordScreen.tsx` | Record a reference: title, time signature, tempo, count-in, play, stop; quantized to 1/16 and saved as a piece |
| `src/MidiCheck.tsx` | Keyboard check screen: input picker and status, metronome controls with beat indicator, live piano roll |
| `src/PieceList.tsx` | Library sidebar: import `.mid` button and the list of pieces |
| `src/PieceLibrary.tsx` | Selected piece as a setup card: Practice on top; tracks, time signature, split hands, attach/remove a score; tempo; bar range and loop; then the preview |
| `src/PiecePreview.tsx` | Piano roll or score, one at a time, behind a segmented control; used by the library and the drills picker |
| `src/ScoreView.tsx` | Renders an attached MusicXML score with OpenSheetMusicDisplay; walks OSMD's cursor once to learn each step's beat and pixel position, then draws its own playhead that glides between steps and scrolls to follow |
| `src/PianoRoll.tsx` | SVG piano roll of a piece in beats: bar lines and numbers, octave lines, notes colored by track; optional overlay of scored played notes (green/yellow/red/hollow); dims bars outside a range |
| `src/useSession.ts` | A practice session: count-in, recording into a `NoteRecorder`, bar/beat status, passes (one, or repeated with a one-bar gap in loop mode) each scored, auto-stop or Esc |
| `src/SessionScreen.tsx` | While playing: one strip with the big bar number, beat dots, session facts, loop pass info, score size and Stop (Esc); then the score with a moving playhead (or the reference roll) filling a wider page |
| `src/ResultsScreen.tsx` | Pass picker, pitch and timing headlines, per-bar strip (click to drill), piano roll with the performance overlaid, per-bar table |
| `src/scoring.ts` | Chord grouping, Needleman–Wunsch chord alignment, note matching by pitch, pitch and timing summaries overall and per bar |
| `src/pieces.ts` | `.mid` → `Piece` via `midi-file` (tempo, time signature, track names, percussion ignored); `splitAtMiddleC`; bar, click-length and BPM-conversion helpers |
| `src/types.ts` | Data model from spec §3: `ReferenceNote`, `PlayedNote`, `Piece` |
| `src/midi.ts` | `parseMidiMessage` (raw bytes → note on/off/sustain events) and `NoteRecorder` (pairs on/off into `PlayedNote`s) |
| `src/useMidiInput.ts` | Web MIDI hook: permission, input list, remembered choice, feeds messages into a `NoteRecorder` |
| `src/metronome.ts` | Web Audio click scheduler with accented downbeat; reconciles the audio clock with `performance.now()` so beats and MIDI notes share a timeline |
| `src/LivePianoRoll.tsx` | Canvas piano roll of recent notes with metronome beat lines and a "now" line |
| `src/storage.ts` | All `localStorage` reads/writes |
| `src/*.test.ts` | Unit tests: MIDI parsing, note pairing, clock conversion, `.mid` import, bar counting, the spec §6 alignment checklist, drill spelling and layout, drill notation |

## localStorage schema

| Key | Value |
|---|---|
| `piece-grader:midiInputId` | id of the chosen MIDI input |
| `piece-grader:pieces` | `Piece[]` (spec §3, with `timeSignature: [n, d]` in place of `beatsPerBar`, plus optional `score: { fileName, base64 }` holding a MusicXML file); notes in beats, quarter note = 1. Pieces saved with `beatsPerBar` are read as n/4. |

| `piece-grader:performances` | `Performance[]` (spec §3), oldest first; `score` holds the summary and per-bar numbers without note-level results |

localStorage is capped at about 5 MB, so attach scores as compressed `.mxl` (tens of KB) rather than `.musicxml` (hundreds of KB), and delete old performances from History if it fills up; the app alerts if a save fails.

## Behaviour notes

- Theme: follows the OS light/dark setting, no toggle. Colours are tokens in `index.css` (`--surface`, `--ink`, `--line`, `--accent` …); components use `bg-surface`, `text-ink-muted`, `border-line`, `bg-accent` and the `btn` / `field` / `card` classes rather than raw Tailwind colours. Green, yellow and red are reserved for scoring. The piano rolls read the tokens (the canvas one via `getComputedStyle`), and the notation renderer's ink colour follows the theme, reloading the score if the theme changes.

- Bars are numbered from 1 and counted from the start of the file; pickup bars are not special-cased. Remove repeats in MuseScore before export so bar numbers match the printed page.
- **Time signature** (deviation from spec §3, which stored `beatsPerBar`): the piece keeps its signature, e.g. 6/8. The metronome clicks the note the bottom number names, accent on beat 1, so 6/8 gets six eighth-note clicks per bar and 3/4 gets three quarter clicks. BPM is shown as that note per minute (♪ = 160); the file's quarter-note tempo is converted on import. Note times stay in quarter notes internally and scoring converts. Only the first tempo and time signature in the file are used; the piece's signature can be edited in the library (top number 1–32, bottom 2/4/8/16), which re-expresses the BPM so the real tempo is unchanged.
- Format 1 files usually start with a notes-free conductor track; tracks with no notes are dropped, so track numbers match the list shown.
- A one-track file offers "Split hands at middle C": C4 and above go to Right hand, the rest to Left hand.
- Clocks: MIDI events are on `performance.now()`, clicks on the AudioContext clock; `getOutputTimestamp()` pairs them. A freshly created AudioContext reports zeros from that call for its first ~100 ms, so the metronome re-captures the pairing every scheduler tick and beat times are always asked for fresh, never cached at session start.
- Session: one full bar of count-in, then time 0 is beat 1 of the first selected bar. Notes struck up to 150 ms before that still count; anything earlier is ignored as count-in noodling. Recording stops one click after the last reference note ends, or on Esc.
- Session screen shows the score with a moving cursor when a MusicXML file is attached, otherwise the reference roll with a red playhead (both a deviation from spec §5, added on request). The roll stays still while the line crosses it and flips when the line nears the right edge, so you can read ahead. During the count-in and the loop gap the cursor waits at the start of the range.
- **Score sync** (deviation from spec §1, which excluded notation rendering): the score is rendered by OpenSheetMusicDisplay. A red playhead slides continuously between notes, moving to the barline before jumping to a new bar or system, and the page scrolls to keep the current system in view. It is driven by beat, so the `.mid` and the MusicXML must come from the same MuseScore file with repeats removed. A pickup bar will put the cursor one partial bar off, since the MIDI import counts bars from tick 0. Zoom in the session screen only affects the score.
- Loop mode: count-in bar, then the bar range, a one-bar gap, the range again, and so on until Esc. Each pass is scored on its own; the pass in progress when Esc is pressed counts only if something was played in it. Notes struck in the gap bar belong to no pass.
- Timing: for each correct note, deviation from its expected time at the session BPM. "On time" is within ±60 ms, "close" within ±120 ms; bias is the signed mean (early or late). Reported overall and per bar; extra notes are charged to the bar they were played in.
- Per-bar strip: green is ≥95% pitch with no extras, yellow ≥80%, red below, gray for bars with no notes in the selected tracks.
- Drills (see `drills-spec.md`): generated on the fly, never stored; the piece id encodes the parameters (`drill:scale:harmonic-minor:F#:both:2:2`) and History rebuilds the piece from it. Everything is in 4/4; scales go up and down with the top note once and the last note held with the longest plain value that fits the bar. Hands together is two tracks an octave apart; four-octave drills start an octave lower. Keys are spelled conventionally (D♭ major, C♯ minor); modes and pentatonics take the key signature of their parent scale.
- Ladder (see `drills-spec.md`): five levels of steps, each a drill at a tempo. A step is passed when any saved performance of that drill at or above the tempo scored ≥95% pitch and ≥80% on time; nothing is stored beyond history. A level opens when the one before it is fully passed (Extras opens with Level 3). Locked levels are listed but not expanded; the picker can play anything regardless. Results for a drill say whether that pass met the mark.
- Hanon: the right hand starts on C3 as in the book (an octave below the other drills), the left hand on C2; sixteenths by default, two groups per bar. No. 12 and No. 20 keep their irregular first groups and lead-ins; No. 20 ends on the E–C chord.
- Evenness (results, timing row): the mean change in deviation from one correct note to the next, so a steady lag scores 0 and only uneven gaps count. The number that matters for scales.
- History: every finished pass is saved (loop passes individually) with date, tempo, bars, tracks and the score summary. The page groups passes into one entry per piece or per drill base (key + kind, e.g. "F♯ harmonic minor scale"; Hanon by number), with the ways it was played as variants (drills: hands / octaves / note value; pieces: tracks + bar range). The sidebar is sorted by last played and filterable; a green dot means some variant has met the ladder pass mark. The detail lists each variant's passes, best pitch, best on-time and the fastest tempo that met the pass mark, then the chart and passes of the chosen variant. Rows can be deleted.
- Record a piece: one bar of count-in, then everything played until Stop/Esc is quantized to the nearest 1/16 note at the recording tempo (shortest note 1/16, early notes clamped to beat 1) and saved as a one-track piece marked `recorded`; split hands at middle C in the library if needed. Stopping with nothing played saves nothing.
- Scoring: reference notes on the same beat form a chord; played onsets within 40 ms of a chord's first note join it. Chord sequences are aligned with Needleman–Wunsch (gap cost 1, mismatch cost 1 minus the pitch-set overlap, ties prefer matching). Inside an aligned pair, equal pitches are correct, leftover pairs are wrong notes, remaining reference notes are missed and remaining played notes are extra. Pitch accuracy is correct ÷ reference notes in range.

## Getting a `.mid` for a piece (one-time prep, outside the app)

The app does not read sheet music. Get a MIDI file in this order:

1. **Find an existing transcription.** musescore.com (public-domain scores are free with an account), the Mutopia Project, or IMSLP. Download MIDI directly, or download the MuseScore file and export MIDI from the free MuseScore desktop app.
2. **OMR the PDF** (for copyrighted method-book pages). Steps below.
3. **Record it** in the app's record-a-reference mode (phase 5): play it correctly and slowly with the metronome.

### PDF → MIDI with Audiveris + MuseScore

1. **Install both (once).** Audiveris: macOS installer from `github.com/Audiveris/audiveris/releases`; it is unsigned, so right-click → Open on first launch. MuseScore Studio: from `musescore.org` (the `.org` site is the free app; `.com` is the score-sharing site).
2. **Run OMR.** In Audiveris: File → Input, pick the PDF, then Transcribe (or Book → Transcribe Book). Under a minute per page on a clean engraved score. Skim, don't fix; MuseScore is the better editor.
3. **Export MusicXML.** Book → Export Book. Produces a `.mxl` in Audiveris's output folder.
4. **Fix misreads in MuseScore.** Open the `.mxl`. Press Space to play it back and listen for wrong notes. Check clef, key signature, and time signature first. Then look for measures with stray rests or extra notes; that is where OMR misread. Delete any non-piano staves. Expect 5–15 minutes per page.
5. **Prep for export.** Two-staff piano part, right hand on top. Each staff becomes its own MIDI track, which is what the app uses for hand selection. Set a sensible tempo. Consider removing repeat signs so bar numbers in the app match the printed page.
6. **Export.** File → Export → MIDI, and again File → Export → MusicXML (compressed `.mxl`). Also save the `.mscz` so fixes never require redoing the OMR. Import the `.mid` into the app, then attach the `.mxl` to the piece to see the score with a moving cursor while you play.

Input quality matters most: use the original PDF, not a phone photo. If scanning paper, 300 dpi minimum.
