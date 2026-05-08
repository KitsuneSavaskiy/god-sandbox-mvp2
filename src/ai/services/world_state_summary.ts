import type { Character, SandboxSession, WorldEvent } from "../../domain/models.js";
import { resolveFaithBand } from "../../domain/character.js";

export type WorldStateSummary = {
  characterName: string;
  faithBand: string;
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
  const faithBand = resolveFaithBand(character.state.status.faith);
  const emotionSummary = describeEmotion(character);
  const recentActions = recentEvents
    .slice(-5)
    .map((e) => e.summary)
    .filter((s) => s.length > 0);

  const currentEvent = recentEvents.at(-1);

  return {
    characterName: character.profile.displayName,
    faithBand,
    emotionSummary,
    recentActions,
    worldStatusTags: [...session.worldStatusTags],
    currentEventSummary: currentEvent?.summary ?? "穏やかな日常が続いている",
  };
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
