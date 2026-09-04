# Piece Grader — rules for Claude Code

Full spec is in `piece-grader-spec.md`. These rules apply every session and override any instinct toward thoroughness. The owner troubleshoots this code himself: **small, plain, readable.**

## Codebase size
- Allowed dependencies: `react`, `react-dom`, `vite`, `typescript`, `tailwindcss`, `vite-plugin-pwa`, `vitest`, `midi-file`. Anything else → ask first.
- No state library, router, component library, CSS-in-JS, form library, or notation-rendering library. `useState` is enough.
- No abstraction until something is used three times. No barrel `index.ts` files.
- Under 20 source files, none over 250 lines. Propose a split before exceeding.
- Keep `README.md` current with a one-line-per-file map.

## Readability
- Descriptive names. `alignChordSequences(reference, played)`, not `align(a, b)`.
- Comment the *why*, especially in the alignment and clock-reconciliation code.
- Plain TypeScript, no type gymnastics.
- No performance work unless something is measurably slow.

## Token spend
- One build phase at a time. Stop after each, summarize briefly, wait.
- Don't paste full files into chat; name the file and describe the change.
- Don't re-read unchanged files.
- Verify with `npm run build` and `npm test` before calling a phase done.
- Short replies. No recaps.

## Ask before
- Adding a dependency
- Changing the data model or `localStorage` schema
- Restructuring folders or renaming files
- Deviating from the spec (explain why, then ask)
- Deleting anything
- Anything taking more than ~30 minutes to undo

## Don't ask about
Variable names, Tailwind classes, comment wording, or anything with no lasting consequence.
