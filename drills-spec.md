# Piece Grader — Drills and progression (addendum to the spec)

Agreed 2026-09-04. Extends `piece-grader-spec.md`; the working rules in `CLAUDE.md` still apply.

## Idea

A drill is a **generated piece**. One generator turns parameters into *spelled* notes (letter, accidental, octave, MIDI number, hand, start beat, duration) and from those we get both the MIDI reference for scoring and the MusicXML for the score view. Session, loop mode, results, per-bar strip and history are unchanged.

Drills are **never stored**. Each has a deterministic id that encodes its parameters, e.g. `scale:F#:melodic-minor:2oct:both:eighths`; history regenerates title and time signature from the id. No new storage schema for drills.

## Drill catalogue

| Family | Variants | Notes |
|---|---|---|
| Scales | major; natural, harmonic, melodic minor; chromatic; major/minor pentatonic; blues; the seven modes | Up then down, top note not repeated, final note held to the bar line. 1, 2 or 4 octaves. |
| Contrary motion | major, harmonic minor | Both hands start on the same note and move apart, then back. |
| Arpeggios | major and minor triads, root position | 1 or 2 octaves. |
| Broken chords | major and minor | ABRSM pattern: 1-3-5, 3-5-8, 5-8-10 … then back down. Switchable to the RCM pattern later. |
| Five-finger patterns | major and minor | Five notes up and down, then the tonic chord. |
| Cadences | I–IV–V–I | Blocked chords, both hands. |
| Hanon | exercises 1–20 | Public domain; patterns taken from an IMSLP edition and checked, not typed from memory. Hands together an octave apart. |

Common parameters: key (12), hands (right, left, both = two tracks an octave apart), octaves, notes per click (1, 2, 4), tempo. Time signature 4/4 for everything except where a pattern needs otherwise.

Spelling: scale degrees give letter names; chromatic uses sharps going up and flats coming down; key signatures are written into the MusicXML so the page looks like a syllabus.

Fingering is not graded — MIDI does not carry it.

## Extra metric for drills

Evenness: the spread (standard deviation) of the gaps between consecutive note onsets, shown as one line on results for drills. Scales are a test of evenness more than of hitting a grid.

## Progression

The ladder is a fixed list of **levels**, each a list of **steps**. A step is a drill id plus a target tempo. Pass thresholds: **95% pitch and 80% on time**, at or above the target tempo (constants, easy to change).

Pass status is **derived from history**, not stored: a step is passed when any saved performance of that drill id at or above the tempo meets the thresholds. So nothing can drift from what was actually played.

**Locking:** a level opens when the previous level is fully passed. The ladder view hides locked levels; the free picker can play any drill at any time regardless.

Outline (loosely the RCM/ABRSM grade order; contents adjustable):

1. **Level 1** — C, G, D, F major and A, E, D harmonic minor, one octave, hands separate, quarters at ♩ = 60. Five-finger patterns in those keys. Arpeggios C, G, F. Cadences in C, G, F. Hanon 1–2.
2. **Level 2** — the same hands together. Add A, E, B♭, E♭ major and B, F♯, G, C minor. Melodic minors. Contrary motion C and G. Eighths at ♩ = 60. Hanon 3–6.
3. **Level 3** — all twelve keys, two octaves, hands together, eighths at ♩ = 72. Chromatic. Broken chords. Hanon 7–12.
4. **Level 4** — two octaves at ♩ = 96, four-octave scales, Hanon 13–20.
5. **Extras** — pentatonic, blues and the modes in all keys. Off the main line; opens with Level 3.

## Screens

- **Drills tab**: the ladder (levels with step status: not yet / tried / passed, next step highlighted) and a free picker (family, variant, key, hands, octaves, notes per click, tempo) with Practice and Loop buttons. Both hand a generated piece to the existing session.
- **Session / results**: unchanged, plus the evenness line for drills. The score view shows the generated notation with the playhead.
- **History**: drill performances appear under a regenerated title.

## Build phases

6. **Drill engine** — generators for every family except Hanon, MusicXML generator, unit tests, the picker (free mode) so drills can be played. *(Built 2026-09-04: `pitches.ts`, `drills.ts`, `drillNotation.ts`, `DrillsScreen.tsx`.)*
7. **Hanon and evenness** — the 20 patterns from a verified source, evenness metric on results. *(Built 2026-09-04: `hanon.ts` from the Mutopia LilyPond files, parsed mechanically; `drillCatalog.ts` split out of `drills.ts`.)*
8. **Ladder** — levels and steps, pass status from history, locking, next-up. *(Built 2026-09-04: `ladder.ts`, `LadderView.tsx`; results show the pass mark for drills.)*

New files expected: `drills.ts`, `drillNotation.ts`, `hanon.ts`, `ladder.ts`, `DrillsScreen.tsx`, plus tests. The file cap in `CLAUDE.md` was raised to 30 source files (tests excluded) for this.
