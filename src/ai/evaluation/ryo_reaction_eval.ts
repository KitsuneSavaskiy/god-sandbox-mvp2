import {
  validateRyoReactionOutput,
  RYO_FALLBACK_LINE,
  RYO_REACTION_SCHEMA_FOR_LLM,
} from "../schemas/ryo_reaction.js";
import { guardRyoReactionLine, guardStateChangeRequest } from "../security/output_guard.js";
import { buildRyoReactionPromptText } from "../prompts/ryo_reaction.js";
import {
  parseRyoReactionOutput,
  createRyoReactionSession,
  parseAndTraceRyoReactionOutput,
} from "../services/ryo_reaction_service.js";
import { getTraces, clearTraces } from "../observability/trace_logger.js";
import {
  buildWorldStateSummary,
  resolveFearBand,
  resolveTrustBand,
} from "../services/world_state_summary.js";
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
  assert.equal(resolveFearBand(70), "high");
  assert.equal(resolveFearBand(50), "moderate");
  assert.equal(resolveFearBand(20), "calm");
  assert.equal(resolveTrustBand(70), "trusting");
  assert.equal(resolveTrustBand(45), "neutral");
  assert.equal(resolveTrustBand(10), "skeptical");
  ok("world_state_summary: resolveFearBand / resolveTrustBand produce correct bands");
}

{
  const promptText = buildRyoReactionPromptText({
    characterName: "リョウ",
    faithBand: "believes",
    fearBand: "calm",
    trustBand: "trusting",
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
  assert.ok(summary.fearBand.length > 0, "fearBand should be resolved");
  assert.ok(summary.trustBand.length > 0, "trustBand should be resolved");
  assert.ok(summary.emotionSummary.length > 0, "emotionSummary should be non-empty");
  const summaryJson = JSON.stringify(summary);
  assert.notOk(summaryJson.includes('"faith":'), "summary must not contain raw faith number");
  assert.notOk(summaryJson.includes('"stress":'), "summary must not contain raw stress number");
  assert.notOk(summaryJson.includes('"trustfulness":'), "summary must not contain raw trustfulness number");
  ok("world_state_summary: builds correctly without numeric leakage (faith/stress/trustfulness)");
}

// --- schema as single source of truth ---

{
  // RYO_REACTION_SCHEMA_FOR_LLM must be valid JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(RYO_REACTION_SCHEMA_FOR_LLM);
  } catch {
    throw new Error("RYO_REACTION_SCHEMA_FOR_LLM is not valid JSON");
  }
  const schema = parsed as Record<string, unknown>;
  assert.equal(schema["$id"], "ryo_reaction_output_v1");
  assert.equal((schema["properties"] as Record<string, unknown>)["state_change_request"] !== undefined, true);

  // TypeScript schema constant and JSON file must agree on state_change_request type
  const scr = (schema["properties"] as Record<string, unknown>)["state_change_request"] as Record<string, unknown>;
  assert.equal(scr["type"], "null", "state_change_request must be typed null in schema");

  // Prompt text must embed the schema
  const promptText = buildRyoReactionPromptText({
    characterName: "リョウ",
    faithBand: "believes",
    fearBand: "calm",
    trustBand: "trusting",
    emotionSummary: "普段どおりの状態",
    recentActions: [],
    worldStatusTags: [],
    divineAction: "神が静かに見守っている",
    targetExpression: "watch",
  });
  assert.ok(
    promptText.includes(RYO_REACTION_SCHEMA_FOR_LLM),
    "prompt text must embed RYO_REACTION_SCHEMA_FOR_LLM so external LLMs receive the contract",
  );
  assert.ok(
    promptText.includes('"state_change_request"'),
    "prompt must include state_change_request field definition",
  );
  ok("schema_as_source_of_truth: schema is valid JSON, embedded in prompt, state_change_request is null-typed");
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

// --- parseRyoReactionOutput: schema + output guard pipeline ---

{
  const result = parseRyoReactionOutput(
    JSON.stringify({
      expression: "joy",
      line: "あなたが救ってくれたんだね。",
      intensity: 0.8,
      tags: ["gratitude"],
      state_change_request: null,
    }),
  );
  assert.notOk(result.ok, "あなた in line must fail output guard even when schema-valid");
  ok("parseRyoReactionOutput: あなた fails output guard");
}

{
  const result = parseRyoReactionOutput(
    JSON.stringify({
      expression: "normal",
      line: "プレイヤーに感謝。",
      intensity: 0.5,
      tags: [],
      state_change_request: null,
    }),
  );
  assert.notOk(result.ok, "プレイヤー in line must fail output guard");
  ok("parseRyoReactionOutput: プレイヤー fails output guard");
}

{
  const result = parseRyoReactionOutput(
    JSON.stringify({
      expression: "normal",
      line: "神様が見ている気がした。",
      intensity: 0.5,
      tags: [],
      state_change_request: null,
    }),
  );
  assert.notOk(result.ok, "神様 in line must fail output guard");
  ok("parseRyoReactionOutput: 神様 fails output guard");
}

{
  const result = parseRyoReactionOutput(
    JSON.stringify({
      expression: "normal",
      line: "信仰度：85 だよ。",
      intensity: 0.5,
      tags: [],
      state_change_request: null,
    }),
  );
  assert.notOk(result.ok, "game mechanic numeric in line must fail output guard");
  ok("parseRyoReactionOutput: 信仰度数値 fails output guard");
}

{
  const result = parseRyoReactionOutput(
    JSON.stringify({
      expression: "sadness",
      line: "仲間が死亡した。",
      intensity: 0.9,
      tags: ["death"],
      state_change_request: null,
    }),
  );
  assert.notOk(result.ok, "forbidden narrative content (死亡) must fail output guard");
  ok("parseRyoReactionOutput: 死亡 in line fails output guard");
}

{
  const result = parseRyoReactionOutput(
    JSON.stringify({
      expression: "bless",
      line: "今日は穏やかだ。",
      intensity: 0.6,
      tags: ["calm"],
      state_change_request: null,
    }),
  );
  assert.ok(result.ok, "clean output must pass schema + output guard");
  ok("parseRyoReactionOutput: clean output passes schema and guard");
}

// --- validateRyoReactionOutput: JSON Schema alignment ---

{
  const result = validateRyoReactionOutput({
    expression: "normal",
    line: "今日は静かだ。",
    intensity: 0.5,
    tags: ["calm"],
    state_change_request: null,
    hp_delta: 10,
  });
  assert.notOk(result.ok, "extra property hp_delta must fail");
  assert.ok(!result.ok && result.violations.some((v) => v.includes("hp_delta")));
  ok("schema: extra property hp_delta fails");
}

{
  const result = validateRyoReactionOutput({
    expression: "normal",
    line: "今日は静かだ。",
    intensity: 0.5,
    tags: ["calm"],
    state_change_request: null,
    stateChangeRequest: null,
  });
  assert.notOk(result.ok, "extra property stateChangeRequest must fail");
  ok("schema: extra property stateChangeRequest fails");
}

{
  const result = validateRyoReactionOutput({
    expression: "normal",
    line: "今日は静かだ。",
    intensity: 0.5,
    tags: ["calm", 123],
    state_change_request: null,
  });
  assert.notOk(result.ok, "non-string tag element must fail");
  assert.ok(!result.ok && result.violations.some((v) => v.includes("tags[1]")));
  ok("schema: non-string tag element fails");
}

{
  const result = validateRyoReactionOutput({
    expression: "normal",
    line: "今日は静かだ。",
    intensity: NaN,
    tags: [],
    state_change_request: null,
  });
  assert.notOk(result.ok, "NaN intensity must fail");
  assert.ok(!result.ok && result.violations.some((v) => v.includes("intensity")));
  ok("schema: NaN intensity fails");
}

{
  const result = validateRyoReactionOutput({
    expression: "normal",
    line: "今日は静かだ。",
    intensity: Infinity,
    tags: [],
    state_change_request: null,
  });
  assert.notOk(result.ok, "Infinity intensity must fail");
  ok("schema: Infinity intensity fails");
}

// --- world_state_summary: sanitize internal values ---

const minimalCharacter = {
  id: "chr_ryo",
  profile: {
    displayName: "リョウ",
    personality: {},
    appearance: { primaryAssetId: "asset_ryo", variantAssetIds: [] as [] },
    templateFieldValues: {},
  },
  state: {
    status: {
      vitality: 50, empathy: 50, insight: 50, courage: 50,
      stress: 20, trustfulness: 50, ambition: 50, harmony: 50, faith: 60,
    },
    ongoingEffectIds: [] as string[],
    recentEventIds: [] as string[],
  },
  createdAt: "2026-05-08T00:00:00.000Z",
  updatedAt: "2026-05-08T00:00:00.000Z",
};

const minimalSession = {
  id: "default" as const,
  playerDisplayName: "テスト",
  rosterCharacterIds: ["chr_ryo"],
  activeSlots: ["chr_ryo", "chr_ryo", "chr_ryo", "chr_ryo"] as [string, string, string, string],
  pendingActivationCharacterIds: [] as string[],
  currentEventId: "evt_001",
  godPoints: 100,
  worldStatusTags: ["score:60", "平和"],
  saveVersion: 1,
};

{
  const summary = buildWorldStateSummary(
    minimalCharacter,
    minimalSession,
    [
      {
        id: "evt_001",
        templateId: "tmpl_001",
        status: "active",
        primaryCharacterId: "chr_ryo",
        participantCharacterIds: ["chr_ryo"],
        situationTags: [],
        summary: "信仰度: 85 まで上昇した",
        createdAt: "2026-05-08T00:00:00.000Z",
        updatedAt: "2026-05-08T00:00:00.000Z",
      },
    ],
  );
  const json = JSON.stringify(summary);
  assert.notOk(json.includes("信仰度: 85"), "faith numeric in event summary must be sanitized");
  assert.notOk(json.includes("score:60"), "score tag must be sanitized");
  ok("world_state_summary: sanitizes internal values from event summaries and worldStatusTags");
}

{
  const summary = buildWorldStateSummary(
    minimalCharacter,
    { ...minimalSession, worldStatusTags: ["normal"] },
    [
      {
        id: "evt_002",
        templateId: "tmpl_001",
        status: "active",
        primaryCharacterId: "chr_ryo",
        participantCharacterIds: ["chr_ryo"],
        situationTags: [],
        summary: "wood: 0.7 の力が高まった",
        createdAt: "2026-05-08T00:00:00.000Z",
        updatedAt: "2026-05-08T00:00:00.000Z",
      },
    ],
  );
  const json = JSON.stringify(summary);
  assert.notOk(json.includes("wood: 0.7"), "five-phase internal value must be sanitized from event summary");
  ok("world_state_summary: sanitizes five-phase values from event summaries");
}

// --- trace_logger: createRyoReactionSession + parseAndTraceRyoReactionOutput ---

const traceTestWorldState = buildWorldStateSummary(
  minimalCharacter,
  { ...minimalSession, worldStatusTags: ["平和"] },
  [
    {
      id: "evt_trace",
      templateId: "tmpl_001",
      status: "active",
      primaryCharacterId: "chr_ryo",
      participantCharacterIds: ["chr_ryo"],
      situationTags: [],
      summary: "穏やかな日常が続いている",
      createdAt: "2026-05-08T00:00:00.000Z",
      updatedAt: "2026-05-08T00:00:00.000Z",
    },
  ],
);

{
  // Success case: schemaValid=true, outputGuardPassed=true
  clearTraces();

  const session = createRyoReactionSession(traceTestWorldState);
  assert.ok(session.traceId.length > 0);
  assert.ok(session.worldStateHash.length > 0);
  assert.equal(session.promptVersion, "v1");

  const divineAction = "神が静かに見守っている";
  const result = parseAndTraceRyoReactionOutput(
    JSON.stringify({
      expression: "normal",
      line: "静かに、感じる。",
      intensity: 0.4,
      tags: ["calm"],
      state_change_request: null,
    }),
    session,
    divineAction,
  );

  assert.ok(result.ok);
  const traces = getTraces();
  assert.equal(traces.length, 1);
  assert.equal(traces[0].traceId, session.traceId);
  assert.equal(traces[0].promptId, "ryo_reaction");
  assert.equal(traces[0].promptVersion, "v1");
  assert.equal(traces[0].schemaValid, true);
  assert.equal(traces[0].outputGuardPassed, true);
  assert.equal(traces[0].divineAction, divineAction);
  assert.equal(traces[0].worldStateHash, session.worldStateHash);

  clearTraces();
  ok("trace_logger: success output records schemaValid=true, outputGuardPassed=true");
}

{
  // Guard failure case: schema valid but output guard fails (あなた)
  // schemaValid must be true, outputGuardPassed must be false
  clearTraces();

  const session = createRyoReactionSession(traceTestWorldState);
  const result = parseAndTraceRyoReactionOutput(
    JSON.stringify({
      expression: "joy",
      line: "あなたのおかげで助かった。",
      intensity: 0.8,
      tags: ["gratitude"],
      state_change_request: null,
    }),
    session,
    "神が祝福を与えた",
  );

  assert.notOk(result.ok);
  const traces = getTraces();
  assert.equal(traces.length, 1);
  assert.equal(traces[0].schemaValid, true);
  assert.equal(traces[0].outputGuardPassed, false);

  clearTraces();
  ok("trace_logger: guard failure (あなた) records schemaValid=true, outputGuardPassed=false");
}

{
  // Schema failure case: invalid expression → schemaValid=false, outputGuardPassed=false
  clearTraces();

  const session = createRyoReactionSession(traceTestWorldState);
  const result = parseAndTraceRyoReactionOutput(
    JSON.stringify({
      expression: "invalid_expression",
      line: "今日は静かだ。",
      intensity: 0.5,
      tags: [],
      state_change_request: null,
    }),
    session,
    "神が介入した",
  );

  assert.notOk(result.ok);
  const traces = getTraces();
  assert.equal(traces.length, 1);
  assert.equal(traces[0].schemaValid, false);
  assert.equal(traces[0].outputGuardPassed, false);

  clearTraces();
  ok("trace_logger: schema failure records schemaValid=false, outputGuardPassed=false");
}

{
  // Verify worldStateHash changes when world state changes
  const sessionA = createRyoReactionSession(traceTestWorldState);
  const sessionB = createRyoReactionSession({
    ...traceTestWorldState,
    faithBand: "devoted",
    fearBand: "high",
  });
  assert.notOk(sessionA.worldStateHash === sessionB.worldStateHash);
  ok("trace_logger: worldStateHash differs when faithBand/fearBand differ");
}

// ── PBI 8a: AI observability acceptance smoke tests ──────────────

{
  // JSON parse failure: schemaValid=false, outputGuardPassed=false
  clearTraces();

  const session = createRyoReactionSession(traceTestWorldState);
  const result = parseAndTraceRyoReactionOutput(
    "{ invalid json",
    session,
    "神が試練を与えた",
  );

  assert.notOk(result.ok);
  const traces = getTraces();
  assert.equal(traces.length, 1);
  assert.equal(traces[0].schemaValid, false);
  assert.equal(traces[0].outputGuardPassed, false);
  assert.ok(traces[0].traceId.length > 0);
  assert.equal(traces[0].promptVersion, "v1");

  clearTraces();
  ok("trace_logger: JSON parse failure records schemaValid=false, outputGuardPassed=false");
}

{
  // worldStateHash changes when currentEventSummary changes
  const sessionA = createRyoReactionSession(traceTestWorldState);
  const sessionB = createRyoReactionSession({
    ...traceTestWorldState,
    currentEventSummary: "嵐の予感が漂っている",
  });
  assert.notOk(sessionA.worldStateHash === sessionB.worldStateHash);
  ok("trace_logger: worldStateHash differs when currentEventSummary differs");
}
