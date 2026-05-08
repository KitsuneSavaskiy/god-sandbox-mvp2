import type {
  Character,
  CharacterRelation,
  EventTemplate,
  SandboxSession,
  WorldEvent,
} from "./models.js";
import { assertSandboxSessionInvariants } from "./session.js";
import { calcEventWeight } from "./worldPrinciple.js";

export type GenerateWorldEventInput = {
  session: SandboxSession;
  characters: ReadonlyMap<string, Character>;
  relations?: CharacterRelation[];
  now: string;
  seed: string;
};

export const EVENT_TEMPLATES: readonly EventTemplate[] = [
  {
    id: "daily-sandbox-observation",
    name: "小さな日常",
    situationTags: ["daily-life", "focused-event"],
    summaryTemplate: "{name}に小さな出来事が起きています。",
    principleProfile: {
      dominantPhase: "wood",
      polarity: "yin",
      principleRole: "circulate",
    },
  },
  {
    id: "small-disagreement",
    name: "言葉の行き違い",
    situationTags: ["daily-life", "friction"],
    summaryTemplate: "{name}のまわりで、言葉の行き違いが起きています。",
    principleProfile: {
      dominantPhase: "fire",
      polarity: "yang",
      principleRole: "restrain",
    },
  },
  {
    id: "shared-work",
    name: "共同作業",
    situationTags: ["daily-life", "cooperation"],
    summaryTemplate: "{name}が、誰かと小さな作業に取り組んでいます。",
    principleProfile: {
      dominantPhase: "earth",
      polarity: "balanced",
      principleRole: "bind",
    },
  },
  {
    id: "quiet-trial",
    name: "静かな試練",
    situationTags: ["daily-life", "small-trial"],
    summaryTemplate: "{name}が、ひとりで小さな課題に向き合っています。",
    principleProfile: {
      dominantPhase: "metal",
      polarity: "yang",
      principleRole: "reveal",
    },
  },
  {
    id: "small-sadness",
    name: "小さな沈黙",
    situationTags: ["daily-life", "reflection"],
    summaryTemplate: "{name}が、静かな気配に立ち止まっています。",
    principleProfile: {
      dominantPhase: "water",
      polarity: "yin",
      principleRole: "separate",
    },
  },
];

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
  const participantCharacters = participantCharacterIds
    .filter((characterId) => characterId !== primaryCharacter.id)
    .map((characterId) => {
      const character = input.characters.get(characterId);
      if (!character) {
        throw new Error(`Participant character not found: ${characterId}`);
      }
      return character;
    });
  const template = selectEventTemplate(
    EVENT_TEMPLATES,
    {
      primaryCharacter,
      participantCharacters,
    },
    input.seed,
  );

  return createWorldEvent({
    id: `evt_${stableHash(`${input.seed}:${input.now}:${primaryCharacter.id}`).toString(36)}`,
    templateId: template.id,
    status: "active",
    primaryCharacterId: primaryCharacter.id,
    participantCharacterIds,
    situationTags: [...template.situationTags],
    summary: template.summaryTemplate.replace("{name}", primaryCharacter.profile.displayName),
    structuredPayload: {
      seed: input.seed,
      primaryCharacterName: primaryCharacter.profile.displayName,
      participantCount: participantCharacterIds.length,
    },
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function selectEventTemplate(
  templates: readonly EventTemplate[],
  context: {
    primaryCharacter: Character;
    participantCharacters: Character[];
  },
  seed: string,
): EventTemplate {
  if (templates.length < 1) {
    throw new Error("At least one event template is required.");
  }

  const weightedTemplates = templates.map((template) => ({
    template,
    weight: calcEventWeight(template, context),
  }));
  const totalWeight = weightedTemplates.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = stableUnitInterval(`${seed}:event-template`) * totalWeight;

  for (const entry of weightedTemplates) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.template;
    }
  }

  return weightedTemplates[weightedTemplates.length - 1].template;
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

function stableUnitInterval(seed: string): number {
  return (stableHash(seed) % 1_000_000) / 1_000_000;
}

export function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}
