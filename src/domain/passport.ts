import type {
  CharacterRelation,
  CharacterSnapshot,
  ExternalAiPromptBlock,
  FaithBand,
  InstructionReceptivityRule,
  PassportGodRelationship,
  PassportKeyEvent,
  PassportLifeMemory,
  PassportOutsideWorldPayload,
  PassportRelationSummary,
  PassportVoiceProfile,
  WorldEvent,
} from "./models.js";
import { resolveFaithBand } from "./character.js";
import { resolveVoiceProfile } from "./voiceProfile.js";

type RecentEventLike = Pick<WorldEvent, "id" | "summary" | "status" | "createdAt">;

export function generatePassportDisplay(snapshot: CharacterSnapshot): PassportOutsideWorldPayload {
  const character = snapshot.character;
  const vp = resolveVoiceProfile(character);
  const faithBand = resolveFaithBand(character.state.status.faith);

  const { memorySummary, keyEvents, relationSummaries } = buildMemorySummary({
    sourceCharacterId: character.id,
    events: snapshot.recentEvents,
    relations: snapshot.relations,
  });

  const portraitAssetId = character.profile.appearance.primaryAssetId;
  const spriteSheetAssetId = character.profile.appearance.spriteSheetAssetId;

  const personalitySummary = buildPersonalitySummary(character.state.status);
  const godRel = buildGodRelationship(faithBand, character.state.status.faith);

  return {
    character: {
      id: character.id,
      name: character.profile.displayName,
      age: character.profile.age,
      personalitySummary,
      assetRef: {
        portraitAssetId,
        spriteSheetAssetId,
      },
    },
    lifeMemory: {
      totalInterventions: snapshot.recentEvents.length,
      memorySummary,
      keyEvents,
      relationSummaries,
    },
    godRelationship: godRel,
    voiceProfile: buildPassportVoiceProfile(vp),
    externalAiPromptBlock: buildExternalAiPromptBlock(
      character.profile.displayName,
      faithBand,
      vp,
      { personalitySummary, memorySummary, godRelationship: godRel },
    ),
  };
}

export function buildMemorySummary(input: {
  sourceCharacterId: string;
  events: RecentEventLike[];
  relations: CharacterRelation[];
  maxKeyEvents?: number;
}): { memorySummary: string; keyEvents: PassportKeyEvent[]; relationSummaries: PassportRelationSummary[] } {
  const maxKeyEvents = input.maxKeyEvents ?? 5;

  const sortedEvents = [...input.events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, maxKeyEvents);

  const keyEvents: PassportKeyEvent[] = sortedEvents.map((e) => ({
    eventId: e.id,
    title: e.summary ?? "（出来事）",
    outcome: e.status === "resolved" ? "resolved" : e.status === "active" ? "ongoing" : "failed",
    characterReflection: "この経験から何かを学んだ。",
  }));

  const memorySummary =
    keyEvents.length > 0
      ? `${keyEvents.length}つの出来事を経験した。`
      : "まだ特記すべき出来事はない。";

  const sortedRelations = [...input.relations]
    .filter((r) => r.characterAId !== r.characterBId)
    .sort((a, b) => {
      const scoreDiff = Math.abs(b.score) - Math.abs(a.score);
      if (scoreDiff !== 0) return scoreDiff;
      const aKey = [a.characterAId, a.characterBId].sort().join("__");
      const bKey = [b.characterAId, b.characterBId].sort().join("__");
      return aKey.localeCompare(bKey);
    })
    .slice(0, 5);

  const relationSummaries: PassportRelationSummary[] = sortedRelations
    .map((r) => {
      const otherCharacterId = resolveOtherCharacterId(r, input.sourceCharacterId);
      if (!otherCharacterId) return null;
      return { withCharacterId: otherCharacterId, relationDescription: describeRelation(r.score) };
    })
    .filter((s): s is PassportRelationSummary => s !== null);

  return { memorySummary, keyEvents, relationSummaries };
}

function resolveOtherCharacterId(
  relation: CharacterRelation,
  sourceCharacterId: string,
): string | null {
  if (relation.characterAId === sourceCharacterId && relation.characterBId !== sourceCharacterId) {
    return relation.characterBId;
  }
  if (relation.characterBId === sourceCharacterId && relation.characterAId !== sourceCharacterId) {
    return relation.characterAId;
  }
  return null;
}

export function buildPassportVoiceProfile(vp: ReturnType<typeof resolveVoiceProfile>): PassportVoiceProfile {
  return {
    firstPerson: vp.firstPerson,
    speechPatterns: [...vp.speechPatterns],
    sentenceLength: vp.sentenceLength,
    emotionalExpression: vp.emotionalExpression,
    sandboxDoNotSay: [...vp.doNotSay],
    outsideWorldDoNotSay: derivePassportDoNotSay(vp.doNotSay),
    doNotInvent: [...vp.doNotInvent],
    continuityRules: [...vp.continuityRules],
    sandboxDialogueExamples: [...vp.sandboxDialogueExamples],
    passportDialogueExamples: [...vp.passportDialogueExamples],
  };
}

export function derivePassportDoNotSay(sandboxDoNotSay: string[]): string[] {
  return sandboxDoNotSay.filter(
    (entry) => !entry.includes("あなた") && !entry.includes("神様"),
  );
}

function buildGodRelationship(faithBand: FaithBand, currentFaith: number): PassportGodRelationship {
  const interpretations: Record<FaithBand, string> = {
    disbelieves: "神の存在を信じていない。",
    uncertain: "神の存在に半信半疑だ。",
    senses_presence: "何か見えない力の存在を感じている。",
    believes: "神を信じており、見守られていると感じている。",
    devoted: "深い信仰を持ち、神に強く依存している。",
  };

  const faithVisibility: Record<FaithBand, string> = {
    disbelieves: "全く感じていない",
    uncertain: "ほんのわずか",
    senses_presence: "うっすらと感じている",
    believes: "はっきりと感じている",
    devoted: "強く感じている",
  };

  return {
    faithBand,
    currentFaith,
    faithVisibility: faithVisibility[faithBand],
    faithChangeSummary: "箱庭での経験を通じて信仰度が変化した。",
    interpretationOfGod: interpretations[faithBand],
  };
}

const ENCOUNTER_FALLBACKS: Record<FaithBand, [string, string, string]> = {
  disbelieves: ["あなたが誰なのかはわからないけれど。", "……どこから来たの？", "ここが外の世界か。"],
  uncertain:   ["あなたのことが気になる。", "また会えるといいな。", "どこかで見たような気がする。"],
  senses_presence: ["何か、引き合うものを感じる。", "あなたに会えて良かった。", "また会おうね。"],
  believes:    ["あなたに会えたのは偶然じゃないと思う。", "また一緒にいられて嬉しいよ。", "よろしくね。"],
  devoted:     ["ずっと会いたかった。", "一緒にいてくれてありがとう。", "あなたと歩めることが嬉しい。"],
};

function buildExternalAiPromptBlock(
  name: string,
  faithBand: FaithBand,
  vp: ReturnType<typeof resolveVoiceProfile>,
  options: {
    personalitySummary: string;
    memorySummary: string;
    godRelationship: PassportGodRelationship;
  },
): ExternalAiPromptBlock {
  const complianceByBand: Record<FaithBand, InstructionReceptivityRule["complianceLevel"]> = {
    disbelieves: "skeptical",
    uncertain: "cautious",
    senses_presence: "moderate",
    believes: "high",
    devoted: "high",
  };

  const systemPrompt = [
    `あなたは「${name}」というキャラクターです。`,
    `一人称は「${vp.firstPerson}」を使います。`,
    `話し方の特徴: ${vp.speechPatterns.slice(0, 3).join("、") || "特になし"}。`,
    options.personalitySummary ? `性格: ${options.personalitySummary}` : "",
    options.memorySummary ? `記憶の要約: ${options.memorySummary}` : "",
    `神との関係: ${options.godRelationship.interpretationOfGod}`,
    "以下の制約を守ってください。",
  ].filter(Boolean).join(" ");

  const instructionReceptivity: InstructionReceptivityRule = {
    faithBand,
    generalStance: `信仰段階「${faithBand}」に基づいた対応をする。`,
    complianceLevel: complianceByBand[faithBand],
    refusalExample: "それはちょっと……",
  };

  const existingLines = vp.passportDialogueExamples
    .filter((e) => e.type === "first_encounter")
    .map((e) => e.text);
  const firstEncounterLines = [...existingLines];
  for (const line of ENCOUNTER_FALLBACKS[faithBand]) {
    if (firstEncounterLines.length >= 3) break;
    firstEncounterLines.push(line);
  }

  return {
    systemPrompt,
    firstEncounterLines,
    instructionReceptivity,
    importantConstraints: [
      ...derivePassportDoNotSay(vp.doNotSay).slice(0, 3),
      ...vp.doNotInvent.slice(0, 2),
    ],
  };
}

function buildPersonalitySummary(status: { ambition?: number; empathy?: number; courage?: number; [key: string]: number | undefined }): string {
  const traits: string[] = [];
  if ((status.ambition ?? 0) >= 60) traits.push("向上心が強い");
  if ((status.empathy ?? 0) >= 60) traits.push("共感力が高い");
  if ((status.courage ?? 0) >= 60) traits.push("勇気がある");
  if ((status.stress ?? 0) >= 60) traits.push("ストレスを抱えやすい");
  return traits.length > 0 ? traits.join("、") + "。" : "バランスの取れた性格。";
}

function describeRelation(score: number): string {
  if (score >= 40) return "深い信頼関係にある。";
  if (score >= 20) return "良好な関係にある。";
  if (score >= 5) return "普通の関係にある。";
  if (score >= -5) return "やや距離感がある。";
  return "複雑な関係にある。";
}
