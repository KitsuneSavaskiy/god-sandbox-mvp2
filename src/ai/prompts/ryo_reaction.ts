import { getPromptEntry } from "./registry.js";
import type { RyoExpression } from "../schemas/ryo_reaction.js";

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

  const outputExample = JSON.stringify(
    {
      expression: input.targetExpression,
      line: "（台詞テキスト）",
      intensity: 0.7,
      tags: ["タグ1", "タグ2"],
      state_change_request: null,
    },
    null,
    2,
  );

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
    "## 出力形式（JSONのみ返すこと）",
    "```json",
    outputExample,
    "```",
    "",
    "## 制約",
    `- line は ${entry.maxOutputCharsJa} 文字以内の日本語`,
    "- 「あなた」「プレイヤー」「神様（直接呼びかけ）」を line に含めない",
    "- 死亡・寿命・勲章に関する内容を含めない",
    "- state_change_request は必ず null（AI はゲーム状態を変更できない）",
    "- expression は normal / joy / sadness / tense / bless / divine / watch / test のいずれか",
    "- intensity は 0.0 〜 1.0 の数値",
  ].join("\n");
}
