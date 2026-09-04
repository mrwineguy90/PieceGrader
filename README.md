# Piece Grader

Listens to a piano piece played on a MIDI keyboard, compares it against a reference, and grades pitch and timing. Chrome on a Mac, keyboard over USB. Spec: `piece-grader-spec.md`. Working rules: `CLAUDE.md`.

```
npm install
npm run dev      # local dev server (Web MIDI works on localhost)
npm test         # unit tests (vitest)
npm run build    # type-check + production build to dist/
```

## Status

Phase 1 of 5 (MIDI in). Pick a keyboard, run the metronome, watch the live piano roll.

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
| `src/App.tsx` | Phase 1 screen: keyboard picker and status, metronome controls with beat indicator, live piano roll |
| `src/types.ts` | Data model from spec §3: `ReferenceNote`, `PlayedNote`, `Piece` |
| `src/midi.ts` | `parseMidiMessage` (raw bytes → note on/off/sustain events) and `NoteRecorder` (pairs on/off into `PlayedNote`s) |
| `src/useMidiInput.ts` | Web MIDI hook: permission, input list, remembered choice, feeds messages into a `NoteRecorder` |
| `src/metronome.ts` | Web Audio click scheduler with accented downbeat; reconciles the audio clock with `performance.now()` so beats and MIDI notes share a timeline |
| `src/LivePianoRoll.tsx` | Canvas piano roll of recent notes with metronome beat lines and a "now" line |
| `src/storage.ts` | All `localStorage` reads/writes |
| `src/*.test.ts` | Unit tests: MIDI parsing, note pairing, clock conversion |

## localStorage schema

| Key | Value |
|---|---|
| `piece-grader:midiInputId` | id of the chosen MIDI input |

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
