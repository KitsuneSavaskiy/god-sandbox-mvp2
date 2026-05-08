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
  parseDialogueCandidatesFromText,
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
} from "./growthBalance.js";
import {
  recoverRuntimeGodPointsByElapsedMinutes,
  selectGrowthCycleProgress,
} from "../application/growthBalanceService.js";
import { resolveCharacterAnimationAssetStatus } from "../features/residents/characterAssetStatus.js";
import {
  isResidentMovementBlockingEmote,
  resolveResidentEmote,
  resolveResidentMotion,
} from "../features/events/EventFirstSandboxEmotes.js";

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
  const recoveredSession = recoverGodPointsByElapsedMinutes(
    {
      ...state.session,
      godPoints: 2,
    },
    9,
  );
  assert.equal(recoveredSession.godPoints, 5);

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
  assert.equal(recoveredRuntime.session.godPoints, 3);

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
    "/art/characters/defaults/ryo/sprites/resident-sprite-sheet-combined-preview-v7.png",
  );
  assert.equal(
    ryoAssetBundle.spriteSheet.plannedPath,
    null,
  );
  assert.equal(ryoAssetBundle.spriteSheet.fallbackAssetId, "ryo-portrait-neutral");
  assert.equal(ryoAssetBundle.spriteSheet.fallbackPath, "/art/characters/defaults/ryo/portrait.png");
  // Ryo PO preview sheet: one combined Codex pet sheet, 7 cols, 14 rows
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.frameWidth, 118);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.frameHeight, 136);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.columns, 7);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.rows, 14);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions.idle?.row, 0);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions.idle?.frames, 7);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions.waving?.row, 3);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions.review?.row, 7);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions["walk-left"]?.row, 2);
  assert.equal(ryoAssetBundle.spriteSheet.metadata?.motions["walk-right"]?.row, 1);
  // Extended motions share the same PO preview PNG.
  assert.equal(ryoAssetBundle.extendedSheet.assetId, "ryo-sprite-sheet-extended");
  assert.equal(ryoAssetBundle.extendedSheet.ready, true);
  assert.equal(ryoAssetBundle.extendedSheet.metadata?.frameWidth, 118);
  assert.equal(ryoAssetBundle.extendedSheet.metadata?.frameHeight, 136);
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
    "/art/characters/defaults/garan/sprites/resident-sprite-sheet-combined-preview-v20.png",
  );
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.frameWidth, 118);
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.frameHeight, 136);
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.columns, 7);
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.rows, 14);
  assert.equal(activeAssetBundles[1]?.spriteSheet.metadata?.motions.failed?.frames, 7);
  assert.equal(
    activeAssetBundles[2]?.spriteSheet.path,
    "/art/characters/defaults/ryo/sprites/resident-sprite-sheet-combined-preview-v7.png",
  );
  assert.equal(activeAssetBundles[2]?.spriteSheet.metadata?.frameWidth, 118);
  assert.equal(activeAssetBundles[2]?.spriteSheet.metadata?.frameHeight, 136);
  assert.equal(activeAssetBundles[2]?.spriteSheet.metadata?.motions.failed?.frames, 5);
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
  assert.equal(activeAssetBundles[2]?.extendedSheet.metadata?.motions["walk-forward"]?.row, 9);
  assert.equal(activeAssetBundles[3]?.extendedSheet.metadata?.frameWidth, 148);
  assert.equal(activeAssetBundles[3]?.extendedSheet.metadata?.frameHeight, 144);
  assert.equal(activeAssetBundles[3]?.extendedSheet.metadata?.motions["walk-forward"]?.row, 9);
  assert.equal(activeAssetBundles[3]?.extendedSheet.metadata?.motions["emote-surprised"]?.row, 13);
  assert.equal(activeAssetBundles[3]?.expressions.angry.isPlaceholder, true);
  assert.equal(activeAssetBundles[3]?.expressions.angry.fallbackAssetId, "suzu-portrait-neutral");
  assert.equal(activeAssetBundles[3]?.expressions.angry.missingReason, "not-generated-yet");

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
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
