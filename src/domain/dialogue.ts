import type {
  CharacterId,
  Character,
  CharacterRelation,
  DialoguePromptPack,
  DialogueWorldDigest,
  SandboxSession,
  WorldEvent,
} from "./models.js";
import { resolveFaithBand } from "./character.js";
import { resolveVoiceProfile } from "./voiceProfile.js";

export function buildDialogueWorldDigest(
  session: SandboxSession,
  characters: Map<CharacterId, Character>,
  relations: CharacterRelation[],
  events: WorldEvent[],
): DialogueWorldDigest {
  const now = new Date().toISOString();

  const activeCharacters = session.activeSlots
    .map((id) => {
      const character = characters.get(id);
      if (!character) return null;
      const vp = resolveVoiceProfile(character);
      return {
        characterId: character.id,
        name: character.profile.displayName,
        faithBand: resolveFaithBand(character.state.status.faith),
        currentStatus: { ...character.state.status },
        voiceProfileSummary: {
          firstPerson: vp.firstPerson,
          speechPatterns: [...vp.speechPatterns],
          doNotSay: [...vp.doNotSay],
        },
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const activeRelations = relations.map((r) => ({
    characterAId: r.characterAId,
    characterBId: r.characterBId,
    score: r.score,
  }));

  const recentEventSummary = events
    .slice(-5)
    .map((e) => e.summary)
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  return {
    sessionId: session.id,
    generatedAt: now,
    activeCharacters,
    activeRelations,
    recentEventSummary,
    currentSituationTag: [...session.worldStatusTags],
  };
}

export function buildDialoguePromptPack(digest: DialogueWorldDigest): DialoguePromptPack {
  const digestId = `${digest.sessionId}-${digest.generatedAt}`;

  const characterLines = digest.activeCharacters
    .map(
      (c) =>
        `【${c.name}】信仰段階: ${c.faithBand} / 口調: ${c.voiceProfileSummary.firstPerson}` +
        (c.voiceProfileSummary.speechPatterns.length > 0
          ? ` / 話し方: ${c.voiceProfileSummary.speechPatterns.slice(0, 3).join("、")}`
          : ""),
    )
    .join("\n");

  const situationLine =
    digest.currentSituationTag.length > 0
      ? `\n状況タグ: ${digest.currentSituationTag.join(", ")}`
      : "";

  const eventLine =
    digest.recentEventSummary.length > 0
      ? `\n直近の出来事:\n${digest.recentEventSummary.map((s) => `- ${s}`).join("\n")}`
      : "";

  const promptText = [
    "以下のキャラクター情報をもとに、箱庭内の自然な発話候補を生成してください。",
    "発話は40文字以内とし、「あなた」「プレイヤー」「神様（直接呼びかけ）」を含めないこと。",
    "",
    characterLines,
    situationLine,
    eventLine,
  ]
    .join("\n")
    .trim();

  return {
    digestId,
    generatedAt: digest.generatedAt,
    promptText,
  };
}

export function validateDialogue(text: string): boolean {
  return text.length <= 40;
}
