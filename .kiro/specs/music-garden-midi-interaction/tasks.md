# Tasks

## Implementation Tasks

- [ ] 1. Add MIDI parser
  - Scope:
    - Parse minimal Standard MIDI File data into normalized notes.
    - Support format 0 and format 1, variable-length delta time, tempo meta events, running status, note-on, note-off, and note-on velocity 0 as note-off.
    - Skip unknown events safely and return controlled errors for malformed files.
  - Files:
    - `src/features/music-garden/musicGardenMidi.ts`
    - `src/domain/runtime.test.ts`
  - Depends on:
    - None
  - Verification:
    - Minimal MThd/MTrk test passes.
    - note-on velocity 0 is treated as note-off.
    - tempo event affects startMs.
    - running status is parsed.
    - malformed track does not crash `/sandbox`.

- [ ] 2. Add Music Garden state model
  - Scope:
    - Define playback and visual note state.
    - Track reward disabled state and parse error state.
  - Files:
    - `src/features/music-garden/musicGardenModel.ts`
  - Depends on:
    - Task 1
  - Verification:
    - Empty session can be created.
    - Parsed MIDI can create session state.
    - Error session can be represented without crashing.
    - Event window reward-disable state can be represented.

- [ ] 3. Add reward logic
  - Scope:
    - Click notes, prevent duplicate click, convert charge into capped reward.
    - Use domain MAX_GOD_POINTS through an application boundary.
  - Files:
    - `src/features/music-garden/musicGardenReward.ts`
    - `src/application/growthBalanceService.ts`
    - `src/domain/runtime.test.ts`
  - Depends on:
    - Task 2
  - Verification:
    - Duplicate click does not increase charge.
    - 10 charge returns +1 reward.
    - cap prevents rewards after +2.
    - MAX_GOD_POINTS is not exceeded.
    - Blocked reward at MAX_GOD_POINTS does not increment the per-file reward count.
    - Event window / result modal disables reward gain.

- [ ] 4. Add MIDI upload panel
  - Scope:
    - File input, play/pause/reset controls, charge display.
  - Files:
    - `src/features/music-garden/MusicGardenPanel.tsx`
    - `src/features/music-garden/MusicGarden.css`
  - Depends on:
    - Task 2
  - Verification:
    - `.mid` / `.midi` can be selected.
    - File name and parse warning/error display correctly.
    - No raw faith, relation score, five-phase values, or internal parameters are displayed.

- [ ] 5. Add background visualizer
  - Scope:
    - Render active notes as semi-transparent mystical visuals.
  - Files:
    - `src/features/music-garden/MusicGardenVisualizer.tsx`
    - `src/features/music-garden/MusicGarden.css`
  - Depends on:
    - Task 2
  - Verification:
    - Notes appear during playback.
    - Notes can be clicked.
    - Clicked notes visually change or disappear.
    - Event window / result modal lowers interaction priority.

- [ ] 6. Add simple WebAudio playback
  - Scope:
    - Play simple oscillator notes based on parsed MIDI.
  - Files:
    - `src/features/music-garden/musicGardenAudio.ts`
  - Depends on:
    - Task 1
  - Verification:
    - Playback starts only after user action.
    - Stop/pause works.
    - Audio failure does not break visuals.

- [ ] 7. Integrate with EventFirstSandbox
  - Scope:
    - Add panel and visualizer into sandbox viewport.
    - Disable note rewards during event window/result modal.
  - Files:
    - `src/features/events/EventFirstSandbox.tsx`
    - `src/features/events/EventFirstSandbox.css`
  - Depends on:
    - Tasks 2, 3, 4, and 5
  - Verification:
    - UI does not block vitality HUD.
    - UI does not block event buttons.
    - No faith/internal values are shown.
    - MIDI remains browser-only and no external API call is added.

- [ ] 8. Manual QA
  - Scope:
    - Browser confirmation.
  - Files:
    - PR body only
  - Depends on:
    - Tasks 1 through 7
  - Verification:
    - Upload MIDI.
    - Play/pause/reset.
    - Click notes.
    - Confirm capped godPoints reward.
    - Confirm event UI remains usable.
    - Confirm no server upload, LLM call, or raw internal value display.

## Out of Scope

- Persistent MIDI storage
- High-quality synth
- External API
- Package dependency changes
- LLM music generation
- Event generation from music
- Faith system changes
- Character vitality changes

## PR Checklist

- [ ] `git diff --name-only origin/main...HEAD`
- [ ] `git diff --check origin/main...HEAD`
- [ ] `npm run typecheck`
- [ ] `npm run test:domain`
- [ ] `npm run test:ai`
- [ ] `npm run build`
- [ ] Manual QA documented
