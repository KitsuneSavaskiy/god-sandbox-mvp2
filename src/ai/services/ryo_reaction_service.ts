import { getPromptEntry } from "../prompts/registry.js";
import type { PromptVersion } from "../prompts/registry.js";
import { buildRyoReactionPromptText } from "../prompts/ryo_reaction.js";
import type { RyoExpression } from "../schemas/ryo_reaction.js";
import {
  validateRyoReactionOutput,
  RYO_FALLBACK_LINE,
} from "../schemas/ryo_reaction.js";
import { guardRyoReactionLine, guardStateChangeRequest } from "../security/output_guard.js";
import type { WorldStateSummary } from "./world_state_summary.js";
import { appendTrace, buildTraceId } from "../observability/trace_logger.js";

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

export type RyoReactionSession = {
  traceId: string;
  worldStateHash: string;
  promptVersion: PromptVersion;
};

function hashWorldStateSummary(worldState: WorldStateSummary): string {
  const raw = JSON.stringify({
    characterName: worldState.characterName,
    faithBand: worldState.faithBand,
    fearBand: worldState.fearBand,
    trustBand: worldState.trustBand,
    emotionSummary: worldState.emotionSummary,
    recentActions: worldState.recentActions,
    worldStatusTags: [...worldState.worldStatusTags].sort(),
    currentEventSummary: worldState.currentEventSummary,
  });
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function createRyoReactionSession(worldState: WorldStateSummary): RyoReactionSession {
  const entry = getPromptEntry("ryo_reaction");
  return {
    traceId: buildTraceId("ryo_reaction", new Date().toISOString()),
    worldStateHash: hashWorldStateSummary(worldState),
    promptVersion: entry.version,
  };
}

export function parseAndTraceRyoReactionOutput(
  rawJson: string,
  session: RyoReactionSession,
  divineAction: string,
): RyoReactionOutputResult {
  const traceBase = {
    traceId: session.traceId,
    feature: "ryo_reaction",
    promptId: "ryo_reaction" as const,
    promptVersion: session.promptVersion,
    divineAction,
    worldStateHash: session.worldStateHash,
    createdAt: new Date().toISOString(),
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    appendTrace({ ...traceBase, expression: "unknown", schemaValid: false, outputGuardPassed: false });
    return { ok: false, violations: ["output is not valid JSON"], fallbackLine: RYO_FALLBACK_LINE };
  }

  const schemaResult = validateRyoReactionOutput(parsed);
  if (!schemaResult.ok) {
    appendTrace({ ...traceBase, expression: "unknown", schemaValid: false, outputGuardPassed: false });
    return { ok: false, violations: schemaResult.violations, fallbackLine: schemaResult.fallbackLine };
  }

  const lineGuard = guardRyoReactionLine(schemaResult.output.line);
  const stateGuard = guardStateChangeRequest(schemaResult.output.state_change_request);
  const outputGuardPassed = lineGuard.ok && stateGuard.ok;

  appendTrace({
    ...traceBase,
    expression: schemaResult.output.expression,
    schemaValid: true,
    outputGuardPassed,
  });

  if (!outputGuardPassed) {
    return {
      ok: false,
      violations: [
        ...(!lineGuard.ok ? lineGuard.violations : []),
        ...(!stateGuard.ok ? stateGuard.violations : []),
      ],
      fallbackLine: RYO_FALLBACK_LINE,
    };
  }

  return {
    ok: true,
    line: schemaResult.output.line,
    expression: schemaResult.output.expression,
    tags: schemaResult.output.tags,
  };
}

// Pure parser. Does not append observability traces.
// Runtime/UI callers should prefer parseAndTraceRyoReactionOutput().
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

  const schemaResult = validateRyoReactionOutput(parsed);
  if (!schemaResult.ok) {
    return { ok: false, violations: schemaResult.violations, fallbackLine: schemaResult.fallbackLine };
  }

  const lineGuard = guardRyoReactionLine(schemaResult.output.line);
  const stateGuard = guardStateChangeRequest(schemaResult.output.state_change_request);

  const violations = [
    ...(!lineGuard.ok ? lineGuard.violations : []),
    ...(!stateGuard.ok ? stateGuard.violations : []),
  ];

  if (violations.length > 0) {
    return { ok: false, violations, fallbackLine: RYO_FALLBACK_LINE };
  }

  return {
    ok: true,
    line: schemaResult.output.line,
    expression: schemaResult.output.expression,
    tags: schemaResult.output.tags,
  };
}
