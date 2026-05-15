import {
  applyFocusedEventInterventionCommand,
  issueCharacterPassportCommand,
  issueCharacterSnapshotCommand,
  replaceActiveSlotCommand,
} from "../application/runtimeCommands.js";
import { createSeedRuntimeWorld } from "../application/runtimeBootstrap.js";
import {
  selectActiveCharacterAssetBundleReadModels,
  selectCharacterAssetBundleReadModel,
  resolveCharacterAssetBundleReadModel,
} from "../application/characterAssetBundles.js";
import {
  selectActiveCharacters,
  selectCurrentEvent,
  selectObservationPreset,
  selectPendingActivationCharacters,
  selectRoster,
} from "../application/runtimeSelectors.js";
import {
  applyFaithChange,
  applyFaithChangeWithPersonality,
  applyIntervention,
} from "./interventions.js";
import { EVENT_TEMPLATES, generateWorldEvent, selectEventTemplate } from "./events.js";
import type {
  Character,
  CharacterRelation,
  CharacterStatusBlock,
  EventTemplate,
  FaithBand,
  FivePhase,
  SandboxSession,
  WorldEvent,
} from "./models.js";
import { replaceActiveSlot } from "./session.js";
import {
  applyInterventionService,
  generateCurrentEventService,
  issuePassportService,
  issueSnapshotService,
} from "../application/runtimeService.js";
import {
  DEFAULT_CHARACTER_STATUS,
  normalizeCharacterStatus,
  resolveFaithBand,
} from "./character.js";
import {
  calcEventWeight,
  getPrincipleRelation,
  resolveImplicitPhase,
  resolvePolarity,
} from "./worldPrinciple.js";
import {
  ALLOWED_GOD_INDIRECT_REFERENCES,
  DEFAULT_DO_NOT_SAY_SANDBOX,
  getDefaultVoiceProfile,
  resolveVoiceProfile,
} from "./voiceProfile.js";
import { createRuntimeWorldState } from "../state/runtimeState.js";
import { createWorldDirectoryLayout } from "../persistence/layout.js";
import { createMigrationRegistry, CURRENT_SAVE_VERSION } from "../persistence/migrations.js";
import {
  DEFAULT_CHARACTER_ASSET_MANIFEST,
  DEFAULT_RESIDENT_SPRITE_SHEET_METADATA,
} from "../persistence/defaultCharacterAssetManifest.js";
import { DEFAULT_RESIDENT_SPRITE_MANIFEST } from "../persistence/defaultResidentSpriteManifest.js";
import {
  createAssetManifestWithResidentSprites,
  isUnmanagedAssetPipelinePath,
  type ResidentSpriteManifest,
} from "../persistence/residentSpriteManifest.js";
import { promoteAssetToReady } from "../persistence/assetManifest.js";
import { validateGeneratedNarrativeCandidate } from "./generatedContentSafety.js";
import { generatePassportDisplay, buildMemorySummary, derivePassportDoNotSay } from "./passport.js";
import {
  buildDialogueWorldDigest,
  buildDialoguePromptPack,
  createObservedDialogueCandidates,
  parseDialogueCandidatesFromText,
  selectVisibleObservedDialogueCandidates,
  validateDialogue,
  type ParsedCandidateRaw,
} from "./dialogue.js";
import type {
  ConversationLogEntry,
  DialogueCandidate,
  DialogueReviewStatus,
  DialogueTrigger,
} from "./models.js";
import {
  BALANCED_INTERVENTION_COSTS,
  GROWTH_CYCLE_TARGET_EVENT_COUNT,
  GROWTH_CYCLE_TARGET_MINUTES,
  MAX_GOD_POINTS,
  getGrowthCycleProgress,
  recoverGodPointsByElapsedMinutes,
  recoverGodPointsByPhaseTicks,
} from "./growthBalance.js";
import {
  recoverRuntimeGodPointsByElapsedMinutes,
  recoverRuntimeGodPointsByPhaseTicks,
  selectGrowthCycleProgress,
} from "../application/growthBalanceService.js";
import { resolveCharacterAnimationAssetStatus } from "../features/residents/characterAssetStatus.js";
import { createEventParticipantOverlayViewModels } from "../features/events/eventParticipantOverlay.js";
import {
  isResidentMovementBlockingEmote,
  resolveResidentEmote,
  resolveResidentMotion,
  resolveVisibleResidentEmote,
} from "../features/events/EventFirstSandboxEmotes.js";
import {
  hasSeenPassportConfirm,
  markPassportConfirmSeen,
} from "../features/passport/passportConfirmStorage.js";
import {
  FAITH_BAND_LABELS,
  PASSPORT_CONFIRM_TEXTS,
  PASSPORT_FORBIDDEN_WORDS,
} from "../features/passport/passportUiText.js";
import { createVisibleChangePatchForSandboxUi } from "../features/events/interventionOutcomeViewModel.js";
import {
  rollD20,
  resolveEventJudgement,
  resolveEventOutcome,
  resolveTemplateThreshold,
} from "./eventOutcome.js";

type TestAssert = {
  deepEqual(actual: unknown, expected: unknown): void;
  equal(actual: unknown, expected: unknown): void;
  notEqual(actual: unknown, expected: unknown): void;
  ok(value: unknown): asserts value;
  throws(action: () => void, pattern: RegExp): void;
};

const assert: TestAssert = {
  deepEqual(actual: unknown, expected: unknown): void {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(`Expected ${expectedJson}, but got ${actualJson}.`);
    }
  },
  equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, but got ${String(actual)}.`);
    }
  },
  notEqual(actual: unknown, expected: unknown): void {
    if (actual === expected) {
      throw new Error(`Expected values to differ: ${String(actual)}.`);
    }
  },
  ok(value: unknown): asserts value {
    if (!value) {
      throw new Error("Expected value to be truthy.");
    }
  },
  throws(action: () => void, pattern: RegExp): void {
    try {
      action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!pattern.test(message)) {
        throw new Error(`Expected error matching ${pattern}, but got: ${message}`);
      }

      return;
    }

    throw new Error(`Expected function to throw ${pattern}.`);
  },
};

const now = "2026-05-04T00:00:00.000Z";

function character(id: string, displayName: string): Character {
  return {
    id,
    profile: {
      displayName,
      personality: {},
      appearance: {
        primaryAssetId: `asset_${id}`,
        variantAssetIds: [],
      },
      templateFieldValues: {},
    },
    state: {
      status: { ...DEFAULT_CHARACTER_STATUS },
      ongoingEffectIds: [],
      recentEventIds: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

function session(currentEventId: string): SandboxSession {
  return {
    id: "default",
    playerDisplayName: "新米神様",
    rosterCharacterIds: ["chr_a", "chr_b", "chr_c", "chr_d", "chr_e"],
    activeSlots: ["chr_a", "chr_b", "chr_c", "chr_d"],
    pendingActivationCharacterIds: ["chr_e"],
    currentEventId,
    godPoints: 4,
    worldStatusTags: ["calm"],
    saveVersion: CURRENT_SAVE_VERSION,
  };
}

function event(id: string): WorldEvent {
  return {
    id,
    templateId: "test-event",
    status: "active",
    primaryCharacterId: "chr_a",
    participantCharacterIds: ["chr_a", "chr_b"],
    situationTags: ["test"],
    summary: "Akiが小さな出来事に出会いました。",
    createdAt: now,
    updatedAt: now,
  };
}

function relation(): CharacterRelation {
  return {
    id: "rel_chr_a__chr_b",
    characterAId: "chr_a",
    characterBId: "chr_b",
    score: 12,
    derivedFromEventIds: ["evt_initial"],
    lastRecomputedAt: now,
  };
}

function worldState() {
  const characters = new Map(
    ["chr_a", "chr_b", "chr_c", "chr_d", "chr_e"].map((id, index) => [
      id,
      character(id, ["Aki", "Beni", "Caro", "Dia", "Ema"][index]),
    ]),
  );
  const initialEvent = event("evt_initial");

  return createRuntimeWorldState({
    worldId: "world_alpha",
    worldContextRefs: ["world-context/chunks/chunk-0001.json"],
    session: session(initialEvent.id),
    characters,
    relations: new Map([[relation().id, relation()]]),
    events: new Map([[initialEvent.id, initialEvent]]),
    interventions: new Map(),
    changeSets: new Map(),
    snapshots: new Map(),
    passports: new Map(),
  });
}

function testActiveSlotsInvariantAndRosterReplacement(): void {
  const base = session("evt_initial");

  assert.throws(
    () =>
      createRuntimeWorldState({
        ...worldState(),
        session: {
          ...base,
          activeSlots: ["chr_a", "chr_b", "chr_c"] as unknown as SandboxSession["activeSlots"],
        },
      }),
    /activeSlots must contain exactly 4/,
  );

  const replaced = replaceActiveSlot(base, 2, "chr_e");
  assert.deepEqual(replaced.activeSlots, ["chr_a", "chr_b", "chr_e", "chr_d"]);
  assert.equal(replaced.activeSlots.length, 4);
  assert.equal(replaced.rosterCharacterIds.includes("chr_e"), true);
  assert.equal(replaced.pendingActivationCharacterIds.includes("chr_e"), false);

  assert.throws(
    () =>
      createRuntimeWorldState({
        ...worldState(),
        session: {
          ...base,
          activeSlots: ["chr_a", "chr_b", "chr_b", "chr_d"],
        },
      }),
    /activeSlots must contain 4 unique character ids/,
  );

  assert.throws(
    () => replaceActiveSlot(base, 2, "chr_b"),
    /Cannot duplicate active character/,
  );
}

function testEventGenerationKeepsFocusedCurrentEvent(): void {
  const generated = generateCurrentEventService(worldState(), {
    now,
    seed: "seed-event-generation",
  });

  assert.equal(generated.state.session.currentEventId, generated.event.id);
  assert.equal(generated.event.status, "active");
  assert.equal(
    generated.event.participantCharacterIds.includes(generated.event.primaryCharacterId),
    true,
  );
  assert.equal(generated.state.events.has(generated.state.session.currentEventId), true);
}

function testEventGenerationParticipantVariety(): void {
  const state = worldState();
  const activeCharacterIds = new Set(state.session.activeSlots);
  const participantCounts = new Set<number>();
  const deterministicFirst = generateWorldEvent({
    session: state.session,
    characters: state.characters,
    relations: [],
    now,
    seed: "participant-variety-deterministic",
  });
  const deterministicSecond = generateWorldEvent({
    session: state.session,
    characters: state.characters,
    relations: [],
    now,
    seed: "participant-variety-deterministic",
  });

  assert.equal(deterministicFirst.primaryCharacterId, deterministicSecond.primaryCharacterId);
  assert.deepEqual(
    deterministicFirst.participantCharacterIds,
    deterministicSecond.participantCharacterIds,
  );

  for (let index = 0; index < 80; index += 1) {
    const generated = generateWorldEvent({
      session: state.session,
      characters: state.characters,
      relations: [],
      now,
      seed: `participant-variety-${index}`,
    });
    const uniqueParticipantIds = new Set(generated.participantCharacterIds);

    participantCounts.add(generated.participantCharacterIds.length);
    assert.equal(generated.participantCharacterIds.includes(generated.primaryCharacterId), true);
    assert.equal(uniqueParticipantIds.size, generated.participantCharacterIds.length);

    for (const characterId of generated.participantCharacterIds) {
      assert.equal(activeCharacterIds.has(characterId), true);
    }
  }

  assert.equal(participantCounts.has(1), true);
  assert.equal(participantCounts.has(2), true);
  assert.equal(participantCounts.has(3), true);
  assert.equal(participantCounts.has(4), true);
}

function testEventGenerationPrioritizesActiveRelations(): void {
  const state = worldState();
  let relatedEvent: WorldEvent | undefined;

  for (let index = 0; index < 80; index += 1) {
    const generated = generateWorldEvent({
      session: state.session,
      characters: state.characters,
      relations: [...state.relations.values()],
      now,
      seed: `relation-priority-${index}`,
    });

    if (generated.primaryCharacterId === "chr_a" || generated.primaryCharacterId === "chr_b") {
      relatedEvent = generated;
      break;
    }
  }

  assert.ok(relatedEvent);
  assert.equal(relatedEvent.participantCharacterIds.includes("chr_a"), true);
  assert.equal(relatedEvent.participantCharacterIds.includes("chr_b"), true);
}

function testEventGenerationUsesReplacedActiveCharacter(): void {
  const state = worldState();
  const sessionWithNewActiveCharacter = replaceActiveSlot(state.session, 0, "chr_e");
  const activeCharacterIds = new Set(sessionWithNewActiveCharacter.activeSlots);
  let includesNewActiveCharacter = false;

  for (let index = 0; index < 80; index += 1) {
    const generated = generateWorldEvent({
      session: sessionWithNewActiveCharacter,
      characters: state.characters,
      relations: [...state.relations.values()],
      now,
      seed: `new-active-character-${index}`,
    });

    includesNewActiveCharacter =
      includesNewActiveCharacter || generated.participantCharacterIds.includes("chr_e");

    for (const characterId of generated.participantCharacterIds) {
      assert.equal(activeCharacterIds.has(characterId), true);
    }
  }

  assert.equal(includesNewActiveCharacter, true);
}

function testInterventionApplyCostsAndChangeSet(): void {
  const state = worldState();
  const currentEvent = state.events.get(state.session.currentEventId);
  const target = state.characters.get("chr_a");
  const supporting = state.characters.get("chr_b");
  assert.ok(currentEvent);
  assert.ok(target);
  assert.ok(supporting);

  const watched = applyIntervention({
    session: state.session,
    event: currentEvent,
    targetCharacters: [target, supporting],
    type: "watch",
    now,
    idSeed: "watch",
  });

  assert.equal(watched.intervention.resourceCost, 0);
  assert.equal(watched.session.godPoints, state.session.godPoints);
  assert.equal(watched.changeSets.length, 2);
  assert.equal(watched.intervention.changeSetIds.length, 2);
  assert.deepEqual(watched.changeSets[0].patch, {
    insight: 1,
    faith: 2,
    faithChange: {
      characterId: "chr_a",
      previousFaith: 30,
      newFaith: 32,
      delta: 2,
      trigger: "watch_success",
      interventionId: "itv_watch",
    },
  });
  assert.deepEqual(watched.changeSets[1].patch, {
    insight: 1,
    faith: 2,
    faithChange: {
      characterId: "chr_b",
      previousFaith: 30,
      newFaith: 32,
      delta: 2,
      trigger: "watch_success",
      interventionId: "itv_watch",
    },
  });
  assert.ok(watched.changeSets[0].postApplySnapshot.status);

  assert.throws(
    () =>
      applyIntervention({
        session: state.session,
        event: currentEvent,
        targetCharacters: [target],
        type: "watch",
        now,
        idSeed: "watch-missing-participant",
      }),
    /Intervention must include event participant/,
  );

  const helped = applyInterventionService(state, {
    type: "help",
    now,
    idSeed: "help",
    playerReason: "初回は助ける体験にする",
  });

  assert.equal(helped.state.interventions.size, 1);
  assert.equal(helped.state.changeSets.size, 2);
  assert.equal(helped.state.session.godPoints, state.session.godPoints - 2);
  assert.equal(helped.state.characters.get("chr_a")?.state.status.faith, 34);
  assert.equal(helped.state.characters.get("chr_b")?.state.status.faith, 34);
  assert.notEqual(helped.state.session.currentEventId, state.session.currentEventId);
  assert.equal(helped.state.events.has(helped.state.session.currentEventId), true);
  assert.equal(
    helped.state.characters.get("chr_b")?.state.recentEventIds.includes(currentEvent.id),
    true,
  );

  const secondHelped = applyInterventionService(helped.state, {
    type: "help",
    now,
    idSeed: "help-second",
    playerReason: "一緒に支える",
  });
  const secondHelpChangeSet = [...secondHelped.state.changeSets.values()].find(
    (changeSet) => changeSet.interventionId === "itv_help-second",
  );
  assert.ok(secondHelpChangeSet);
  assert.equal(secondHelpChangeSet.patch.faith, 5);

  const trialed = applyIntervention({
    session: state.session,
    event: currentEvent,
    targetCharacters: [target, supporting],
    type: "trial",
    now,
    idSeed: "trial",
  });

  assert.equal(trialed.intervention.resourceCost, BALANCED_INTERVENTION_COSTS.trial);
  assert.equal(
    trialed.session.godPoints,
    state.session.godPoints - BALANCED_INTERVENTION_COSTS.trial,
  );
  assert.deepEqual(trialed.changeSets[0].patch, {
    courage: 2,
    stress: 1,
    ambition: 1,
    faith: 5,
    faithChange: {
      characterId: "chr_a",
      previousFaith: 30,
      newFaith: 35,
      delta: 5,
      trigger: "trial_success",
      interventionId: "itv_trial",
    },
  });
}

function testThirtyMinuteGrowthBalance(): void {
  assert.equal(GROWTH_CYCLE_TARGET_MINUTES, 30);
  assert.equal(GROWTH_CYCLE_TARGET_EVENT_COUNT, 10);
  assert.equal(BALANCED_INTERVENTION_COSTS.watch, 0);
  assert.equal(BALANCED_INTERVENTION_COSTS.help, 2);
  assert.equal(BALANCED_INTERVENTION_COSTS.trial, 3);

  const progressBeforeGoal = getGrowthCycleProgress(9);
  assert.equal(progressBeforeGoal.isCycleComplete, false);
  assert.equal(progressBeforeGoal.remainingEventCount, 1);

  const progressAtGoal = getGrowthCycleProgress(10);
  assert.equal(progressAtGoal.isCycleComplete, true);
  assert.equal(progressAtGoal.remainingEventCount, 0);

  const state = worldState();
  // 3 minutes = 4 phases => +2 (phase-aligned recovery)
  const threeMinSession = recoverGodPointsByElapsedMinutes(
    { ...state.session, godPoints: 2 },
    3,
  );
  assert.equal(threeMinSession.godPoints, 4);

  // 9 minutes = 12 phases => +6, but capped at MAX_GOD_POINTS (6)
  const recoveredSession = recoverGodPointsByElapsedMinutes(
    {
      ...state.session,
      godPoints: 2,
    },
    9,
  );
  assert.equal(recoveredSession.godPoints, MAX_GOD_POINTS);

  const cappedSession = recoverGodPointsByElapsedMinutes(
    {
      ...state.session,
      godPoints: MAX_GOD_POINTS - 1,
    },
    30,
  );
  assert.equal(cappedSession.godPoints, MAX_GOD_POINTS);

  const recoveredRuntime = recoverRuntimeGodPointsByElapsedMinutes(
    createRuntimeWorldState({
      ...state,
      session: {
        ...state.session,
        godPoints: 1,
      },
    }),
    6,
  );
  assert.equal(recoveredRuntime.session.godPoints, 5); // 6 min = 8 phases => +4

  const events = new Map(state.events);
  for (let index = 0; index < GROWTH_CYCLE_TARGET_EVENT_COUNT; index += 1) {
    events.set(`evt_cycle_${index}`, {
      ...event(`evt_cycle_${index}`),
      status: "resolved",
    });
  }
  const progressState = createRuntimeWorldState({
    ...state,
    events,
  });
  const selectedProgress = selectGrowthCycleProgress(progressState);
  assert.equal(selectedProgress.completedEventCount, GROWTH_CYCLE_TARGET_EVENT_COUNT);
  assert.equal(selectedProgress.isCycleComplete, true);
}

function testSnapshotAndPassportAreSeparateArtifacts(): void {
  const afterIntervention = applyInterventionService(worldState(), {
    type: "help",
    now,
    idSeed: "snapshot-source",
  }).state;

  const issuedSnapshot = issueSnapshotService(afterIntervention, {
    characterId: "chr_a",
    snapshotId: "snp_chr_a_001",
    now,
    annotationTags: ["first-help"],
    memo: "初回の助ける体験後の記録",
  });

  assert.equal(issuedSnapshot.snapshot.characterId, "chr_a");
  assert.equal(issuedSnapshot.snapshot.relations.length, 1);
  assert.equal(issuedSnapshot.state.snapshots.has("snp_chr_a_001"), true);
  assert.equal(issuedSnapshot.state.passports.size, 0);

  const issuedPassport = issuePassportService(issuedSnapshot.state, {
    snapshotId: issuedSnapshot.snapshot.id,
    passportId: "psp_chr_a_001",
    fileNameToken: "aki--psp-001",
    schemaVersion: 1,
    now,
  });

  assert.equal(issuedPassport.passport.snapshotId, issuedSnapshot.snapshot.id);
  assert.equal(issuedPassport.passport.exportHints.referencedCharacterFileId, "chr_a");
  assert.deepEqual(issuedPassport.passport.exportHints.referencedAssetIds, ["asset_chr_a"]);
  assert.equal(issuedPassport.state.snapshots.size, 1);
  assert.equal(issuedPassport.state.passports.size, 1);
}

function testPersistenceFoundations(): void {
  const layout = createWorldDirectoryLayout("alpha--world_alpha");
  assert.equal(layout.worldFile, "worlds/alpha--world_alpha/world.json");
  assert.equal(
    layout.historyChunkFile("events", "2026-05", 1),
    "worlds/alpha--world_alpha/events/history/2026-05/chunk-0001.json",
  );
  assert.equal(
    layout.historyChunkFile("interventions", "2026-05", 1),
    "worlds/alpha--world_alpha/interventions/2026-05/chunk-0001.json",
  );
  assert.equal(
    layout.historyChunkFile("changes", "2026-05", 1),
    "worlds/alpha--world_alpha/changes/2026-05/chunk-0001.json",
  );
  assert.equal(
    layout.assetManifestFile,
    "worlds/alpha--world_alpha/assets/manifest.json",
  );

  const registry = createMigrationRegistry();
  assert.equal(registry.currentSaveVersion, CURRENT_SAVE_VERSION);
  assert.deepEqual(registry.migrateToCurrent({ worldId: "world_alpha" }, CURRENT_SAVE_VERSION), {
    worldId: "world_alpha",
  });
}

function testRuntimeSelectorsAndCommands(): void {
  const state = createSeedRuntimeWorld();
  const focusedEvent = selectCurrentEvent(state);
  const activeCharacters = selectActiveCharacters(state);
  const activeAssetBundles = selectActiveCharacterAssetBundleReadModels(state);
  const observationPreset = selectObservationPreset(state);
  const roster = selectRoster(state);
  const pending = selectPendingActivationCharacters(state);
  const ryoAssetBundle = selectCharacterAssetBundleReadModel(state, "chr_ryo");

  assert.equal(focusedEvent.id, state.session.currentEventId);
  assert.equal(activeCharacters.length, 4);
  assert.equal(activeAssetBundles.length, 4);
  assert.equal(observationPreset.focusedEventId, focusedEvent.id);
  assert.deepEqual(observationPreset.activeCharacterIds, state.session.activeSlots);
  assert.deepEqual(
    roster.map((character) => character.profile.displayName),
    ["Eve", "Garan", "Ryo", "Suzu"],
  );
  assert.equal(pending.length, 0);
  assert.equal(ryoAssetBundle.portrait.assetId, "ryo-portrait-neutral");
  assert.equal(ryoAssetBundle.portrait.path, "/art/characters/defaults/ryo/portrait.png");
  assert.equal(ryoAssetBundle.expressions.neutral.assetId, "ryo-portrait-neutral");
  assert.equal(ryoAssetBundle.expressions.happy.assetId, "ryo-expression-happy");
  assert.equal(ryoAssetBundle.expressions.happy.isPlaceholder, false);
  assert.equal(ryoAssetBundle.expressions.surprised.assetId, "ryo-expression-surprised");
  assert.equal(ryoAssetBundle.spriteSheet.assetId, "ryo-sprite-sheet");
  assert.equal(ryoAssetBundle.spriteSheet.ready, true);
  assert.equal(ryoAssetBundle.spriteSheet.isPlaceholder, false);
  assert.equal(ryoAssetBundle.spriteSheet.missingReason, undefined);
  assert.equal(
    ryoAssetBundle.spriteSheet.path,
    "/art/characters/defaults/ryo/sprites/resident-sprite-sheet-combined-preview-v12.png",
  );
  assert.equal(
    ryoAssetBundle.spriteSheet.plannedPath,
    null,
  );
  assert.equal(ryoAssetBundle.spriteSheet.fallbackAssetId, "ryo-portrait-neutral");
  assert.equal(ryoAssetBundle.spriteSheet.fallbackPath, "/art/characters/defaults/ryo/portrait.png");
  // Ryo PO preview sheet: one combined Codex pet sheet, 6 cols, 14 rows.
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.frameWidth, 148);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.frameHeight, 144);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.columns, 6);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.rows, 14);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions.idle?.row, 0);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions.idle?.frames, 6);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions.waving?.row, 3);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions.review?.row, 7);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions["walk-left"]?.row, 2);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions["walk-right"]?.row, 1);
  // Extended motions share the same PO preview PNG.
  assert.equal(ryoAssetBundle.extendedSheet.assetId, "ryo-sprite-sheet-extended");
  assert.equal(ryoAssetBundle.extendedSheet.ready, true);
  assert.equal(ryoAssetBundle.extendedSheet.metadata?.frameWidth, 148);
  assert.equal(ryoAssetBundle.extendedSheet.metadata?.frameHeight, 144);
  assert.equal(ryoAssetBundle.extendedSheet.metadata?.motions["walk-up"]?.row, 8);
  assert.equal(ryoAssetBundle.extendedSheet.metadata?.motions["walk-forward"]?.row, 9);
  assert.equal(ryoAssetBundle.extendedSheet.metadata?.motions["emote-happy"]?.row, 10);
  assert.equal(ryoAssetBundle.extendedSheet.metadata?.motions["emote-surprised"]?.row, 13);
  assert.equal(ryoAssetBundle.basicSettings.introduction.isPlaceholder, true);
  assert.equal(ryoAssetBundle.basicSettings.introduction.source, "placeholder");
  assert.equal(activeAssetBundles[0]?.portrait.ready, true);
  assert.equal(activeAssetBundles[0]?.spriteSheet.assetId, "eve-sprite-sheet");
  assert.equal(activeAssetBundles[1]?.spriteSheet.assetId, "garan-sprite-sheet");
  assert.equal(activeAssetBundles[2]?.spriteSheet.assetId, "ryo-sprite-sheet");
  assert.equal(activeAssetBundles[3]?.spriteSheet.assetId, "suzu-sprite-sheet");
  assert.equal(activeAssetBundles.every((bundle) => bundle.spriteSheet.metadata !== null), true);
  assert.equal(activeAssetBundles[0]?.spriteSheet.ready, true);
  assert.equal(
    activeAssetBundles[0]?.spriteSheet.path,
    "/art/characters/defaults/eve/sprites/resident-sprite-sheet-combined-preview-v14.png",
  );
  assert.equal(activeAssetBundles[0]?.spriteSheet.metadata?.frameWidth, 118);
  assert.equal(activeAssetBundles[0]?.spriteSheet.metadata?.frameHeight, 136);
  assert.equal(activeAssetBundles[0]?.spriteSheet.metadata?.columns, 7);
  assert.equal(activeAssetBundles[0]?.spriteSheet.metadata?.rows, 14);
  assert.equal(activeAssetBundles[0]?.spriteSheet.metadata?.motions.idle?.frames, 7);
  assert.equal(activeAssetBundles[0]?.spriteSheet.metadata?.motions.failed?.frames, 5);
  assert.equal(activeAssetBundles[1]?.spriteSheet.ready, true);
  assert.equal(activeAssetBundles[2]?.spriteSheet.ready, true);
  assert.equal(activeAssetBundles[3]?.spriteSheet.ready, true);
  assert.equal(
    activeAssetBundles[1]?.spriteSheet.path,
    "/art/characters/defaults/garan/sprites/resident-sprite-sheet-combined-preview-v21.png",
  );
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.frameWidth, 118);
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.frameHeight, 136);
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.columns, 7);
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.rows, 14);
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.motions.failed?.frames, 7);
  assert.equal(
    activeAssetBundles[2]?.spriteSheet.path,
    "/art/characters/defaults/ryo/sprites/resident-sprite-sheet-combined-preview-v12.png",
  );
  assert.equal(activeAssetBundles[2]?.spriteSheet.metadata?.frameWidth, 148);
  assert.equal(activeAssetBundles[2]?.spriteSheet.metadata?.frameHeight, 144);
  assert.equal(activeAssetBundles[2]?.spriteSheet.metadata?.columns, 6);
  assert.equal(activeAssetBundles[2]?.spriteSheet.metadata?.rows, 14);
  assert.equal(activeAssetBundles[2]?.spriteSheet.metadata?.motions.failed?.frames, 6);
  assert.equal(
    activeAssetBundles[3]?.spriteSheet.path,
    "/art/characters/defaults/suzu/sprites/resident-sprite-sheet-combined-preview-v2.png",
  );
  assert.equal(activeAssetBundles[3]?.spriteSheet.metadata?.frameWidth, 148);
  assert.equal(activeAssetBundles[3]?.spriteSheet.metadata?.frameHeight, 144);
  assert.equal(activeAssetBundles[3]?.spriteSheet.metadata?.columns, 6);
  assert.equal(activeAssetBundles[3]?.spriteSheet.metadata?.rows, 14);
  assert.equal(activeAssetBundles[3]?.spriteSheet.metadata?.motions["walk-left"]?.row, 1);
  assert.equal(activeAssetBundles[3]?.spriteSheet.metadata?.motions["walk-right"]?.row, 2);
  assert.equal(activeAssetBundles[3]?.spriteSheet.metadata?.motions.failed?.frames, 6);
  assert.equal(activeAssetBundles.every((bundle) => bundle.extendedSheet.metadata !== null), true);
  assert.equal(activeAssetBundles[0]?.extendedSheet.ready, true);
  assert.equal(activeAssetBundles[0]?.extendedSheet.metadata?.frameWidth, 118);
  assert.equal(activeAssetBundles[0]?.extendedSheet.metadata?.frameHeight, 136);
  assert.equal(activeAssetBundles[0]?.extendedSheet.metadata?.columns, 7);
  assert.equal(activeAssetBundles[0]?.extendedSheet.metadata?.rows, 14);
  assert.equal(activeAssetBundles[0]?.extendedSheet.metadata?.motions["walk-up"]?.row, 8);
  assert.equal(activeAssetBundles[0]?.extendedSheet.metadata?.motions["walk-forward"]?.row, 9);
  assert.equal(activeAssetBundles[0]?.extendedSheet.metadata?.motions["walk-back"]?.row, 8);
  assert.equal(activeAssetBundles[0]?.extendedSheet.metadata?.motions["emote-surprised"]?.row, 13);
  assert.equal(activeAssetBundles[1]?.extendedSheet.ready, true);
  assert.equal(activeAssetBundles[2]?.extendedSheet.ready, true);
  assert.equal(activeAssetBundles[3]?.extendedSheet.ready, true);
  assert.equal(activeAssetBundles[1]?.extendedSheet.metadata?.frameWidth, 118);
  assert.equal(activeAssetBundles[1]?.extendedSheet.metadata?.frameHeight, 136);
  assert.equal(activeAssetBundles[1]?.extendedSheet.metadata?.motions["walk-forward"]?.row, 9);
  assert.equal(activeAssetBundles[1]?.extendedSheet.metadata?.motions["emote-angry"]?.row, 11);
  assert.equal(activeAssetBundles[2]?.extendedSheet.metadata?.frameWidth, 148);
  assert.equal(activeAssetBundles[2]?.extendedSheet.metadata?.frameHeight, 144);
  assert.equal(activeAssetBundles[2]?.extendedSheet.metadata?.columns, 6);
  assert.equal(activeAssetBundles[2]?.extendedSheet.metadata?.rows, 14);
  assert.equal(activeAssetBundles[2]?.extendedSheet.metadata?.motions["walk-forward"]?.row, 9);
  assert.equal(activeAssetBundles[2]?.extendedSheet.metadata?.motions["emote-sad"]?.row, 12);
  assert.equal(activeAssetBundles[3]?.extendedSheet.metadata?.frameWidth, 148);
  assert.equal(activeAssetBundles[3]?.extendedSheet.metadata?.frameHeight, 144);
  assert.equal(activeAssetBundles[3]?.extendedSheet.metadata?.motions["walk-forward"]?.row, 9);
  assert.equal(activeAssetBundles[3]?.extendedSheet.metadata?.motions["emote-surprised"]?.row, 13);
  assert.equal(activeAssetBundles[3]?.expressions.angry.assetId, "suzu-expression-angry");
  assert.equal(activeAssetBundles[3]?.expressions.angry.isPlaceholder, false);
  assert.equal(
    activeAssetBundles[3]?.expressions.angry.path,
    "/art/characters/defaults/suzu/expressions/angry.png",
  );
  assert.equal(activeAssetBundles[3]?.expressions.sad.assetId, "suzu-expression-sad");
  assert.equal(activeAssetBundles[3]?.expressions.sad.isPlaceholder, false);
  assert.equal(
    activeAssetBundles[3]?.expressions.sad.path,
    "/art/characters/defaults/suzu/expressions/sad.png",
  );
  assert.equal(activeAssetBundles[3]?.expressions.surprised.assetId, "suzu-expression-surprised");
  assert.equal(activeAssetBundles[3]?.expressions.surprised.isPlaceholder, false);
  assert.equal(
    activeAssetBundles[3]?.expressions.surprised.path,
    "/art/characters/defaults/suzu/expressions/surprised.png",
  );

  const afterIntervention = applyFocusedEventInterventionCommand(state, {
    type: "help",
    now,
    idSeed: "seed-help",
  }).state;
  assert.equal(afterIntervention.interventions.size, 1);
  assert.equal(afterIntervention.changeSets.size, 2);

  const issuedSnapshot = issueCharacterSnapshotCommand(afterIntervention, {
    characterId: "chr_ryo",
    snapshotId: "snp_seed_ryo",
    now,
    sourceEventId: focusedEvent.id,
  });
  assert.equal(issuedSnapshot.state.snapshots.size, 1);
  assert.equal(issuedSnapshot.state.passports.size, 0);

  const issuedPassport = issueCharacterPassportCommand(issuedSnapshot.state, {
    snapshotId: "snp_seed_ryo",
    passportId: "psp_seed_ryo",
    fileNameToken: "ryo-seed",
    schemaVersion: 1,
    now,
  });
  assert.equal(issuedPassport.state.snapshots.size, 1);
  assert.equal(issuedPassport.state.passports.size, 1);
}

function testCharacterAssetReadModelSeparatesIntroductionSources(): void {
  const baseCharacter = character("chr_test", "Test");
  baseCharacter.profile.appearance.assetBundle = {
    portraitAssetId: "test-portrait-neutral",
    iconAssetId: null,
    spriteSheetAssetId: null,
    expressions: {
      neutral: "test-portrait-neutral",
      happy: null,
      angry: null,
      sad: null,
      surprised: null,
    },
  };

  const placeholderReadModel = resolveCharacterAssetBundleReadModel(baseCharacter, {
    saveVersion: CURRENT_SAVE_VERSION,
    updatedAt: now,
    entries: [
      {
        id: "test-portrait-neutral",
        ownerCharacterId: "chr_test",
        kind: "appearance-source",
        relativePath: "art/characters/defaults/test/portrait.png",
      },
    ],
  });
  assert.equal(placeholderReadModel.basicSettings.introduction.isPlaceholder, true);
  assert.equal(placeholderReadModel.basicSettings.introduction.source, "placeholder");
  assert.equal(placeholderReadModel.basicSettings.introduction.needsUserConfirmation, false);

  const generatedRecognitionCharacter = {
    ...baseCharacter,
    profile: {
      ...baseCharacter.profile,
      templateFieldValues: {
        description: "花と緑を身につけた住民として見える",
        descriptionSource: "generated-recognition",
      },
    },
  };
  const generatedRecognitionReadModel = resolveCharacterAssetBundleReadModel(
    generatedRecognitionCharacter,
    {
      saveVersion: CURRENT_SAVE_VERSION,
      updatedAt: now,
      entries: [
        {
          id: "test-portrait-neutral",
          ownerCharacterId: "chr_test",
          kind: "appearance-source",
          relativePath: "art/characters/defaults/test/portrait.png",
        },
      ],
    },
  );
  assert.equal(generatedRecognitionReadModel.basicSettings.introduction.source, "generated-recognition");
  assert.equal(generatedRecognitionReadModel.basicSettings.introduction.isPlaceholder, false);
  assert.equal(generatedRecognitionReadModel.basicSettings.introduction.needsUserConfirmation, true);
}

function testInvalidSpriteMetadataFallsBackToReviewing(): void {
  const baseCharacter = character("chr_test", "Test");
  baseCharacter.profile.appearance.assetBundle = {
    portraitAssetId: "test-portrait-neutral",
    iconAssetId: null,
    spriteSheetAssetId: "test-sprite-sheet",
    expressions: {
      neutral: "test-portrait-neutral",
      happy: null,
      angry: null,
      sad: null,
      surprised: null,
    },
  };

  const readModel = resolveCharacterAssetBundleReadModel(baseCharacter, {
    saveVersion: CURRENT_SAVE_VERSION,
    updatedAt: now,
    entries: [
      {
        id: "test-portrait-neutral",
        ownerCharacterId: "chr_test",
        kind: "appearance-source",
        relativePath: "art/characters/defaults/test/portrait.png",
      },
      {
        id: "test-sprite-sheet",
        ownerCharacterId: "chr_test",
        kind: "sprite-sheet",
        relativePath: "art/characters/defaults/test/sprites/resident-sprite-sheet.png",
        spriteSheet: {
          kind: "motion",
          frameWidth: 192,
          frameHeight: 208,
          columns: 8,
          rows: 9,
          motions: {
            idle: { row: 0, frames: 8 },
          },
        },
      },
    ],
  });
  const status = resolveCharacterAnimationAssetStatus(readModel);

  assert.equal(readModel.spriteSheet.ready, false);
  assert.equal(readModel.spriteSheet.missingReason, "invalid-metadata");
  assert.equal(status.tone, "reviewing");
  assert.equal(status.label, "確認が必要");
}

function testResidentSpriteManifestReadModel(): void {
  const residentSpriteManifest: ResidentSpriteManifest = {
    schemaVersion: "resident-sprite-manifest-v1",
    updatedAt: now,
    residents: [
      {
        residentId: "chr_ryo",
        spriteSheet: {
          assetId: "ryo-sprite-sheet",
          status: "ready",
          sourcePath: "assets/residents/ryo/sprites/resident-sprite-sheet.png",
          publicPath: "/art/characters/defaults/ryo/sprites/resident-sprite-sheet.png",
          frameSize: {
            width: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.frameWidth,
            height: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.frameHeight,
          },
          columns: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.columns,
          rows: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.rows,
          fallbackAssetId: "ryo-portrait-neutral",
          motions: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.motions,
        },
      },
      {
        residentId: "chr_eve",
        spriteSheet: {
          assetId: "eve-sprite-sheet",
          status: "ready",
          sourcePath: "asset-pipeline/incoming/eve/resident-sprite-sheet.png",
          publicPath: "/art/characters/defaults/eve/sprites/resident-sprite-sheet.png",
          frameSize: {
            width: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.frameWidth,
            height: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.frameHeight,
          },
          columns: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.columns,
          rows: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.rows,
          fallbackAssetId: "eve-portrait-neutral",
          motions: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.motions,
        },
      },
    ],
  };
  const manifest = createAssetManifestWithResidentSprites(
    DEFAULT_CHARACTER_ASSET_MANIFEST,
    residentSpriteManifest,
  );
  const state = createSeedRuntimeWorld();
  const ryoAssetBundle = selectCharacterAssetBundleReadModel(state, "chr_ryo", manifest);
  const eveAssetBundle = selectCharacterAssetBundleReadModel(state, "chr_eve", manifest);
  const fallbackManifest = createAssetManifestWithResidentSprites(
    DEFAULT_CHARACTER_ASSET_MANIFEST,
    null,
  );
  const defaultResidentSpriteManifest = createAssetManifestWithResidentSprites(
    DEFAULT_CHARACTER_ASSET_MANIFEST,
    DEFAULT_RESIDENT_SPRITE_MANIFEST,
  );
  const suzuAssetBundle = selectCharacterAssetBundleReadModel(
    state,
    "chr_suzu",
    fallbackManifest,
  );
  const defaultManifestSuzuAssetBundle = selectCharacterAssetBundleReadModel(
    state,
    "chr_suzu",
    defaultResidentSpriteManifest,
  );
  const defaultManifestEveAssetBundle = selectCharacterAssetBundleReadModel(
    state,
    "chr_eve",
    defaultResidentSpriteManifest,
  );
  const partialStatus = resolveCharacterAnimationAssetStatus(ryoAssetBundle);

  assert.equal(ryoAssetBundle.spriteSheet.status, "ready");
  assert.equal(ryoAssetBundle.spriteSheet.ready, true);
  assert.equal(
    ryoAssetBundle.spriteSheet.path,
    "/art/characters/defaults/ryo/sprites/resident-sprite-sheet.png",
  );
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions["walk-right"]?.frames, 8);

  assert.equal(isUnmanagedAssetPipelinePath("asset-pipeline/incoming/eve.png"), true);
  assert.equal(isUnmanagedAssetPipelinePath("assets/residents/ryo/sprites/sheet.png"), false);
  assert.equal(eveAssetBundle.spriteSheet.status, "placeholder");
  assert.equal(eveAssetBundle.spriteSheet.ready, false);
  assert.equal(eveAssetBundle.spriteSheet.path, null);
  assert.equal(eveAssetBundle.spriteSheet.missingReason, "source-not-adopted");
  assert.equal(eveAssetBundle.spriteSheet.fallbackAssetId, "eve-portrait-neutral");

  assert.equal(suzuAssetBundle.spriteSheet.status, "ready");
  assert.equal(suzuAssetBundle.spriteSheet.ready, true);
  assert.equal(
    suzuAssetBundle.spriteSheet.path,
    "/art/characters/defaults/suzu/sprites/resident-sprite-sheet-combined-preview-v2.png",
  );
  assert.equal(suzuAssetBundle.spriteSheet.fallbackPath, "/art/characters/defaults/suzu/portrait.png");
  assert.equal(partialStatus.tone, "ready");
  assert.equal(partialStatus.label, "準備済み");
  assert.equal(defaultManifestEveAssetBundle.spriteSheet.status, "placeholder");
  assert.equal(defaultManifestEveAssetBundle.spriteSheet.ready, false);
  assert.equal(defaultManifestEveAssetBundle.spriteSheet.path, null);
  assert.equal(defaultManifestEveAssetBundle.spriteSheet.missingReason, "not-generated-yet");
  assert.equal(defaultManifestSuzuAssetBundle.spriteSheet.status, "placeholder");
  assert.equal(defaultManifestSuzuAssetBundle.spriteSheet.plannedPath, "/art/characters/defaults/suzu/sprites/resident-sprite-sheet.png");
}

function testInterventionResultEmotesRemainVisible(): void {
  const focusedBystanderEmote = resolveResidentEmote({
    sandboxStage: "focused-event",
    isPrimary: false,
    isSupporting: false,
    latestOutcome: null,
  });
  const primaryHelpEmote = resolveResidentEmote({
    sandboxStage: "result",
    isPrimary: true,
    isSupporting: false,
    latestOutcome: { interventionType: "help" },
  });
  const supportingHelpEmote = resolveResidentEmote({
    sandboxStage: "result",
    isPrimary: false,
    isSupporting: true,
    latestOutcome: { interventionType: "help" },
  });
  const bystanderHelpEmote = resolveResidentEmote({
    sandboxStage: "result",
    isPrimary: false,
    isSupporting: false,
    latestOutcome: { interventionType: "help" },
  });

  assert.equal(focusedBystanderEmote, "talk-request");
  assert.equal(primaryHelpEmote, "joy");
  assert.equal(supportingHelpEmote, "surprise");
  assert.equal(bystanderHelpEmote, "joy");
  assert.equal(resolveResidentMotion(primaryHelpEmote, false, null), "emote-happy");
  assert.equal(resolveResidentMotion(primaryHelpEmote, true, null), "idle");
  assert.equal(resolveResidentMotion("event-alert", false, "left"), "walk-left");
  assert.equal(resolveResidentMotion("talk-request", false, null), "idle");
  assert.equal(resolveResidentMotion("talk-request", false, "right"), "walk-right");
  assert.equal(isResidentMovementBlockingEmote("event-alert"), false);
  assert.equal(isResidentMovementBlockingEmote("talk-request"), false);
  assert.equal(
    resolveVisibleResidentEmote({
      emote: "talk-request",
      dialogueBubbleVisible: true,
    }),
    null,
  );
  assert.equal(
    resolveVisibleResidentEmote({
      emote: "event-alert",
      dialogueBubbleVisible: true,
    }),
    "event-alert",
  );
  assert.equal(
    resolveVisibleResidentEmote({
      emote: "talk-request",
      dialogueBubbleVisible: false,
    }),
    "talk-request",
  );
}

function testFaithDomainModelDefaultsAndBands(): void {
  assert.equal(DEFAULT_CHARACTER_STATUS.faith, 30);

  const seedState = createSeedRuntimeWorld();
  for (const character of seedState.characters.values()) {
    assert.equal(character.state.status.faith, 30);
  }

  const legacyStatusWithoutFaith: Omit<CharacterStatusBlock, "faith"> = {
    vitality: 41,
    empathy: 42,
    insight: 43,
    courage: 44,
    stress: 45,
    trustfulness: 46,
    ambition: 47,
    harmony: 48,
  };
  const normalized = normalizeCharacterStatus(legacyStatusWithoutFaith);

  assert.equal(normalized.vitality, 41);
  assert.equal(normalized.faith, 30);

  const faithBandBoundaries: Array<[number, ReturnType<typeof resolveFaithBand>]> = [
    [0, "disbelieves"],
    [19, "disbelieves"],
    [20, "uncertain"],
    [39, "uncertain"],
    [40, "senses_presence"],
    [59, "senses_presence"],
    [60, "believes"],
    [79, "believes"],
    [80, "devoted"],
    [100, "devoted"],
  ];

  for (const [faith, expectedBand] of faithBandBoundaries) {
    assert.equal(resolveFaithBand(faith), expectedBand);
  }
}

function testFaithChangeApplication(): void {
  assert.equal(applyFaithChange(30, "help_success"), 34);
  assert.equal(applyFaithChange(30, "help_failure"), 28);
  assert.equal(applyFaithChange(30, "watch_success"), 32);
  assert.equal(applyFaithChange(30, "watch_failure"), 29);
  assert.equal(applyFaithChange(30, "trial_success"), 35);
  assert.equal(applyFaithChange(30, "trial_failure"), 26);
  assert.equal(applyFaithChange(30, "player_memo_bonus"), 31);
  assert.equal(applyFaithChange(30, "player_memo_penalty"), 29);
  assert.equal(applyFaithChange(98, "help_success"), 100);
  assert.equal(applyFaithChange(2, "trial_failure"), 0);

  const sensitiveCharacter = character("chr_sensitive", "Sensitive");
  sensitiveCharacter.profile.personality = { sensitivity: 75 };
  assert.equal(
    applyFaithChangeWithPersonality(sensitiveCharacter, "watch_success"),
    33,
  );

  const boldCharacter = character("chr_bold", "Bold");
  boldCharacter.profile.personality = { boldness: 80 };
  assert.equal(
    applyFaithChangeWithPersonality(boldCharacter, "trial_failure"),
    28,
  );

  const curiousCharacter = character("chr_curious", "Curious");
  curiousCharacter.profile.personality = { curiosity: 75 };
  assert.equal(
    applyFaithChangeWithPersonality(curiousCharacter, "help_failure"),
    29,
  );

  const disciplinedCharacter = character("chr_disciplined", "Disciplined");
  disciplinedCharacter.profile.personality = { discipline: 80 };
  assert.equal(
    applyFaithChangeWithPersonality(disciplinedCharacter, "trial_success"),
    37,
  );

  const memoCharacter = character("chr_memo", "Memo");
  assert.equal(
    applyFaithChangeWithPersonality(memoCharacter, "help_success", "help", null),
    34,
  );
  assert.equal(
    applyFaithChangeWithPersonality(memoCharacter, "help_success", "help", "help"),
    35,
  );
  assert.equal(
    applyFaithChangeWithPersonality(memoCharacter, "help_success", "help", "trial"),
    33,
  );
  assert.equal(
    applyFaithChangeWithPersonality(memoCharacter, "player_memo_bonus", "help", "help"),
    31,
  );
  assert.equal(
    applyFaithChangeWithPersonality(memoCharacter, "player_memo_penalty", "help", "trial"),
    29,
  );
}

function testWorldPrincipleEngine(): void {
  const status = (patch: Partial<CharacterStatusBlock>): CharacterStatusBlock => {
    const next = { ...DEFAULT_CHARACTER_STATUS };
    for (const [key, value] of Object.entries(patch)) {
      if (typeof value === "number") {
        next[key] = value;
      }
    }
    return next;
  };
  const withStatus = (id: string, patch: Partial<CharacterStatusBlock>): Character => ({
    ...character(id, id),
    state: {
      ...character(id, id).state,
      status: status(patch),
    },
  });

  assert.equal(resolveImplicitPhase(status({ ambition: 90, empathy: 85 })), "wood");
  assert.equal(
    resolveImplicitPhase(status({ courage: 90, stress: 85, ambition: 20, empathy: 20 })),
    "fire",
  );
  assert.equal(
    resolveImplicitPhase(
      status({ harmony: 90, trustfulness: 85, ambition: 20, empathy: 20 }),
    ),
    "earth",
  );
  assert.equal(
    resolveImplicitPhase(status({ insight: 90, stress: 10, ambition: 20, empathy: 20 })),
    "metal",
  );
  assert.equal(
    resolveImplicitPhase(status({ vitality: 95, empathy: 90, ambition: 20 })),
    "water",
  );
  assert.equal(
    resolveImplicitPhase(
      status({
        ambition: 70,
        empathy: 70,
        vitality: 70,
        courage: 40,
        stress: 30,
        harmony: 30,
        trustfulness: 30,
        insight: 30,
      }),
    ),
    "wood",
  );

  const expectedRelations: Record<FivePhase, Record<FivePhase, string>> = {
    wood: {
      wood: "neutral",
      fire: "nourish",
      earth: "restrain",
      metal: "neutral",
      water: "neutral",
    },
    fire: {
      wood: "neutral",
      fire: "neutral",
      earth: "nourish",
      metal: "restrain",
      water: "neutral",
    },
    earth: {
      wood: "neutral",
      fire: "neutral",
      earth: "neutral",
      metal: "nourish",
      water: "restrain",
    },
    metal: {
      wood: "restrain",
      fire: "neutral",
      earth: "neutral",
      metal: "neutral",
      water: "nourish",
    },
    water: {
      wood: "nourish",
      fire: "restrain",
      earth: "neutral",
      metal: "neutral",
      water: "neutral",
    },
  };
  const phases = Object.keys(expectedRelations) as FivePhase[];
  for (const from of phases) {
    for (const to of phases) {
      assert.equal(getPrincipleRelation(from, to), expectedRelations[from][to]);
    }
  }

  const woodCharacter = withStatus("chr_wood", {
    ambition: 90,
    empathy: 85,
    vitality: 40,
    courage: 20,
    stress: 20,
  });
  const fireTemplate: EventTemplate = {
    id: "fire-template",
    name: "Fire Template",
    situationTags: ["test"],
    summaryTemplate: "{name}",
    principleProfile: {
      dominantPhase: "fire",
      polarity: "balanced",
      principleRole: "restrain",
    },
  };
  const metalTemplate: EventTemplate = {
    id: "metal-template",
    name: "Metal Template",
    situationTags: ["test"],
    summaryTemplate: "{name}",
    principleProfile: {
      dominantPhase: "metal",
      polarity: "balanced",
      principleRole: "reveal",
    },
  };
  const untaggedTemplate: EventTemplate = {
    id: "untagged",
    name: "Untagged",
    situationTags: ["test"],
    summaryTemplate: "{name}",
  };
  const context = { primaryCharacter: woodCharacter, participantCharacters: [] };

  assert.equal(resolvePolarity(status({ courage: 90, stress: 90, ambition: 90 })), "yang");
  assert.equal(resolvePolarity(status({ vitality: 90, harmony: 90, empathy: 90, stress: 10 })), "yin");
  assert.equal(resolvePolarity(DEFAULT_CHARACTER_STATUS), "balanced");
  assert.equal(calcEventWeight(untaggedTemplate, context), 1.0);
  assert.equal(
    calcEventWeight(fireTemplate, context) > calcEventWeight(metalTemplate, context),
    true,
  );

  const selectedFirst = selectEventTemplate(EVENT_TEMPLATES, context, "principle-seed");
  const selectedSecond = selectEventTemplate(EVENT_TEMPLATES, context, "principle-seed");
  assert.equal(selectedFirst.id, selectedSecond.id);

  const state = worldState();
  const generatedFirst = generateWorldEvent({
    session: state.session,
    characters: state.characters,
    relations: [...state.relations.values()],
    now,
    seed: "principle-event-seed",
  });
  const generatedSecond = generateWorldEvent({
    session: state.session,
    characters: state.characters,
    relations: [...state.relations.values()],
    now,
    seed: "principle-event-seed",
  });
  assert.equal(generatedFirst.templateId, generatedSecond.templateId);
  assert.equal(EVENT_TEMPLATES.some((template) => template.id === generatedFirst.templateId), true);
  assert.equal(JSON.stringify(generatedFirst).includes('"wood":'), false);
  assert.equal(JSON.stringify(generatedFirst).includes('"fire":'), false);

  const issuedSnapshot = issueSnapshotService(worldState(), {
    characterId: "chr_a",
    snapshotId: "snp_no_phase",
    now,
  });
  const issuedPassport = issuePassportService(issuedSnapshot.state, {
    snapshotId: "snp_no_phase",
    passportId: "psp_no_phase",
    fileNameToken: "no-phase",
    schemaVersion: 1,
    now,
  });
  const passportDisplayJson = JSON.stringify(issuedPassport.passport.display);
  for (const phase of phases) {
    assert.equal(passportDisplayJson.includes(`"${phase}":`), false);
  }
}

function testVoiceProfileStorageAndResolver(): void {
  const state = createSeedRuntimeWorld();
  const expectedSeedProfiles = [
    ["chr_eve", "eve"],
    ["chr_garan", "garan"],
    ["chr_ryo", "ryo"],
    ["chr_suzu", "suzu"],
  ] as const;

  for (const [characterId, speechStyleId] of expectedSeedProfiles) {
    const seedCharacter = state.characters.get(characterId);
    assert.ok(seedCharacter);
    assert.equal(seedCharacter.profile.speechStyleId, speechStyleId);

    const resolvedProfile = resolveVoiceProfile(seedCharacter);
    const doNotSay = resolvedProfile.doNotSay.join("");

    assert.equal(doNotSay.includes("あなた"), true);
    assert.equal(doNotSay.includes("画面"), true);
    assert.equal(doNotSay.includes("セーブ"), true);
    assert.equal(
      resolvedProfile.sandboxDialogueExamples.some(
        (example) => example.type === "god_indirect_reaction",
      ),
      true,
    );
    assert.equal(
      resolvedProfile.passportDialogueExamples.some(
        (example) => example.type === "first_encounter",
      ),
      true,
    );
  }

  const garanProfile = getDefaultVoiceProfile("garan");
  assert.equal(DEFAULT_DO_NOT_SAY_SANDBOX.join("").includes("ステータス"), true);
  assert.equal(ALLOWED_GOD_INDIRECT_REFERENCES.length >= 3, true);

  // atomicity: 「あなた」「プレイヤー」「神様」が別エントリである
  const entryWithAnata = DEFAULT_DO_NOT_SAY_SANDBOX.filter((e) => e.includes("「あなた」"));
  const entryWithPlayer = DEFAULT_DO_NOT_SAY_SANDBOX.filter((e) => e.includes("「プレイヤー」"));
  const entryWithGodSama = DEFAULT_DO_NOT_SAY_SANDBOX.filter((e) => e.includes("「神様」"));
  assert.equal(entryWithAnata.length, 1);
  assert.equal(entryWithPlayer.length, 1);
  assert.equal(entryWithGodSama.length, 1);
  assert.notEqual(entryWithAnata[0], entryWithPlayer[0]);
  assert.notEqual(entryWithAnata[0], entryWithGodSama[0]);
  assert.notEqual(entryWithPlayer[0], entryWithGodSama[0]);
  assert.equal(
    garanProfile.passportDialogueExamples.some(
      (example) =>
        example.type === "first_encounter" &&
        /あなた|神様|見ていてくれた/.test(example.text),
    ),
    true,
  );

  const fallbackCharacter = character("chr_unknown", "Unknown");
  const fallbackProfile = resolveVoiceProfile(fallbackCharacter);
  assert.equal(fallbackProfile.firstPerson, "私");
  assert.equal(
    fallbackProfile.sandboxDialogueExamples.some(
      (example) => example.type === "god_indirect_reaction",
    ),
    true,
  );
}

function testPromoteAssetToReadyGate(): void {
  assert.equal(
    promoteAssetToReady({
      currentStatus: "needs_review",
      review: { approvedBy: "po@example.com", approvedAt: now, approvalRole: "PO" },
    }),
    "ready",
  );

  assert.equal(
    promoteAssetToReady({
      currentStatus: "needs_review",
      review: { approvedBy: "reviewer@example.com", approvedAt: now, approvalRole: "manual-reviewer" },
    }),
    "ready",
  );

  assert.throws(
    () =>
      promoteAssetToReady({
        currentStatus: "placeholder",
        review: { approvedBy: "po@example.com", approvedAt: now, approvalRole: "PO" },
      }),
    /Cannot promote to ready from 'placeholder'/,
  );

  assert.throws(
    () =>
      promoteAssetToReady({
        currentStatus: "missing",
        review: { approvedBy: "po@example.com", approvedAt: now, approvalRole: "PO" },
      }),
    /Cannot promote to ready from 'missing'/,
  );

  assert.throws(
    () =>
      promoteAssetToReady({
        currentStatus: "rejected",
        review: { approvedBy: "po@example.com", approvedAt: now, approvalRole: "PO" },
      }),
    /Cannot promote to ready from 'rejected'/,
  );

  assert.throws(
    () =>
      promoteAssetToReady({
        currentStatus: "needs_review",
        review: {
          approvedBy: "po@example.com",
          approvedAt: now,
          approvalRole: "admin" as unknown as "PO",
        },
      }),
    /Invalid approvalRole 'admin'/,
  );
}

function testValidateGeneratedNarrativeCandidate(): void {
  const reject = validateGeneratedNarrativeCandidate("キャラクターが死亡する場面が描かれた");
  assert.equal(reject.ok, false);
  if (!reject.ok) {
    assert.equal(reject.violations.length > 0, true);
  }

  const rejectEnglish = validateGeneratedNarrativeCandidate("The character faces death in this scene");
  assert.equal(rejectEnglish.ok, false);

  const rejectLifespan = validateGeneratedNarrativeCandidate("寿命が尽きた");
  assert.equal(rejectLifespan.ok, false);

  const rejectMedal = validateGeneratedNarrativeCandidate("勲章を受け取った");
  assert.equal(rejectMedal.ok, false);

  const pass = validateGeneratedNarrativeCandidate("今日は楽しい一日だった");
  assert.equal(pass.ok, true);

  const passEmpty = validateGeneratedNarrativeCandidate("");
  assert.equal(passEmpty.ok, true);
}

function testDialogueAuthoringPreview(): void {
  const world = createSeedRuntimeWorld();

  // buildDialogueWorldDigest returns sessionId matching session
  const events = [...world.events.values()];
  const relations = [...world.relations.values()];
  const digest = buildDialogueWorldDigest(world.session, world.characters, relations, events);
  assert.equal(digest.sessionId, world.session.id);
  assert.ok(digest.activeCharacters.length > 0);

  // activeCharacters have faithBand — no numeric faith or status values in digest
  const validBands = ["disbelieves", "uncertain", "senses_presence", "believes", "devoted"];
  for (const c of digest.activeCharacters) {
    assert.ok(validBands.includes(c.faithBand));
    assert.ok(typeof c.visibleStateSummary === "string");
  }
  const digestJson = JSON.stringify(digest);
  assert.equal(digestJson.includes('"currentFaith":'), false);
  assert.equal(digestJson.includes('"faith":'), false);
  assert.equal(digestJson.includes('"score":'), false);
  assert.equal(digestJson.includes('"currentStatus":'), false);

  // buildDialoguePromptPack produces a non-empty prompt
  const pack = buildDialoguePromptPack(digest);
  assert.ok(pack.promptText.length > 0);
  assert.equal(pack.digestId.startsWith(digest.sessionId), true);

  // authored_fixture candidate: DialogueCandidate source and reviewStatus
  const fixture: DialogueCandidate = {
    id: "fixture-001",
    characterId: "chr_garan",
    text: "今日は風がやわらかいね",
    type: "daily",
    source: "authored_fixture",
    reviewStatus: "accepted",
    createdAt: "2026-05-08T00:00:00Z",
  };
  assert.equal(fixture.source, "authored_fixture");
  assert.equal(fixture.reviewStatus, "accepted");

  // parseDialogueCandidatesFromText: known speaker resolves characterId
  const nameToIdMap = new Map([["Garan", "chr_garan"], ["Ryo", "chr_ryo"]]);
  const parseNow = "2026-05-08T00:00:00Z";
  const knownResult = parseDialogueCandidatesFromText("Garan：今日は風がやわらかいね", nameToIdMap, parseNow);
  assert.equal(knownResult.length, 1);
  assert.equal(knownResult[0].characterId, "chr_garan");
  assert.equal(knownResult[0].rawSpeakerName, "Garan");
  assert.equal(knownResult[0].source, "external_llm_handoff");
  assert.equal(knownResult[0].reviewStatus, "needs_review");

  // parseDialogueCandidatesFromText: unknown speaker → characterId is null
  const unknownResult = parseDialogueCandidatesFromText("Suzu：散歩したい気分", nameToIdMap, parseNow);
  assert.equal(unknownResult.length, 1);
  assert.equal(unknownResult[0].characterId, null);
  assert.equal(unknownResult[0].rawSpeakerName, "Suzu");

  // ParsedCandidateRaw type: llm_handoff starts as needs_review
  const llmCandidate: ParsedCandidateRaw = {
    id: "llm-001",
    rawSpeakerName: "Garan",
    characterId: "chr_garan",
    text: "今日は風がやわらかいね",
    type: "daily",
    source: "external_llm_handoff",
    reviewStatus: "needs_review",
    createdAt: "2026-05-08T00:00:00Z",
  };
  assert.equal(llmCandidate.source, "external_llm_handoff");
  assert.equal(llmCandidate.reviewStatus, "needs_review");

  // validateDialogue returns DialogueValidationResult
  const tooLong = validateDialogue("あ".repeat(41));
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.ok(tooLong.violations.length > 0);

  const justRight = validateDialogue("あ".repeat(40));
  assert.equal(justRight.ok, true);

  const withForbiddenAddress = validateDialogue("あなたのことが好き");
  assert.equal(withForbiddenAddress.ok, false);

  const withGodDirect = validateDialogue("神様を信じている");
  assert.equal(withGodDirect.ok, false);

  const withDeath = validateDialogue("キャラクターが死亡する");
  assert.equal(withDeath.ok, false);

  const normalText = validateDialogue("今日は風がやわらかいね");
  assert.equal(normalText.ok, true);

  // min 5文字チェック
  const tooShort = validateDialogue("今日");
  assert.equal(tooShort.ok, false);
  if (!tooShort.ok) assert.ok(tooShort.violations.some((v) => v.includes("文字数不足")));

  const fiveChars = validateDialogue("今日は晴れ");
  assert.equal(fiveChars.ok, true);

  // UI用語チェック
  const withSave = validateDialogue("セーブしてから行く");
  assert.equal(withSave.ok, false);

  const withStatus = validateDialogue("ステータスが変わった");
  assert.equal(withStatus.ok, false);

  // 好感度/友好度 numeric pattern
  const withKansendo = validateDialogue("好感度が60になった");
  assert.equal(withKansendo.ok, false);

  const withYukodo = validateDialogue("友好度は30だよ");
  assert.equal(withYukodo.ok, false);

  // 信仰度パターン拡張（が/は も検出）
  const withFaithGa = validateDialogue("信仰度が50になった");
  assert.equal(withFaithGa.ok, false);

  const withFaithWord = validateDialogue("信仰が揺れている");
  assert.equal(withFaithWord.ok, false);

  const withFaithBandWord = validateDialogue("faithBand が変わった");
  assert.equal(withFaithBandWord.ok, false);

  // needs_review DialogueCandidate is excluded from accepted filter
  const needsReviewCandidate: DialogueCandidate = {
    id: "llm-002",
    characterId: "chr_garan",
    text: "今日は風がやわらかいね",
    type: "daily",
    source: "external_llm_handoff",
    reviewStatus: "needs_review",
    createdAt: "2026-05-08T00:00:00Z",
  };
  const candidates: DialogueCandidate[] = [needsReviewCandidate];
  const accepted = candidates.filter((c) => c.reviewStatus === "accepted");
  assert.equal(accepted.length, 0);

  // DialogueReviewStatus exhaustiveness check
  const status: DialogueReviewStatus = "rejected";
  assert.equal(status, "rejected");

  // ConversationLogEntry type check (PBI 4b 前提)
  // phase_change is a valid DialogueTrigger
  const phaseTrigger: DialogueTrigger = "phase_change";
  assert.equal(phaseTrigger, "phase_change");

  const trigger: DialogueTrigger = "intervention_applied";
  const logEntry: ConversationLogEntry = {
    id: "log-001",
    speakerCharacterId: "chr_garan",
    speakerDisplayName: "Garan",
    text: "今日は風がやわらかいね",
    dialogueType: "daily",
    trigger,
    createdAt: "2026-05-08T00:00:00Z",
  };
  assert.equal(logEntry.trigger, "intervention_applied");
  assert.equal(logEntry.speakerDisplayName, "Garan");

  // PBI 4b-min runtime slice: authored fixture only, accepted, validated, max 2.
  const runtimeCandidates = createObservedDialogueCandidates({
    trigger: "event_started",
    characters: [...world.characters.values()],
    event: events[0],
    restrictEventParticipants: true,
    now: "2026-05-08T00:00:00Z",
    seed: "event-started-proof",
    maxCandidates: 3,
  });
  assert.ok(runtimeCandidates.length > 0);
  assert.ok(runtimeCandidates.length <= events[0].participantCharacterIds.length);
  for (const candidate of runtimeCandidates) {
    assert.ok(events[0].participantCharacterIds.includes(candidate.characterId));
  }
  for (const candidate of runtimeCandidates) {
    assert.equal(candidate.source, "authored_fixture");
    assert.equal(candidate.reviewStatus, "accepted");
    assert.equal(validateDialogue(candidate.text).ok, true);
    assert.equal(candidate.text.includes("信仰"), false);
    assert.equal(candidate.text.includes("信仰度"), false);
  }

  const visibleRuntimeCandidates = selectVisibleObservedDialogueCandidates(
    runtimeCandidates,
    2,
  );
  assert.equal(visibleRuntimeCandidates.length, Math.min(2, runtimeCandidates.length));

  const interventionCandidates = createObservedDialogueCandidates({
    trigger: "intervention_applied",
    characters: [...world.characters.values()],
    event: events[0],
    restrictEventParticipants: true,
    now: "2026-05-08T00:00:01Z",
    seed: "intervention-proof",
  });
  assert.ok(interventionCandidates.length > 0);
  for (const candidate of interventionCandidates) {
    assert.ok(events[0].participantCharacterIds.includes(candidate.characterId));
  }
  assert.equal(interventionCandidates[0].type, "god_indirect_reaction");

  const idleActiveCandidates = createObservedDialogueCandidates({
    trigger: "idle_timer",
    characters: [...world.characters.values()],
    event: events[0],
    restrictEventParticipants: true,
    now: "2026-05-08T00:00:02Z",
    seed: "idle-active-proof",
  });
  assert.ok(idleActiveCandidates.length > 0);
  assert.ok(
    idleActiveCandidates.some((candidate) =>
      [...world.characters.values()].some((character) => character.id === candidate.characterId),
    ),
  );

  const idleCandidates = createObservedDialogueCandidates({
    trigger: "idle_timer",
    characters: [],
    now: "2026-05-08T00:00:02Z",
    seed: "no-candidate-proof",
  });
  assert.equal(idleCandidates.length, 0);

  const negativeMaxCandidates = createObservedDialogueCandidates({
    trigger: "idle_timer",
    characters: [...world.characters.values()],
    now: "2026-05-08T00:00:03Z",
    seed: "negative-max-proof",
    maxCandidates: -1,
  });
  assert.equal(negativeMaxCandidates.length, 0);
}

function testPassportOutsideWorldPayload(): void {
  // Build a passport via the service pipeline
  const afterIntervention = applyInterventionService(worldState(), {
    type: "help",
    now,
    idSeed: "pbi5-source",
  }).state;

  const issuedSnapshot = issueSnapshotService(afterIntervention, {
    characterId: "chr_a",
    snapshotId: "snp_pbi5_001",
    now,
    annotationTags: ["pbi5-test"],
  });

  const issuedPassport = issuePassportService(issuedSnapshot.state, {
    snapshotId: issuedSnapshot.snapshot.id,
    passportId: "psp_pbi5_001",
    fileNameToken: "aki--pbi5-001",
    schemaVersion: 1,
    now,
  });

  const display = issuedPassport.passport.display;

  // faithBand resolves to a valid value
  const validBands = ["disbelieves", "uncertain", "senses_presence", "believes", "devoted"];
  assert.ok(validBands.includes(display.godRelationship.faithBand));

  // systemPrompt is at least 50 characters
  assert.ok(display.externalAiPromptBlock.systemPrompt.length > 50);

  // lifeMemory.keyEvents reflects recentEvents
  assert.ok(Array.isArray(display.lifeMemory.keyEvents));

  // memorySummary contains no raw numeric status values
  const memorySummaryJson = JSON.stringify(display.lifeMemory.memorySummary);
  assert.equal(/:\s*\d+/.test(memorySummaryJson), false);

  // display JSON must not contain five-phase internal keys
  const displayJson = JSON.stringify(display);
  assert.equal(displayJson.includes('"wood":'), false);
  assert.equal(displayJson.includes('"fire":'), false);
  assert.equal(displayJson.includes('"earth":'), false);
  assert.equal(displayJson.includes('"metal":'), false);
  assert.equal(displayJson.includes('"water":'), false);

  // generatePassportDisplay directly
  const directDisplay = generatePassportDisplay(issuedSnapshot.snapshot);
  assert.equal(directDisplay.character.name, "Aki");
  assert.ok(directDisplay.voiceProfile.sandboxDoNotSay.length > 0);

  // derivePassportDoNotSay excludes "あなた" entries
  const sandbox = ["「あなた」への直接呼びかけ", "「神様」への直接呼びかけ", "「画面」認識表現"];
  const outside = derivePassportDoNotSay(sandbox);
  assert.equal(outside.length, 1);
  assert.equal(outside[0], "「画面」認識表現");

  // firstEncounterLines has at least 3 entries (with fallbacks)
  assert.ok(display.externalAiPromptBlock.firstEncounterLines.length >= 3);

  // currentFaith numeric value is not leaked into externalAiPromptBlock
  const promptBlockJson = JSON.stringify(display.externalAiPromptBlock);
  assert.equal(promptBlockJson.includes('"currentFaith":'), false);

  // buildMemorySummary with no events returns fallback text
  const empty = buildMemorySummary({ sourceCharacterId: "chr_x", events: [], relations: [] });
  assert.ok(empty.memorySummary.length > 0);
  assert.equal(empty.keyEvents.length, 0);

  // buildMemorySummary sorts relations by abs(score) desc, source on A side
  const { relationSummaries } = buildMemorySummary({
    sourceCharacterId: "a",
    events: [],
    relations: [
      { id: "r1", characterAId: "a", characterBId: "b", score: 5, derivedFromEventIds: [], lastRecomputedAt: now },
      { id: "r2", characterAId: "a", characterBId: "c", score: -30, derivedFromEventIds: [], lastRecomputedAt: now },
      { id: "r3", characterAId: "a", characterBId: "d", score: 20, derivedFromEventIds: [], lastRecomputedAt: now },
    ],
  });
  assert.equal(relationSummaries[0].withCharacterId, "c");
  assert.equal(relationSummaries[1].withCharacterId, "d");

  // source on B side resolves A as the "other" character
  const { relationSummaries: bSideRelations } = buildMemorySummary({
    sourceCharacterId: "c",
    events: [],
    relations: [
      { id: "r2", characterAId: "a", characterBId: "c", score: -30, derivedFromEventIds: [], lastRecomputedAt: now },
    ],
  });
  assert.equal(bSideRelations[0].withCharacterId, "a");

  // self-relation (both sides same) is excluded
  const { relationSummaries: selfRelations } = buildMemorySummary({
    sourceCharacterId: "x",
    events: [],
    relations: [
      { id: "r_self", characterAId: "x", characterBId: "x", score: 0, derivedFromEventIds: [], lastRecomputedAt: now },
    ],
  });
  assert.equal(selfRelations.length, 0);

  // relation not involving sourceCharacterId at all is excluded
  const { relationSummaries: unrelatedRelations } = buildMemorySummary({
    sourceCharacterId: "a",
    events: [],
    relations: [
      { id: "r_unrelated", characterAId: "b", characterBId: "c", score: 30, derivedFromEventIds: [], lastRecomputedAt: now },
    ],
  });
  assert.equal(unrelatedRelations.length, 0);

  // interventionType is absent (undefined) when unknown
  const { keyEvents: eventsWithType } = buildMemorySummary({
    sourceCharacterId: "chr_x",
    events: [{ id: "e1", summary: "テスト", status: "resolved", createdAt: now }],
    relations: [],
  });
  assert.equal("interventionType" in eventsWithType[0], false);
}

function testPassportConfirmUi(): void {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
  } as Storage;

  assert.equal(hasSeenPassportConfirm(mockStorage), false);
  markPassportConfirmSeen(mockStorage);
  assert.equal(hasSeenPassportConfirm(mockStorage), true);
  assert.equal(hasSeenPassportConfirm(mockStorage), true);

  const allText = [...PASSPORT_CONFIRM_TEXTS.bodyLines, PASSPORT_CONFIRM_TEXTS.title].join(" ");
  for (const word of PASSPORT_FORBIDDEN_WORDS) {
    assert.equal(allText.includes(word), false);
  }

  const bands: FaithBand[] = ["disbelieves", "uncertain", "senses_presence", "believes", "devoted"];
  for (const band of bands) {
    assert.ok(FAITH_BAND_LABELS[band].length > 0);
  }
}

function testFaithExposureAndHandoffPrompt(): void {
  // --- Goal 2: faith patch filter ---
  const mixedPatch = {
    vitality: 2,
    stress: -1,
    faith: 4,
    faithChange: {
      characterId: "chr_ryo",
      previousFaith: 30,
      newFaith: 34,
      delta: 4,
      trigger: "help_success",
      interventionId: "itv_001",
    },
  };

  const visible = createVisibleChangePatchForSandboxUi(mixedPatch);
  assert.equal("faith" in visible, false);
  assert.equal("faithChange" in visible, false);
  assert.ok("vitality" in visible);
  assert.ok("stress" in visible);

  const visibleJson = JSON.stringify(visible);
  assert.equal(visibleJson.includes("faith"), false);
  assert.equal(visibleJson.includes("30"), false);
  assert.equal(visibleJson.includes("34"), false);
  assert.equal(visibleJson.includes("help_success"), false);

  const faithOnlyPatch: Record<string, unknown> = {
    faith: 4,
    faithChange: { previousFaith: 30, newFaith: 34, delta: 4 },
  };
  const visibleFaithOnly = createVisibleChangePatchForSandboxUi(faithOnlyPatch);
  assert.equal(Object.keys(visibleFaithOnly).length, 0);

  // --- Goal 4 & 5: handoff prompt structure ---
  const ws = worldState();
  const digest = buildDialogueWorldDigest(
    ws.session,
    ws.characters,
    [...ws.relations.values()],
    [...ws.events.values()],
  );
  const pack = buildDialoguePromptPack(digest);
  const pt = pack.promptText;

  // Must contain
  assert.ok(pt.includes("Return only a valid JSON array"));
  assert.ok(pt.includes('"name"'));
  assert.ok(pt.includes('"text"'));
  assert.ok(pt.includes("allowedSpeakers"));
  assert.ok(pt.includes("divinePerceptionBand"));
  assert.ok(pt.includes("Return 6 to 10 candidates"));
  assert.ok(pt.includes("Do not copy the placeholder strings"));
  assert.ok(pt.includes("Do not explain this prompt"));

  // Must NOT contain Japanese faith labels
  assert.equal(pt.includes("信仰度"), false);
  assert.equal(pt.includes("信仰段階"), false);

  // Must NOT contain placeholder speaker name
  assert.equal(pt.includes("ExactSpeakerName"), false);

  // Must have at least one active speaker name (from allowedSpeakers in example)
  const speakerNames = digest.activeCharacters.map((c) => c.name);
  assert.ok(speakerNames.length > 0);
  assert.ok(pt.includes(speakerNames[0]));

  // --- Goal 5: parser round-trip ---
  const nameToIdMap = new Map<string, string>();
  for (const c of ws.characters.values()) {
    nameToIdMap.set(c.profile.displayName, c.id);
  }
  const firstSpeaker = speakerNames[0];
  const simulatedLlmOutput = `[{"name":"${firstSpeaker}","text":"風が、少し変わった気がする。"}]`;
  const parsed = parseDialogueCandidatesFromText(simulatedLlmOutput, nameToIdMap, now);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].rawSpeakerName, firstSpeaker);
  assert.ok(parsed[0].characterId !== null);
  const vResult = validateDialogue(parsed[0].text);
  assert.ok(vResult.ok);
}

// ──────────────────────────────────────────────────────────────────
// PBI 8a: MVP Acceptance Smoke Tests
// ──────────────────────────────────────────────────────────────────

function testFaithHidingSmokeTests(): void {
  // 1. ChangeSet.patch 内部には faith 関連フィールドが存在してよい
  const internalPatch = {
    vitality: 2,
    stress: -1,
    faith: 5,
    currentFaith: 35,
    faithChange: {
      characterId: "chr_a",
      previousFaith: 30,
      newFaith: 35,
      delta: 5,
      trigger: "help_success",
      interventionId: "itv_001",
    },
  };
  assert.ok("faith" in internalPatch);
  assert.ok("faithChange" in internalPatch);

  // 2. sandbox UI 表示用 formatter には internal faith 関連フィールドが出ない
  const visible = createVisibleChangePatchForSandboxUi(internalPatch);
  const visibleJson = JSON.stringify(visible);
  assert.equal("faith" in visible, false);
  assert.equal("faithChange" in visible, false);
  assert.equal("currentFaith" in visible, false);
  assert.equal(visibleJson.includes("previousFaith"), false);
  assert.equal(visibleJson.includes("newFaith"), false);
  assert.equal(visibleJson.includes("delta"), false);
  assert.equal(visibleJson.includes("help_success"), false);
  assert.equal(visibleJson.includes("信仰"), false);
  assert.equal(visibleJson.includes("信仰度"), false);

  // watch_success / trial_success も出ない
  const watchPatch = { faith: 3, faithChange: { trigger: "watch_success", previousFaith: 20, newFaith: 23, delta: 3 } };
  const trialPatch = { faith: 2, faithChange: { trigger: "trial_success", previousFaith: 23, newFaith: 25, delta: 2 } };
  for (const p of [watchPatch, trialPatch]) {
    const v = createVisibleChangePatchForSandboxUi(p);
    const j = JSON.stringify(v);
    assert.equal(j.includes("faith"), false);
    assert.equal(j.includes("_success"), false);
    assert.equal(j.includes("delta"), false);
  }

  // Non-faith fields remain visible
  assert.ok("vitality" in visible);
  assert.ok("stress" in visible);

  // 3. faith-only patch の visible 結果は空
  const faithOnlyPatch = {
    faith: 5,
    currentFaith: 35,
    faithChange: { previousFaith: 30, newFaith: 35, delta: 5, trigger: "help_success" },
  };
  const visibleFaithOnly = createVisibleChangePatchForSandboxUi(faithOnlyPatch);
  assert.equal(Object.keys(visibleFaithOnly).length, 0);

  // 4. validateDialogue が以下を reject する
  assert.equal(validateDialogue("信仰度が50になった").ok, false);
  assert.equal(validateDialogue("信仰が揺れている").ok, false);
  assert.equal(validateDialogue("faithBand が変わった").ok, false);
  assert.equal(validateDialogue("画面を見て").ok, false);
  assert.equal(validateDialogue("ステータスが上がった").ok, false);
  assert.equal(validateDialogue("あなたのおかげだ").ok, false);
  assert.equal(validateDialogue("神様ありがとう").ok, false);

  // 有効な発話は通過する
  assert.equal(validateDialogue("今日は風がやわらかいね").ok, true);
  assert.equal(validateDialogue("木陰が気持ちよさそう。").ok, true);
}

function testDialogueHandoffSmokeTests(): void {
  const ws = worldState();
  const digest = buildDialogueWorldDigest(
    ws.session,
    ws.characters,
    [...ws.relations.values()],
    [...ws.events.values()],
  );
  const pack = buildDialoguePromptPack(digest);
  const pt = pack.promptText;

  // 1. 人間向け説明がコピー文に混入していない
  assert.equal(pt.includes("## 人間オペレーター向け"), false);
  assert.equal(pt.includes("## ChatGPTで使う場合"), false);
  assert.equal(pt.includes("キャラクター名のProject"), false);
  assert.equal(pt.includes("この時点では外部AIへ自動送信されません"), false);

  // 2. 解説禁止命令が含まれる
  assert.ok(pt.includes("Do not explain this prompt"));
  assert.ok(pt.includes("Do not summarize this prompt"));
  assert.ok(pt.includes("Do not analyze this prompt"));
  assert.ok(pt.includes("Do not say what this file is"));

  // 3. JSON のみを要求している
  assert.ok(pt.includes("Return only a valid JSON array"));
  assert.ok(pt.includes("Your entire response must be parseable by JSON.parse"));
  assert.ok(pt.includes('Start your response with "[" and end with "]"'));
  assert.ok(pt.includes("Now return the JSON array only"));

  // 4. 出力形式と必須フィールドが含まれる
  assert.ok(pt.includes("allowedSpeakers"));
  assert.ok(pt.includes('"name"'));
  assert.ok(pt.includes('"text"'));
  assert.ok(pt.includes("divinePerceptionBand"));
  assert.ok(pt.includes("Return 6 to 10 candidates"));
  assert.ok(pt.includes("Your actual response must contain 6 to 10 items"));
  assert.ok(pt.includes("Do not return only the example items"));
  assert.ok(pt.includes("Now return the JSON array only, with 6 to 10 items"));

  // 5. 禁止語が日本語ラベルとして出ない
  assert.equal(pt.includes("信仰度"), false);
  assert.equal(pt.includes("信仰段階"), false);
  assert.equal(pt.includes("faithBand"), false);
  assert.equal(pt.includes("ExactSpeakerName"), false);

  const speakerNames = digest.activeCharacters.map((c) => c.name);
  assert.ok(speakerNames.length > 0);
  assert.ok(pt.includes(speakerNames[0]));

  // 3. parseDialogueCandidatesFromText が known speaker を正しく parse する
  const nameToIdMap = new Map<string, string>();
  for (const c of ws.characters.values()) {
    nameToIdMap.set(c.profile.displayName, c.id);
  }
  const knownLlmOutput = `[{"name":"${speakerNames[0]}","text":"風が、少し変わった気がする。"}]`;
  const knownParsed = parseDialogueCandidatesFromText(knownLlmOutput, nameToIdMap, now);
  assert.equal(knownParsed.length, 1);
  assert.equal(knownParsed[0].rawSpeakerName, speakerNames[0]);
  assert.ok(knownParsed[0].characterId !== null);
  assert.equal(validateDialogue(knownParsed[0].text).ok, true);

  // 5. unknown speaker → characterId === null
  const unknownLlmOutput = `[{"name":"Unknown","text":"風が、少し変わった気がする。"}]`;
  const unknownParsed = parseDialogueCandidatesFromText(unknownLlmOutput, nameToIdMap, now);
  assert.equal(unknownParsed.length, 1);
  assert.equal(unknownParsed[0].characterId, null);
  // unknown speaker は accepted 候補になれない
  const unknownAccepted = unknownParsed.filter(
    (c) => c.characterId !== null,
  );
  assert.equal(unknownAccepted.length, 0);
}

function testObservedDialogueRuntimeSmokeTests(): void {
  const charA = character("chr_a", "Aki");
  const charB = character("chr_b", "Beni");
  const charC = character("chr_c", "Caro");
  const evt = event("evt_smoke");

  // 1. event_started: authored_fixture / accepted / event participant のみ
  const eventStartedCandidates = createObservedDialogueCandidates({
    trigger: "event_started",
    characters: [charA, charB, charC],
    event: evt,
    restrictEventParticipants: true,
    now,
    seed: "smoke-event-started",
  });
  assert.ok(eventStartedCandidates.length > 0);
  for (const c of eventStartedCandidates) {
    assert.equal(c.source, "authored_fixture");
    assert.equal(c.reviewStatus, "accepted");
    assert.ok(evt.participantCharacterIds.includes(c.characterId));
  }

  // 2. intervention_applied: god_indirect_reaction / event participant のみ
  const interventionCandidates = createObservedDialogueCandidates({
    trigger: "intervention_applied",
    characters: [charA, charB, charC],
    event: evt,
    restrictEventParticipants: true,
    now,
    seed: "smoke-intervention",
  });
  assert.ok(interventionCandidates.length > 0);
  for (const c of interventionCandidates) {
    assert.equal(c.type, "god_indirect_reaction");
    assert.ok(evt.participantCharacterIds.includes(c.characterId));
  }

  // 3. idle_timer: daily type / active residents から候補が出る
  const idleCandidates = createObservedDialogueCandidates({
    trigger: "idle_timer",
    characters: [charA, charB, charC],
    now,
    seed: "smoke-idle",
  });
  assert.ok(idleCandidates.length > 0);
  assert.equal(idleCandidates[0].type, "daily");

  // 4. selectVisibleObservedDialogueCandidates: 最大2件 / invalid を除外
  const allCandidates = createObservedDialogueCandidates({
    trigger: "event_started",
    characters: [charA, charB, charC],
    event: evt,
    restrictEventParticipants: false,
    now,
    seed: "smoke-visible",
    maxCandidates: 10,
  });
  const visible = selectVisibleObservedDialogueCandidates(allCandidates, 2);
  assert.ok(visible.length <= 2);

  // needs_review は visible にならない
  const needsReviewCandidate: DialogueCandidate = {
    id: "dlg_smoke_needs_review",
    characterId: charA.id,
    text: "今日は風がやわらかいね",
    type: "daily",
    source: "external_llm_handoff",
    reviewStatus: "needs_review",
    createdAt: now,
  };
  const withNeedsReview = selectVisibleObservedDialogueCandidates(
    [...allCandidates, needsReviewCandidate],
    10,
  );
  assert.ok(withNeedsReview.every((c) => c.reviewStatus === "accepted"));

  // invalid dialogue は visible にならない
  const invalidCandidate: DialogueCandidate = {
    id: "dlg_smoke_invalid",
    characterId: charA.id,
    text: "信仰が揺れている",
    type: "daily",
    source: "authored_fixture",
    reviewStatus: "accepted",
    createdAt: now,
  };
  const withInvalid = selectVisibleObservedDialogueCandidates(
    [...allCandidates, invalidCandidate],
    10,
  );
  assert.ok(withInvalid.every((c) => validateDialogue(c.text).ok));

  // 5. characters: [] → 空配列 / 例外なし
  const emptyResult = createObservedDialogueCandidates({
    trigger: "idle_timer",
    characters: [],
    now,
    seed: "smoke-empty",
  });
  assert.equal(emptyResult.length, 0);

  // 6. maxCandidates: -1 でも例外を投げない
  const negativeResult = createObservedDialogueCandidates({
    trigger: "idle_timer",
    characters: [charA, charB],
    now,
    seed: "smoke-negative",
    maxCandidates: -1,
  });
  assert.equal(negativeResult.length, 0);

  // 7. visible dialogue に内部値が出ない
  const visibleTexts = visible.map((c) => c.text).join(" ");
  assert.equal(visibleTexts.includes("faith"), false);
  assert.equal(visibleTexts.includes("faithBand"), false);
  assert.equal(visibleTexts.includes("信仰"), false);
  assert.equal(visibleTexts.includes("信仰度"), false);
  assert.equal(visibleTexts.includes("スコア"), false);
  assert.equal(visibleTexts.includes("ステータス"), false);
}

function testPassportBoundarySmokeTests(): void {
  // Use faith=73 (distinctive odd value; default is 30, avoids timestamp/common-number false negatives)
  const ws = worldState();
  const char = ws.characters.get("chr_a")!;
  ws.characters.set("chr_a", {
    ...char,
    state: { ...char.state, status: { ...char.state.status, faith: 73 } },
  });

  const issuedSnapshot = issueSnapshotService(ws, {
    characterId: "chr_a",
    snapshotId: "snp_pbi8a_001",
    now,
    annotationTags: ["pbi8a-smoke"],
  });

  const issuedPassport = issuePassportService(issuedSnapshot.state, {
    snapshotId: issuedSnapshot.snapshot.id,
    passportId: "psp_pbi8a_001",
    fileNameToken: "aki--pbi8a-001",
    schemaVersion: 1,
    now,
  });

  const display = issuedPassport.passport.display;

  // 1. Passport JSON 内部に godRelationship.currentFaith が number として存在してよい
  assert.ok(typeof display.godRelationship.currentFaith === "number");
  assert.ok(display.godRelationship.currentFaith >= 0);

  // 2. externalAiPromptBlock に "currentFaith" 文字列が出ない
  const promptBlockJson = JSON.stringify(display.externalAiPromptBlock);
  assert.equal(promptBlockJson.includes("currentFaith"), false);

  // 3. externalAiPromptBlock.systemPrompt が存在し外部 AI で使える文章である
  assert.ok(display.externalAiPromptBlock.systemPrompt.length > 50);

  // 4. FAITH_BAND_LABELS は距離感表現になっている（直接的な信仰ラベルでない）
  assert.equal(FAITH_BAND_LABELS.disbelieves, "まだ距離がある");
  assert.equal(FAITH_BAND_LABELS.uncertain, "少し迷いがある");
  assert.equal(FAITH_BAND_LABELS.senses_presence, "気配を感じている");
  assert.equal(FAITH_BAND_LABELS.believes, "信頼が芽生えている");
  assert.equal(FAITH_BAND_LABELS.devoted, "深く結びついている");

  // 5. PassportConfirm user-facing text に禁止ワードが出ない
  const allConfirmText = [
    PASSPORT_CONFIRM_TEXTS.title,
    ...PASSPORT_CONFIRM_TEXTS.bodyLines,
    PASSPORT_CONFIRM_TEXTS.confirm,
    PASSPORT_CONFIRM_TEXTS.cancel,
  ].join(" ");
  for (const word of PASSPORT_FORBIDDEN_WORDS) {
    assert.equal(
      allConfirmText.includes(word),
      false,
    );
  }

  // currentFaith の数値も externalAiPromptBlock 全体に出ない（faith=73 で確認）
  const faithValue = display.godRelationship.currentFaith;
  assert.equal(faithValue, 73); // distinctive value actually round-tripped through snapshot→passport
  assert.equal(promptBlockJson.includes(String(faithValue)), false);
  assert.equal(display.externalAiPromptBlock.systemPrompt.includes(String(faithValue)), false);
}

function testGodPointPhaseRecovery(): void {
  const state = worldState();
  const baseSession = { ...state.session };

  // 1 phase tick => no recovery
  const noRecovery = recoverGodPointsByPhaseTicks({ ...baseSession, godPoints: 3 }, 1);
  assert.equal(noRecovery.godPoints, 3);

  // 2 phase ticks => +1
  const oneRecovery = recoverGodPointsByPhaseTicks({ ...baseSession, godPoints: 3 }, 2);
  assert.equal(oneRecovery.godPoints, 4);

  // 4 phase ticks => +2
  const twoRecovery = recoverGodPointsByPhaseTicks({ ...baseSession, godPoints: 3 }, 4);
  assert.equal(twoRecovery.godPoints, 5);

  // 0 ticks => no change
  const zeroTicks = recoverGodPointsByPhaseTicks({ ...baseSession, godPoints: 3 }, 0);
  assert.equal(zeroTicks.godPoints, 3);

  // negative ticks => no change
  const negativeTicks = recoverGodPointsByPhaseTicks({ ...baseSession, godPoints: 3 }, -5);
  assert.equal(negativeTicks.godPoints, 3);

  // max 6 is not exceeded
  const nearMax = recoverGodPointsByPhaseTicks({ ...baseSession, godPoints: 5 }, 4);
  assert.equal(nearMax.godPoints, MAX_GOD_POINTS);

  const atMax = recoverGodPointsByPhaseTicks({ ...baseSession, godPoints: MAX_GOD_POINTS }, 4);
  assert.equal(atMax.godPoints, MAX_GOD_POINTS);

  // other fields are unchanged
  assert.equal(noRecovery.id, baseSession.id);
  assert.equal(noRecovery.currentEventId, baseSession.currentEventId);

  // applyIntervention still reduces godPoints correctly
  const eventState = state;
  const currentEvent = selectCurrentEvent(eventState);
  const helpCost = BALANCED_INTERVENTION_COSTS.help; // 2
  const initialGp = eventState.session.godPoints;
  // seed world starts at MAX_GOD_POINTS, so help (cost 2) is always affordable
  assert.ok(initialGp >= helpCost);
  const interventionResult = applyIntervention({
    session: eventState.session,
    event: currentEvent,
    targetCharacters: [...eventState.characters.values()].filter((c) =>
      currentEvent.participantCharacterIds.includes(c.id),
    ),
    type: "help",
    now: "2026-01-01T00:00:00.000Z",
    idSeed: "test-help-9f",
  });
  assert.equal(interventionResult.session.godPoints, initialGp - helpCost);

  // after help (cost 2), 4 phase ticks restore +2 (up to max 6)
  const afterHelp = interventionResult.session;
  const restored = recoverGodPointsByPhaseTicks(afterHelp, 4);
  assert.equal(restored.godPoints, Math.min(MAX_GOD_POINTS, afterHelp.godPoints + 2));

  // recoverRuntimeGodPointsByPhaseTicks: state-level wrapper
  const runtimeBefore = createRuntimeWorldState({
    ...state,
    session: { ...state.session, godPoints: 2 },
  });
  const runtimeResult = recoverRuntimeGodPointsByPhaseTicks(runtimeBefore, {
    elapsedPhaseTicks: 4,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(runtimeResult.recoveredAmount, 2);
  assert.equal(runtimeResult.state.session.godPoints, 4);

  // 0 recovery amount when already at max
  const runtimeFull = createRuntimeWorldState({
    ...state,
    session: { ...state.session, godPoints: MAX_GOD_POINTS },
  });
  const fullResult = recoverRuntimeGodPointsByPhaseTicks(runtimeFull, {
    elapsedPhaseTicks: 4,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(fullResult.recoveredAmount, 0);
  assert.equal(fullResult.state.session.godPoints, MAX_GOD_POINTS);
}

function testEventOutcomeFoundation(): void {
  // --- rollD20 ---
  // Same seed always returns the same value (deterministic)
  const roll1 = rollD20("seed-abc");
  const roll2 = rollD20("seed-abc");
  assert.equal(roll1, roll2);

  // Result is always 1–20
  for (const seed of ["s1", "s2", "s3", "s4", "s5", "hello", "world", "test:event:watch"]) {
    const r = rollD20(seed);
    assert.ok(r >= 1 && r <= 20);
  }

  // Different seeds usually produce different values (not a hard invariant, but sanity check)
  const distinctRolls = new Set(
    ["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => rollD20(s)),
  );
  assert.ok(distinctRolls.size > 1);

  // --- resolveEventJudgement: success case ---
  // Build a character with high insight (watch +2 modifier) so total is likely >= 11
  const highInsightCharacter = character("chr_hi", "HighInsight");
  highInsightCharacter.state.status = {
    ...highInsightCharacter.state.status,
    insight: 80,
    stress: 20,
  };
  // Try multiple seeds until we find one that passes
  let successFound = false;
  for (let i = 0; i < 100; i++) {
    const j = resolveEventJudgement({
      seed: `success-seed-${i}`,
      eventId: "evt_test",
      interventionType: "watch",
      character: highInsightCharacter,
    });
    assert.ok(j.roll >= 1 && j.roll <= 20);
    assert.equal(j.modifier, 2); // insight >= 60 => +2
    assert.equal(j.total, j.roll + j.modifier);
    assert.equal(j.outcome, j.total >= j.threshold ? "success" : "failure");
    if (j.outcome === "success") {
      successFound = true;
      break;
    }
  }
  assert.ok(successFound);

  // --- resolveEventJudgement: failure case ---
  const highStressCharacter = character("chr_lo", "HighStress");
  highStressCharacter.state.status = {
    ...highStressCharacter.state.status,
    insight: 10,
    empathy: 10,
    courage: 10,
    harmony: 10,
    stress: 90, // -1 modifier
  };
  let failureFound = false;
  for (let i = 0; i < 100; i++) {
    const j = resolveEventJudgement({
      seed: `failure-seed-${i}`,
      eventId: "evt_test",
      interventionType: "trial",
      character: highStressCharacter,
    });
    assert.equal(j.modifier, -1); // stress >= 70 => -1, courage < 60 => no bonus
    assert.equal(j.total, j.roll + j.modifier);
    if (j.outcome === "failure") {
      failureFound = true;
      break;
    }
  }
  assert.ok(failureFound);

  // --- modifier rules ---
  const baseChar = character("chr_base", "Base");

  // watch: insight >= 60 => +2
  baseChar.state.status = { ...baseChar.state.status, insight: 60, stress: 0 };
  assert.equal(
    resolveEventJudgement({ seed: "m", eventId: "e", interventionType: "watch", character: baseChar }).modifier,
    2,
  );

  // watch: insight < 60 => 0
  baseChar.state.status = { ...baseChar.state.status, insight: 59, stress: 0 };
  assert.equal(
    resolveEventJudgement({ seed: "m", eventId: "e", interventionType: "watch", character: baseChar }).modifier,
    0,
  );

  // help: empathy >= 60 => +1
  baseChar.state.status = { ...baseChar.state.status, insight: 0, empathy: 60, harmony: 0, stress: 0 };
  assert.equal(
    resolveEventJudgement({ seed: "m", eventId: "e", interventionType: "help", character: baseChar }).modifier,
    1,
  );

  // help: harmony >= 60 => +1
  baseChar.state.status = { ...baseChar.state.status, empathy: 0, harmony: 60, stress: 0 };
  assert.equal(
    resolveEventJudgement({ seed: "m", eventId: "e", interventionType: "help", character: baseChar }).modifier,
    1,
  );

  // trial: courage >= 60 => +2
  baseChar.state.status = { ...baseChar.state.status, empathy: 0, harmony: 0, courage: 60, stress: 0 };
  assert.equal(
    resolveEventJudgement({ seed: "m", eventId: "e", interventionType: "trial", character: baseChar }).modifier,
    2,
  );

  // stress >= 70 => -1
  baseChar.state.status = { ...baseChar.state.status, insight: 0, empathy: 0, harmony: 0, courage: 0, stress: 70 };
  assert.equal(
    resolveEventJudgement({ seed: "m", eventId: "e", interventionType: "watch", character: baseChar }).modifier,
    -1,
  );

  // stress >= 70 stacks with other modifiers (watch + insight - stress)
  baseChar.state.status = { ...baseChar.state.status, insight: 60, stress: 70 };
  assert.equal(
    resolveEventJudgement({ seed: "m", eventId: "e", interventionType: "watch", character: baseChar }).modifier,
    1, // +2 - 1
  );

  // --- 7 event templates ---
  const MVP_TEMPLATE_IDS = [
    "moving-stone",
    "shrine-prayer-wish",
    "strange-grass-found",
    "shared-nap-place",
    "mysterious-footprints",
    "legendary-big-fish",
    "shrine-fox-offering",
  ];
  for (const templateId of MVP_TEMPLATE_IDS) {
    const tmpl = EVENT_TEMPLATES.find((t) => t.id === templateId);
    assert.ok(tmpl != null);
    assert.ok(tmpl.principleProfile != null);
    assert.ok(typeof tmpl.summaryTemplate === "string" && tmpl.summaryTemplate.length > 0);
  }

  // --- resolveEventOutcome returns valid record ---
  const testEvent: WorldEvent = {
    id: "evt_outcome_test",
    templateId: "moving-stone",
    status: "active",
    primaryCharacterId: "chr_a",
    participantCharacterIds: ["chr_a"],
    situationTags: ["mystery"],
    summary: "石が動いた。",
    createdAt: now,
    updatedAt: now,
  };
  const testIntervention = {
    id: "itv_outcome_test",
    eventId: "evt_outcome_test",
    type: "watch" as const,
    resourceCost: 1,
    godPointsBeforeApply: 4,
    godPointsAfterApply: 3,
    changeSetIds: [],
    createdAt: now,
  };
  const testChar = character("chr_a", "Aki");
  const outcomeRecord = resolveEventOutcome({
    event: testEvent,
    intervention: testIntervention,
    primaryCharacter: testChar,
    seed: "outcome-test-seed",
  });
  assert.equal(outcomeRecord.eventId, "evt_outcome_test");
  assert.equal(outcomeRecord.templateId, "moving-stone");
  assert.ok(outcomeRecord.outcome === "success" || outcomeRecord.outcome === "failure");
  assert.ok(outcomeRecord.judgement.roll >= 1 && outcomeRecord.judgement.roll <= 20);
  assert.equal(outcomeRecord.judgement.total, outcomeRecord.judgement.roll + outcomeRecord.judgement.modifier);
  assert.ok(typeof outcomeRecord.summary === "string" && outcomeRecord.summary.length > 0);

  // --- shrine-fox-offering: offeringCollected flag ---
  const foxEvent: WorldEvent = {
    ...testEvent,
    id: "evt_fox_test",
    templateId: "shrine-fox-offering",
    summary: "油揚げがあった。",
  };
  const foxOutcome = resolveEventOutcome({
    event: foxEvent,
    intervention: { ...testIntervention, eventId: "evt_fox_test" },
    primaryCharacter: testChar,
    seed: "fox-test-seed",
  });
  assert.ok(foxOutcome.outcome === "success" || foxOutcome.outcome === "failure");
  assert.ok(typeof foxOutcome.summary === "string" && foxOutcome.summary.length > 0);
  // offeringCount は今回増やさない（この PR では offeringCollected flag のみ）

  // --- resolveTemplateThreshold ---
  assert.equal(resolveTemplateThreshold("legendary-big-fish"), 13);
  assert.equal(resolveTemplateThreshold("moving-stone"), 11);
  assert.equal(resolveTemplateThreshold("unknown-template"), 11);

  // --- legendary-big-fish: threshold=13, total 11 or 12 must be failure ---
  // faith trigger and structuredPayload.outcome must agree when total is in the 11-12 range.
  // We find a seed that produces roll+modifier with total exactly 11 or 12 for legendary-big-fish.
  const fishChar = character("chr_fish", "FishWatcher");
  fishChar.state.status = { ...fishChar.state.status, insight: 0, stress: 0 }; // modifier = 0
  let fishRegressionTested = false;
  for (let i = 0; i < 500; i++) {
    const seed = `fish-regression-${i}`;
    const roll = rollD20(`${seed}:evt_fish_test:watch`);
    if (roll === 11 || roll === 12) {
      // modifier=0, total=11 or 12 — should be failure at threshold 13
      const j = resolveEventJudgement({
        seed,
        eventId: "evt_fish_test",
        interventionType: "watch",
        character: fishChar,
        threshold: resolveTemplateThreshold("legendary-big-fish"),
      });
      assert.equal(j.total, roll);
      assert.equal(j.threshold, 13);
      assert.equal(j.outcome, "failure");

      // resolveEventOutcome must also return failure for the same seed
      const fishEvent: WorldEvent = {
        id: "evt_fish_test",
        templateId: "legendary-big-fish",
        status: "active",
        primaryCharacterId: "chr_fish",
        participantCharacterIds: ["chr_fish"],
        situationTags: ["rare"],
        summary: "大きな影が見えた。",
        createdAt: now,
        updatedAt: now,
      };
      const fishRecord = resolveEventOutcome({
        event: fishEvent,
        intervention: { ...testIntervention, eventId: "evt_fish_test" },
        primaryCharacter: fishChar,
        seed,
      });
      // faith trigger outcome and structuredPayload outcome must agree
      assert.equal(fishRecord.outcome, "failure");
      assert.equal(fishRecord.judgement.total, j.total);

      fishRegressionTested = true;
      break;
    }
  }
  // If this fails, the seed search range needs to be increased
  assert.ok(fishRegressionTested);

  // --- applyInterventionService wires outcome into resolvedEvent ---
  const initialState = worldState();
  const afterIntervention = applyInterventionService(initialState, {
    type: "watch",
    now,
    idSeed: "outcome-wiring-seed",
  });
  const resolvedEventId = initialState.session.currentEventId;
  const resolvedEvent = afterIntervention.state.events.get(resolvedEventId);
  assert.ok(resolvedEvent != null);
  assert.equal(resolvedEvent.status, "resolved");
  assert.ok(resolvedEvent.structuredPayload != null);
  const payload = resolvedEvent.structuredPayload as Record<string, unknown>;
  assert.ok(payload.outcome === "success" || payload.outcome === "failure");
  const j = payload.judgement as Record<string, unknown>;
  assert.ok(typeof j.roll === "number" && (j.roll as number) >= 1 && (j.roll as number) <= 20);
  assert.equal(j.total, (j.roll as number) + (j.modifier as number));
  assert.ok(typeof payload.outcomeSummary === "string" && (payload.outcomeSummary as string).length > 0);
}

function testEventParticipantOverlayViewModel(): void {
  const mkChar = (id: string) => character(id, id.replace("chr_", ""));
  const chars = new Map([
    ["chr_a", mkChar("chr_a")],
    ["chr_b", mkChar("chr_b")],
    ["chr_c", mkChar("chr_c")],
    ["chr_d", mkChar("chr_d")],
    ["chr_e", mkChar("chr_e")],
  ]);

  const mkEvent = (participantIds: string[]) => ({
    ...event("evt_test"),
    primaryCharacterId: participantIds[0] ?? "chr_a",
    participantCharacterIds: participantIds,
  });

  // 1名: primary → left-front
  const one = createEventParticipantOverlayViewModels({
    event: mkEvent(["chr_a"]),
    characters: chars,
  });
  assert.equal(one.length, 1);
  assert.equal(one[0].slot, "left-front");
  assert.equal(one[0].role, "primary");

  // 2名: primary left-front, supporting right-front
  const two = createEventParticipantOverlayViewModels({
    event: mkEvent(["chr_a", "chr_b"]),
    characters: chars,
  });
  assert.equal(two.length, 2);
  assert.equal(two[0].slot, "left-front");
  assert.equal(two[0].role, "primary");
  assert.equal(two[1].slot, "right-front");
  assert.equal(two[1].role, "supporting");

  // 3名
  const three = createEventParticipantOverlayViewModels({
    event: mkEvent(["chr_a", "chr_b", "chr_c"]),
    characters: chars,
  });
  assert.equal(three.length, 3);
  assert.equal(three[0].slot, "left-front");
  assert.equal(three[1].slot, "right-front");
  assert.equal(three[2].slot, "left-back");

  // 4名
  const four = createEventParticipantOverlayViewModels({
    event: mkEvent(["chr_a", "chr_b", "chr_c", "chr_d"]),
    characters: chars,
  });
  assert.equal(four.length, 4);
  assert.equal(four[3].slot, "right-back");
  assert.equal(four[3].role, "supporting");

  // 5名以上: 4名に丸める。primary は必ず含む
  const five = createEventParticipantOverlayViewModels({
    event: mkEvent(["chr_a", "chr_b", "chr_c", "chr_d", "chr_e"]),
    characters: chars,
  });
  assert.equal(five.length, 4);
  assert.equal(five[0].characterId, "chr_a");
  assert.equal(five[0].role, "primary");

  // 存在しないcharacterIdはskip
  const withMissing = createEventParticipantOverlayViewModels({
    event: mkEvent(["chr_a", "chr_missing", "chr_b"]),
    characters: chars,
  });
  assert.equal(withMissing.length, 2);
  assert.ok(withMissing.every((v) => v.characterId !== "chr_missing"));

  // slug解決: chr_ prefix を除去
  const eveChar = character("chr_eve", "Eve");
  const eveSingle = createEventParticipantOverlayViewModels({
    event: mkEvent(["chr_eve"]),
    characters: new Map([["chr_eve", eveChar]]),
  });
  assert.ok(eveSingle[0].src.includes("/defaults/eve/overlays/event-participant/"));

  // alt テキスト
  assert.equal(one[0].alt, "aの立ち絵");
}

const tests: Array<[string, () => void]> = [
  ["activeSlots invariant and roster replacement", testActiveSlotsInvariantAndRosterReplacement],
  ["event generation keeps focused current event", testEventGenerationKeepsFocusedCurrentEvent],
  ["event generation participant variety", testEventGenerationParticipantVariety],
  ["event generation prioritizes active relations", testEventGenerationPrioritizesActiveRelations],
  ["event generation uses replaced active character", testEventGenerationUsesReplacedActiveCharacter],
  ["intervention apply costs and changeset", testInterventionApplyCostsAndChangeSet],
  ["thirty minute growth balance", testThirtyMinuteGrowthBalance],
  ["snapshot and passport are separate artifacts", testSnapshotAndPassportAreSeparateArtifacts],
  ["persistence foundations", testPersistenceFoundations],
  ["runtime selectors and commands", testRuntimeSelectorsAndCommands],
  ["asset read model separates introduction sources", testCharacterAssetReadModelSeparatesIntroductionSources],
  ["invalid sprite metadata falls back to reviewing", testInvalidSpriteMetadataFallsBackToReviewing],
  ["resident sprite manifest read model", testResidentSpriteManifestReadModel],
  ["intervention result emotes remain visible", testInterventionResultEmotesRemainVisible],
  ["faith domain model defaults and bands", testFaithDomainModelDefaultsAndBands],
  ["faith change application", testFaithChangeApplication],
  ["world principle engine", testWorldPrincipleEngine],
  ["voice profile storage and resolver", testVoiceProfileStorageAndResolver],
  ["promoteAssetToReady gate", testPromoteAssetToReadyGate],
  ["validateGeneratedNarrativeCandidate", testValidateGeneratedNarrativeCandidate],
  ["dialogue authoring preview (PBI 4a)", testDialogueAuthoringPreview],
  ["passport outside world payload (PBI 5)", testPassportOutsideWorldPayload],
  ["passport confirm UI (PBI 6)", testPassportConfirmUi],
  ["faith exposure and handoff prompt", testFaithExposureAndHandoffPrompt],
  ["faith hiding smoke tests (PBI 8a)", testFaithHidingSmokeTests],
  ["dialogue handoff smoke tests (PBI 8a)", testDialogueHandoffSmokeTests],
  ["observed dialogue runtime smoke tests (PBI 8a)", testObservedDialogueRuntimeSmokeTests],
  ["passport boundary smoke tests (PBI 8a)", testPassportBoundarySmokeTests],
  ["event outcome foundation (PBI 9a-core)", testEventOutcomeFoundation],
  ["god point phase recovery (PBI 9f)", testGodPointPhaseRecovery],
  ["event participant overlay view model (PBI 9e-ui)", testEventParticipantOverlayViewModel],
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
