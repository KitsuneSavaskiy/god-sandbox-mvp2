import type { InterventionKind, SandboxSession } from "./models.js";

export const GROWTH_CYCLE_TARGET_MINUTES = 30;
export const GROWTH_CYCLE_TARGET_EVENT_COUNT = 10;
export const GOD_POINT_RECOVERY_INTERVAL_MINUTES = 3;
export const GOD_POINT_RECOVERY_AMOUNT = 1;
export const MAX_GOD_POINTS = 6;

export const BALANCED_INTERVENTION_COSTS: Record<InterventionKind, number> = {
  watch: 0,
  help: 2,
  trial: 3,
};

export type GrowthCycleProgress = {
  targetMinutes: typeof GROWTH_CYCLE_TARGET_MINUTES;
  targetEventCount: typeof GROWTH_CYCLE_TARGET_EVENT_COUNT;
  completedEventCount: number;
  remainingEventCount: number;
  isCycleComplete: boolean;
};

export function getGrowthCycleProgress(completedEventCount: number): GrowthCycleProgress {
  const normalizedCompletedEventCount = Math.max(0, Math.floor(completedEventCount));

  return {
    targetMinutes: GROWTH_CYCLE_TARGET_MINUTES,
    targetEventCount: GROWTH_CYCLE_TARGET_EVENT_COUNT,
    completedEventCount: normalizedCompletedEventCount,
    remainingEventCount: Math.max(
      0,
      GROWTH_CYCLE_TARGET_EVENT_COUNT - normalizedCompletedEventCount,
    ),
    isCycleComplete: normalizedCompletedEventCount >= GROWTH_CYCLE_TARGET_EVENT_COUNT,
  };
}

export function recoverGodPointsByElapsedMinutes(
  session: SandboxSession,
  elapsedMinutes: number,
): SandboxSession {
  const recoveryTicks = Math.floor(
    Math.max(0, elapsedMinutes) / GOD_POINT_RECOVERY_INTERVAL_MINUTES,
  );
  const recoveredGodPoints = recoveryTicks * GOD_POINT_RECOVERY_AMOUNT;

  return {
    ...session,
    godPoints: Math.min(MAX_GOD_POINTS, session.godPoints + recoveredGodPoints),
  };
}
