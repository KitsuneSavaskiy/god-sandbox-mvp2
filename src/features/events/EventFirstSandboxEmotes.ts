import type { PersonalityVector } from "../../domain/models.js";
import {
  buildAmbientResidentEmoteWeights,
  getNextAmbientEmoteResidentIndex,
  selectWeightedAmbientResidentEmote,
  type AmbientResidentEmote as WeightedAmbientResidentEmote,
} from "./ambientResidentEmotes.js";
import type { SandboxExperienceStage } from "../tutorial/tutorialStateMachine.js";

export type EmoteKind =
  | "joy"
  | "anger"
  | "sadness"
  | "surprise"
  | "talk-request"
  | "event-alert"
  | null;

export type ResidentMotionKey =
  | "idle"
  | "failed"
  | "waving"
  | "jumping"
  | "waiting"
  | "review"
  | "walk-up"
  | "walk-down"
  | "walk-left"
  | "walk-right"
  | "walk-forward"
  | "walk-back"
  | "emote-happy"
  | "emote-angry"
  | "emote-sad"
  | "emote-surprised";

export type ResidentMovementDirection =
  | "left"
  | "right"
  | "up"
  | "down"
  | "forward"
  | "back"
  | null;

export type InterventionOutcomeLike = {
  interventionType: "watch" | "help" | "trial";
};

export type AmbientResidentEmote = {
  residentIndex: number;
  emote: NonNullable<Extract<EmoteKind, "joy" | "anger" | "sadness" | "surprise">>;
};

export function resolveResidentEmote(input: {
  sandboxStage: SandboxExperienceStage;
  isPrimary: boolean;
  isSupporting: boolean;
  latestOutcome: InterventionOutcomeLike | null;
}): EmoteKind {
  if (input.sandboxStage === "focused-event") {
    if (input.isPrimary) {
      return "event-alert";
    }
    return "talk-request";
  }

  if (!input.latestOutcome) {
    return null;
  }

  if (input.latestOutcome.interventionType === "help") {
    return input.isPrimary ? "joy" : input.isSupporting ? "surprise" : "joy";
  }

  if (input.latestOutcome.interventionType === "trial") {
    return input.isPrimary ? "anger" : input.isSupporting ? "surprise" : "sadness";
  }

  return input.isPrimary ? "talk-request" : input.isSupporting ? "surprise" : "surprise";
}

export function resolveDisplayedResidentEmote(
  baseEmote: EmoteKind,
  residentIndex: number,
  ambientEmote: AmbientResidentEmote | null,
): EmoteKind {
  if (baseEmote !== null) {
    return baseEmote;
  }
  if (!ambientEmote || ambientEmote.residentIndex !== residentIndex) {
    return null;
  }
  return ambientEmote.emote;
}

export function resolveVisibleResidentEmote(input: {
  emote: EmoteKind;
  dialogueBubbleVisible: boolean;
}): EmoteKind {
  if (input.dialogueBubbleVisible && input.emote === "talk-request") {
    return null;
  }

  return input.emote;
}

export function createNextAmbientResidentEmote(
  previousResidentIndex: number,
  residentCount: number,
  randomValue: number,
  personality: PersonalityVector,
): AmbientResidentEmote | null {
  const residentIndex = getNextAmbientEmoteResidentIndex(
    Number.isInteger(previousResidentIndex) ? previousResidentIndex : null,
    residentCount,
  );

  if (residentIndex === null) {
    return null;
  }

  return {
    residentIndex,
    emote: mapAmbientResidentEmote(
      selectWeightedAmbientResidentEmote(
        buildAmbientResidentEmoteWeights(personality),
        randomValue,
      ),
    ),
  };
}

export function resolveResidentMotion(
  emote: EmoteKind,
  isPaused: boolean,
  movementDirection: ResidentMovementDirection,
): ResidentMotionKey {
  const emoteMotion = emoteKindToMotion(emote);
  if (emoteMotion !== null && !isPaused) {
    return emoteMotion;
  }

  if (isPaused) {
    return "idle";
  }

  return directionToMotion(movementDirection);
}

export function isResidentMovementBlockingEmote(emote: EmoteKind): boolean {
  return (
    emote === "joy" ||
    emote === "anger" ||
    emote === "sadness" ||
    emote === "surprise"
  );
}

function emoteKindToMotion(emote: EmoteKind): ResidentMotionKey | null {
  switch (emote) {
    case null:
      return null;
    case "joy":
      return "emote-happy";
    case "anger":
      return "emote-angry";
    case "sadness":
      return "emote-sad";
    case "surprise":
      return "emote-surprised";
    case "talk-request":
    case "event-alert":
      return null;
  }
}

function directionToMotion(dir: ResidentMovementDirection): ResidentMotionKey {
  switch (dir) {
    case "left":
      return "walk-left";
    case "right":
      return "walk-right";
    case "up":
      return "walk-up";
    case "down":
      return "walk-down";
    case "forward":
      return "walk-forward";
    case "back":
      return "walk-back";
    default:
      return "idle";
  }
}

function mapAmbientResidentEmote(
  emote: WeightedAmbientResidentEmote,
): AmbientResidentEmote["emote"] {
  switch (emote) {
    case "happy":
      return "joy";
    case "angry":
      return "anger";
    case "sad":
      return "sadness";
    case "surprised":
      return "surprise";
  }
}
