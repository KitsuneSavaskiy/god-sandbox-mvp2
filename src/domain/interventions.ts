import { applyStatusDelta, cloneCharacter } from "./character.js";
import { BALANCED_INTERVENTION_COSTS } from "./growthBalance.js";
import type {
  ChangeSet,
  Character,
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

export type ApplyInterventionInput = {
  session: SandboxSession;
  event: WorldEvent;
  targetCharacters: Character[];
  type: InterventionKind;
  now: string;
  idSeed: string;
  playerReason?: string;
  playerMemo?: string;
  costs?: Record<InterventionKind, number>;
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
  const interventionId = `itv_${input.idSeed}`;
  const godPointsAfterApply = godPointsBeforeApply - resourceCost;

  const appliedCharacters = input.targetCharacters.map((targetCharacter) => {
    const updatedCharacter = cloneCharacter(targetCharacter);
    updatedCharacter.state = {
      ...updatedCharacter.state,
      status: applyStatusDelta(updatedCharacter.state.status, delta),
      recentEventIds: uniqueRecentEventIds([
        input.event.id,
        ...updatedCharacter.state.recentEventIds,
      ]),
    };
    updatedCharacter.updatedAt = input.now;
    return updatedCharacter;
  });

  const changeSets: ChangeSet[] = appliedCharacters.map((updatedCharacter, index) => ({
    id: `chg_${input.idSeed}_${String(index + 1).padStart(2, "0")}`,
    eventId: input.event.id,
    interventionId,
    targetCharacterId: updatedCharacter.id,
    kind: "status-delta",
    patch: { ...delta },
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

function uniqueRecentEventIds(eventIds: string[]): string[] {
  return [...new Set(eventIds)].slice(0, 12);
}
