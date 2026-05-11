import { applyStatusDelta, clampStatus, cloneCharacter } from "./character.js";
import { BALANCED_INTERVENTION_COSTS } from "./growthBalance.js";
import type {
  ChangeSet,
  Character,
  FaithChangeRecord,
  FaithChangeTrigger,
  InterventionKind,
  InterventionRecord,
  SandboxSession,
  WorldEvent,
} from "./models.js";

export const DEFAULT_INTERVENTION_COSTS: Record<InterventionKind, number> = {
  ...BALANCED_INTERVENTION_COSTS,
};

const STATUS_DELTA_BY_INTERVENTION: Record<InterventionKind, Record<string, number>> = {
  watch: {
    insight: 1,
  },
  help: {
    vitality: 2,
    stress: -1,
    harmony: 1,
  },
  trial: {
    courage: 2,
    stress: 1,
    ambition: 1,
  },
};

const FAITH_TRIGGER_BY_INTERVENTION: Record<InterventionKind, FaithChangeTrigger> = {
  watch: "watch_success",
  help: "help_success",
  trial: "trial_success",
};

const FAITH_DELTA_BY_TRIGGER: Record<FaithChangeTrigger, number> = {
  watch_success: 2,
  watch_failure: -1,
  help_success: 4,
  help_failure: -2,
  trial_success: 5,
  trial_failure: -4,
  player_memo_bonus: 1,
  player_memo_penalty: -1,
};

export type PlayerMemoGroup = "watch" | "help" | "trial";

export type ApplyInterventionInput = {
  session: SandboxSession;
  event: WorldEvent;
  targetCharacters: Character[];
  type: InterventionKind;
  now: string;
  idSeed: string;
  playerReason?: string;
  playerMemo?: string;
  currentMemoGroup?: PlayerMemoGroup | null;
  previousMemoGroup?: PlayerMemoGroup | null;
  costs?: Record<InterventionKind, number>;
  faithTriggerOverride?: FaithChangeTrigger;
};

export type ApplyInterventionResult = {
  session: SandboxSession;
  characters: Character[];
  intervention: InterventionRecord;
  changeSets: ChangeSet[];
};

export function applyIntervention(input: ApplyInterventionInput): ApplyInterventionResult {
  if (input.session.currentEventId !== input.event.id) {
    throw new Error("Intervention can only be applied to the current event.");
  }

  if (input.targetCharacters.length === 0) {
    throw new Error("Intervention requires at least one target character.");
  }

  const targetCharacterIds = new Set(input.targetCharacters.map((character) => character.id));
  if (targetCharacterIds.size !== input.targetCharacters.length) {
    throw new Error("Intervention target characters must be unique.");
  }

  for (const participantCharacterId of input.event.participantCharacterIds) {
    if (!targetCharacterIds.has(participantCharacterId)) {
      throw new Error(`Intervention must include event participant: ${participantCharacterId}`);
    }
  }

  for (const targetCharacter of input.targetCharacters) {
    if (!input.event.participantCharacterIds.includes(targetCharacter.id)) {
      throw new Error(`Target character must participate in the event: ${targetCharacter.id}`);
    }
  }

  const costs = input.costs ?? DEFAULT_INTERVENTION_COSTS;
  const resourceCost = costs[input.type];
  const godPointsBeforeApply = input.session.godPoints;

  if (resourceCost > godPointsBeforeApply) {
    throw new Error(`Not enough god points for ${input.type}.`);
  }

  const delta = STATUS_DELTA_BY_INTERVENTION[input.type];
  const faithTrigger = input.faithTriggerOverride ?? FAITH_TRIGGER_BY_INTERVENTION[input.type];
  const interventionId = `itv_${input.idSeed}`;
  const godPointsAfterApply = godPointsBeforeApply - resourceCost;
  const currentMemoGroup =
    input.currentMemoGroup ?? resolvePlayerMemoGroup(input.playerMemo ?? input.playerReason);
  const previousMemoGroup = input.previousMemoGroup ?? null;

  const applied = input.targetCharacters.map((targetCharacter) => {
    const updatedCharacter = cloneCharacter(targetCharacter);
    const faithChange = createFaithChangeRecord({
      character: targetCharacter,
      trigger: faithTrigger,
      interventionId,
      currentMemoGroup,
      previousMemoGroup,
    });
    updatedCharacter.state = {
      ...updatedCharacter.state,
      status: {
        ...applyStatusDelta(updatedCharacter.state.status, delta),
        faith: faithChange.newFaith,
      },
      recentEventIds: uniqueRecentEventIds([
        input.event.id,
        ...updatedCharacter.state.recentEventIds,
      ]),
    };
    updatedCharacter.updatedAt = input.now;
    return {
      character: updatedCharacter,
      faithChange,
    };
  });
  const appliedCharacters = applied.map((entry) => entry.character);

  const changeSets: ChangeSet[] = applied.map(({ character: updatedCharacter, faithChange }, index) => ({
    id: `chg_${input.idSeed}_${String(index + 1).padStart(2, "0")}`,
    eventId: input.event.id,
    interventionId,
    targetCharacterId: updatedCharacter.id,
    kind: "status-delta",
    patch: {
      ...delta,
      faith: faithChange.delta,
      faithChange,
    },
    postApplySnapshot: {
      status: updatedCharacter.state.status,
    },
    originDescription: `${input.type} intervention applied to ${updatedCharacter.profile.displayName}.`,
    createdAt: input.now,
  }));

  const intervention: InterventionRecord = {
    id: interventionId,
    eventId: input.event.id,
    type: input.type,
    resourceCost,
    godPointsBeforeApply,
    godPointsAfterApply,
    playerReason: input.playerReason,
    playerMemo: input.playerMemo,
    changeSetIds: changeSets.map((changeSet) => changeSet.id),
    createdAt: input.now,
  };

  return {
    session: {
      ...input.session,
      godPoints: godPointsAfterApply,
    },
    characters: appliedCharacters,
    intervention,
    changeSets,
  };
}

export function applyFaithChange(currentFaith: number, trigger: FaithChangeTrigger): number {
  return clampStatus(currentFaith + FAITH_DELTA_BY_TRIGGER[trigger]);
}

export function applyFaithChangeWithPersonality(
  character: Character,
  trigger: FaithChangeTrigger,
  currentMemoGroup?: PlayerMemoGroup | null,
  previousMemoGroup?: PlayerMemoGroup | null,
): number {
  let delta = FAITH_DELTA_BY_TRIGGER[trigger];

  if (trigger === "watch_success" && (character.profile.personality.sensitivity ?? 0) >= 70) {
    delta *= 1.5;
  }

  if (trigger === "trial_failure" && (character.profile.personality.boldness ?? 0) >= 70) {
    delta *= 0.5;
  }

  if (trigger === "help_failure" && (character.profile.personality.curiosity ?? 0) >= 70) {
    delta *= 0.7;
  }

  if (trigger === "trial_success" && (character.profile.personality.discipline ?? 0) >= 70) {
    delta *= 1.5;
  }

  delta = Math.trunc(delta);

  if (isInterventionFaithTrigger(trigger) && currentMemoGroup && previousMemoGroup) {
    delta += currentMemoGroup === previousMemoGroup ? 1 : -1;
  }

  return clampStatus(character.state.status.faith + delta);
}

function isInterventionFaithTrigger(trigger: FaithChangeTrigger): boolean {
  return trigger !== "player_memo_bonus" && trigger !== "player_memo_penalty";
}

export function resolvePlayerMemoGroup(memo?: string | null): PlayerMemoGroup | null {
  if (!memo) {
    return null;
  }

  if (/(見守|信頼|応援|そばにいる|待つ)/u.test(memo)) {
    return "watch";
  }

  if (/(助け|救|支え|守る|一緒に)/u.test(memo)) {
    return "help";
  }

  if (/(試練|乗り越え|成長|強く|鍛える)/u.test(memo)) {
    return "trial";
  }

  return null;
}

function createFaithChangeRecord(input: {
  character: Character;
  trigger: FaithChangeTrigger;
  interventionId: string;
  currentMemoGroup?: PlayerMemoGroup | null;
  previousMemoGroup?: PlayerMemoGroup | null;
}): FaithChangeRecord {
  const previousFaith = input.character.state.status.faith;
  const newFaith = applyFaithChangeWithPersonality(
    input.character,
    input.trigger,
    input.currentMemoGroup,
    input.previousMemoGroup,
  );

  return {
    characterId: input.character.id,
    previousFaith,
    newFaith,
    delta: newFaith - previousFaith,
    trigger: input.trigger,
    interventionId: input.interventionId,
  };
}

function uniqueRecentEventIds(eventIds: string[]): string[] {
  return [...new Set(eventIds)].slice(0, 12);
}
