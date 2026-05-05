import {
  getGrowthCycleProgress,
  recoverGodPointsByElapsedMinutes,
  type GrowthCycleProgress,
} from "../domain/growthBalance.js";
import type { RuntimeWorldState } from "../state/runtimeState.js";
import { createRuntimeWorldState } from "../state/runtimeState.js";

export function selectGrowthCycleProgress(state: RuntimeWorldState): GrowthCycleProgress {
  const completedEventCount = [...state.events.values()].filter(
    (event) => event.status === "resolved",
  ).length;

  return getGrowthCycleProgress(completedEventCount);
}

export function recoverRuntimeGodPointsByElapsedMinutes(
  state: RuntimeWorldState,
  elapsedMinutes: number,
): RuntimeWorldState {
  return createRuntimeWorldState({
    ...state,
    session: recoverGodPointsByElapsedMinutes(state.session, elapsedMinutes),
  });
}
