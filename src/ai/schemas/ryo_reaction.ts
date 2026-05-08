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

export function validateRyoReactionOutput(raw: unknown): RyoReactionValidationResult {
  const violations: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, violations: ["output is not an object"], fallbackLine: RYO_FALLBACK_LINE };
  }

  const obj = raw as Record<string, unknown>;

  if (!RYO_EXPRESSIONS.has(String(obj.expression ?? ""))) {
    violations.push(`expression "${String(obj.expression)}" is not a valid RyoExpression`);
  }

  if (typeof obj.line !== "string" || obj.line.length === 0) {
    violations.push("line must be a non-empty string");
  } else if (obj.line.length > 42) {
    violations.push(`line exceeds 42 chars: ${obj.line.length}`);
  }

  if (typeof obj.intensity !== "number" || obj.intensity < 0 || obj.intensity > 1) {
    violations.push("intensity must be a number in [0.0, 1.0]");
  }

  if (!Array.isArray(obj.tags)) {
    violations.push("tags must be an array");
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
