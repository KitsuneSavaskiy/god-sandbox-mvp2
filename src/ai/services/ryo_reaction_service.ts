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
import {
  appendTrace,
  buildTraceId,
  hashWorldState,
} from "../observability/trace_logger.js";

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
  return {
    promptId: entry.id,
    promptVersion: entry.version,
    promptText: buildRyoReactionPromptText({
      characterName: input.worldState.characterName,
      faithBand: input.worldState.faithBand,
      fearBand: input.worldState.fearBand,
      trustBand: input.worldState.trustBand,
      emotionSummary: input.worldState.emotionSummary,
      recentActions: input.worldState.recentActions,
      worldStatusTags: input.worldState.worldStatusTags,
      divineAction: input.divineAction,
      targetExpression: input.targetExpression,
    }),
  };
}

export type RyoReactionSession = {
  traceId: string;
  worldStateHash: string;
  promptVersion: PromptVersion;
};

export function createRyoReactionSession(worldState: WorldStateSummary): RyoReactionSession {
  const entry = getPromptEntry("ryo_reaction");
  return {
    traceId: buildTraceId("ryo_reaction", new Date().toISOString()),
    worldStateHash: hashWorldState(worldState.worldStatusTags, worldState.currentEventSummary),
    promptVersion: entry.version,
  };
}

export function parseAndTraceRyoReactionOutput(
  rawJson: string,
  session: RyoReactionSession,
  divineAction: string,
): RyoReactionOutputResult {
  const result = parseRyoReactionOutput(rawJson);
  appendTrace({
    traceId: session.traceId,
    feature: "ryo_reaction",
    promptId: "ryo_reaction",
    promptVersion: session.promptVersion,
    divineAction,
    expression: result.ok ? result.expression : "unknown",
    worldStateHash: session.worldStateHash,
    schemaValid: result.ok,
    outputGuardPassed: result.ok,
    createdAt: new Date().toISOString(),
  });
  return result;
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
