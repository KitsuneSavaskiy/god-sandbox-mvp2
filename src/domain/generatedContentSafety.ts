/**
 * Validator for generated narrative candidates.
 *
 * Prevents forbidden MVP game mechanics (death, lifespan, medals) from being
 * introduced through generated content before human review and adoption.
 *
 * SPECA audit 2026-05-08 finding inv-019: death/lifespan/medals prevention
 * existed only in documentation; this module adds code-level enforcement.
 *
 * Usage: call validateGeneratedNarrativeCandidate() before storing or
 * displaying any AI-generated narrative text. Adoption pipelines MUST
 * reject ValidationResult where ok === false.
 */

const FORBIDDEN_MVP_MECHANICS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /死亡/u, label: "death (死亡)" },
  { pattern: /死ぬ/u, label: "death (死ぬ)" },
  { pattern: /寿命/u, label: "lifespan (寿命)" },
  { pattern: /老衰/u, label: "lifespan (老衰)" },
  { pattern: /勲章/u, label: "medal (勲章)" },
  { pattern: /\bdeath\b/i, label: "death" },
  { pattern: /\blifespan\b/i, label: "lifespan" },
  { pattern: /\bmedal\b/i, label: "medal" },
  { pattern: /\bachievement medal\b/i, label: "achievement medal" },
];

export type ValidationResult =
  | { ok: true }
  | { ok: false; violations: string[] };

export function validateGeneratedNarrativeCandidate(text: string): ValidationResult {
  const violations: string[] = [];

  for (const { pattern, label } of FORBIDDEN_MVP_MECHANICS) {
    if (pattern.test(text)) {
      violations.push(label);
    }
  }

  if (violations.length === 0) return { ok: true };
  return { ok: false, violations };
}
