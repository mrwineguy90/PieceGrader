# Piece Grader

Listens to a piano piece played on a MIDI keyboard, compares it against a reference, and grades pitch and timing. Chrome on a Mac, keyboard over USB. Spec: `piece-grader-spec.md`. Working rules: `CLAUDE.md`.

```
npm install
npm run dev      # local dev server (Web MIDI works on localhost)
npm test         # unit tests (vitest)
npm run build    # type-check + production build to dist/
```

## Status

Phase 3 of 5 (Session and pitch scoring). Pick a piece, tracks and BPM, press Practice: one bar of count-in, play, and get pitch results on a piano roll. Timing colors, bar ranges and loop mode come in phase 4.

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
| `src/index.css` | Tailwind import; light theme only; no text selection |
| `src/App.tsx` | Tab shell (Pieces, Keyboard check); owns the MIDI connection, the piece list and the session; shows the session or results screen while one is active |
| `src/MidiCheck.tsx` | Keyboard check screen: input picker and status, metronome controls with beat indicator, live piano roll |
| `src/PieceLibrary.tsx` | Import `.mid`, list pieces, rename and toggle tracks, split hands at middle C, BPM controls, zoomable reference roll, Practice button, delete |
| `src/PianoRoll.tsx` | SVG piano roll of a piece in beats: bar lines and numbers, octave lines, notes colored by track; optional overlay of scored played notes |
| `src/useSession.ts` | A practice session: count-in, recording from beat 1 into a `NoteRecorder`, bar/beat status, auto-stop one beat after the last note or on Esc, then scoring |
| `src/SessionScreen.tsx` | While playing: piece line, big bar number, beat dots, Stop button |
| `src/ResultsScreen.tsx` | Pitch accuracy headline, correct/wrong/missed/extra counts, piano roll with the performance overlaid |
| `src/scoring.ts` | Chord grouping, Needleman–Wunsch chord alignment, note matching by pitch, pitch metrics and per-note deviations |
| `src/pieces.ts` | `.mid` → `Piece` via `midi-file` (tempo, time signature, track names, percussion ignored); `splitAtMiddleC`; bar, click-length and BPM-conversion helpers |
| `src/types.ts` | Data model from spec §3: `ReferenceNote`, `PlayedNote`, `Piece` |
| `src/midi.ts` | `parseMidiMessage` (raw bytes → note on/off/sustain events) and `NoteRecorder` (pairs on/off into `PlayedNote`s) |
| `src/useMidiInput.ts` | Web MIDI hook: permission, input list, remembered choice, feeds messages into a `NoteRecorder` |
| `src/metronome.ts` | Web Audio click scheduler with accented downbeat; reconciles the audio clock with `performance.now()` so beats and MIDI notes share a timeline |
| `src/LivePianoRoll.tsx` | Canvas piano roll of recent notes with metronome beat lines and a "now" line |
| `src/storage.ts` | All `localStorage` reads/writes |
| `src/*.test.ts` | Unit tests: MIDI parsing, note pairing, clock conversion, `.mid` import, bar counting, the spec §6 alignment checklist |

## localStorage schema

| Key | Value |
|---|---|
| `piece-grader:midiInputId` | id of the chosen MIDI input |
| `piece-grader:pieces` | `Piece[]` (spec §3, with `timeSignature: [n, d]` in place of `beatsPerBar`); notes in beats, quarter note = 1. Pieces saved with `beatsPerBar` are read as n/4. |

## Behaviour notes

- Bars are numbered from 1 and counted from the start of the file; pickup bars are not special-cased. Remove repeats in MuseScore before export so bar numbers match the printed page.
- **Time signature** (deviation from spec §3, which stored `beatsPerBar`): the piece keeps its signature, e.g. 6/8. The metronome clicks the note the bottom number names, accent on beat 1, so 6/8 gets six eighth-note clicks per bar and 3/4 gets three quarter clicks. BPM is shown as that note per minute (♪ = 160); the file's quarter-note tempo is converted on import. Note times stay in quarter notes internally and scoring converts. Only the first tempo and time signature in the file are used; the piece's signature can be edited in the library (top number 1–32, bottom 2/4/8/16), which re-expresses the BPM so the real tempo is unchanged.
- Format 1 files usually start with a notes-free conductor track; tracks with no notes are dropped, so track numbers match the list shown.
- A one-track file offers "Split hands at middle C": C4 and above go to Right hand, the rest to Left hand.
- Session: one full bar of count-in, then time 0 is beat 1 of the first selected bar. Notes struck up to 150 ms before that still count; anything earlier is ignored as count-in noodling. Recording stops one click after the last reference note ends, or on Esc.
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
6. **Export.** File → Export → MIDI. Also save the `.mscz` so fixes never require redoing the OMR. Import the `.mid` into the app.

Input quality matters most: use the original PDF, not a phone photo. If scanning paper, 300 dpi minimum.
