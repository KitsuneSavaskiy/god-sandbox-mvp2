import { generateWorldEvent } from "../domain/events.js";
import { applyIntervention } from "../domain/interventions.js";
import type {
  CharacterPassport,
  CharacterSnapshot,
  InterventionKind,
  WorldEvent,
} from "../domain/models.js";
import {
  issueCharacterPassport,
  issueCharacterSnapshot,
} from "../domain/snapshots.js";
import type { RuntimeWorldState } from "../state/runtimeState.js";
import { createRuntimeWorldState } from "../state/runtimeState.js";

export type GenerateCurrentEventCommand = {
  now: string;
  seed: string;
};

export type ApplyInterventionCommand = {
  type: InterventionKind;
  now: string;
  idSeed: string;
  playerReason?: string;
  playerMemo?: string;
};

export type IssueSnapshotCommand = {
  characterId: string;
  snapshotId: string;
  now: string;
  sourceEventId?: string;
  annotationTags?: string[];
  memo?: string;
};

export type IssuePassportCommand = {
  snapshotId: string;
  passportId: string;
  fileNameToken: string;
  schemaVersion: number;
  now: string;
};

export function generateCurrentEventService(
  state: RuntimeWorldState,
  command: GenerateCurrentEventCommand,
): { state: RuntimeWorldState; event: WorldEvent } {
  const event = generateWorldEvent({
    session: state.session,
    characters: state.characters,
    relations: [...state.relations.values()],
    now: command.now,
    seed: command.seed,
  });

  const events = new Map(state.events);
  events.set(event.id, event);

  return {
    event,
    state: createRuntimeWorldState({
      ...state,
      session: {
        ...state.session,
        currentEventId: event.id,
        lastAutosavedAt: command.now,
      },
      events,
    }),
  };
}

export function applyInterventionService(
  state: RuntimeWorldState,
  command: ApplyInterventionCommand,
): {
  state: RuntimeWorldState;
  nextEvent: WorldEvent;
} {
  const currentEvent = state.events.get(state.session.currentEventId);
  if (!currentEvent) {
    throw new Error("Current event record is missing.");
  }

  const targetCharacters = currentEvent.participantCharacterIds.map((characterId) => {
    const character = state.characters.get(characterId);
    if (!character) {
      throw new Error(`Participant character record is missing: ${characterId}`);
    }

    return character;
  });

  const applied = applyIntervention({
    session: state.session,
    event: currentEvent,
    targetCharacters,
    type: command.type,
    now: command.now,
    idSeed: command.idSeed,
    playerReason: command.playerReason,
    playerMemo: command.playerMemo,
  });

  const resolvedEvent: WorldEvent = {
    ...currentEvent,
    status: "resolved",
    updatedAt: command.now,
  };

  const characters = new Map(state.characters);
  for (const character of applied.characters) {
    characters.set(character.id, character);
  }

  const events = new Map(state.events);
  events.set(resolvedEvent.id, resolvedEvent);

  const interventions = new Map(state.interventions);
  interventions.set(applied.intervention.id, applied.intervention);

  const changeSets = new Map(state.changeSets);
  for (const changeSet of applied.changeSets) {
    changeSets.set(changeSet.id, changeSet);
  }

  const intermediateState = createRuntimeWorldState({
    ...state,
    session: applied.session,
    characters,
    events,
    interventions,
    changeSets,
  });

  const generated = generateCurrentEventService(intermediateState, {
    now: command.now,
    seed: `${command.idSeed}:next-event`,
  });

  return {
    state: generated.state,
    nextEvent: generated.event,
  };
}

export function issueSnapshotService(
  state: RuntimeWorldState,
  command: IssueSnapshotCommand,
): { state: RuntimeWorldState; snapshot: CharacterSnapshot } {
  const character = state.characters.get(command.characterId);
  if (!character) {
    throw new Error(`Character not found for snapshot: ${command.characterId}`);
  }

  const relevantRelations = [...state.relations.values()].filter(
    (relation) =>
      relation.characterAId === command.characterId ||
      relation.characterBId === command.characterId,
  );

  const recentEvents = [...state.events.values()]
    .filter((event) => character.state.recentEventIds.includes(event.id))
    .slice(0, 12);

  const snapshot = issueCharacterSnapshot({
    id: command.snapshotId,
    character,
    relations: relevantRelations,
    recentEvents,
    sourceWorldId: state.worldId,
    sourceSessionId: state.session.id,
    sourceEventId: command.sourceEventId,
    worldContextRefs: state.worldContextRefs,
    now: command.now,
    annotationTags: command.annotationTags,
    memo: command.memo,
  });

  const snapshots = new Map(state.snapshots);
  snapshots.set(snapshot.id, snapshot);

  return {
    snapshot,
    state: createRuntimeWorldState({
      ...state,
      snapshots,
    }),
  };
}

export function issuePassportService(
  state: RuntimeWorldState,
  command: IssuePassportCommand,
): { state: RuntimeWorldState; passport: CharacterPassport } {
  const snapshot = state.snapshots.get(command.snapshotId);
  if (!snapshot) {
    throw new Error(`Snapshot not found for passport: ${command.snapshotId}`);
  }

  const passport = issueCharacterPassport({
    id: command.passportId,
    snapshot,
    schemaVersion: command.schemaVersion,
    fileNameToken: command.fileNameToken,
    now: command.now,
  });

  const passports = new Map(state.passports);
  passports.set(passport.id, passport);

  return {
    passport,
    state: createRuntimeWorldState({
      ...state,
      passports,
    }),
  };
}
