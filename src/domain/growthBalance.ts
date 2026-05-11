import type { InterventionKind, SandboxSession } from "./models.js";

export const GROWTH_CYCLE_TARGET_MINUTES = 30;
export const GROWTH_CYCLE_TARGET_EVENT_COUNT = 10;
export const MAX_GOD_POINTS = 6;

export const GOD_POINT_RECOVERY_PHASES_PER_POINT = 2;
export const GOD_POINT_RECOVERY_AMOUNT_PER_TICK = 1;
export const SANDBOX_DAY_PHASES_PER_SEASON = 4;
export const GOD_POINT_RECOVERY_PER_SEASON = 2;
export const SANDBOX_PHASE_MINUTES = 0.75; // 1 phase = 45s
export const GOD_POINT_RECOVERY_INTERVAL_MINUTES =
  SANDBOX_PHASE_MINUTES * GOD_POINT_RECOVERY_PHASES_PER_POINT; // 1.5 min per +1
export const GOD_POINT_RECOVERY_AMOUNT = GOD_POINT_RECOVERY_AMOUNT_PER_TICK; // 1

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

export function recoverGodPointsByPhaseTicks(
  session: SandboxSession,
  elapsedPhaseTicks: number,
): SandboxSession {
  if (elapsedPhaseTicks <= 0) return session;
  const recoveryTicks = Math.floor(elapsedPhaseTicks / GOD_POINT_RECOVERY_PHASES_PER_POINT);
  return {
    ...session,
    godPoints: Math.min(MAX_GOD_POINTS, session.godPoints + recoveryTicks * GOD_POINT_RECOVERY_AMOUNT_PER_TICK),
  };
}

export function recoverGodPointsByElapsedMinutes(
  session: SandboxSession,
  elapsedMinutes: number,
): SandboxSession {
  const elapsedPhaseTicks = Math.floor(Math.max(0, elapsedMinutes) / SANDBOX_PHASE_MINUTES);
  return recoverGodPointsByPhaseTicks(session, elapsedPhaseTicks);
}
