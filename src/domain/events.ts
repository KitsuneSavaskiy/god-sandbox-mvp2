import type { Character, CharacterRelation, SandboxSession, WorldEvent } from "./models.js";
import { assertSandboxSessionInvariants } from "./session.js";

export type GenerateWorldEventInput = {
  session: SandboxSession;
  characters: ReadonlyMap<string, Character>;
  relations?: CharacterRelation[];
  now: string;
  seed: string;
};

export function createWorldEvent(input: WorldEvent): WorldEvent {
  if (!input.primaryCharacterId) {
    throw new Error("WorldEvent.primaryCharacterId is required.");
  }

  if (input.participantCharacterIds.length < 1) {
    throw new Error("WorldEvent.participantCharacterIds must contain at least one character.");
  }

  if (!input.participantCharacterIds.includes(input.primaryCharacterId)) {
    throw new Error("WorldEvent.primaryCharacterId must also be in participantCharacterIds.");
  }

  return structuredClone(input) as WorldEvent;
}

export function generateWorldEvent(input: GenerateWorldEventInput): WorldEvent {
  assertSandboxSessionInvariants(input.session);

  const activeCharacters = input.session.activeSlots.map((characterId) => {
    const character = input.characters.get(characterId);
    if (!character) {
      throw new Error(`Active character not found: ${characterId}`);
    }
    return character;
  });

  const primaryIndex = deterministicIndex(input.seed, activeCharacters.length);
  const primaryCharacter = activeCharacters[primaryIndex];
  const relationPartner = selectRelatedParticipant(
    primaryCharacter.id,
    input.session.activeSlots,
    input.relations ?? [],
  );
  const participantCharacterIds = relationPartner
    ? [primaryCharacter.id, relationPartner]
    : [primaryCharacter.id];

  return createWorldEvent({
    id: `evt_${stableHash(`${input.seed}:${input.now}:${primaryCharacter.id}`).toString(36)}`,
    templateId: "daily-sandbox-observation",
    status: "active",
    primaryCharacterId: primaryCharacter.id,
    participantCharacterIds,
    situationTags: ["daily-life", "focused-event"],
    summary: `${primaryCharacter.profile.displayName}に小さな出来事が起きています。`,
    structuredPayload: {
      seed: input.seed,
      primaryCharacterName: primaryCharacter.profile.displayName,
      participantCount: participantCharacterIds.length,
    },
    createdAt: input.now,
    updatedAt: input.now,
  });
}

function selectRelatedParticipant(
  primaryCharacterId: string,
  activeCharacterIds: readonly string[],
  relations: CharacterRelation[],
): string | undefined {
  const candidates = relations
    .filter(
      (relation) =>
        relation.characterAId === primaryCharacterId ||
        relation.characterBId === primaryCharacterId,
    )
    .map((relation) => ({
      score: relation.score,
      partnerId:
        relation.characterAId === primaryCharacterId
          ? relation.characterBId
          : relation.characterAId,
    }))
    .filter((candidate) => activeCharacterIds.includes(candidate.partnerId))
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.partnerId;
}

function deterministicIndex(seed: string, length: number): number {
  return stableHash(seed) % length;
}

export function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}
