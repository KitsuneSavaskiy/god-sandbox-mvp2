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
  // Notes are sorted by startMs. Find the first index that still needs activation
  // so we avoid a full map on every frame once early notes are all active.
  let firstPending = -1;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    if (!n.active && n.startMs <= elapsedMs) { firstPending = i; break; }
    if (!n.active && n.startMs > elapsedMs) break; // sorted: nothing more to activate
  }
  if (firstPending === -1) return state;
  const updated = notes.map((note) =>
    !note.active && note.startMs <= elapsedMs ? { ...note, active: true } : note,
  );
  return { ...state, notes: updated };
}

export function resetPlayback(state: MusicGardenState): MusicGardenState {
  return {
    ...state,
    elapsedMs: 0,
    isPlaying: false,
    currentNoteStreak: 0,
    godPointRewardsEarned: 0,
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
