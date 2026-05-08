import { getPromptEntry } from "./registry.js";
import type { RyoExpression } from "../schemas/ryo_reaction.js";
import { RYO_REACTION_SCHEMA_FOR_LLM } from "../schemas/ryo_reaction.js";

export type RyoReactionPromptInput = {
  characterName: string;
  faithBand: string;
  fearBand: string;
  trustBand: string;
  emotionSummary: string;
  recentActions: string[];
  worldStatusTags: string[];
  divineAction: string;
  targetExpression: RyoExpression;
};

export function buildRyoReactionPromptText(input: RyoReactionPromptInput): string {
  const entry = getPromptEntry("ryo_reaction");

  const characterBlock = [
    `キャラクター: ${input.characterName}`,
    `信仰段階: ${input.faithBand}`,
    `恐れの度合い: ${input.fearBand}`,
    `信頼の度合い: ${input.trustBand}`,
    `現在の状態: ${input.emotionSummary}`,
    input.recentActions.length > 0
      ? `直近の出来事:\n${input.recentActions.map((a) => `- ${a}`).join("\n")}`
      : "",
    input.worldStatusTags.length > 0
      ? `世界の状況タグ: ${input.worldStatusTags.join("、")}`
      : "",
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  return [
    "以下のキャラクター状態と神の介入をもとに、キャラクターの短文リアクションを JSON で生成してください。",
    "",
    "## キャラクター状態",
    characterBlock,
    "",
    "## 神の行為",
    input.divineAction,
    "",
    "## 要求表情",
    input.targetExpression,
    "",
    "## 出力スキーマ（このスキーマに厳密に従うこと）",
    "```json",
    RYO_REACTION_SCHEMA_FOR_LLM,
    "```",
    "",
    "## 制約（スキーマに加えて）",
    `- line は ${entry.maxOutputCharsJa} 文字以内の日本語`,
    "- 「あなた」「プレイヤー」「神様（直接呼びかけ）」を line に含めない",
    "- 死亡・寿命・勲章に関する内容を含めない",
    "- state_change_request は必ず null（AI はゲーム状態を変更できない）",
    "- JSON のみを返すこと。説明文・前置きは不要",
  ].join("\n");
}
