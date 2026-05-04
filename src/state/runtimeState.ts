import type {
  ChangeSet,
  Character,
  CharacterPassport,
  CharacterRelation,
  CharacterSnapshot,
  InterventionRecord,
  SandboxSession,
  WorldEvent,
} from "../domain/models.js";
import { assertSandboxSessionInvariants } from "../domain/session.js";

export type RuntimeWorldState = {
  worldId: string;
  worldContextRefs: string[];
  session: SandboxSession;
  characters: Map<string, Character>;
  relations: Map<string, CharacterRelation>;
  events: Map<string, WorldEvent>;
  interventions: Map<string, InterventionRecord>;
  changeSets: Map<string, ChangeSet>;
  snapshots: Map<string, CharacterSnapshot>;
  passports: Map<string, CharacterPassport>;
};

export function createRuntimeWorldState(input: RuntimeWorldState): RuntimeWorldState {
  assertSandboxSessionInvariants(input.session);

  if (!input.events.has(input.session.currentEventId)) {
    throw new Error("RuntimeWorldState must contain the current event record.");
  }

  return {
    worldId: input.worldId,
    worldContextRefs: [...input.worldContextRefs],
    session: structuredClone(input.session) as SandboxSession,
    characters: new Map(input.characters),
    relations: new Map(input.relations),
    events: new Map(input.events),
    interventions: new Map(input.interventions),
    changeSets: new Map(input.changeSets),
    snapshots: new Map(input.snapshots),
    passports: new Map(input.passports),
  };
}
