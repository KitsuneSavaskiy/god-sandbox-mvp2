import { DEFAULT_CHARACTER_STATUS } from "../domain/character.js";
import { createWorldEvent } from "../domain/events.js";
import type {
  Character,
  CharacterRelation,
  SandboxSession,
} from "../domain/models.js";
import { CURRENT_SAVE_VERSION } from "../persistence/migrations.js";
import { createRuntimeWorldState, type RuntimeWorldState } from "../state/runtimeState.js";

const seedNow = "2026-05-04T00:00:00.000Z";

export function createSeedRuntimeWorld(): RuntimeWorldState {
  const characters = new Map<string, Character>(
    [
      seedCharacter("chr_ryo", "Ryo", "まじめで少し不器用な若者"),
      seedCharacter("chr_mina", "Mina", "周りをよく見て動く住民"),
      seedCharacter("chr_towa", "Towa", "小さな変化に気づきやすい住民"),
      seedCharacter("chr_sena", "Sena", "勇気を出す練習をしている住民"),
      seedCharacter("chr_noa", "Noa", "次に仲間へ加わる候補の住民"),
    ].map((character) => [character.id, character]),
  );

  const currentEvent = createWorldEvent({
    id: "evt_seed_observation",
    templateId: "seed-observation",
    status: "active",
    primaryCharacterId: "chr_ryo",
    participantCharacterIds: ["chr_ryo", "chr_mina"],
    situationTags: ["daily-life", "first-observation"],
    summary: "RyoとMinaのあいだに、小さな変化が起きています。",
    structuredPayload: {
      presetId: "default-observation",
    },
    createdAt: seedNow,
    updatedAt: seedNow,
  });

  const session: SandboxSession = {
    id: "default",
    playerDisplayName: "新米神様",
    rosterCharacterIds: ["chr_ryo", "chr_mina", "chr_towa", "chr_sena", "chr_noa"],
    activeSlots: ["chr_ryo", "chr_mina", "chr_towa", "chr_sena"],
    pendingActivationCharacterIds: ["chr_noa"],
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

function seedCharacter(id: string, displayName: string, description: string): Character {
  return {
    id,
    profile: {
      displayName,
      personality: {},
      appearance: {
        primaryAssetId: `asset_${id}_portrait`,
        variantAssetIds: [],
      },
      templateFieldValues: {
        description,
      },
    },
    state: {
      status: { ...DEFAULT_CHARACTER_STATUS },
      ongoingEffectIds: [],
      recentEventIds: [],
    },
    createdAt: seedNow,
    updatedAt: seedNow,
  };
}

const seedRelation: CharacterRelation = {
  id: "rel_chr_ryo__chr_mina",
  characterAId: "chr_ryo",
  characterBId: "chr_mina",
  score: 10,
  derivedFromEventIds: ["evt_seed_observation"],
  lastRecomputedAt: seedNow,
};
