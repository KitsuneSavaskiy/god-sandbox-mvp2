import type {
  Character,
  CharacterStatusBlock,
  EventTemplate,
  FivePhase,
  YinYangPolarity,
} from "./models.js";

export type PrincipleRelation = "nourish" | "restrain" | "neutral";

export const FIVE_PHASE_ORDER: readonly FivePhase[] = [
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
] as const;

const SHENG: Record<FivePhase, FivePhase> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const KE: Record<FivePhase, FivePhase> = {
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
  metal: "wood",
};

export function resolveImplicitPhase(status: CharacterStatusBlock): FivePhase {
  const scores: Record<FivePhase, number> = {
    wood: (status.ambition + status.empathy) / 2,
    fire: (status.courage + status.stress) / 2,
    earth: (status.harmony + status.trustfulness) / 2,
    metal: (status.insight + (100 - status.stress)) / 2,
    water: (status.vitality + status.empathy) / 2,
  };

  return FIVE_PHASE_ORDER.reduce((selected, candidate) =>
    scores[selected] >= scores[candidate] ? selected : candidate,
  );
}

export function resolvePolarity(status: CharacterStatusBlock): YinYangPolarity {
  const yangScore = (status.courage + status.stress + status.ambition) / 3;
  const yinScore = (status.vitality + status.harmony + status.empathy) / 3;
  const diff = yangScore - yinScore;

  if (diff > 15) {
    return "yang";
  }

  if (diff < -15) {
    return "yin";
  }

  return "balanced";
}

export function getPrincipleRelation(
  from: FivePhase,
  to: FivePhase,
): PrincipleRelation {
  if (SHENG[from] === to) {
    return "nourish";
  }

  if (KE[from] === to) {
    return "restrain";
  }

  return "neutral";
}

export function calcEventWeight(
  template: Pick<EventTemplate, "principleProfile">,
  context: {
    primaryCharacter: Character;
    participantCharacters: Character[];
  },
): number {
  if (!template.principleProfile) {
    return 1.0;
  }

  const allCharacters = [context.primaryCharacter, ...context.participantCharacters];
  const phases = allCharacters.map((character) =>
    resolveImplicitPhase(character.state.status),
  );
  const primaryPolarity = resolvePolarity(context.primaryCharacter.state.status);
  const profile = template.principleProfile;
  let weight = 1.0;

  weight += phases.filter((phase) => phase === profile.dominantPhase).length * 0.2;
  weight += phases.filter(
    (phase) => getPrincipleRelation(phase, profile.dominantPhase) === "nourish",
  ).length * 0.15;
  weight += phases.filter(
    (phase) => getPrincipleRelation(phase, profile.dominantPhase) === "restrain",
  ).length * 0.1;

  if (primaryPolarity === profile.polarity) {
    weight += 0.1;
  }

  return weight;
}
