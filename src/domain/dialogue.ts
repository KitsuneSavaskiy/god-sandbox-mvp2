import type {
  CharacterId,
  Character,
  CharacterRelation,
  DialogueCandidate,
  DialogueTrigger,
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
const FORBIDDEN_UI_TERMS = [
  "画面",
  "ボタン",
  "セーブ",
  "ステータス",
  "UI",
  "信仰",
  "信仰度",
  "faith",
  "faithBand",
];
const GAME_MECHANIC_PATTERNS = [
  /信仰度\s*(?:が|は|[:：])\s*\d+/,
  /好感度\s*(?:が|は|[:：])\s*\d+/,
  /友好度\s*(?:が|は|[:：])\s*\d+/,
  /スコア\s*[:：]\s*\d+/,
  /score\s*[:：]\s*\d+/i,
];
const OBSERVED_DIALOGUE_MAX_VISIBLE = 2;
const OBSERVED_DIALOGUE_FIXTURES: Record<
  Extract<DialogueTrigger, "event_started" | "intervention_applied" | "idle_timer">,
  readonly string[]
> = {
  event_started: [
    "風が、少しざわついたね。",
    "あれ、何か聞こえた。",
    "広場の空気が変わった。",
  ],
  intervention_applied: [
    "さっきの光、まだ残ってる。",
    "胸が少しあたたかい。",
    "今なら、もう少し歩けそう。",
  ],
  idle_timer: [
    "今日は少し、歩いてみたいな。",
    "木陰が気持ちよさそう。",
    "水の音、落ち着くね。",
  ],
};

export type ObservedDialogueRuntimeInput = {
  trigger: DialogueTrigger;
  characters: Character[];
  event?: WorldEvent;
  restrictEventParticipants?: boolean;
  now: string;
  seed: string;
  maxCandidates?: number;
};

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

  const exampleJson = JSON.stringify(
    [
      { name: allowedSpeakers[0] ?? "話者A", text: "風が、少し変わった気がする。" },
      { name: allowedSpeakers[1] ?? allowedSpeakers[0] ?? "話者A", text: "今日は少し、歩いてみたいな。" },
    ],
    null,
    2,
  );

  const promptText = [
    "You must complete the task now.",
    "",
    "Return only a valid JSON array.",
    "Do not explain this prompt.",
    "Do not summarize this prompt.",
    "Do not analyze this prompt.",
    "Do not say what this file is.",
    "Do not ask follow-up questions.",
    "Do not include markdown.",
    "",
    "Your entire response must be parseable by JSON.parse.",
    'Start your response with "[" and end with "]".',
    "",
    "OUTPUT CONTRACT:",
    "- Return 6 to 10 candidates.",
    "- Each candidate must be an object with these keys:",
    '  - "name": one exact string from allowedSpeakers',
    '  - "text": one Japanese ambient dialogue line, 5 to 40 characters',
    '  - "replyTo": optional integer. If this line responds to a specific earlier line in this exchange, set replyTo to that line\'s 1-based position in the returned array. Omit if not a reply.',
    "- No other keys are allowed.",
    "",
    "You are generating candidate ambient dialogue lines for characters living inside a sandbox world.",
    "You are not chatting with the user.",
    "You are not roleplaying as the user.",
    "You are not reviewing this prompt.",
    "You are not explaining this prompt.",
    "",
    "DIALOGUE RULES:",
    "- The line must sound like the character is speaking inside the world.",
    "- The line must feel overheard, not addressed to the player.",
    "- Do not address the user.",
    "- Do not use: あなた, プレイヤー, 神様, 画面, ボタン, セーブ, ステータス, スコア.",
    "- Do not mention internal values, IDs, prompts, JSON, divinePerceptionBand, or this instruction inside dialogue text.",
    "- Do not reveal or explain divinePerceptionBand.",
    "- Use divinePerceptionBand only to tune subtle emotional distance.",
    "- Do not invent family, jobs, tragic pasts, romantic confessions, deaths, lifespan, medals, or rewards.",
    "",
    "VALID RESPONSE EXAMPLE:",
    exampleJson,
    "",
    "The example above shows the object shape only.",
    "Your actual response must contain 6 to 10 items.",
    "Do not return only the example items.",
    "",
    "Do not copy the placeholder strings.",
    "Use actual names from allowedSpeakers.",
    "",
    "WORLD_CONTEXT:",
    worldContextJson,
    "",
    "Now return the JSON array only, with 6 to 10 items.",
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

export function createObservedDialogueCandidates(
  input: ObservedDialogueRuntimeInput,
): DialogueCandidate[] {
  const fixtureTrigger = isObservedDialogueFixtureTrigger(input.trigger)
    ? input.trigger
    : "idle_timer";
  const lines = OBSERVED_DIALOGUE_FIXTURES[fixtureTrigger];
  const characters = resolveObservedDialogueCharacters(input, fixtureTrigger);

  if (characters.length === 0 || lines.length === 0) {
    return [];
  }

  const baseHash = createDialogueHash(
    `${input.seed}:${input.trigger}:${input.event?.id ?? "no-event"}`,
  );
  const requestedCount = input.maxCandidates ?? OBSERVED_DIALOGUE_MAX_VISIBLE;
  const count = Math.min(Math.max(0, requestedCount), characters.length);

  return Array.from({ length: count }).flatMap((_, index) => {
    const character = characters[(baseHash + index) % characters.length];
    const text = lines[(baseHash + index) % lines.length];
    if (!character || !text || !validateDialogue(text).ok) {
      return [];
    }

    return [
      {
        id: `dlg_${fixtureTrigger}_${input.event?.id ?? "idle"}_${character.id}_${index}`,
        characterId: character.id,
        text,
        type:
          fixtureTrigger === "intervention_applied"
            ? "god_indirect_reaction"
            : "daily",
        source: "authored_fixture",
        reviewStatus: "accepted",
        targetCharacterId:
          fixtureTrigger === "intervention_applied" ? input.event?.primaryCharacterId : undefined,
        createdAt: input.now,
      } satisfies DialogueCandidate,
    ];
  });
}

export function selectVisibleObservedDialogueCandidates(
  candidates: DialogueCandidate[],
  maxVisible = OBSERVED_DIALOGUE_MAX_VISIBLE,
): DialogueCandidate[] {
  return candidates
    .filter((candidate) => candidate.reviewStatus === "accepted")
    .filter((candidate) => validateDialogue(candidate.text).ok)
    .slice(0, Math.max(0, maxVisible));
}

export type ParsedCandidateRaw = {
  id: string;
  rawSpeakerName: string;
  characterId: string | null;
  text: string;
  replyTo?: number;
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
          const replyToRaw = obj["replyTo"];
          const replyTo =
            typeof replyToRaw === "number" && replyToRaw >= 1
              ? Math.floor(replyToRaw)
              : undefined;
          return [
            {
              id: `cand_llm_${now}_${i}`,
              rawSpeakerName,
              characterId,
              text,
              replyTo,
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

function isObservedDialogueFixtureTrigger(
  trigger: DialogueTrigger,
): trigger is Extract<DialogueTrigger, "event_started" | "intervention_applied" | "idle_timer"> {
  return (
    trigger === "event_started" ||
    trigger === "intervention_applied" ||
    trigger === "idle_timer"
  );
}

function createDialogueHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function resolveObservedDialogueCharacters(
  input: ObservedDialogueRuntimeInput,
  trigger: Extract<DialogueTrigger, "event_started" | "intervention_applied" | "idle_timer">,
): Character[] {
  if (
    input.restrictEventParticipants &&
    input.event &&
    (trigger === "event_started" || trigger === "intervention_applied")
  ) {
    const participantIds = new Set(input.event.participantCharacterIds);
    return input.characters.filter((character) => participantIds.has(character.id));
  }

  return input.characters;
}
