# Tasks — Music Garden MIDI Interaction

## Implementation Tasks

- [ ] 1. Add MIDI parser
  - Scope: Parse ArrayBuffer from FileReader into NormalizedNote[]. Support SMF format 0 and format 1, variable-length delta time, tempo meta event `0xFF 0x51`, running status, note-on velocity 0 as note-off. Skip unknown events safely. Enforce MVP guardrails (file size, duration, note count).
  - Files:
    - `src/features/music-garden/musicGardenMidi.ts`
  - Depends on: None
  - Verification:
    - Unit tests: valid SMF format 0 and format 1 → correct NormalizedNote count and timing
    - Unit tests: note-on velocity 0 treated as note-off; tempo event affects startMs; running status parsed
    - Unit tests: malformed track returns controlled error without crashing `/sandbox`
    - Unit tests: file exceeding MVP limits → returns error or truncated result
    - Unit tests: truncated (non-rendered) notes are excluded from the active note list and cannot trigger streak breaks

- [ ] 2. Add Music Garden state model and reducers
  - Scope: `MusicGardenState` type (`currentNoteStreak`, `godPointRewardsEarned`, `rewardsEnabled`, etc.), initial state factory, pure reducers: `tickElapsed`, `activateNotes`, `handleNoteExpiry` (streak break), `resetPlayback` (streak reset, no reward cap reset), `resetSession` (full reset on new file upload).
  - Files:
    - `src/features/music-garden/musicGardenModel.ts`
  - Depends on: Task 1
  - Verification:
    - Types compile without error
    - Reducers are pure (no side effects)
    - `resetPlayback` does not reset `godPointRewardsEarned`
    - `resetSession` resets all fields including `godPointRewardsEarned`

- [ ] 3. Add reward logic
  - Scope: `handleNoteClick` (streak increment, duplicate guard), `streakReward` (godPoint grant at `MUSIC_NOTE_STREAK_TARGET`, file cap at `MUSIC_GOD_POINT_REWARD_CAP_PER_FILE`, `MAX_GOD_POINTS` guard via `grantRuntimeGodPoints`).
  - Files:
    - `src/features/music-garden/musicGardenReward.ts`
    - `src/application/growthBalanceService.ts` — add `grantRuntimeGodPoints({ source: "music-garden", amount })`. Must cap at `MAX_GOD_POINTS` from `src/domain/growthBalance.ts`. Must not touch faith, vitality, relation score, events, or characters.
  - Depends on: Task 2
  - Verification:
    - Unit tests: streak increments on valid click; duplicate click ignored
    - Unit tests: streak resets to 0 on missed note (handleNoteExpiry)
    - Unit tests: godPoint granted at streak target; file cap enforced; MAX_GOD_POINTS not exceeded
    - Unit tests: blocked reward at MAX_GOD_POINTS does not increment godPointRewardsEarned
    - Unit tests: rewardsEnabled = false → clicks and expiry have no effect

- [ ] 4. Add BGM audio playback
  - Scope: Simple Web Audio API oscillator playback synchronized with parsed MIDI notes. Lightweight tones only; no soundfont or external audio files. Start/pause/reset control tied to MusicGardenPanel state. Audio failure must not block visualization.
  - Files:
    - `src/features/music-garden/musicGardenAudio.ts`
  - Depends on: Task 1
  - Verification:
    - Audio starts when Play is pressed; pauses on Pause; stops on Reset
    - No audio plays when no file is loaded
    - Does not crash when MIDI has dense simultaneous notes (limit active oscillators)
    - Audio failure is silent and non-blocking

- [ ] 5. Add upload panel component
  - Scope: File input (`.mid`/`.midi` only), play/pause/reset controls, streak progress indicator (`currentNoteStreak / MUSIC_NOTE_STREAK_TARGET`), `godPointRewardsEarned` display, error/warning message display, performance limit warnings.
  - Files:
    - `src/features/music-garden/MusicGardenPanel.tsx`
    - `src/features/music-garden/MusicGarden.css`
  - Depends on: Task 2
  - Verification:
    - Panel renders without error
    - File input filters to `.mid`/`.midi`; invalid file shows inline error; no crash
    - Streak progress and reward count visible during playback
    - Panel does not overlap the top-right vitality/godPoints HUD
    - No raw faith, relation score, five-phase values, or internal parameters are displayed

- [ ] 6. Add visualizer component
  - Scope: Canvas or CSS overlay rendering active notes as semi-transparent floating particles. z-index: above world backdrop, below event overlay and character sprites. De-emphasize (reduce opacity) when event window is open.
  - Files:
    - `src/features/music-garden/MusicGardenVisualizer.tsx`
    - `src/features/music-garden/MusicGarden.css`
  - Depends on: Task 2
  - Verification:
    - Visualizer renders without error
    - Notes appear when active; disappear after `durationMs`
    - z-index does not overlap event window
    - Active note count stays within MVP limit

- [ ] 7. Integrate with EventFirstSandbox
  - Scope: Add `MusicGardenState` via `useState`; wire `MusicGardenPanel` and `MusicGardenVisualizer`; set `rewardsEnabled = false` when event window / result modal is open (no streak increment, no streak break from expiry); restore `rewardsEnabled = true` when event UI closes.
  - Files:
    - `src/features/events/EventFirstSandbox.tsx`
    - `src/features/events/EventFirstSandbox.css` (if z-index adjustments needed)
  - Depends on: Tasks 3, 4, 5, 6
  - Verification:
    - Music Garden visible in `/sandbox`
    - Streak does not change while event window is open (neither click nor expiry)
    - Full session resets on new MIDI file upload (reward cap resets)
    - Playback reset does not reset reward cap

- [ ] 8. Add unit tests
  - Scope: MIDI parser, state reducers (including reset behavior), reward logic (streak, expiry, file cap, MAX_GOD_POINTS), rewardsEnabled gate.
  - Files:
    - `src/features/music-garden/musicGarden.test.ts` (new)
  - Depends on: Tasks 1–3
  - Verification:
    - All tests pass with `npm run test:domain` or equivalent

- [ ] 9. Manual QA
  - Scope: Full play-through per the QA steps in design.md.
  - Follow steps 1–11 from `design.md#manual-qa`.
  - Record results in PR body.

## Out of Scope

- MIDI persistent storage
- Server upload of MIDI data
- High-quality audio synthesis or soundfont
- Instrument selection or DAW-like editing
- LLM calls from Music Garden
- Automatic event generation from music analysis
- New npm package dependencies
- faith / relation score / five-phase values in UI

## Spec PR Checklist

Use when submitting a PR that only changes `.kiro/specs/**`:

- [ ] `git diff --name-only origin/main...HEAD` shows only `.kiro/specs/**`
- [ ] `git diff --check origin/main...HEAD` is clean
- [ ] `npm run build` passes
- [ ] No secrets, tokens, or local absolute paths committed
- [ ] PR body includes: target PBI, issue number (Closes #...), changed files, out of scope, build result, manual QA N/A explanation, merge dependency on steering PR

## Implementation PR Checklist

Use when submitting a PR that changes `src/**` for this feature:

- [ ] `git diff --name-only origin/main...HEAD` shows only files declared by the selected tasks
- [ ] `git diff --check origin/main...HEAD` is clean
- [ ] `npm run typecheck` passes
- [ ] `npm run test:domain` passes
- [ ] `npm run test:ai` passes
- [ ] `npm run build` passes
- [ ] Manual QA documented (follow `design.md#manual-qa` steps 1–11)
- [ ] No secrets, tokens, or local absolute paths committed
- [ ] No faith, relation score, five-phase values, or internal parameters exposed in UI or LLM context
