import {
  getGrowthCycleProgress,
  recoverGodPointsByElapsedMinutes,
  recoverGodPointsByPhaseTicks,
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

export type RecoverGodPointsCommand = {
  elapsedPhaseTicks: number;
  now: string;
};

export function recoverRuntimeGodPointsByPhaseTicks(
  state: RuntimeWorldState,
  command: RecoverGodPointsCommand,
): { state: RuntimeWorldState; recoveredAmount: number } {
  const before = state.session.godPoints;
  const updatedSession = recoverGodPointsByPhaseTicks(state.session, command.elapsedPhaseTicks);
  return {
    state: createRuntimeWorldState({ ...state, session: updatedSession }),
    recoveredAmount: updatedSession.godPoints - before,
  };
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
