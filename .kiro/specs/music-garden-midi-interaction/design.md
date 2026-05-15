# Design — Music Garden MIDI Interaction

## Overview

Music Garden is a side-feature layer in EventFirstSandbox. MIDI is parsed in the browser with a
lightweight custom parser (no new npm dependencies). Simple WebAudio oscillator tones play the
notes as BGM. Note visuals float above the world backdrop using a Canvas or CSS-animated overlay.
The player clicks active notes to build a consecutive success streak; 10 consecutive clicks grant
+1 godPoint, capped at 2 per loaded file. State is local to EventFirstSandbox for MVP; nothing is
persisted.

## Architecture

| Layer | Role in this feature |
|-------|---------------------|
| `src/features/music-garden/` | UI components, MIDI parser, state model, reward logic, audio playback |
| `src/domain/growthBalance.ts` | Source of `MAX_GOD_POINTS` and godPoint balance constants |
| `src/application/growthBalanceService.ts` | `grantRuntimeGodPoints` helper: applies capped godPoint grants to `RuntimeWorldState` |
| `src/features/events/EventFirstSandbox.tsx` | Integration point; owns local Music Garden state |
| `src/domain/` | No other changes. godPoints type lives here; Music Garden reads but does not mutate domain directly |

### Layer boundary

- `src/features/music-garden/**` owns MIDI parsing, Music Garden state, visual notes, and UI components.
- `src/application/growthBalanceService.ts` exposes an application helper that applies music rewards without letting the UI mutate domain state directly.
- `src/domain/growthBalance.ts` remains the source of truth for `MAX_GOD_POINTS`.
- `src/features/events/EventFirstSandbox.tsx` integrates the panel and visualizer into `/sandbox`.
- Music Garden must not call LLM APIs, image generation APIs, or any server upload endpoint.

## Data Model

```ts
interface NormalizedNote {
  id: string;           // unique per note instance
  pitch: number;        // MIDI note number 0–127
  startMs: number;      // onset in milliseconds from track start
  durationMs: number;   // note duration in milliseconds
  clicked: boolean;     // has the player successfully clicked this note?
  active: boolean;      // is this note currently in the visible interaction window?
}

interface MusicGardenState {
  notes: NormalizedNote[];
  currentNoteStreak: number;       // 0–(MUSIC_NOTE_STREAK_TARGET-1), resets to 0 on reward or missed note
  godPointRewardsEarned: number;   // 0–MUSIC_GOD_POINT_REWARD_CAP_PER_FILE; does not reset on playback reset
  isPlaying: boolean;
  elapsedMs: number;
  rewardsEnabled: boolean;         // false when event window / result modal is open
  errorMessage: string | null;
}

const MUSIC_NOTE_STREAK_TARGET = 10;
const MUSIC_GOD_POINT_REWARD_CAP_PER_FILE = 2;
```

`godPointRewardsEarned` is scoped to the currently loaded MIDI file. It resets only when a new
file is uploaded, not on playback reset.

If `currentNoteStreak` reaches `MUSIC_NOTE_STREAK_TARGET` while godPoints are already at
`MAX_GOD_POINTS`, the system does not grant a godPoint and does not increment `godPointRewardsEarned`.

## Components

| File | Responsibility |
|------|----------------|
| `src/features/music-garden/musicGardenMidi.ts` | Parse ArrayBuffer → NormalizedNote[]. Support SMF format 0 and 1, variable-length delta time, tempo meta event, running status, note-on velocity 0 as note-off. Skip unknown events safely. |
| `src/features/music-garden/musicGardenModel.ts` | MusicGardenState type, initial state factory, pure reducers: `tickElapsed`, `activateNotes`, `handleNoteExpiry` (streak break), `resetPlayback` (no reward cap reset), `resetSession` (full reset on new file) |
| `src/features/music-garden/musicGardenReward.ts` | `handleNoteClick` (streak increment, duplicate guard), `streakReward` (godPoint grant, file cap, MAX_GOD_POINTS guard), `handleNoteExpiry` (streak break) |
| `src/features/music-garden/musicGardenAudio.ts` | Simple Web Audio API playback for parsed MIDI notes. MVP uses lightweight oscillator tones; high-quality soundfonts are out of scope. |
| `src/features/music-garden/MusicGardenPanel.tsx` | Upload button, play/pause/reset controls, streak progress indicator, godPointRewardsEarned display, error/warning messages |
| `src/features/music-garden/MusicGardenVisualizer.tsx` | Canvas or CSS overlay rendering active NormalizedNotes as floating mystical visuals; de-emphasize when event window is open |
| `src/features/music-garden/MusicGarden.css` | Styles for panel and visualizer (z-index layering) |
| `src/application/growthBalanceService.ts` | Add `grantRuntimeGodPoints({ source: "music-garden", amount })`. Must cap at `MAX_GOD_POINTS`. Must not touch faith, vitality, relation score, events, or characters. |
| `src/features/events/EventFirstSandbox.tsx` | Integrate MusicGardenPanel and MusicGardenVisualizer; own MusicGardenState via useState; pass rewardsEnabled=false when event window is open |

## State Flow

1. Player opens sandbox → MusicGardenState initializes to empty/idle.
2. Player uploads `.mid` / `.midi` file → parser validates and normalizes notes → full session reset (streak = 0, godPointRewardsEarned = 0, clicked = false for all notes).
3. Player presses Play → isPlaying = true; musicGardenAudio.ts starts oscillator playback; visualizer animation loop starts.
4. Each animation frame: elapsedMs advances; notes with startMs ≤ elapsedMs become active.
5. Player clicks an active unclicked note → handleNoteClick: marks clicked, increments currentNoteStreak.
6. An active rendered note expires unclicked (while rewardsEnabled = true) → handleNoteExpiry: currentNoteStreak resets to 0. Notes that were never added to the rendered note list do not trigger this path.
7. currentNoteStreak reaches MUSIC_NOTE_STREAK_TARGET → streakReward: currentNoteStreak resets to 0, godPointRewardsEarned++ (only if godPoints < MAX_GOD_POINTS), grantRuntimeGodPoints called.
8. godPointRewardsEarned reaches MUSIC_GOD_POINT_REWARD_CAP_PER_FILE → further streaks do not trigger rewards.
9. Event window / result modal opens → rewardsEnabled = false: note clicks do not increment streak; note expiry does not break streak.
10. Event window / result modal closes → rewardsEnabled = true.
11. Player presses Reset → elapsedMs = 0, all clicked state cleared, currentNoteStreak = 0. godPointRewardsEarned is NOT reset.
12. Player uploads a new MIDI file → full session reset: new notes array, currentNoteStreak = 0, godPointRewardsEarned = 0.

## Performance Guardrails

Recommended MVP limits to prevent browser memory and frame-rate issues:

- file size: 2 MB
- visualized notes: 800 (additional notes parsed but not rendered)
- duration: 10 minutes
- active visual notes at once: 80

Exceeding these limits shows a warning; the file is rejected or notes are truncated.
Final values are PO-confirmed (see requirements.md PO Confirmation Points).

**Streak scope rule**: Only notes that are rendered as visual notes (`active === true` at some point
during playback) are streak targets. Notes truncated by the visualization limit are never added to
the active note list and therefore never trigger streak-breaking expiry. The `handleNoteExpiry`
reducer must only be called for notes that were actually rendered.

## UI

- **MusicGardenPanel**: positioned bottom-left or bottom-center of sandbox. Must not overlap the top-right vitality/godPoints HUD. Shows file input, play/pause/reset controls, streak progress indicator, godPointRewardsEarned display, and error/warning messages.
- **MusicGardenVisualizer**: full-sandbox Canvas overlay. z-index: above world backdrop, below event overlay and character sprites. Semi-transparent note particles drift and fade during their active window. Uses pitch for vertical position; velocity for size or glow.
- When event window is open: rewardsEnabled = false; Visualizer opacity reduces (notes still animate but are visually de-emphasized). Note clicks and streak-breaking expiry are paused.

The UI must not show faith, relation score, five-phase internal values, or raw internal parameters.

## Error Handling

- Non-MIDI file selected: show inline error message in MusicGardenPanel; do not crash.
- Malformed MIDI (parse error): show "読み込めませんでした" message; reset to idle state.
- File exceeds MVP size/duration/note limits: show specific warning; reject or truncate.
- MIDI with no note-on events: play silently; streak never accumulates; inform player via panel message.
- Audio failure: does not block visualization; audio failure is silent and non-blocking.

## Security / Privacy

- MIDI files are read via FileReader API in the browser only. No data is sent to any server.
- No faith, relation score, five-phase internal values, or internal game parameters are displayed in Music Garden UI.
- No LLM API calls are made by this feature.
- No new environment variables or API keys are required.

## Test Strategy

Unit tests in `src/features/music-garden/musicGarden.test.ts` (new):

- MIDI parser: valid SMF format 0 and 1 → correct NormalizedNote count and timing; note-on velocity 0 treated as note-off; tempo event affects startMs; running status parsed; malformed track returns controlled error.
- handleNoteClick: streak increments; duplicate click ignored.
- handleNoteExpiry: streak resets to 0.
- streakReward: godPoint granted at MUSIC_NOTE_STREAK_TARGET; file cap enforced; MAX_GOD_POINTS not exceeded; blocked reward at MAX_GOD_POINTS does not increment godPointRewardsEarned.
- resetPlayback: currentNoteStreak = 0; godPointRewardsEarned unchanged.
- resetSession: all fields reset including godPointRewardsEarned.
- rewardsEnabled = false: clicks and expiry have no effect on streak.

No visual snapshot tests for MVP.

## Manual QA

1. Navigate to `/sandbox`.
2. Upload a valid `.mid` file. Confirm BGM audio starts and note visuals appear in the background.
3. Click notes in sequence. Confirm streak progress indicator increases.
4. Miss a note (let it expire). Confirm streak resets to 0.
5. Rebuild streak to 10. Confirm godPoints +1 and streak resets to 0.
6. Reach 2 godPoints from music. Confirm no further rewards despite continuing to click notes.
7. Press Reset. Confirm streak = 0, playback restarts, but godPoints earned remain (no recovery).
8. Upload a new MIDI file. Confirm streak = 0 and reward cap resets (can earn up to 2 godPoints again).
9. Open an event window during playback. Confirm note clicks do not increment streak; let a note expire and confirm streak does not reset. Close event window; confirm note interaction resumes.
10. Upload a non-MIDI file. Confirm error message; no crash.
11. (If feasible) Upload a MIDI exceeding the size/note limit. Confirm warning and safe handling.

## Risks

| Risk | Mitigation |
|------|------------|
| Custom MIDI parser may not handle all SMF formats | Scope to format 0 and format 1 only; show error for unsupported files |
| Canvas animation may affect performance on low-end devices | Keep active particle count ≤ 80; use requestAnimationFrame with frame throttle |
| z-index conflicts with existing event UI | Define explicit z-index constants in a shared CSS layer map |
| Oscillator tone playback may produce unpleasant sound for complex MIDI | Limit simultaneous active oscillators; use basic gain envelope |
