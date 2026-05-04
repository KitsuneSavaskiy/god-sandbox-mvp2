export type SandboxExperienceStage = "focused-event" | "result";

export type TutorialFlowId = "intro-event-first" | "newcomer-slot";

export type TutorialStepId =
  | "observe-world"
  | "inspect-event"
  | "intervene"
  | "read-result"
  | "newcomer-roster";

export interface TutorialState {
  activeFlowId: TutorialFlowId | null;
  currentStepId: TutorialStepId | null;
  introCompleted: boolean;
  newcomerCompleted: boolean;
}

export interface TutorialContext {
  routePath: string;
  stage?: SandboxExperienceStage;
  eventWindowOpen?: boolean;
}

export interface TutorialBinding {
  anchorId: string;
  routePath: string;
  requiredStage?: SandboxExperienceStage;
}

type TutorialStorageLike = Pick<Storage, "getItem" | "setItem">;

const INTRO_KEY = "godsandbox.tutorial.event-first.v1";
const NEWCOMER_KEY = "godsandbox.tutorial.newcomer.v1";

const bindings: Record<TutorialStepId, TutorialBinding> = {
  "observe-world": {
    anchorId: "tutorial-anchor-world",
    routePath: "/sandbox",
    requiredStage: "focused-event",
  },
  "inspect-event": {
    anchorId: "tutorial-anchor-event",
    routePath: "/sandbox",
    requiredStage: "focused-event",
  },
  intervene: {
    anchorId: "tutorial-anchor-event-entry",
    routePath: "/sandbox",
    requiredStage: "focused-event",
  },
  "read-result": {
    anchorId: "tutorial-anchor-result",
    routePath: "/sandbox",
    requiredStage: "result",
  },
  "newcomer-roster": {
    anchorId: "tutorial-anchor-newcomer",
    routePath: "/character-editor/new",
  },
};

function getStorage(storageLike?: TutorialStorageLike): TutorialStorageLike | null {
  if (storageLike) {
    return storageLike;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readTutorialState(storageLike?: TutorialStorageLike): TutorialState {
  const storage = getStorage(storageLike);
  return {
    activeFlowId: null,
    currentStepId: null,
    introCompleted: storage?.getItem(INTRO_KEY) === "done",
    newcomerCompleted: storage?.getItem(NEWCOMER_KEY) === "done",
  };
}

export function ensureTutorialForContext(
  currentState: TutorialState,
  context: TutorialContext,
): TutorialState {
  if (currentState.activeFlowId && currentState.currentStepId) {
    return currentState;
  }

  if (!currentState.introCompleted && context.routePath === "/sandbox") {
    return {
      ...currentState,
      activeFlowId: "intro-event-first",
      currentStepId: "observe-world",
    };
  }

  if (!currentState.newcomerCompleted && context.routePath === "/character-editor/new") {
    return {
      ...currentState,
      activeFlowId: "newcomer-slot",
      currentStepId: "newcomer-roster",
    };
  }

  return currentState;
}

export function getTutorialBinding(
  state: TutorialState,
  context: TutorialContext,
): TutorialBinding | null {
  if (!state.currentStepId) {
    return null;
  }

  const binding = bindings[state.currentStepId];
  if (binding.routePath !== context.routePath) {
    return null;
  }

  if (binding.requiredStage && binding.requiredStage !== context.stage) {
    return null;
  }

  if (state.currentStepId === "intervene" && context.eventWindowOpen) {
    return {
      ...binding,
      anchorId: "tutorial-anchor-event-interventions",
    };
  }

  return binding;
}

export function advanceTutorialStep(
  currentState: TutorialState,
  action:
    | "continue"
    | "intervened"
    | "result-reviewed"
    | "newcomer-acknowledged",
): TutorialState {
  if (!currentState.currentStepId) {
    return currentState;
  }

  if (currentState.currentStepId === "observe-world" && action === "continue") {
    return {
      ...currentState,
      currentStepId: "inspect-event",
    };
  }

  if (currentState.currentStepId === "inspect-event" && action === "continue") {
    return {
      ...currentState,
      currentStepId: "intervene",
    };
  }

  if (currentState.currentStepId === "intervene" && action === "intervened") {
    return {
      ...currentState,
      currentStepId: "read-result",
    };
  }

  if (currentState.currentStepId === "read-result" && action === "result-reviewed") {
    return {
      ...currentState,
      activeFlowId: null,
      currentStepId: null,
      introCompleted: true,
    };
  }

  if (
    currentState.currentStepId === "newcomer-roster" &&
    action === "newcomer-acknowledged"
  ) {
    return {
      ...currentState,
      activeFlowId: null,
      currentStepId: null,
      newcomerCompleted: true,
    };
  }

  return currentState;
}

export function persistTutorialState(
  state: TutorialState,
  storageLike?: TutorialStorageLike,
): void {
  const storage = getStorage(storageLike);
  if (!storage) {
    return;
  }

  if (state.introCompleted) {
    storage.setItem(INTRO_KEY, "done");
  }

  if (state.newcomerCompleted) {
    storage.setItem(NEWCOMER_KEY, "done");
  }
}
