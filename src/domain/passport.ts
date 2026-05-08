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
    events: snapshot.recentEvents,
    relations: snapshot.relations,
  });

  const portraitAssetId = character.profile.appearance.primaryAssetId;
  const spriteSheetAssetId = character.profile.appearance.spriteSheetAssetId;

  const personalitySummary = buildPersonalitySummary(character.state.status);

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
    godRelationship: buildGodRelationship(faithBand, character.state.status.faith),
    voiceProfile: buildPassportVoiceProfile(vp),
    externalAiPromptBlock: buildExternalAiPromptBlock(
      character.profile.displayName,
      faithBand,
      vp,
    ),
  };
}

export function buildMemorySummary(input: {
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
    .sort((a, b) => {
      const scoreDiff = Math.abs(b.score) - Math.abs(a.score);
      if (scoreDiff !== 0) return scoreDiff;
      const aKey = [a.characterAId, a.characterBId].sort().join("__");
      const bKey = [b.characterAId, b.characterBId].sort().join("__");
      return aKey.localeCompare(bKey);
    })
    .slice(0, 5);

  const relationSummaries: PassportRelationSummary[] = sortedRelations.map((r) => ({
    withCharacterId: r.characterBId,
    relationDescription: describeRelation(r.score),
  }));

  return { memorySummary, keyEvents, relationSummaries };
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

function buildExternalAiPromptBlock(
  name: string,
  faithBand: FaithBand,
  vp: ReturnType<typeof resolveVoiceProfile>,
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
    "以下の制約を守ってください。",
  ].join(" ");

  const instructionReceptivity: InstructionReceptivityRule = {
    faithBand,
    generalStance: `信仰段階「${faithBand}」に基づいた対応をする。`,
    complianceLevel: complianceByBand[faithBand],
    refusalExample: "それはちょっと……",
  };

  return {
    systemPrompt,
    firstEncounterLines: vp.passportDialogueExamples
      .filter((e) => e.type === "first_encounter")
      .map((e) => e.text),
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
