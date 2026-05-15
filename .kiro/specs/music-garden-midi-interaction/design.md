# Design

## Overview

Music Garden is a browser-only MIDI upload and visualization feature.
It adds a musical interaction layer to the sandbox without changing faith, character vitality, relation scores, or event outcome logic.

## Architecture

### Files

- `src/features/music-garden/musicGardenMidi.ts`
- `src/features/music-garden/musicGardenModel.ts`
- `src/features/music-garden/musicGardenReward.ts`
- `src/features/music-garden/musicGardenAudio.ts`
- `src/features/music-garden/MusicGardenPanel.tsx`
- `src/features/music-garden/MusicGardenVisualizer.tsx`
- `src/features/music-garden/MusicGarden.css`
- `src/application/growthBalanceService.ts`
- `src/features/events/EventFirstSandbox.tsx`
- `src/domain/runtime.test.ts`

### Layer boundary

- `src/features/music-garden/**` owns MIDI parsing, Music Garden state, visual notes, and UI components.
- `src/application/growthBalanceService.ts` may expose an application helper that applies music rewards without letting the UI mutate domain state directly.
- `src/domain/growthBalance.ts` remains the source of truth for `MAX_GOD_POINTS`.
- `src/features/events/EventFirstSandbox.tsx` integrates the panel and visualizer into `/sandbox`.
- Music Garden must not call LLM APIs, image generation APIs, or any server upload endpoint.

## Data Model

```ts
export type MusicGardenMidiNote = {
  id: string;
  trackIndex: number;
  channel: number;
  pitch: number;
  velocity: number;
  startMs: number;
  durationMs: number;
};

export type MusicGardenVisualNote = MusicGardenMidiNote & {
  clicked: boolean;
  active: boolean;
};

export type MusicGardenSessionState = {
  playbackState: "empty" | "ready" | "playing" | "paused" | "ended" | "error";
  fileName: string | null;
  durationMs: number;
  currentTimeMs: number;
  notes: MusicGardenVisualNote[];
  clickedNoteIds: string[];
  musicCharge: number;
  musicChargeTarget: number;
  godPointRewardsEarned: number;
  godPointRewardCap: number;
  rewardClicksEnabled: boolean;
  errorMessage: string | null;
};
```

Reward constants:

```ts
const MUSIC_CHARGE_TARGET = 10;
const MUSIC_GOD_POINT_REWARD_CAP_PER_FILE = 2;
```

If `musicCharge` reaches `musicChargeTarget` while current godPoints are already `MAX_GOD_POINTS`, the system does not grant a godPoint and does not increment `godPointRewardsEarned`.
The UI may keep the charge capped or show a gentle "already full" state, but it must not create an unlimited farming loop.

## Components

### MIDI Parser

- Parse Standard MIDI File header `MThd`.
- Parse track chunk `MTrk`.
- Support format 0 and format 1.
- Support variable-length delta time.
- Support note-on / note-off.
- Treat note-on velocity 0 as note-off.
- Support tempo meta event `0xFF 0x51`.
- Support running status.
- Merge multi-track note timing into one normalized note list.
- Skip unknown events safely.
- Return a controlled parse error for malformed or unsupported files.

### MusicGardenPanel

- MIDI file input.
- File name display.
- Play / pause / reset controls.
- musicCharge display.
- Reward cap display.
- Parse warning / error display.

### MusicGardenVisualizer

- Renders note visuals in the sandbox viewport.
- Uses pitch for vertical position.
- Uses time for horizontal drift.
- Uses velocity for size or glow.
- Clickable note visuals.
- Disabled during event window / result modal.

### Reward Logic

- 1 clicked note = 1 musicCharge.
- Duplicate note clicks do not increase musicCharge.
- 10 musicCharge = +1 godPoint.
- Max +2 godPoints per MIDI file.
- Never exceed MAX_GOD_POINTS.
- If event window or result modal is open, note clicks may be visually acknowledged but must not increase musicCharge.

## State Flow

1. Player selects MIDI file.
2. Browser reads ArrayBuffer.
3. Parser normalizes note events.
4. MusicGardenSessionState is created.
5. Player presses play.
6. Audio clock and visualizer start.
7. Player clicks notes.
8. musicCharge increases.
9. Reward logic grants capped godPoints through application service.
10. Event window or result modal opens.
11. `rewardClicksEnabled` becomes false while event play has priority.
12. Event window and result modal close.
13. `rewardClicksEnabled` becomes true again if playback is still active.

## UI

Placement:

- Music Garden panel should be bottom-right or bottom-left.
- It must not overlap the top-right vitality HUD.
- It must not block event window or result modal.

Visual style:

- semi-transparent
- mystical
- sparkle-like
- gentle
- not rhythm-game intense

The UI must not show faith, relation score, five-phase internal values, or raw internal parameters.

## Error Handling

- Invalid MIDI shows error.
- Oversized file shows warning/error.
- Too many notes are capped.
- Audio failure does not block visualization.
- Unsupported MIDI events are skipped.
- Malformed tracks return a controlled error instead of crashing `/sandbox`.

## Security / Privacy

- MIDI is parsed in the browser.
- MIDI is not uploaded to a server.
- No external API calls.
- No LLM calls.
- No raw faith/internal values are shown.
- No package dependency changes in MVP.

## Test Strategy

- Parser test with minimal valid MIDI.
- Format 0 and format 1 parsing tests.
- Variable-length delta time test.
- Running status test.
- note-on velocity 0 test.
- Tempo conversion test.
- Unknown event skip test.
- Malformed track error test.
- maxNotes truncation test.
- click duplicate prevention test.
- event window / result modal reward disable test.
- reward cap test.
- max godPoints test.
- browser-only privacy and no external-call regression check.
- internal-values-hidden regression check.

## Manual QA

- Upload MIDI.
- Play / pause / reset.
- Observe background notes.
- Click notes.
- See musicCharge increase.
- Confirm duplicate note clicks do not increase musicCharge.
- Confirm godPoints reward cap.
- Confirm MAX_GOD_POINTS boundary.
- Confirm event UI is not blocked.
- Confirm event window / result modal disables note rewards.
- Confirm no faith/internal values shown.

## Risks

- MIDI parsing complexity.
- Too many notes may hurt performance.
- Reward balance may be too generous.
- Visual layer may make sandbox noisy.
- Reward boundary can be confusing if godPoints are already full.

## Out of Scope

- Persistence
- High-quality sound font
- DAW editing
- Server upload
- LLM music
- Music-driven event generation
- Package dependency changes
