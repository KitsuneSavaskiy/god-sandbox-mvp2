import type {
  CharacterId,
  Character,
  CharacterRelation,
  DialoguePromptPack,
  DialogueValidationResult,
  DialogueWorldDigest,
  SandboxSession,
  WorldEvent,
} from "./models.js";
import { resolveFaithBand } from "./character.js";
import { resolveVoiceProfile } from "./voiceProfile.js";
import { validateGeneratedNarrativeCandidate } from "./generatedContentSafety.js";

const FORBIDDEN_DIRECT_ADDRESS = ["あなた", "プレイヤー"];
const FORBIDDEN_GOD_DIRECT = ["神様"];
const GAME_MECHANIC_PATTERNS = [
  /信仰度\s*[:：]\s*\d+/,
  /スコア\s*[:：]\s*\d+/,
  /score\s*[:：]\s*\d+/i,
];

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
        visibleStateSummary: buildVisibleStateSummary(character),
        voiceProfileSummary: {
          firstPerson: vp.firstPerson,
          speechPatterns: [...vp.speechPatterns],
          doNotSay: [...vp.doNotSay],
        },
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const relationSummaries = relations.map((r) => {
    const nameA = characters.get(r.characterAId)?.profile.displayName ?? r.characterAId;
    const nameB = characters.get(r.characterBId)?.profile.displayName ?? r.characterBId;
    return `${nameA}と${nameB}は${describeRelation(r.score)}`;
  });

  const recentEventSummary = events
    .slice(-5)
    .map((e) => e.summary)
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  return {
    sessionId: session.id,
    generatedAt: now,
    activeCharacters,
    relationSummaries,
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
          : "") +
        ` / ${c.visibleStateSummary}`,
    )
    .join("\n");

  const relationLine =
    digest.relationSummaries.length > 0
      ? `\n関係性:\n${digest.relationSummaries.map((s) => `- ${s}`).join("\n")}`
      : "";

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
    relationLine,
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

export function validateDialogue(text: string): DialogueValidationResult {
  const violations: string[] = [];

  if (text.length > 40) {
    violations.push(`文字数超過: ${text.length}文字（上限40文字）`);
  }

  for (const word of FORBIDDEN_DIRECT_ADDRESS) {
    if (text.includes(word)) {
      violations.push(`直接呼びかけ禁止: 「${word}」を含む`);
    }
  }

  for (const word of FORBIDDEN_GOD_DIRECT) {
    if (text.includes(word)) {
      violations.push(`直接呼びかけ禁止: 「${word}」を含む`);
    }
  }

  for (const pattern of GAME_MECHANIC_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`ゲーム内部値の漏出: ${pattern.source}`);
    }
  }

  const narrativeResult = validateGeneratedNarrativeCandidate(text);
  if (!narrativeResult.ok) {
    violations.push(...narrativeResult.violations);
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}

export type ParsedCandidateRaw = {
  id: string;
  rawSpeakerName: string;
  characterId: string | null;
  text: string;
  type: "daily" | "relationship" | "god_indirect_reaction";
  source: "external_llm_handoff";
  reviewStatus: "needs_review";
  createdAt: string;
};

export function parseDialogueCandidatesFromText(
  rawText: string,
  nameToIdMap: Map<string, string>,
  now: string,
): ParsedCandidateRaw[] {
  const trimmed = rawText.trim();

  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return (parsed as unknown[]).flatMap((item, i) => {
          if (typeof item !== "object" || item === null) return [];
          const obj = item as Record<string, unknown>;
          const rawSpeakerName = String(obj["name"] ?? obj["speakerName"] ?? "").trim();
          const text = String(obj["text"] ?? obj["content"] ?? "").trim();
          if (!rawSpeakerName || !text) return [];
          const characterId = nameToIdMap.get(rawSpeakerName) ?? null;
          return [
            {
              id: `cand_llm_${now}_${i}`,
              rawSpeakerName,
              characterId,
              text,
              type: "daily" as const,
              source: "external_llm_handoff" as const,
              reviewStatus: "needs_review" as const,
              createdAt: now,
            },
          ];
        });
      }
    } catch {
      // fall through to line parsing
    }
  }

  return rawText.split("\n").flatMap((line, i) => {
    const jpColonIdx = line.indexOf("：");
    const asciiColonIdx = line.indexOf(":");
    const splitAt =
      jpColonIdx >= 0 ? jpColonIdx : asciiColonIdx >= 0 ? asciiColonIdx : -1;
    if (splitAt < 0) return [];
    const rawSpeakerName = line.slice(0, splitAt).trim();
    const text = line.slice(splitAt + 1).trim();
    if (!rawSpeakerName || !text) return [];
    const characterId = nameToIdMap.get(rawSpeakerName) ?? null;
    return [
      {
        id: `cand_llm_${now}_${i}`,
        rawSpeakerName,
        characterId,
        text,
        type: "daily" as const,
        source: "external_llm_handoff" as const,
        reviewStatus: "needs_review" as const,
        createdAt: now,
      },
    ];
  });
}

function buildVisibleStateSummary(character: Character): string {
  const { vitality, stress, empathy } = character.state.status;
  const traits: string[] = [];
  if (vitality >= 60) traits.push("元気");
  else if (vitality <= 20) traits.push("疲れ気味");
  if (stress >= 60) traits.push("ストレスを感じている");
  if (empathy >= 60) traits.push("穏やか");
  return traits.length > 0 ? traits.join("、") : "普通";
}

function describeRelation(score: number): string {
  if (score >= 40) return "深い信頼関係にある";
  if (score >= 20) return "良好な関係にある";
  if (score >= 5) return "普通の関係にある";
  if (score >= -5) return "やや距離がある";
  return "複雑な関係にある";
}
