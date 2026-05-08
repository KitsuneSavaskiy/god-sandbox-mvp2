export type RyoExpression =
  | "normal"
  | "joy"
  | "sadness"
  | "tense"
  | "bless"
  | "divine"
  | "watch"
  | "test";

export const RYO_EXPRESSIONS: ReadonlySet<string> = new Set<RyoExpression>([
  "normal",
  "joy",
  "sadness",
  "tense",
  "bless",
  "divine",
  "watch",
  "test",
]);

export type RyoReactionOutput = {
  expression: RyoExpression;
  line: string;
  intensity: number;
  tags: string[];
  state_change_request: null;
};

export type RyoReactionValidationResult =
  | { ok: true; output: RyoReactionOutput }
  | { ok: false; violations: string[]; fallbackLine: string };

export const RYO_FALLBACK_LINE = "……神の御業を、静かに受け取りました。";

// Canonical JSON Schema for RyoReactionOutput.
// This is the single source of truth for both:
//   1. validateRyoReactionOutput() — runtime enforcement
//   2. buildRyoReactionPromptText() — embedded in every prompt sent to external LLMs
// ryo_reaction.schema.json must match this definition.
export const RYO_REACTION_SCHEMA_FOR_LLM = JSON.stringify(
  {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "ryo_reaction_output_v1",
    title: "RyoReactionOutput",
    description: "神の介入に対するリョウの短文リアクション出力スキーマ",
    type: "object",
    required: ["expression", "line", "intensity", "tags", "state_change_request"],
    additionalProperties: false,
    properties: {
      expression: {
        type: "string",
        enum: ["normal", "joy", "sadness", "tense", "bless", "divine", "watch", "test"],
        description: "リョウの表情。8値のうちのひとつ",
      },
      line: {
        type: "string",
        minLength: 1,
        maxLength: 42,
        description: "台詞テキスト（42文字以内の日本語）",
      },
      intensity: {
        type: "number",
        minimum: 0.0,
        maximum: 1.0,
        description: "感情の強度（0.0〜1.0）",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "関連タグ（blessing, joy, despair など）",
      },
      state_change_request: {
        type: "null",
        description:
          "常に null。AI はゲーム状態（HP・信仰値・好感度など）を変更できない",
      },
    },
  },
  null,
  2,
);

const ALLOWED_OUTPUT_KEYS = new Set([
  "expression",
  "line",
  "intensity",
  "tags",
  "state_change_request",
]);

export function validateRyoReactionOutput(raw: unknown): RyoReactionValidationResult {
  const violations: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, violations: ["output is not an object"], fallbackLine: RYO_FALLBACK_LINE };
  }

  const obj = raw as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_OUTPUT_KEYS.has(key)) {
      violations.push(`additional property is not allowed: ${key}`);
    }
  }

  if (!RYO_EXPRESSIONS.has(String(obj.expression ?? ""))) {
    violations.push(`expression "${String(obj.expression)}" is not a valid RyoExpression`);
  }

  if (typeof obj.line !== "string" || obj.line.length === 0) {
    violations.push("line must be a non-empty string");
  } else if (obj.line.length > 42) {
    violations.push(`line exceeds 42 chars: ${obj.line.length}`);
  }

  if (
    typeof obj.intensity !== "number" ||
    !Number.isFinite(obj.intensity) ||
    obj.intensity < 0 ||
    obj.intensity > 1
  ) {
    violations.push("intensity must be a finite number in [0.0, 1.0]");
  }

  if (!Array.isArray(obj.tags)) {
    violations.push("tags must be an array");
  } else {
    for (const [index, tag] of (obj.tags as unknown[]).entries()) {
      if (typeof tag !== "string") {
        violations.push(`tags[${index}] must be a string`);
      }
    }
  }

  if (obj.state_change_request !== null) {
    violations.push(
      "state_change_request must be null — AI cannot request game state changes",
    );
  }

  if (violations.length > 0) {
    return { ok: false, violations, fallbackLine: RYO_FALLBACK_LINE };
  }

  return {
    ok: true,
    output: {
      expression: obj.expression as RyoExpression,
      line: obj.line as string,
      intensity: obj.intensity as number,
      tags: obj.tags as string[],
      state_change_request: null,
    },
  };
}
