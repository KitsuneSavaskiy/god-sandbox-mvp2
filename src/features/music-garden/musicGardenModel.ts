import type { NormalizedNote } from "./musicGardenMidi.js";

export const MUSIC_NOTE_STREAK_TARGET = 10;
export const MUSIC_GOD_POINT_REWARD_CAP_PER_FILE = 2;

export interface MusicGardenState {
  notes: NormalizedNote[];
  currentNoteStreak: number;
  godPointRewardsEarned: number;
  isPlaying: boolean;
  elapsedMs: number;
  rewardsEnabled: boolean;
  errorMessage: string | null;
  warnings: string[];
}

export function createInitialMusicGardenState(): MusicGardenState {
  return {
    notes: [],
    currentNoteStreak: 0,
    godPointRewardsEarned: 0,
    isPlaying: false,
    elapsedMs: 0,
    rewardsEnabled: true,
    errorMessage: null,
    warnings: [],
  };
}

export function tickElapsed(state: MusicGardenState, deltaMs: number): MusicGardenState {
  if (!state.isPlaying) return state;
  return { ...state, elapsedMs: state.elapsedMs + deltaMs };
}

export function activateNotes(state: MusicGardenState): MusicGardenState {
  const { elapsedMs, notes } = state;
  let changed = false;
  const updated = notes.map((note) => {
    if (!note.active && note.startMs <= elapsedMs) {
      changed = true;
      return { ...note, active: true };
    }
    return note;
  });
  return changed ? { ...state, notes: updated } : state;
}

export function resetPlayback(state: MusicGardenState): MusicGardenState {
  return {
    ...state,
    elapsedMs: 0,
    isPlaying: false,
    currentNoteStreak: 0,
    notes: state.notes.map((n) => ({ ...n, clicked: false, active: false })),
  };
}

export function resetSession(notes: NormalizedNote[], warnings: string[] = []): MusicGardenState {
  return {
    notes: notes.map((n) => ({ ...n, clicked: false, active: false })),
    currentNoteStreak: 0,
    godPointRewardsEarned: 0,
    isPlaying: false,
    elapsedMs: 0,
    rewardsEnabled: true,
    errorMessage: null,
    warnings,
  };
}
