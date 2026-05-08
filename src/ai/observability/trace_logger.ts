import type { PromptId, PromptVersion } from "../prompts/registry.js";

export type PromptTrace = {
  traceId: string;
  feature: string;
  promptId: PromptId;
  promptVersion: PromptVersion;
  model?: string;
  divineAction: string;
  expression: string;
  worldStateHash: string;
  latencyMs?: number;
  costEstimate?: number;
  schemaValid: boolean;
  outputGuardPassed: boolean;
  acceptedByPlayer?: boolean;
  createdAt: string;
};

const _traces: PromptTrace[] = [];

export function appendTrace(trace: PromptTrace): void {
  _traces.push(trace);
}

export function getTraces(): readonly PromptTrace[] {
  return _traces;
}

export function clearTraces(): void {
  _traces.length = 0;
}

export function buildTraceId(
  feature: string,
  now: string,
  seed = Math.random().toString(36).slice(2, 8),
): string {
  return `gs_trace_${feature}_${Date.parse(now).toString(36)}_${seed}`;
}

export function hashWorldState(tags: string[], eventSummary: string): string {
  const raw = [...tags].sort().join("|") + ":" + eventSummary;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
