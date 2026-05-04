import { replaceActiveSlot } from "../domain/session.js";
import type { RuntimeWorldState } from "../state/runtimeState.js";
import { createRuntimeWorldState } from "../state/runtimeState.js";
import type { ApplyInterventionCommand } from "./runtimeService.js";
import {
  applyInterventionService,
  issuePassportService,
  issueSnapshotService,
  type IssuePassportCommand,
  type IssueSnapshotCommand,
} from "./runtimeService.js";

export type ReplaceActiveSlotCommand = {
  slotIndex: number;
  characterId: string;
};

export function replaceActiveSlotCommand(
  state: RuntimeWorldState,
  command: ReplaceActiveSlotCommand,
): RuntimeWorldState {
  return createRuntimeWorldState({
    ...state,
    session: replaceActiveSlot(
      state.session,
      command.slotIndex,
      command.characterId,
    ),
  });
}

export function applyFocusedEventInterventionCommand(
  state: RuntimeWorldState,
  command: ApplyInterventionCommand,
): ReturnType<typeof applyInterventionService> {
  return applyInterventionService(state, command);
}

export function issueCharacterSnapshotCommand(
  state: RuntimeWorldState,
  command: IssueSnapshotCommand,
): ReturnType<typeof issueSnapshotService> {
  return issueSnapshotService(state, command);
}

export function issueCharacterPassportCommand(
  state: RuntimeWorldState,
  command: IssuePassportCommand,
): ReturnType<typeof issuePassportService> {
  return issuePassportService(state, command);
}
