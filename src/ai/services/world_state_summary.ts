import type { Character, SandboxSession, WorldEvent } from "../../domain/models.js";
import { resolveFaithBand } from "../../domain/character.js";

const INTERNAL_VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  /信仰度\s*[:：]\s*\d+/g,
  /恐怖値\s*[:：]\s*\d+/g,
  /スコア\s*[:：]\s*\d+/g,
  /score\s*[:：]\s*\d+/gi,
  /\b(wood|fire|earth|metal|water|yin|yang)\s*[:：]\s*[\d.]+/gi,
];

function sanitizeWorldContextText(text: string): string {
  return INTERNAL_VALUE_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, "[内部値]"),
    text,
  );
}

export type WorldStateSummary = {
  characterName: string;
  faithBand: string;
  fearBand: string;
  trustBand: string;
  emotionSummary: string;
  recentActions: string[];
  worldStatusTags: string[];
  currentEventSummary: string;
};

export function buildWorldStateSummary(
  character: Character,
  session: SandboxSession,
  recentEvents: WorldEvent[],
): WorldStateSummary {
  const { stress, trustfulness } = character.state.status;

  const faithBand = resolveFaithBand(character.state.status.faith);
  const fearBand = resolveFearBand(stress);
  const trustBand = resolveTrustBand(trustfulness);
  const emotionSummary = describeEmotion(character);
  const recentActions = recentEvents
    .slice(-5)
    .map((e) => sanitizeWorldContextText(e.summary))
    .filter((s) => s.length > 0);

  const currentEvent = recentEvents.at(-1);

  return {
    characterName: character.profile.displayName,
    faithBand,
    fearBand,
    trustBand,
    emotionSummary,
    recentActions,
    worldStatusTags: [...session.worldStatusTags].map(sanitizeWorldContextText),
    currentEventSummary: sanitizeWorldContextText(currentEvent?.summary ?? "穏やかな日常が続いている"),
  };
}

export function resolveFearBand(stress: number): string {
  if (stress >= 65) return "high";
  if (stress >= 35) return "moderate";
  return "calm";
}

export function resolveTrustBand(trustfulness: number): string {
  if (trustfulness >= 60) return "trusting";
  if (trustfulness >= 30) return "neutral";
  return "skeptical";
}

function describeEmotion(character: Character): string {
  const { vitality, stress, empathy, courage } = character.state.status;
  const traits: string[] = [];

  if (vitality >= 70) traits.push("元気に満ちている");
  else if (vitality <= 25) traits.push("深く疲れている");

  if (stress >= 65) traits.push("強いストレスを感じている");
  else if (stress <= 15) traits.push("心が落ち着いている");

  if (empathy >= 65) traits.push("他者への共感が深い");
  if (courage >= 65) traits.push("強い意志を持っている");
  else if (courage <= 20) traits.push("迷いを抱えている");

  return traits.length > 0 ? traits.join("、") : "普段どおりの状態";
}
