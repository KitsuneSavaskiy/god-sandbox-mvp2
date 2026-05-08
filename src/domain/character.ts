import type { Character, CharacterStatusBlock, FaithBand } from "./models.js";

export const DEFAULT_CHARACTER_STATUS: CharacterStatusBlock = {
  vitality: 50,
  empathy: 50,
  insight: 50,
  courage: 50,
  stress: 10,
  trustfulness: 50,
  ambition: 50,
  harmony: 50,
  faith: 30,
};

export function cloneCharacter(character: Character): Character {
  return structuredClone(character) as Character;
}

export function applyStatusDelta(
  status: CharacterStatusBlock,
  delta: Record<string, number>,
): CharacterStatusBlock {
  const next: CharacterStatusBlock = { ...status };

  for (const [key, amount] of Object.entries(delta)) {
    const current = next[key] ?? 0;
    next[key] = clampStatus(current + amount);
  }

  return next;
}

export function normalizeCharacterStatus(
  raw: Partial<CharacterStatusBlock>,
): CharacterStatusBlock {
  return {
    ...DEFAULT_CHARACTER_STATUS,
    ...raw,
    faith: clampStatus(raw.faith ?? DEFAULT_CHARACTER_STATUS.faith),
  };
}

export function resolveFaithBand(faith: number): FaithBand {
  if (faith < 20) {
    return "disbelieves";
  }

  if (faith < 40) {
    return "uncertain";
  }

  if (faith < 60) {
    return "senses_presence";
  }

  if (faith < 80) {
    return "believes";
  }

  return "devoted";
}

export function clampStatus(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}
