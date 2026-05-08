import { getPromptEntry } from "../prompts/registry.js";
import type { RyoExpression } from "../schemas/ryo_reaction.js";
import { validateRyoReactionOutput, RYO_FALLBACK_LINE } from "../schemas/ryo_reaction.js";
import type { WorldStateSummary } from "./world_state_summary.js";

export type RyoReactionInput = {
  worldState: WorldStateSummary;
  divineAction: string;
  targetExpression: RyoExpression;
};

export type RyoReactionPromptResult = {
  promptId: string;
  promptVersion: string;
  promptText: string;
};

export type RyoReactionOutputResult =
  | { ok: true; line: string; expression: RyoExpression; tags: string[] }
  | { ok: false; violations: string[]; fallbackLine: string };

export function buildRyoReactionPrompt(input: RyoReactionInput): RyoReactionPromptResult {
  const entry = getPromptEntry("ryo_reaction");

  const worldBlock = [
    `キャラクター: ${input.worldState.characterName}`,
    `信仰段階: ${input.worldState.faithBand}`,
    `現在の状態: ${input.worldState.emotionSummary}`,
    input.worldState.recentActions.length > 0
      ? `直近の出来事:\n${input.worldState.recentActions.map((a) => `- ${a}`).join("\n")}`
      : "",
    input.worldState.worldStatusTags.length > 0
      ? `世界の状況: ${input.worldState.worldStatusTags.join("、")}`
      : "",
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  const promptText = [
    "以下の箱庭キャラクター情報と神の介入に対して、キャラクターの短文リアクションを生成してください。",
    "",
    "## キャラクター状態",
    worldBlock,
    "",
    `## 神の行為`,
    input.divineAction,
    "",
    `## 要求表情`,
    input.targetExpression,
    "",
    "## 出力形式（JSON のみ返すこと）",
    "```json",
    JSON.stringify(
      {
        expression: input.targetExpression,
        line: "（42文字以内の日本語台詞）",
        intensity: 0.7,
        tags: ["（関連タグ）"],
        state_change_request: null,
      },
      null,
      2,
    ),
    "```",
    "",
    "## 制約",
    `- line は ${entry.maxOutputCharsJa} 文字以内の日本語`,
    "- 「あなた」「プレイヤー」「神様（直接呼びかけ）」を line に含めない",
    "- 死亡・寿命・勲章に関する内容を含めない",
    "- state_change_request は必ず null にする（AIがゲーム状態を変更することは禁止）",
    "- expression は以下 8 値のいずれかのみ: normal / joy / sadness / tense / bless / divine / watch / test",
  ].join("\n");

  return {
    promptId: entry.id,
    promptVersion: entry.version,
    promptText,
  };
}

export function parseRyoReactionOutput(rawJson: string): RyoReactionOutputResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      violations: ["output is not valid JSON"],
      fallbackLine: RYO_FALLBACK_LINE,
    };
  }

  const result = validateRyoReactionOutput(parsed);
  if (!result.ok) {
    return { ok: false, violations: result.violations, fallbackLine: result.fallbackLine };
  }

  return {
    ok: true,
    line: result.output.line,
    expression: result.output.expression,
    tags: result.output.tags,
  };
}
