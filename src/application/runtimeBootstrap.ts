import { DEFAULT_CHARACTER_STATUS, normalizeCharacterStatus } from "../domain/character.js";
import { createWorldEvent } from "../domain/events.js";
import type {
  Character,
  CharacterAssetBundle,
  CharacterRelation,
  SandboxSession,
} from "../domain/models.js";
import { CURRENT_SAVE_VERSION } from "../persistence/migrations.js";
import { createRuntimeWorldState, type RuntimeWorldState } from "../state/runtimeState.js";

const seedNow = "2026-05-04T00:00:00.000Z";

export function createSeedRuntimeWorld(): RuntimeWorldState {
  const characters = new Map<string, Character>(
    [
      seedCharacter("chr_eve", "Eve"),
      seedCharacter("chr_garan", "Garan"),
      seedCharacter("chr_ryo", "Ryo"),
      seedCharacter("chr_suzu", "Suzu"),
    ].map((character) => [character.id, character]),
  );

  const currentEvent = createWorldEvent({
    id: "evt_seed_observation",
    templateId: "seed-observation",
    status: "active",
    primaryCharacterId: "chr_ryo",
    participantCharacterIds: ["chr_ryo", "chr_suzu"],
    situationTags: ["daily-life", "first-observation"],
    summary: "RyoとSuzuのあいだに、小さな変化が起きています。",
    structuredPayload: {
      presetId: "default-observation",
    },
    createdAt: seedNow,
    updatedAt: seedNow,
  });

  const session: SandboxSession = {
    id: "default",
    playerDisplayName: "新米神様",
    rosterCharacterIds: ["chr_eve", "chr_garan", "chr_ryo", "chr_suzu"],
    activeSlots: ["chr_eve", "chr_garan", "chr_ryo", "chr_suzu"],
    pendingActivationCharacterIds: [],
    currentEventId: currentEvent.id,
    godPoints: 6,
    worldStatusTags: ["calm", "first-session"],
    saveVersion: CURRENT_SAVE_VERSION,
  };

  return createRuntimeWorldState({
    worldId: "seed-world",
    worldContextRefs: ["world-context/chunks/seed.json"],
    session,
    characters,
    relations: new Map([[seedRelation.id, seedRelation]]),
    events: new Map([[currentEvent.id, currentEvent]]),
    interventions: new Map(),
    changeSets: new Map(),
    snapshots: new Map(),
    passports: new Map(),
  });
}

function seedCharacter(id: string, displayName: string): Character {
  const bundleId = id.replace(/^chr_/, "");
  const portraitAssetId = `${bundleId}-portrait-neutral`;
  return {
    id,
    profile: {
      displayName,
      speechStyleId: bundleId,
      personality: {},
      appearance: {
        primaryAssetId: portraitAssetId,
        variantAssetIds: [],
        assetBundle: createSeedAssetBundle(bundleId, portraitAssetId),
      },
      templateFieldValues: {},
    },
    state: {
      status: normalizeCharacterStatus(DEFAULT_CHARACTER_STATUS),
      ongoingEffectIds: [],
      recentEventIds: [],
    },
    createdAt: seedNow,
    updatedAt: seedNow,
  };
}

function createSeedAssetBundle(
  bundleId: string,
  portraitAssetId: string,
): CharacterAssetBundle {
  const generatedExpressionAssetIds = new Set(
    bundleId === "suzu"
      ? ["happy"]
      : ["happy", "angry", "sad", "surprised"],
  );

  return {
    portraitAssetId,
    iconAssetId: null,
    spriteSheetAssetId: null,
    expressions: {
      neutral: portraitAssetId,
      happy: generatedExpressionAssetIds.has("happy")
        ? `${bundleId}-expression-happy`
        : null,
      angry: generatedExpressionAssetIds.has("angry")
        ? `${bundleId}-expression-angry`
        : null,
      sad: generatedExpressionAssetIds.has("sad")
        ? `${bundleId}-expression-sad`
        : null,
      surprised: generatedExpressionAssetIds.has("surprised")
        ? `${bundleId}-expression-surprised`
        : null,
    },
  };
}

const seedRelation: CharacterRelation = {
  id: "rel_chr_ryo__chr_suzu",
  characterAId: "chr_ryo",
  characterBId: "chr_suzu",
  score: 10,
  derivedFromEventIds: ["evt_seed_observation"],
  lastRecomputedAt: seedNow,
};
