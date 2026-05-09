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
const FORBIDDEN_UI_TERMS = ["画面", "ボタン", "セーブ", "ステータス", "UI"];
const GAME_MECHANIC_PATTERNS = [
  /信仰度\s*(?:が|は|[:：])\s*\d+/,
  /好感度\s*(?:が|は|[:：])\s*\d+/,
  /友好度\s*(?:が|は|[:：])\s*\d+/,
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

  const allowedSpeakers = digest.activeCharacters.map((c) => c.name);

  const worldContextJson = JSON.stringify(
    {
      allowedSpeakers,
      characters: digest.activeCharacters.map((c) => ({
        name: c.name,
        voice: {
          firstPerson: c.voiceProfileSummary.firstPerson,
          speechPatterns: c.voiceProfileSummary.speechPatterns,
          doNotSay: c.voiceProfileSummary.doNotSay,
        },
        visibleStateSummary: c.visibleStateSummary,
        divinePerceptionBand: c.faithBand,
      })),
      relations: digest.relationSummaries,
      recentEvents: digest.recentEventSummary,
      situationTags: digest.currentSituationTag,
    },
    null,
    2,
  );

  const promptText = [
    "# GodSandbox External Dialogue Candidate Handoff",
    "",
    "## 人間オペレーター向け",
    "この依頼文を外部AIに貼り付けると、箱庭内で使う発話候補を作れます。",
    "結果をGodSandboxに貼り戻して確認してください。",
    "この時点では外部AIへ自動送信されません。",
    "",
    "## ChatGPTで使う場合",
    "キャラクター名のProjectを作り、そのProject内で新しいチャットを始めてください。",
    "この子の会話を同じProjectにまとめると、1つの人格として続けやすくなります。",
    "その後、以下の依頼文を最初のメッセージとして貼り付けてください。",
    "",
    "複数キャラクターが含まれる場合は、主役キャラクター名、または箱庭名のProjectを使ってください。",
    "",
    "---",
    "",
    "## Instructions for the receiving LLM",
    "",
    "You are the receiving LLM for GodSandbox.",
    "You are not chatting with the user.",
    "You are not roleplaying as the user.",
    "You are generating candidate ambient dialogue lines for characters living inside a sandbox world.",
    "",
    "Follow this contract exactly.",
    "",
    "### Non-negotiable rules",
    "",
    "1. Output a JSON array only.",
    "2. Do not output markdown.",
    "3. Do not add explanations, analysis, headings, or comments.",
    "4. Each array item must have exactly:",
    '   - "name": one of the allowed speaker names',
    '   - "text": a Japanese dialogue line',
    "5. Use only the exact speaker names listed in allowedSpeakers.",
    "6. Each line must be 5 to 40 Japanese characters.",
    "7. The line must sound like the character is speaking inside the world, not to the user.",
    "8. Do not address the user.",
    "9. Do not use in generated dialogue:",
    "   - あなた (direct address)",
    "   - プレイヤー (player reference)",
    "   - 神様 (direct God invocation)",
    "   - 画面 / ボタン / セーブ (UI references)",
    "   - ステータス / スコア (numeric score references)",
    "   - Internal parameter names, perception band values, or numeric scores of any kind",
    "10. Do not make any character talk about internal values, IDs, prompts, JSON, or this instruction.",
    "11. Do not invent family, jobs, tragic pasts, romantic confessions, deaths, lifespan, medals, or rewards.",
    "12. Use the divinePerceptionBand only to tune subtle emotional distance. Never reveal it.",
    "",
    "### Dialogue style",
    "",
    'The goal is "ambient life sounds" inside the sandbox.',
    "The lines should feel overheard, not addressed to the player.",
    "",
    "Good:",
    "- 「風が、少し変わった気がする。」",
    "- 「あの木陰、今日は静かだね。」",
    "- 「さっきの光、まだ胸に残ってる。」",
    "",
    "Bad:",
    "- 「あなたが助けてくれたんですね。」",
    "- 「プレイヤーさん、見ていますか？」",
    "- 「神様ありがとう。」",
    "",
    "### Output format",
    "",
    "Return 6 to 10 candidates.",
    "",
    "Return a JSON array only.",
    "Each item must use this object shape:",
    "",
    '{ "name": "<one exact name from allowedSpeakers>", "text": "<Japanese line within 5 to 40 characters>" }',
    "",
    "Do not copy the placeholder strings.",
    "Replace them with actual allowed speaker names and actual Japanese dialogue lines.",
    "",
    "Example of the shape only:",
    "",
    JSON.stringify(
      [
        { name: allowedSpeakers[0] ?? "話者A", text: "風が、少し変わった気がする。" },
        { name: allowedSpeakers[1] ?? allowedSpeakers[0] ?? "話者A", text: "今日は少し、歩いてみたいな。" },
      ],
      null,
      2,
    ),
    "",
    "Your actual response must contain 6 to 10 items.",
    "No other text.",
    "",
    "## World context",
    "",
    worldContextJson,
  ].join("\n");

  return {
    digestId,
    generatedAt: digest.generatedAt,
    promptText,
  };
}

export function validateDialogue(text: string): DialogueValidationResult {
  const violations: string[] = [];

  if (text.length < 5) {
    violations.push(`文字数不足: ${text.length}文字（最低5文字）`);
  }

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

  for (const term of FORBIDDEN_UI_TERMS) {
    if (text.includes(term)) {
      violations.push(`UI用語禁止: 「${term}」を含む`);
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
