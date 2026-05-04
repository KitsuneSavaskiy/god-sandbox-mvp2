import type {
  Character,
  CharacterId,
  WorldEvent,
} from "../domain/models.js";
import type { RuntimeWorldState } from "../state/runtimeState.js";

export type ObservationPresetResolution = {
  presetId: "default-observation";
  focusedEventId: string;
  activeCharacterIds: readonly CharacterId[];
  worldStatusTags: readonly string[];
  eventSituationTags: readonly string[];
  summary: string;
};

export function selectCurrentEvent(state: RuntimeWorldState): WorldEvent {
  const event = state.events.get(state.session.currentEventId);
  if (!event) {
    throw new Error("Current event record is missing.");
  }

  return event;
}

export function selectActiveCharacters(state: RuntimeWorldState): Character[] {
  return state.session.activeSlots.map((characterId) => {
    const character = state.characters.get(characterId);
    if (!character) {
      throw new Error(`Active character record is missing: ${characterId}`);
    }

    return character;
  });
}

export function selectObservationPreset(
  state: RuntimeWorldState,
): ObservationPresetResolution {
  const focusedEvent = selectCurrentEvent(state);

  return {
    presetId: "default-observation",
    focusedEventId: focusedEvent.id,
    activeCharacterIds: [...state.session.activeSlots],
    worldStatusTags: [...state.session.worldStatusTags],
    eventSituationTags: [...focusedEvent.situationTags],
    summary: focusedEvent.summary,
  };
}

export function selectRoster(state: RuntimeWorldState): Character[] {
  return state.session.rosterCharacterIds.map((characterId) => {
    const character = state.characters.get(characterId);
    if (!character) {
      throw new Error(`Roster character record is missing: ${characterId}`);
    }

    return character;
  });
}

export function selectPendingActivationCharacters(
  state: RuntimeWorldState,
): Character[] {
  return state.session.pendingActivationCharacterIds.map((characterId) => {
    const character = state.characters.get(characterId);
    if (!character) {
      throw new Error(`Pending activation character record is missing: ${characterId}`);
    }

    return character;
  });
}
