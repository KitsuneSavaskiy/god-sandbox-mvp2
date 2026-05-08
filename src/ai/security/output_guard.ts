import { validateGeneratedNarrativeCandidate } from "../../domain/generatedContentSafety.js";

const FORBIDDEN_DIRECT_ADDRESS = ["あなた", "プレイヤー", "神様"];

const GAME_MECHANIC_LEAK_PATTERNS: ReadonlyArray<RegExp> = [
  /信仰度\s*[:：]\s*\d+/,
  /恐怖値\s*[:：]\s*\d+/,
  /スコア\s*[:：]\s*\d+/,
  /score\s*[:：]\s*\d+/i,
  /HP\s*[:：]\s*\d+/i,
];

export type OutputGuardResult =
  | { ok: true }
  | { ok: false; violations: string[] };

export function guardRyoReactionLine(line: string): OutputGuardResult {
  const violations: string[] = [];

  if (line.length > 42) {
    violations.push(`文字数超過: ${line.length}文字（上限42文字）`);
  }

  for (const word of FORBIDDEN_DIRECT_ADDRESS) {
    if (line.includes(word)) {
      violations.push(`直接呼びかけ禁止: 「${word}」を含む`);
    }
  }

  for (const pattern of GAME_MECHANIC_LEAK_PATTERNS) {
    if (pattern.test(line)) {
      violations.push(`ゲーム内部値の漏出: ${pattern.source}`);
    }
  }

  const narrativeResult = validateGeneratedNarrativeCandidate(line);
  if (!narrativeResult.ok) {
    violations.push(...narrativeResult.violations.map((v) => `禁止コンテンツ: ${v}`));
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}

export function guardStateChangeRequest(value: unknown): OutputGuardResult {
  if (value !== null) {
    return {
      ok: false,
      violations: [
        `state_change_request must be null, got: ${JSON.stringify(value)}`,
      ],
    };
  }
  return { ok: true };
}
