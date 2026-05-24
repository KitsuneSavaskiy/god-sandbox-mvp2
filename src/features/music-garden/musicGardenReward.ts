import {
  grantRuntimeGodPoints,
} from "../../application/growthBalanceService.js";
import { MAX_GOD_POINTS } from "../../domain/growthBalance.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import {
  MUSIC_GOD_POINT_REWARD_CAP_PER_FILE,
  MUSIC_NOTE_STREAK_TARGET,
  type MusicGardenState,
} from "./musicGardenModel.js";

export interface RewardResult {
  musicState: MusicGardenState;
  worldState: RuntimeWorldState;
}

export function handleNoteClick(
  state: MusicGardenState,
  noteId: string,
): MusicGardenState {
  if (!state.rewardsEnabled) return state;

  const note = state.notes.find((n) => n.id === noteId);
  if (!note || !note.active || note.clicked) return state;

  const updatedNotes = state.notes.map((n) =>
    n.id === noteId ? { ...n, clicked: true } : n,
  );

  return {
    ...state,
    notes: updatedNotes,
    currentNoteStreak: state.currentNoteStreak + 1,
  };
}

export function streakReward(
  musicState: MusicGardenState,
  worldState: RuntimeWorldState,
): RewardResult {
  if (musicState.currentNoteStreak < MUSIC_NOTE_STREAK_TARGET) {
    return { musicState, worldState };
  }

  // Per-file cap reached
  if (musicState.godPointRewardsEarned >= MUSIC_GOD_POINT_REWARD_CAP_PER_FILE) {
    return {
      musicState: { ...musicState, currentNoteStreak: 0 },
      worldState,
    };
  }

  // MAX_GOD_POINTS boundary
  if (worldState.session.godPoints >= MAX_GOD_POINTS) {
    return {
      musicState: { ...musicState, currentNoteStreak: 0 },
      worldState,
    };
  }

  const { state: updatedWorld, granted } = grantRuntimeGodPoints(worldState, {
    source: "music-garden",
    amount: 1,
  });

  const updatedMusic: MusicGardenState = {
    ...musicState,
    currentNoteStreak: 0,
    godPointRewardsEarned: granted > 0
      ? musicState.godPointRewardsEarned + 1
      : musicState.godPointRewardsEarned,
  };

  return { musicState: updatedMusic, worldState: updatedWorld };
}

export function handleNoteExpiry(
  state: MusicGardenState,
  _noteId: string,
): MusicGardenState {
  // Missed notes do not reset the click count; only reward-granting resets it.
  return state;
}
