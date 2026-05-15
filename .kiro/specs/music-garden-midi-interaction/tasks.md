# Tasks — Music Garden MIDI Interaction

## Implementation Tasks

- [ ] 1. Add MIDI parser
  - Scope: Parse ArrayBuffer from FileReader into NormalizedNote[]. Support SMF Type 0 and Type 1. No npm dependencies.
  - Files:
    - `src/features/music-garden/musicGardenMidi.ts`
  - Verification:
    - Unit tests: valid MIDI → correct note count and timing values
    - Unit tests: malformed input → throws or returns empty array without crash

- [ ] 2. Add Music Garden state model and reducer
  - Scope: MusicGardenState type, initial state factory, pure reducers (tickElapsed, activateNotes, resetSession).
  - Files:
    - `src/features/music-garden/musicGardenModel.ts`
  - Verification:
    - Types compile without error
    - Reducers are pure (no side effects)

- [ ] 3. Add reward logic
  - Scope: handleNoteClick (charge increment, duplicate guard), rewardStep (godPoint grant, session cap, MAX_GOD_POINTS guard).
  - Files:
    - `src/features/music-garden/musicGardenReward.ts`
    - `src/application/growthBalanceService.ts` (add godPointFromMusicReward helper)
  - Verification:
    - Unit tests: charge increments; duplicate click ignored; reward at 10; session cap at 2; MAX_GOD_POINTS not exceeded

- [ ] 4. Add upload panel component
  - Scope: File input (.mid/.midi only), play/pause/reset controls, musicCharge progress display, error message display.
  - Files:
    - `src/features/music-garden/MusicGardenPanel.tsx`
    - `src/features/music-garden/MusicGarden.css`
  - Verification:
    - Panel renders without error
    - File input filters to .mid/.midi
    - Invalid file shows inline error; no crash

- [ ] 5. Add visualizer component
  - Scope: Canvas or CSS overlay rendering active notes as semi-transparent floating particles. z-index: above world backdrop, below event overlay. De-emphasize when event window is open.
  - Files:
    - `src/features/music-garden/MusicGardenVisualizer.tsx`
    - `src/features/music-garden/MusicGarden.css`
  - Verification:
    - Visualizer renders without error
    - Notes appear during playback; disappear after durationMs
    - z-index does not overlap event window

- [ ] 6. Integrate with EventFirstSandbox
  - Scope: Add MusicGardenState via useState; wire MusicGardenPanel and MusicGardenVisualizer; disable reward clicks when event window is open.
  - Files:
    - `src/features/events/EventFirstSandbox.tsx`
    - `src/features/events/EventFirstSandbox.css` (if z-index adjustments needed)
  - Verification:
    - Music Garden visible in /sandbox
    - Note clicks do not grant charge while event window is open
    - State resets correctly on new song upload

- [ ] 7. Add unit tests
  - Scope: MIDI parser, reward logic, state reducers.
  - Files:
    - `src/domain/runtime.test.ts` or new `src/features/music-garden/musicGarden.test.ts`
  - Verification:
    - All tests pass with `npm run test:domain` or equivalent

- [ ] 8. Manual QA
  - Scope: Full play-through per the QA steps in design.md.
  - Follow steps 1–10 from `design.md#manual-qa`.
  - Record results in PR body.

## Out of Scope

- MIDI persistent storage
- Server upload of MIDI data
- High-quality audio synthesis or soundfont
- LLM calls from Music Garden
- Automatic event generation from music analysis
- New npm package dependencies
- faith / relation score / five-phase values in UI

## PR Checklist

- [ ] `git diff --name-only origin/main...HEAD` shows only `.kiro/specs/**`
- [ ] `git diff --check origin/main...HEAD` is clean
- [ ] `npm run build` passes (no src changes in this PR)
- [ ] No secrets, tokens, or local absolute paths committed
- [ ] PR body includes: target PBI, issue number (Closes #...), changed files, out of scope, build result, manual QA N/A (docs-only PR), merge dependency on steering PR
