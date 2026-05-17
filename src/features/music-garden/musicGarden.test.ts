import {
  MUSIC_GOD_POINT_REWARD_CAP_PER_FILE,
  MUSIC_NOTE_STREAK_TARGET,
  createInitialMusicGardenState,
  resetPlayback,
  resetSession,
  type MusicGardenState,
} from "./musicGardenModel.js";
import {
  handleNoteClick,
  handleNoteExpiry as rewardHandleNoteExpiry,
  streakReward,
} from "./musicGardenReward.js";
import { parseMidi } from "./musicGardenMidi.js";
import { MAX_GOD_POINTS } from "../../domain/growthBalance.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import type { NormalizedNote } from "./musicGardenMidi.js";

// ── inline assert ─────────────────────────────────────────────────────────────

const assert = {
  equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, but got ${String(actual)}.`);
    }
  },
  ok(value: unknown, msg?: string): void {
    if (!value) {
      throw new Error(msg ?? "Expected value to be truthy.");
    }
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function makeNote(overrides: Partial<NormalizedNote> = {}): NormalizedNote {
  return {
    id: "n1",
    pitch: 60,
    startMs: 0,
    durationMs: 500,
    clicked: false,
    active: true,
    ...overrides,
  };
}

function makeRuntimeState(godPoints: number): RuntimeWorldState {
  return {
    worldId: "test",
    worldContextRefs: [],
    session: {
      id: "s1" as never,
      playerDisplayName: "player",
      rosterCharacterIds: ["c1", "c2", "c3", "c4"] as never,
      activeSlots: ["c1", "c2", "c3", "c4"] as never,
      pendingActivationCharacterIds: [],
      currentEventId: "e1",
      godPoints,
      worldStatusTags: [],
      saveVersion: 1,
    },
    characters: new Map(),
    relations: new Map(),
    events: new Map([["e1", { id: "e1" } as never]]),
    interventions: new Map(),
    changeSets: new Map(),
    snapshots: new Map(),
    passports: new Map(),
  };
}

function makeMusicState(overrides: Partial<MusicGardenState> = {}): MusicGardenState {
  return { ...createInitialMusicGardenState(), rewardsEnabled: true, ...overrides };
}

// ── SMF builder ───────────────────────────────────────────────────────────────

function encodeVarLen(value: number): number[] {
  if (value < 0x80) return [value];
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    bytes.unshift(v & 0x7f);
    v >>= 7;
  }
  for (let i = 0; i < bytes.length - 1; i++) bytes[i]! |= 0x80;
  return bytes;
}

function uint32BE(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function uint16BE(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

function buildTrack(events: number[][]): number[] {
  const body = events.flat();
  return [0x4d, 0x54, 0x72, 0x6b, ...uint32BE(body.length), ...body];
}

function buildSmf(format: number, ppq: number, tracks: number[][]): ArrayBuffer {
  const header = [
    0x4d, 0x54, 0x68, 0x64,
    ...uint32BE(6),
    ...uint16BE(format),
    ...uint16BE(tracks.length),
    ...uint16BE(ppq),
  ];
  return new Uint8Array([...header, ...tracks.flat()]).buffer;
}

function makeSimpleSmf0(pitch = 60, ppq = 480): ArrayBuffer {
  const track = buildTrack([
    [...encodeVarLen(0), 0x90, pitch, 64],
    [...encodeVarLen(480), 0x80, pitch, 0],
    [...encodeVarLen(0), 0xff, 0x2f, 0x00],
  ]);
  return buildSmf(0, ppq, [track]);
}

// ── MIDI parser tests ─────────────────────────────────────────────────────────

function testParsesSmf0(): void {
  const result = parseMidi(makeSimpleSmf0(60, 480));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.result.notes.length, 1);
  const note = result.result.notes[0]!;
  assert.equal(note.pitch, 60);
  assert.ok(note.startMs < 10, `startMs near 0, got ${note.startMs}`);
  // 480 ticks / 480 ppq = 1 beat at 120 BPM = 500ms
  assert.ok(
    Math.abs(note.durationMs - 500) < 50,
    `durationMs ~500ms at 120BPM, got ${note.durationMs}`,
  );
}

function testParsesSmf1(): void {
  const tempoTrack = buildTrack([
    [...encodeVarLen(0), 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20],
    [...encodeVarLen(0), 0xff, 0x2f, 0x00],
  ]);
  const noteTrack = buildTrack([
    [...encodeVarLen(0), 0x90, 62, 80],
    [...encodeVarLen(480), 0x80, 62, 0],
    [...encodeVarLen(0), 0xff, 0x2f, 0x00],
  ]);
  const result = parseMidi(buildSmf(1, 480, [tempoTrack, noteTrack]));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.result.notes.length, 1);
  assert.equal(result.result.notes[0]!.pitch, 62);
}

function testNoteOnVelocityZeroAsNoteOff(): void {
  const track = buildTrack([
    [...encodeVarLen(0), 0x90, 60, 64],
    [...encodeVarLen(240), 0x90, 60, 0],
    [...encodeVarLen(0), 0xff, 0x2f, 0x00],
  ]);
  const result = parseMidi(buildSmf(0, 480, [track]));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.result.notes.length, 1);
  assert.ok(result.result.notes[0]!.durationMs < 600);
}

function testTempoEventAffectsStartMs(): void {
  // Track: at tick 240 change tempo to 60 BPM; second note starts at tick 480
  // tick 0→240 at 120BPM (500ms/beat) = 250ms; tick 240→480 at 60BPM (1000ms/beat) = 500ms
  // So second note startMs = 750ms > 500ms
  const track = buildTrack([
    [...encodeVarLen(0), 0x90, 60, 64],
    [...encodeVarLen(240), 0x80, 60, 0],
    [...encodeVarLen(0), 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40], // 1000000 µs = 60 BPM at tick 240
    [...encodeVarLen(240), 0x90, 62, 64],  // delta=240 → tick 480
    [...encodeVarLen(480), 0x80, 62, 0],
    [...encodeVarLen(0), 0xff, 0x2f, 0x00],
  ]);
  const result = parseMidi(buildSmf(0, 480, [track]));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.result.notes.length, 2);
  const sorted = [...result.result.notes].sort((a, b) => a.startMs - b.startMs);
  assert.ok(sorted[1]!.startMs > 500, `second note should be > 500ms, got ${sorted[1]!.startMs}`);
}

function testRunningStatusParsed(): void {
  const track = buildTrack([
    [...encodeVarLen(0), 0x90, 60, 64],
    [...encodeVarLen(100), 62, 64], // running status
    [...encodeVarLen(200), 0x80, 60, 0],
    [...encodeVarLen(0), 0x80, 62, 0],
    [...encodeVarLen(0), 0xff, 0x2f, 0x00],
  ]);
  const result = parseMidi(buildSmf(0, 480, [track]));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.result.notes.length, 2);
}

function testMalformedMidiReturnsError(): void {
  const buf = new Uint8Array([0x00, 0x01, 0x02]).buffer;
  const result = parseMidi(buf);
  assert.equal(result.ok, false);
}

function testFileSizeLimitRejected(): void {
  const big = new Uint8Array(2 * 1024 * 1024 + 1).buffer;
  const result = parseMidi(big);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.error.includes("2MB"));
}

function testTruncatedNotesExcludedFromActiveList(): void {
  const events: number[][] = [];
  for (let i = 0; i < 850; i++) {
    events.push([...encodeVarLen(0), 0x90, 60, 64]);
    events.push([...encodeVarLen(10), 0x80, 60, 0]);
  }
  events.push([...encodeVarLen(0), 0xff, 0x2f, 0x00]);
  const result = parseMidi(buildSmf(0, 480, [buildTrack(events)]));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.result.notes.length, 800);
  assert.ok(result.result.warnings.length > 0);
}

// ── Model reducer tests ───────────────────────────────────────────────────────

function testResetPlaybackResetsRewardCap(): void {
  // Cap must reset on playback reset so the player can earn rewards again
  // after spending vitality on blessings.
  const state = makeMusicState({ godPointRewardsEarned: 2, currentNoteStreak: 5 });
  const after = resetPlayback(state);
  assert.equal(after.godPointRewardsEarned, 0);
  assert.equal(after.currentNoteStreak, 0);
  assert.equal(after.isPlaying, false);
  assert.equal(after.elapsedMs, 0);
}

function testResetSessionResetsAll(): void {
  const after = resetSession([]);
  assert.equal(after.godPointRewardsEarned, 0);
  assert.equal(after.currentNoteStreak, 0);
  assert.equal(after.isPlaying, false);
}

// Note: handleNoteExpiry lives only in musicGardenReward (consolidated).
// See testRewardHandleNoteExpiry* below for expiry coverage.

// ── Reward logic tests ────────────────────────────────────────────────────────

function testHandleNoteClickIncrementsStreak(): void {
  const state = makeMusicState({
    notes: [makeNote({ id: "n1", active: true, clicked: false })],
    currentNoteStreak: 0,
  });
  const after = handleNoteClick(state, "n1");
  assert.equal(after.currentNoteStreak, 1);
  assert.equal(after.notes[0]!.clicked, true);
}

function testHandleNoteClickDuplicateIgnored(): void {
  const state = makeMusicState({
    notes: [makeNote({ id: "n1", active: true, clicked: true })],
    currentNoteStreak: 3,
  });
  assert.equal(handleNoteClick(state, "n1").currentNoteStreak, 3);
}

function testHandleNoteClickDisabledIgnored(): void {
  const state = makeMusicState({
    notes: [makeNote({ id: "n1", active: true, clicked: false })],
    currentNoteStreak: 0,
    rewardsEnabled: false,
  });
  assert.equal(handleNoteClick(state, "n1").currentNoteStreak, 0);
}

function testHandleNoteClickInactiveIgnored(): void {
  const state = makeMusicState({
    notes: [makeNote({ id: "n1", active: false, clicked: false })],
    currentNoteStreak: 2,
  });
  assert.equal(handleNoteClick(state, "n1").currentNoteStreak, 2);
}

function testRewardHandleNoteExpiryNoReset(): void {
  // Missed notes no longer reset the click count — cumulative system.
  const state = makeMusicState({
    notes: [makeNote({ id: "n1", active: true, clicked: false })],
    currentNoteStreak: 7,
    rewardsEnabled: true,
  });
  assert.equal(rewardHandleNoteExpiry(state, "n1").currentNoteStreak, 7);
}

function testRewardHandleNoteExpiryClickedIgnored(): void {
  const state = makeMusicState({
    notes: [makeNote({ id: "n1", active: true, clicked: true })],
    currentNoteStreak: 7,
    rewardsEnabled: true,
  });
  assert.equal(rewardHandleNoteExpiry(state, "n1").currentNoteStreak, 7);
}

function testRewardHandleNoteExpiryDisabledIgnored(): void {
  const state = makeMusicState({
    notes: [makeNote({ id: "n1", active: true, clicked: false })],
    currentNoteStreak: 4,
    rewardsEnabled: false,
  });
  assert.equal(rewardHandleNoteExpiry(state, "n1").currentNoteStreak, 4);
}

function testStreakRewardGrantsGodPoint(): void {
  const state = makeMusicState({
    currentNoteStreak: MUSIC_NOTE_STREAK_TARGET,
    godPointRewardsEarned: 0,
  });
  const world = makeRuntimeState(0);
  const { musicState, worldState } = streakReward(state, world);
  assert.equal(musicState.currentNoteStreak, 0);
  assert.equal(musicState.godPointRewardsEarned, 1);
  assert.equal(worldState.session.godPoints, 1);
}

function testStreakRewardBelowTarget(): void {
  const state = makeMusicState({ currentNoteStreak: MUSIC_NOTE_STREAK_TARGET - 1 });
  const world = makeRuntimeState(0);
  const { musicState, worldState } = streakReward(state, world);
  assert.equal(musicState.currentNoteStreak, MUSIC_NOTE_STREAK_TARGET - 1);
  assert.equal(worldState.session.godPoints, 0);
}

function testStreakRewardPerFileCap(): void {
  const state = makeMusicState({
    currentNoteStreak: MUSIC_NOTE_STREAK_TARGET,
    godPointRewardsEarned: MUSIC_GOD_POINT_REWARD_CAP_PER_FILE,
  });
  const { musicState, worldState } = streakReward(state, makeRuntimeState(0));
  assert.equal(musicState.currentNoteStreak, 0);
  assert.equal(musicState.godPointRewardsEarned, MUSIC_GOD_POINT_REWARD_CAP_PER_FILE);
  assert.equal(worldState.session.godPoints, 0);
}

function testStreakRewardMaxGodPointsNotExceeded(): void {
  const state = makeMusicState({ currentNoteStreak: MUSIC_NOTE_STREAK_TARGET });
  const { worldState } = streakReward(state, makeRuntimeState(MAX_GOD_POINTS));
  assert.equal(worldState.session.godPoints, MAX_GOD_POINTS);
}

function testStreakRewardBlockedDoesNotIncrementCap(): void {
  const state = makeMusicState({ currentNoteStreak: MUSIC_NOTE_STREAK_TARGET, godPointRewardsEarned: 0 });
  const { musicState } = streakReward(state, makeRuntimeState(MAX_GOD_POINTS));
  assert.equal(musicState.godPointRewardsEarned, 0);
}

function testRewardsDisabledGate(): void {
  const note = makeNote({ id: "n1", active: true, clicked: false });
  const state = makeMusicState({ notes: [note], currentNoteStreak: 5, rewardsEnabled: false });
  assert.equal(handleNoteClick(state, "n1").currentNoteStreak, 5);
  assert.equal(rewardHandleNoteExpiry(state, "n1").currentNoteStreak, 5);
}

// ── runner ────────────────────────────────────────────────────────────────────

const tests: Array<[string, () => void]> = [
  ["valid SMF format 0 → correct NormalizedNote count and timing", testParsesSmf0],
  ["valid SMF format 1 with two tracks", testParsesSmf1],
  ["note-on velocity 0 treated as note-off", testNoteOnVelocityZeroAsNoteOff],
  ["tempo event affects startMs", testTempoEventAffectsStartMs],
  ["running status parsed", testRunningStatusParsed],
  ["malformed MIDI returns controlled error", testMalformedMidiReturnsError],
  ["file exceeding 2MB size limit rejected", testFileSizeLimitRejected],
  ["truncated notes excluded from active list (no streak break)", testTruncatedNotesExcludedFromActiveList],
  ["resetPlayback resets godPointRewardsEarned so rewards can be earned again", testResetPlaybackResetsRewardCap],
  ["resetSession resets all fields including godPointRewardsEarned", testResetSessionResetsAll],
  ["handleNoteClick increments streak on valid note", testHandleNoteClickIncrementsStreak],
  ["handleNoteClick duplicate click ignored", testHandleNoteClickDuplicateIgnored],
  ["handleNoteClick disabled gate", testHandleNoteClickDisabledIgnored],
  ["handleNoteClick inactive note ignored", testHandleNoteClickInactiveIgnored],
  ["rewardHandleNoteExpiry does not reset count on missed note", testRewardHandleNoteExpiryNoReset],
  ["rewardHandleNoteExpiry skips clicked note", testRewardHandleNoteExpiryClickedIgnored],
  ["rewardHandleNoteExpiry disabled gate", testRewardHandleNoteExpiryDisabledIgnored],
  ["streakReward grants godPoint at target", testStreakRewardGrantsGodPoint],
  ["streakReward no-op below target", testStreakRewardBelowTarget],
  ["streakReward enforces per-file cap", testStreakRewardPerFileCap],
  ["streakReward MAX_GOD_POINTS not exceeded", testStreakRewardMaxGodPointsNotExceeded],
  ["streakReward blocked at MAX_GOD_POINTS does not increment cap", testStreakRewardBlockedDoesNotIncrementCap],
  ["rewardsEnabled=false: clicks and expiry have no effect", testRewardsDisabledGate],
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
