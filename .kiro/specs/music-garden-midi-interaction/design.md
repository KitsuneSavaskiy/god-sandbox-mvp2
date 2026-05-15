# Design — Music Garden MIDI Interaction

## Overview

Music Garden is a side-feature layer in EventFirstSandbox. MIDI is parsed in the browser with a
lightweight custom parser (no new npm dependencies). Note visuals float above the world backdrop
using a Canvas or CSS-animated overlay. State is local to EventFirstSandbox for MVP; nothing is
persisted.

## Architecture

| Layer | Role in this feature |
|-------|---------------------|
| `src/features/music-garden/` | UI components, MIDI parser, state model, reward logic, audio (optional) |
| `src/application/growthBalanceService.ts` | Provides MAX_GOD_POINTS constant and godPoint grant helper |
| `src/features/events/EventFirstSandbox.tsx` | Integration point; owns local Music Garden state |
| `src/domain/` | No changes. godPoints type lives here; Music Garden reads but does not mutate domain directly |

LLM must not be called by Music Garden. MIDI files must not leave the browser.

## Data Model

```ts
interface NormalizedNote {
  id: string;           // unique per note instance
  pitch: number;        // MIDI note number 0–127
  startMs: number;      // onset in milliseconds from track start
  durationMs: number;   // note duration in milliseconds
  clicked: boolean;     // has the player clicked this note?
  active: boolean;      // is this note currently in the visible window?
}

interface MusicGardenState {
  notes: NormalizedNote[];
  musicCharge: number;       // 0–9, resets to 0 on reward
  sessionGodPointsGranted: number;  // 0–2, capped per song
  isPlaying: boolean;
  elapsedMs: number;
}

const MUSIC_CHARGE_PER_REWARD = 10;
const SESSION_GOD_POINT_CAP = 2;
```

## Components

| File | Responsibility |
|------|----------------|
| `src/features/music-garden/musicGardenMidi.ts` | Parse ArrayBuffer → NormalizedNote[] (custom lightweight parser, no deps) |
| `src/features/music-garden/musicGardenModel.ts` | MusicGardenState type, initial state, pure reducer functions |
| `src/features/music-garden/musicGardenReward.ts` | handleNoteClick logic: charge increment, reward conversion, cap enforcement |
| `src/features/music-garden/musicGardenAudio.ts` | Optional: simple Web Audio API tone on note onset |
| `src/features/music-garden/MusicGardenPanel.tsx` | Upload button, play/pause/reset controls, charge progress display |
| `src/features/music-garden/MusicGardenVisualizer.tsx` | Canvas or CSS overlay rendering active NormalizedNotes as floating visuals |
| `src/features/music-garden/MusicGarden.css` | Styles for panel and visualizer (z-index layering) |
| `src/application/growthBalanceService.ts` | Add godPointFromMusicReward helper (reads MAX_GOD_POINTS, returns updated value or cap) |
| `src/features/events/EventFirstSandbox.tsx` | Integrate MusicGardenPanel and MusicGardenVisualizer; own MusicGardenState via useState |

## State Flow

1. Player opens sandbox → MusicGardenState initializes to empty/idle.
2. Player uploads .mid file → musicGardenMidi.ts parses → notes array populated.
3. Player presses Play → isPlaying = true, animation loop starts.
4. Each animation frame: elapsedMs advances; notes with startMs ≤ elapsedMs become active.
5. Player clicks note → handleNoteClick: marks clicked, increments musicCharge.
6. musicCharge hits 10 → rewardStep: musicCharge resets to 0, sessionGodPointsGranted++, godPoints++ (if under cap).
7. Event window opens → isRewarding = false (clicks have no effect on charge until window closes).
8. Song ends or player resets → state resets; sessionGodPointsGranted resets for next song.

## UI

- **MusicGardenPanel**: positioned bottom-left or bottom-center of sandbox. Must not overlap the HP HUD (top-right). Shows file input, play/pause/reset buttons, and a musicCharge progress indicator.
- **MusicGardenVisualizer**: full-sandbox Canvas overlay. z-index: above world backdrop, below event overlay and character sprites. Semi-transparent note particles drift upward and fade.
- When event window is open: Visualizer opacity reduces (notes still animate but are visually de-emphasized). Note clicks do not register rewards.

## Error Handling

- Non-MIDI file selected: show inline error message in MusicGardenPanel; do not crash.
- Malformed MIDI (parse error): show "読み込めませんでした" message; reset to idle state.
- MIDI with no note-on events: play silently; charge never accumulates; inform player via panel message.

## Security / Privacy

- MIDI files are read via FileReader API in the browser only. No data is sent to any server.
- No faith, relation score, five-phase internal values, or internal game parameters are displayed in Music Garden UI.
- No LLM API calls are made by this feature.
- No new environment variables or API keys are required.

## Test Strategy

Unit tests in `src/domain/runtime.test.ts` (or a new `musicGarden.test.ts`):
- MIDI parser: valid file → correct NormalizedNote count and timing.
- handleNoteClick: charge increments correctly; duplicate click ignored; reward triggers at 10; cap enforced at 2 session godPoints.
- godPointFromMusicReward: does not exceed MAX_GOD_POINTS.

No visual snapshot tests for MVP.

## Manual QA

1. Navigate to `/sandbox`.
2. Upload a valid `.mid` file via the Music Garden panel.
3. Press Play. Confirm note visuals appear in the background.
4. Click notes. Confirm musicCharge progress indicator increases.
5. Click the same note twice. Confirm charge does not increase on second click.
6. Accumulate 10 charges. Confirm godPoints +1 and charge resets.
7. Repeat until 2 godPoints granted. Confirm no further rewards despite clicking notes.
8. Open an event window during playback. Confirm note clicks do not grant charge.
9. Close the event window. Confirm note clicks resume granting charge (charge not retroactive).
10. Upload a non-MIDI file. Confirm error message; no crash.

## Risks

| Risk | Mitigation |
|------|------------|
| Custom MIDI parser may not handle all SMF formats | Scope to Type 0 and Type 1 MIDI for MVP; show error for unsupported files |
| Canvas animation may affect performance on low-end devices | Keep particle count low; use requestAnimationFrame with frame throttle |
| z-index conflicts with existing event UI | Define explicit z-index constants in a shared CSS layer map |
