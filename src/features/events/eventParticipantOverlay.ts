import type { Character, CharacterId, WorldEvent } from "../../domain/models.js";

export type EventParticipantOverlaySlot =
  | "left-front"
  | "right-front"
  | "left-back"
  | "right-back";

export type EventParticipantOverlayViewModel = {
  characterId: CharacterId;
  displayName: string;
  role: "primary" | "supporting";
  slot: EventParticipantOverlaySlot;
  src: string;
  alt: string;
};

const SLOT_ORDER: readonly EventParticipantOverlaySlot[] = [
  "left-front",
  "right-front",
  "left-back",
  "right-back",
];

const SLOT_ORDER_BY_COUNT: Record<1 | 2 | 3 | 4, readonly EventParticipantOverlaySlot[]> = {
  1: ["left-front"],
  2: ["left-front", "right-front"],
  3: ["left-front", "right-front", "left-back"],
  4: ["left-front", "right-front", "left-back", "right-back"],
};

export function createEventParticipantOverlayViewModels(input: {
  event: WorldEvent;
  characters: Map<CharacterId, Character>;
}): EventParticipantOverlayViewModel[] {
  const { event, characters } = input;

  // primary first, then supporters in participantCharacterIds order
  const orderedIds: CharacterId[] = [event.primaryCharacterId];
  for (const id of event.participantCharacterIds) {
    if (id !== event.primaryCharacterId && !orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }

  // resolve characters, skip missing, cap at 4
  const resolved: Array<{ character: Character; role: "primary" | "supporting" }> = [];
  for (const id of orderedIds) {
    if (resolved.length >= 4) break;
    const character = characters.get(id);
    if (!character) continue;
    resolved.push({
      character,
      role: id === event.primaryCharacterId ? "primary" : "supporting",
    });
  }

  if (resolved.length === 0) return [];

  const count = resolved.length as 1 | 2 | 3 | 4;
  const slots = SLOT_ORDER_BY_COUNT[count] ?? SLOT_ORDER;

  return resolved.map(({ character, role }, index) => {
    const slug = resolveDefaultCharacterSlug(character);
    return {
      characterId: character.id,
      displayName: character.profile.displayName,
      role,
      slot: slots[index] ?? "left-front",
      src: `/art/characters/defaults/${slug}/overlays/event-participant/neutral-body.png`,
      alt: `${character.profile.displayName}の立ち絵`,
    };
  });
}

function resolveDefaultCharacterSlug(character: Character): string {
  if (character.id.startsWith("chr_")) {
    return character.id.slice(4);
  }
  return character.profile.speechStyleId ?? character.profile.displayName.toLowerCase();
}
