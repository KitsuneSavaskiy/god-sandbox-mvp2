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
  // MVP 7 events (PBI 9a-core)
  {
    id: "moving-stone",
    name: "謎の動く石",
    situationTags: ["mystery", "observation", "recurring"],
    summaryTemplate: "{name}の近くで、また石が位置を変えていた。",
    principleProfile: {
      dominantPhase: "water",
      polarity: "yin",
      principleRole: "separate",
    },
  },
  {
    id: "shrine-prayer-wish",
    name: "お参りと願い",
    situationTags: ["shrine", "inner-life", "prayer"],
    summaryTemplate: "{name}が、祠の前で何かを祈ろうとしている。",
    principleProfile: {
      dominantPhase: "fire",
      polarity: "yin",
      principleRole: "bind",
    },
  },
  {
    id: "strange-grass-found",
    name: "変な草を拾う",
    situationTags: ["nature", "curiosity", "discovery"],
    summaryTemplate: "{name}が、見たことのない草を拾い上げた。",
    principleProfile: {
      dominantPhase: "wood",
      polarity: "yang",
      principleRole: "circulate",
    },
  },
  {
    id: "shared-nap-place",
    name: "同じ場所で昼寝",
    situationTags: ["daily-life", "relationship", "multi-character"],
    summaryTemplate: "{name}たちが、同じ場所でうとうとしている。",
    principleProfile: {
      dominantPhase: "earth",
      polarity: "yin",
      principleRole: "bind",
    },
  },
  {
    id: "mysterious-footprints",
    name: "謎の足あと",
    situationTags: ["mystery", "investigation", "plaza"],
    summaryTemplate: "{name}が、広場に残された謎の足あとを見つけた。",
    principleProfile: {
      dominantPhase: "metal",
      polarity: "yang",
      principleRole: "reveal",
    },
  },
  {
    id: "legendary-big-fish",
    name: "伝説の大きな魚",
    situationTags: ["rare", "river", "pond", "legend"],
    summaryTemplate: "{name}が、水面の奥に大きな魚影を見た気がした。",
    principleProfile: {
      dominantPhase: "water",
      polarity: "yang",
      principleRole: "separate",
    },
  },
  {
    id: "shrine-fox-offering",
    name: "祠の油揚げ",
    // offeringCount accumulation across events is deferred to a future PBI.
    // For now, each event instance records offeringCollected in structuredPayload only.
    situationTags: ["shrine", "offering", "accumulative"],
    summaryTemplate: "{name}が、祠のそばに置かれた油揚げを見つけた。",
    principleProfile: {
      dominantPhase: "wood",
      polarity: "yin",
      principleRole: "circulate",
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
