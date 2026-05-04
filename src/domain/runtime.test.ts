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
import { applyIntervention } from "./interventions.js";
import type { Character, CharacterRelation, SandboxSession, WorldEvent } from "./models.js";
import { replaceActiveSlot } from "./session.js";
import {
  applyInterventionService,
  generateCurrentEventService,
  issuePassportService,
  issueSnapshotService,
} from "../application/runtimeService.js";
import { DEFAULT_CHARACTER_STATUS } from "./character.js";
import { createRuntimeWorldState } from "../state/runtimeState.js";
import { createWorldDirectoryLayout } from "../persistence/layout.js";
import { createMigrationRegistry, CURRENT_SAVE_VERSION } from "../persistence/migrations.js";

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
  assert.deepEqual(watched.changeSets[0].patch, { insight: 1 });
  assert.deepEqual(watched.changeSets[1].patch, { insight: 1 });
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
  assert.notEqual(helped.state.session.currentEventId, state.session.currentEventId);
  assert.equal(helped.state.events.has(helped.state.session.currentEventId), true);
  assert.equal(
    helped.state.characters.get("chr_b")?.state.recentEventIds.includes(currentEvent.id),
    true,
  );

  const trialed = applyIntervention({
    session: state.session,
    event: currentEvent,
    targetCharacters: [target, supporting],
    type: "trial",
    now,
    idSeed: "trial",
  });

  assert.equal(trialed.intervention.resourceCost, 2);
  assert.equal(trialed.session.godPoints, state.session.godPoints - 2);
  assert.deepEqual(trialed.changeSets[0].patch, { courage: 2, stress: 1, ambition: 1 });
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
  assert.equal(ryoAssetBundle.basicSettings.introduction.isPlaceholder, true);
  assert.equal(ryoAssetBundle.basicSettings.introduction.source, "placeholder");
  assert.equal(activeAssetBundles[0]?.portrait.ready, true);
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

const tests: Array<[string, () => void]> = [
  ["activeSlots invariant and roster replacement", testActiveSlotsInvariantAndRosterReplacement],
  ["event generation keeps focused current event", testEventGenerationKeepsFocusedCurrentEvent],
  ["intervention apply costs and changeset", testInterventionApplyCostsAndChangeSet],
  ["snapshot and passport are separate artifacts", testSnapshotAndPassportAreSeparateArtifacts],
  ["persistence foundations", testPersistenceFoundations],
  ["runtime selectors and commands", testRuntimeSelectorsAndCommands],
  ["asset read model separates introduction sources", testCharacterAssetReadModelSeparatesIntroductionSources],
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
