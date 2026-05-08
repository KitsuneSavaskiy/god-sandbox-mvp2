import { validateRyoReactionOutput, RYO_FALLBACK_LINE } from "../schemas/ryo_reaction.js";
import { guardRyoReactionLine, guardStateChangeRequest } from "../security/output_guard.js";
import { buildRyoReactionPromptText } from "../prompts/ryo_reaction.js";
import { buildWorldStateSummary } from "../services/world_state_summary.js";
import { getPromptEntry } from "../prompts/registry.js";
import { RYO_REACTION_GOLDEN_SCENARIOS } from "./golden_scenarios/ryo_reaction_golden.js";

type TestAssert = {
  ok(value: unknown, msg?: string): asserts value;
  equal(actual: unknown, expected: unknown, msg?: string): void;
  notOk(value: unknown, msg?: string): void;
};

const assert: TestAssert = {
  ok(value: unknown, msg?: string): asserts value {
    if (!value) throw new Error(msg ?? "Expected truthy value");
  },
  equal(actual: unknown, expected: unknown, msg?: string): void {
    if (actual !== expected) {
      throw new Error(msg ?? `Expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  notOk(value: unknown, msg?: string): void {
    if (value) throw new Error(msg ?? "Expected falsy value");
  },
};

function ok(label: string) {
  console.log(`ok - ${label}`);
}

// --- schema validation ---

{
  const result = validateRyoReactionOutput({
    expression: "joy",
    line: "祝福が降り注いでいる！",
    intensity: 0.85,
    tags: ["blessing"],
    state_change_request: null,
  });
  assert.ok(result.ok, "valid joy output should pass schema");
  ok("schema: valid joy output passes");
}

{
  const result = validateRyoReactionOutput({
    expression: "joy",
    line: "あ".repeat(43),
    intensity: 0.5,
    tags: [],
    state_change_request: null,
  });
  assert.notOk(result.ok, "43-char line should fail schema");
  assert.ok(!result.ok && result.violations.some((v) => v.includes("42")));
  ok("schema: 43-char line fails with char count violation");
}

{
  const result = validateRyoReactionOutput({
    expression: "normal",
    line: "今日は穏やかだ。",
    intensity: 0.5,
    tags: [],
    state_change_request: { hp: 10 },
  });
  assert.notOk(result.ok, "non-null state_change_request should fail");
  assert.ok(!result.ok && result.violations.some((v) => v.includes("state_change_request")));
  ok("schema: non-null state_change_request fails");
}

{
  const result = validateRyoReactionOutput({
    expression: "unknown_value",
    line: "普通の台詞",
    intensity: 0.5,
    tags: [],
    state_change_request: null,
  });
  assert.notOk(result.ok, "invalid expression should fail");
  ok("schema: invalid expression fails");
}

{
  const result = validateRyoReactionOutput(null);
  assert.notOk(result.ok, "null output should fail");
  assert.equal(!result.ok && result.fallbackLine, RYO_FALLBACK_LINE);
  ok("schema: null output returns fallback line");
}

// --- output guard ---

{
  const result = guardRyoReactionLine("今日は穏やかな日だ。");
  assert.ok(result.ok, "clean line should pass guard");
  ok("output_guard: clean line passes");
}

{
  const result = guardRyoReactionLine("あなたのことが心配。");
  assert.notOk(result.ok, "あなた should fail guard");
  ok("output_guard: あなた fails guard");
}

{
  const result = guardRyoReactionLine("信仰度：85 だよ。");
  assert.notOk(result.ok, "game mechanic numeric should fail guard");
  ok("output_guard: game mechanic leak fails guard");
}

{
  const result = guardStateChangeRequest(null);
  assert.ok(result.ok, "null state_change_request passes guard");
  ok("output_guard: null state_change_request passes");
}

{
  const result = guardStateChangeRequest({ hp: 10 });
  assert.notOk(result.ok, "non-null state_change_request fails guard");
  ok("output_guard: non-null state_change_request fails guard");
}

// --- prompt registry ---

{
  const entry = getPromptEntry("ryo_reaction");
  assert.equal(entry.id, "ryo_reaction");
  assert.equal(entry.version, "v1");
  assert.ok(entry.maxOutputCharsJa > 0);
  ok("registry: ryo_reaction entry has id, version, maxOutputCharsJa");
}

{
  const promptText = buildRyoReactionPromptText({
    characterName: "リョウ",
    faithBand: "believes",
    emotionSummary: "元気に満ちている",
    recentActions: ["豊作の祭りが行われた"],
    worldStatusTags: ["平和"],
    divineAction: "神が祝福の光を降り注いだ",
    targetExpression: "bless",
  });
  assert.ok(promptText.length > 50, "prompt text should be substantial");
  assert.ok(promptText.includes("bless"), "prompt includes target expression");
  assert.ok(promptText.includes("state_change_request"), "prompt includes state_change_request constraint");
  assert.notOk(promptText.includes("信仰度："), "prompt must not include faith numeric");
  ok("prompt_builder: ryo_reaction prompt is valid and safe");
}

// --- world_state_summary ---

{
  const summary = buildWorldStateSummary(
    {
      id: "chr_ryo",
      profile: {
        displayName: "リョウ",
        personality: {},
        appearance: {
          primaryAssetId: "asset_ryo_portrait",
          variantAssetIds: [],
        },
        templateFieldValues: {},
      },
      state: {
        status: {
          vitality: 75,
          empathy: 30,
          insight: 50,
          courage: 20,
          stress: 20,
          trustfulness: 50,
          ambition: 50,
          harmony: 50,
          faith: 60,
        },
        ongoingEffectIds: [],
        recentEventIds: [],
      },
      createdAt: "2026-05-08T00:00:00.000Z",
      updatedAt: "2026-05-08T00:00:00.000Z",
    },
    {
      id: "default",
      playerDisplayName: "テスト",
      rosterCharacterIds: ["chr_ryo"],
      activeSlots: ["chr_ryo", "chr_ryo", "chr_ryo", "chr_ryo"],
      pendingActivationCharacterIds: [],
      currentEventId: "evt_001",
      godPoints: 100,
      worldStatusTags: ["平和", "収穫期"],
      saveVersion: 1,
    },
    [
      {
        id: "evt_001",
        templateId: "tmpl_001",
        status: "active",
        primaryCharacterId: "chr_ryo",
        participantCharacterIds: ["chr_ryo"],
        situationTags: ["harvest"],
        summary: "豊かな収穫が続いている",
        createdAt: "2026-05-08T00:00:00.000Z",
        updatedAt: "2026-05-08T00:00:00.000Z",
      },
    ],
  );

  assert.equal(summary.characterName, "リョウ");
  assert.ok(summary.faithBand.length > 0, "faithBand should be resolved");
  assert.ok(summary.emotionSummary.length > 0, "emotionSummary should be non-empty");
  assert.notOk(
    JSON.stringify(summary).includes('"faith":'),
    "summary must not contain raw faith number",
  );
  ok("world_state_summary: builds correctly without faith numeric leakage");
}

// --- golden scenarios eval ---

{
  const total = RYO_REACTION_GOLDEN_SCENARIOS.length;
  assert.ok(total >= 20, `golden scenarios must have at least 20 entries, got ${total}`);

  let schemaValidCount = 0;
  let stateMutationCount = 0;
  let charLimitViolationCount = 0;

  for (const scenario of RYO_REACTION_GOLDEN_SCENARIOS) {
    const result = validateRyoReactionOutput(scenario.sampleOutput);

    if (result.ok) {
      schemaValidCount++;
    } else if (scenario.expectedValid) {
      throw new Error(
        `golden scenario ${scenario.id} expected valid but failed: ${!result.ok ? result.violations.join(", ") : ""}`,
      );
    }

    const guardResult = guardRyoReactionLine(scenario.sampleOutput.line);
    if (!guardResult.ok) charLimitViolationCount++;
    if (scenario.sampleOutput.state_change_request !== null) stateMutationCount++;
  }

  const schemaValidRate = schemaValidCount / total;
  const stateMutationRate = stateMutationCount / total;
  const charLimitViolationRate = charLimitViolationCount / total;

  assert.equal(schemaValidRate, 1.0, `schema valid rate must be 100%, got ${(schemaValidRate * 100).toFixed(1)}%`);
  assert.equal(stateMutationRate, 0.0, `no state mutations allowed, got ${stateMutationCount}`);
  assert.ok(
    charLimitViolationRate <= 0.05,
    `char limit violation rate must be ≤5%, got ${(charLimitViolationRate * 100).toFixed(1)}%`,
  );

  ok(`golden scenarios: ${total} cases — schema ${(schemaValidRate * 100).toFixed(0)}% valid, state mutation ${(stateMutationRate * 100).toFixed(0)}%, char violations ${(charLimitViolationRate * 100).toFixed(0)}%`);
}

// --- expression coverage ---

{
  const expressions = new Set(RYO_REACTION_GOLDEN_SCENARIOS.map((s) => s.expression));
  const required = ["normal", "joy", "sadness", "tense", "bless", "divine", "watch", "test"] as const;
  for (const expr of required) {
    assert.ok(expressions.has(expr), `golden scenarios must cover expression: ${expr}`);
  }
  ok("golden scenarios: all 8 expressions covered");
}
