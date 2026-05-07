import type { PersonalityVector } from "../../domain/models.js";

export const AMBIENT_RESIDENT_EMOTES = [
  "happy",
  "angry",
  "sad",
  "surprised",
] as const;

export type AmbientResidentEmote = (typeof AMBIENT_RESIDENT_EMOTES)[number];

export type AmbientResidentEmoteWeights = Record<AmbientResidentEmote, number>;

type PersonalityInfluenceMap = Partial<
  Record<keyof PersonalityVector, Partial<Record<AmbientResidentEmote, number>>>
>;

const MIN_WEIGHT = 0.05;
const NEUTRAL_PERSONALITY_SCORE = 50;
const PERSONALITY_SCORE_RANGE = 50;

export const DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS: AmbientResidentEmoteWeights = {
  happy: 1,
  angry: 0.35,
  sad: 0.3,
  surprised: 0.45,
};

export const PERSONALITY_AMBIENT_EMOTE_INFLUENCES: PersonalityInfluenceMap = {
  kindness: {
    happy: 0.4,
    angry: -0.45,
    sad: 0.1,
  },
  boldness: {
    angry: 0.3,
    sad: -0.2,
    surprised: 0.2,
  },
  curiosity: {
    happy: 0.1,
    angry: -0.05,
    sad: -0.1,
    surprised: 0.45,
  },
  patience: {
    happy: 0.15,
    angry: -0.4,
    surprised: -0.15,
  },
  sociability: {
    happy: 0.3,
    sad: -0.2,
    surprised: 0.05,
  },
  mischief: {
    angry: 0.1,
    sad: -0.15,
    surprised: 0.3,
  },
  discipline: {
    angry: -0.15,
    surprised: -0.2,
  },
  sensitivity: {
    happy: -0.05,
    angry: 0.05,
    sad: 0.4,
    surprised: 0.25,
  },
};

export function buildAmbientResidentEmoteWeights(
  personality: PersonalityVector,
  baseWeights: AmbientResidentEmoteWeights = DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS,
): AmbientResidentEmoteWeights {
  const modifierTotals = createEmptyAmbientResidentEmoteWeights(0);

  for (const traitName of Object.keys(PERSONALITY_AMBIENT_EMOTE_INFLUENCES) as Array<
    keyof PersonalityVector
  >) {
    const rawScore = personality[traitName];
    if (typeof rawScore !== "number" || !Number.isFinite(rawScore)) {
      continue;
    }

    const normalizedScore = normalizePersonalityScore(rawScore);
    const influences = PERSONALITY_AMBIENT_EMOTE_INFLUENCES[traitName];
    if (!influences) {
      continue;
    }

    for (const emote of AMBIENT_RESIDENT_EMOTES) {
      modifierTotals[emote] += (influences[emote] ?? 0) * normalizedScore;
    }
  }

  return {
    happy: applyWeightModifier(baseWeights.happy, modifierTotals.happy),
    angry: applyWeightModifier(baseWeights.angry, modifierTotals.angry),
    sad: applyWeightModifier(baseWeights.sad, modifierTotals.sad),
    surprised: applyWeightModifier(baseWeights.surprised, modifierTotals.surprised),
  };
}

export function selectWeightedAmbientResidentEmote(
  weights: AmbientResidentEmoteWeights,
  randomValue: number,
): AmbientResidentEmote {
  const normalizedRandom = normalizeRandomValue(randomValue);
  const normalizedWeights = normalizeAmbientResidentEmoteWeights(weights);
  const totalWeight = sumAmbientResidentEmoteWeights(normalizedWeights);
  let cursor = normalizedRandom * totalWeight;

  for (const emote of AMBIENT_RESIDENT_EMOTES) {
    cursor -= normalizedWeights[emote];
    if (cursor < 0) {
      return emote;
    }
  }

  return AMBIENT_RESIDENT_EMOTES[AMBIENT_RESIDENT_EMOTES.length - 1];
}

export function getNextAmbientEmoteResidentIndex(
  previousResidentIndex: number | null,
  residentCount: number,
): number | null {
  if (!Number.isInteger(residentCount) || residentCount <= 0) {
    return null;
  }

  if (
    previousResidentIndex === null ||
    !Number.isInteger(previousResidentIndex) ||
    previousResidentIndex < 0
  ) {
    return 0;
  }

  return (previousResidentIndex + 1) % residentCount;
}

function normalizeAmbientResidentEmoteWeights(
  weights: AmbientResidentEmoteWeights,
): AmbientResidentEmoteWeights {
  const normalized = {
    happy: sanitizeWeight(weights.happy),
    angry: sanitizeWeight(weights.angry),
    sad: sanitizeWeight(weights.sad),
    surprised: sanitizeWeight(weights.surprised),
  };

  if (sumAmbientResidentEmoteWeights(normalized) > 0) {
    return normalized;
  }

  return { ...DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS };
}

function sanitizeWeight(weight: number | undefined): number {
  if (typeof weight !== "number" || !Number.isFinite(weight)) {
    return 0;
  }

  return Math.max(0, weight);
}

function normalizePersonalityScore(score: number): number {
  const centered = (score - NEUTRAL_PERSONALITY_SCORE) / PERSONALITY_SCORE_RANGE;
  return clamp(centered, -1, 1);
}

function normalizeRandomValue(randomValue: number): number {
  if (!Number.isFinite(randomValue)) {
    return 0;
  }

  if (randomValue <= 0) {
    return 0;
  }

  if (randomValue >= 1) {
    return 1 - Number.EPSILON;
  }

  return randomValue;
}

function applyWeightModifier(baseWeight: number, modifier: number): number {
  const safeBaseWeight = sanitizeWeight(baseWeight);
  return Math.max(MIN_WEIGHT, safeBaseWeight * (1 + modifier));
}

function sumAmbientResidentEmoteWeights(
  weights: AmbientResidentEmoteWeights,
): number {
  return AMBIENT_RESIDENT_EMOTES.reduce((sum, emote) => sum + weights[emote], 0);
}

function createEmptyAmbientResidentEmoteWeights(
  value: number,
): AmbientResidentEmoteWeights {
  return {
    happy: value,
    angry: value,
    sad: value,
    surprised: value,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
