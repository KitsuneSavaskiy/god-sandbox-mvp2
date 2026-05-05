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

  if (new Set(input.participantCharacterIds).size !== input.participantCharacterIds.length) {
    throw new Error("WorldEvent.participantCharacterIds must not contain duplicate characters.");
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
  const participantCharacterIds = selectEventParticipants(
    primaryCharacter.id,
    input.session.activeSlots,
    input.relations ?? [],
    input.seed,
  );

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

function selectEventParticipants(
  primaryCharacterId: string,
  activeCharacterIds: readonly string[],
  relations: CharacterRelation[],
  seed: string,
): string[] {
  const desiredCount = Math.max(
    selectParticipantCount(seed, activeCharacterIds.length),
    hasRelatedParticipant(primaryCharacterId, activeCharacterIds, relations) ? 2 : 1,
  );
  const participantIds = [primaryCharacterId];
  const relatedParticipantIds = selectRelatedParticipants(
    primaryCharacterId,
    activeCharacterIds,
    relations,
  );

  for (const characterId of relatedParticipantIds) {
    addParticipantIfNeeded(participantIds, characterId, desiredCount);
  }

  const seededCandidates = activeCharacterIds
    .filter((characterId) => characterId !== primaryCharacterId)
    .filter((characterId) => !participantIds.includes(characterId))
    .sort(
      (left, right) => {
        const rankDifference =
          stableHash(`${seed}:participant:${left}`) -
          stableHash(`${seed}:participant:${right}`);
        return rankDifference === 0 ? left.localeCompare(right) : rankDifference;
      },
    );

  for (const characterId of seededCandidates) {
    addParticipantIfNeeded(participantIds, characterId, desiredCount);
  }

  return participantIds;
}

function selectParticipantCount(seed: string, activeCharacterCount: number): number {
  return 1 + (stableHash(`${seed}:participant-count`) % activeCharacterCount);
}

function hasRelatedParticipant(
  primaryCharacterId: string,
  activeCharacterIds: readonly string[],
  relations: CharacterRelation[],
): boolean {
  return selectRelatedParticipants(primaryCharacterId, activeCharacterIds, relations).length > 0;
}

function selectRelatedParticipants(
  primaryCharacterId: string,
  activeCharacterIds: readonly string[],
  relations: CharacterRelation[],
): string[] {
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
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      return scoreDifference === 0
        ? left.partnerId.localeCompare(right.partnerId)
        : scoreDifference;
    });

  return candidates.map((candidate) => candidate.partnerId);
}

function addParticipantIfNeeded(
  participantIds: string[],
  characterId: string,
  desiredCount: number,
): void {
  if (participantIds.length >= desiredCount || participantIds.includes(characterId)) {
    return;
  }

  participantIds.push(characterId);
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
