import type { CharacterId, SandboxSession } from "./models.js";

export const ACTIVE_SLOT_COUNT = 4;

export function assertSandboxSessionInvariants(session: SandboxSession): void {
  if (session.activeSlots.length !== ACTIVE_SLOT_COUNT) {
    throw new Error("SandboxSession.activeSlots must contain exactly 4 character ids.");
  }

  if (!session.currentEventId) {
    throw new Error("SandboxSession.currentEventId must point to one current event.");
  }

  const roster = new Set(session.rosterCharacterIds);
  const activeSlotIds = new Set(session.activeSlots);

  if (activeSlotIds.size !== ACTIVE_SLOT_COUNT) {
    throw new Error("SandboxSession.activeSlots must contain 4 unique character ids.");
  }

  for (const characterId of session.activeSlots) {
    if (!roster.has(characterId)) {
      throw new Error(`activeSlots contains a character outside roster: ${characterId}`);
    }
  }

  for (const characterId of session.pendingActivationCharacterIds) {
    if (!roster.has(characterId)) {
      throw new Error(`pendingActivationCharacterIds contains a character outside roster: ${characterId}`);
    }
  }

  if (!Number.isInteger(session.saveVersion) || session.saveVersion < 1) {
    throw new Error("SandboxSession.saveVersion must be a positive integer.");
  }

  if (!Number.isFinite(session.godPoints) || session.godPoints < 0) {
    throw new Error("SandboxSession.godPoints must be a non-negative number.");
  }
}

function createSandboxSession(input: SandboxSession): SandboxSession {
  assertSandboxSessionInvariants(input);
  return structuredClone(input) as SandboxSession;
}

export function addCharacterToRoster(
  session: SandboxSession,
  characterId: CharacterId,
): SandboxSession {
  const rosterCharacterIds = session.rosterCharacterIds.includes(characterId)
    ? session.rosterCharacterIds
    : [...session.rosterCharacterIds, characterId];

  const alreadyActive = session.activeSlots.includes(characterId);
  const pendingActivationCharacterIds =
    alreadyActive || session.pendingActivationCharacterIds.includes(characterId)
      ? session.pendingActivationCharacterIds
      : [...session.pendingActivationCharacterIds, characterId];

  const next = {
    ...session,
    rosterCharacterIds,
    pendingActivationCharacterIds,
  };

  assertSandboxSessionInvariants(next);
  return next;
}

export function replaceActiveSlot(
  session: SandboxSession,
  slotIndex: number,
  characterId: CharacterId,
): SandboxSession {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= ACTIVE_SLOT_COUNT) {
    throw new Error("slotIndex must point to one of the 4 active slots.");
  }

  if (!session.rosterCharacterIds.includes(characterId)) {
    throw new Error(`Cannot activate character outside roster: ${characterId}`);
  }

  if (session.activeSlots.includes(characterId) && session.activeSlots[slotIndex] !== characterId) {
    throw new Error(`Cannot duplicate active character in activeSlots: ${characterId}`);
  }

  const activeSlots = [...session.activeSlots] as SandboxSession["activeSlots"];
  activeSlots[slotIndex] = characterId;

  const next: SandboxSession = {
    ...session,
    activeSlots,
    pendingActivationCharacterIds: session.pendingActivationCharacterIds.filter(
      (pendingId) => pendingId !== characterId,
    ),
  };

  assertSandboxSessionInvariants(next);
  return next;
}
