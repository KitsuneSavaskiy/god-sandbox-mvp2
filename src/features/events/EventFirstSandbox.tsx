import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import {
  isCharacterAnimationReady,
  selectActiveCharacterAssetBundleReadModels,
} from "../../application/characterAssetBundles.js";
import { applyFocusedEventInterventionCommand } from "../../application/runtimeCommands.js";
import {
  grantRuntimeGodPoints,
  recoverRuntimeGodPointsByPhaseTicks,
} from "../../application/growthBalanceService.js";
import {
  BALANCED_INTERVENTION_COSTS,
  GOD_POINT_RECOVERY_PHASES_PER_POINT,
  MAX_GOD_POINTS,
} from "../../domain/growthBalance.js";
import {
  selectActiveCharacters,
  selectCurrentEvent,
  selectObservationPreset,
} from "../../application/runtimeSelectors.js";
import {
  createObservedDialogueCandidates,
  selectVisibleObservedDialogueCandidates,
} from "../../domain/dialogue.js";
import type {
  CharacterId,
  DialogueTrigger,
  InterventionKind,
  WorldEvent,
} from "../../domain/models.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import { Button } from "../../ui/Button.js";
import type { StoryLogEntry } from "../story/StoryLogPanel.js";
import { TutorialOverlay } from "../tutorial/TutorialOverlay.js";
import {
  advanceTutorialStep,
  ensureTutorialForContext,
  getTutorialBinding,
  persistTutorialState,
  readTutorialState,
  type SandboxExperienceStage,
  type TutorialState,
} from "../tutorial/tutorialStateMachine.js";
import { MusicGardenPanel } from "../music-garden/MusicGardenPanel.js";
import { MusicGardenVisualizer } from "../music-garden/MusicGardenVisualizer.js";
import { parseMidi } from "../music-garden/musicGardenMidi.js";
import {
  activateNotes,
  createInitialMusicGardenState,
  resetPlayback as musicResetPlayback,
  resetSession as musicResetSession,
  tickElapsed,
  type MusicGardenState,
} from "../music-garden/musicGardenModel.js";
import { MusicGardenAudio } from "../music-garden/musicGardenAudio.js";
import {
  handleNoteClick as musicHandleNoteClick,
  handleNoteExpiry as rewardHandleNoteExpiry,
  streakReward,
} from "../music-garden/musicGardenReward.js";
import { resolveEventArt } from "./eventArt.js";
import { createEventParticipantOverlayViewModels } from "./eventParticipantOverlay.js";
import { createVisibleChangePatchForSandboxUi } from "./interventionOutcomeViewModel.js";
import {
  createNextAmbientResidentEmote,
  isResidentMovementBlockingEmote,
  resolveDisplayedResidentEmote,
  resolveResidentEmote,
  resolveResidentMotion,
  resolveVisibleResidentEmote,
  type AmbientResidentEmote,
  type EmoteKind,
  type ResidentMotionKey,
} from "./EventFirstSandboxEmotes.js";
import { createTimestamp } from "./EventFirstSandboxTimestamp.js";
import "./EventFirstSandbox.css";

type ResidentDecoration = {
  zoneLabel: string;
  presetLabel: string;
  alertPriority: string;
  positionClassName: string;
  depthClassName: string;
};

export type ActiveResidentPreview = {
  id: string;
  displayName: string;
  zoneLabel: string;
  presetLabel: string;
  alertPriority: string;
  isPrimary: boolean;
  isSupporting: boolean;
  statusSummary: string[];
};

const EXTENDED_SHEET_MOTIONS = new Set<ResidentMotionKey>([
  "waving",
  "jumping",
  "waiting",
  "review",
  "walk-up",
  "walk-down",
  "walk-forward",
  "walk-back",
  "emote-happy",
  "emote-angry",
  "emote-sad",
  "emote-surprised",
]);

type ResidentSpriteMetadata = {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  row: number;
  frames: number;
};

type ResidentViewModel = ActiveResidentPreview & {
  emote: EmoteKind;
  positionClassName: string;
  depthClassName: string;
  motion: ResidentMotionKey;
  movement: ResidentMovementState;
  visualMode: "sprite" | "portrait" | "icon" | "placeholder";
  portraitPath: string | null;
  iconPath: string | null;
  spriteSheetPath: string | null;
  extendedSheetPath: string | null;
  spriteSheetMetadata: ResidentSpriteMetadata | null;
};

type InterventionOutcome = {
  eventId: string;
  interventionType: InterventionKind;
  summaryTitle: string;
  summaryBody: string;
  changeHighlights: string[];
  godPointsAfter: number;
  nextEventHeadline: string;
};

type ApostleMotionState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isMoving: boolean;
  facing: "left" | "right";
};

type ResidentMovementState = {
  x: number;
  y: number;
  direction: "left" | "right" | "up" | "down" | "forward" | "back" | null;
};
type ResidentMoveDirection = NonNullable<ResidentMovementState["direction"]>;

type ObservedDialogueBubble = {
  id: string;
  characterId: CharacterId;
  text: string;
};

type DialogueAnchorPlacement = {
  left: number;
  top: number;
};

const sandboxDayPhases = ["morning", "noon", "evening", "night"] as const;
type SandboxDayPhase = (typeof sandboxDayPhases)[number];
const sandboxSeasons = ["spring", "summer", "autumn", "winter"] as const;
type SandboxSeason = (typeof sandboxSeasons)[number];

type SandboxBackgroundState = {
  cycleStep: number;
  season: SandboxSeason;
  dayPhase: SandboxDayPhase;
  seasonIndex: number;
  dayPhaseIndex: number;
  hourHandStartDegrees: number;
  hourHandEndDegrees: number;
  minuteHandStartDegrees: number;
  minuteHandEndDegrees: number;
  imagePath: string;
  fallbackImagePath: string;
};

interface EventFirstSandboxProps {
  runtimeState: RuntimeWorldState;
  routePath: string;
  manualSweepEnabled: boolean;
  manualSweepRuntimeDirectory: string;
  onRuntimeStateChange: (state: RuntimeWorldState) => void;
  onFocusedEventIdChange: (focusedEventId: string) => void;
  onStoryEntriesChange: (entries: StoryLogEntry[]) => void;
  onActiveResidentsChange: (residents: ActiveResidentPreview[]) => void;
  onOpenCharacterDetail: (characterId: CharacterId) => void;
  onTutorialStateChange: (tutorialStateId: string | null) => void;
}

const interventionLabels: Record<InterventionKind, string> = {
  watch: "見守る",
  help: "助ける",
  trial: "試練",
};

const residentDecorations: ResidentDecoration[] = [
  {
    zoneLabel: "泉のほとり",
    presetLabel: "落ち着いた観察",
    alertPriority: "最優先",
    positionClassName: "event-first-sandbox__resident--one",
    depthClassName: "event-first-sandbox__resident--depth-mid",
  },
  {
    zoneLabel: "木陰の小道",
    presetLabel: "会話の気配",
    alertPriority: "高め",
    positionClassName: "event-first-sandbox__resident--two",
    depthClassName: "event-first-sandbox__resident--depth-back",
  },
  {
    zoneLabel: "風の見張り台",
    presetLabel: "変化に敏感",
    alertPriority: "ふつう",
    positionClassName: "event-first-sandbox__resident--three",
    depthClassName: "event-first-sandbox__resident--depth-front",
  },
  {
    zoneLabel: "灯りの広場",
    presetLabel: "賑わい観察",
    alertPriority: "ふつう",
    positionClassName: "event-first-sandbox__resident--four",
    depthClassName: "event-first-sandbox__resident--depth-mid",
  },
];

const emoteLabels: Record<NonNullable<EmoteKind>, string> = {
  joy: "嬉",
  anger: "怒",
  sadness: "涙",
  surprise: "驚",
  "talk-request": "話",
  "event-alert": "!",
};

const initialApostleMotion: ApostleMotionState = {
  x: 82,
  y: 74,
  targetX: 82,
  targetY: 74,
  isMoving: false,
  facing: "left",
};

const SANDBOX_BACKGROUND_PHASE_INTERVAL_MS = 45_000;
const DEFAULT_SANDBOX_BACKGROUND_PATH = "/art/world/backgrounds/world_spring_noon.png";

// Resident y is the top edge of the resident wrapper as a viewport percentage.
// The lower limit intentionally lets the wrapper move below the viewport so only
// the top of the head can peek from the bottom edge.
const RESIDENT_BOTTOM_PEEK_Y = 94;
const RESIDENT_BOUNDS = { minX: 10, maxX: 82, minY: 28, maxY: RESIDENT_BOTTOM_PEEK_Y };
const RESIDENT_BOTTOM_RETURN_Y = 92;
const RESIDENT_BOTTOM_STRONG_RETURN_Y = RESIDENT_BOTTOM_PEEK_Y;
const RESIDENT_PERSPECTIVE_RANGE = { minY: 12, maxY: RESIDENT_BOTTOM_PEEK_Y };
const RESIDENT_VIEWPORT_EDGE_CLEARANCE_PX = 8;
const MOVEMENT_TRANSITION_MS = 3200;
const MOVEMENT_INTERVAL_MS = 5000;
const AMBIENT_EMOTE_DURATION_MS = 2400;
const OBSERVED_DIALOGUE_DURATION_MS = 4200;
const OBSERVED_DIALOGUE_IDLE_DELAY_MS = 6200;
const RESIDENT_MOVE_STEP: Record<ResidentMoveDirection, [number, number]> = {
  left: [-14, 0],
  right: [14, 0],
  up: [0, -10],
  down: [0, 10],
  forward: [0, 8],
  back: [0, -8],
};
const RESIDENT_DEFAULT_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 21, y: 54 },
  { x: 58, y: 42 },
  { x: 37, y: 66 },
  { x: 72, y: 60 },
];

const sandboxDayPhaseLabels: Record<SandboxDayPhase, string> = {
  morning: "朝",
  noon: "昼",
  evening: "夕方",
  night: "夜",
};

const sandboxSeasonLabels: Record<
  SandboxSeason,
  {
    label: string;
    icon: string;
  }
> = {
  spring: { label: "春", icon: "芽" },
  summer: { label: "夏", icon: "日" },
  autumn: { label: "秋", icon: "葉" },
  winter: { label: "冬", icon: "雪" },
};

const sandboxBackgroundImages: Record<
  SandboxSeason,
  Partial<Record<SandboxDayPhase, string>>
> = {
  spring: {
    morning: "/art/world/backgrounds/world_spring_morning.png",
    noon: DEFAULT_SANDBOX_BACKGROUND_PATH,
    evening: "/art/world/backgrounds/world_spring_evening.png",
    night: "/art/world/backgrounds/world_spring_night.png",
  },
  summer: {
    morning: "/art/world/backgrounds/world_summer_morning.png",
    noon: "/art/world/backgrounds/world_summer_noon.png",
    evening: "/art/world/backgrounds/world_summer_evening.png",
    night: "/art/world/backgrounds/world_summer_night.png",
  },
  autumn: {
    morning: "/art/world/backgrounds/world_autumn_morning.png",
    noon: "/art/world/backgrounds/world_autumn_noon.png",
    evening: "/art/world/backgrounds/world_autumn_evening.png",
    night: "/art/world/backgrounds/world_autumn_night.png",
  },
  winter: {
    morning: "/art/world/backgrounds/world_winter_morning.png",
    noon: "/art/world/backgrounds/world_winter_noon.png",
    evening: "/art/world/backgrounds/world_winter_evening.png",
    night: "/art/world/backgrounds/world_winter_night.png",
  },
};

const sandboxDayPhaseVisuals: Record<
  SandboxDayPhase,
  {
    brightness: number;
    opacity: number;
    saturation: number;
  }
> = {
  morning: { brightness: 1.08, opacity: 0.92, saturation: 1.04 },
  noon: { brightness: 1, opacity: 0.94, saturation: 1 },
  evening: { brightness: 0.88, opacity: 0.94, saturation: 1.08 },
  night: { brightness: 0.62, opacity: 0.9, saturation: 0.82 },
};

const sandboxSeasonVisuals: Partial<
  Record<
    SandboxSeason,
    {
      saturation: number;
    }
  >
> = {
  summer: { saturation: 1.08 },
  autumn: { saturation: 1.04 },
  winter: { saturation: 0.88 },
};

export function EventFirstSandbox({
  runtimeState,
  routePath,
  manualSweepEnabled,
  manualSweepRuntimeDirectory,
  onRuntimeStateChange,
  onFocusedEventIdChange,
  onStoryEntriesChange,
  onActiveResidentsChange,
  onOpenCharacterDetail,
  onTutorialStateChange,
}: EventFirstSandboxProps) {
  const [sandboxStage, setSandboxStage] =
    useState<SandboxExperienceStage>("focused-event");
  const [storyEntries, setStoryEntries] = useState<StoryLogEntry[]>(() =>
    createInitialStoryEntries(runtimeState),
  );
  const [tutorialState, setTutorialState] = useState<TutorialState>(() =>
    ensureTutorialForContext(readTutorialState(), {
      routePath,
      stage: "focused-event",
    }),
  );
  const [eventWindowOpen, setEventWindowOpen] = useState(false);
  const [latestOutcome, setLatestOutcome] = useState<InterventionOutcome | null>(null);
  const [apostleMotion, setApostleMotion] =
    useState<ApostleMotionState>(initialApostleMotion);
  const [residentMovements, setResidentMovements] = useState<ResidentMovementState[]>(
    RESIDENT_DEFAULT_POSITIONS.map((pos) => ({ ...pos, direction: null }))
  );
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [ambientResidentEmote, setAmbientResidentEmote] =
    useState<AmbientResidentEmote | null>(null);
  const [observedDialogueBubbles, setObservedDialogueBubbles] = useState<
    ObservedDialogueBubble[]
  >([]);
  const [dialogueAnchorPlacements, setDialogueAnchorPlacements] = useState<
    Record<string, DialogueAnchorPlacement>
  >({});
  const [backgroundCycleStep, setBackgroundCycleStep] = useState(() =>
    sandboxDayPhases.indexOf("noon"),
  );
  const [eventArtError, setEventArtError] = useState(false);
  const [musicState, setMusicState] = useState<MusicGardenState>(createInitialMusicGardenState);
  const [musicResetKey, setMusicResetKey] = useState(0);
  const musicAudioRef = useRef<MusicGardenAudio>(new MusicGardenAudio());
  const musicRuntimeStateRef = useRef(runtimeState);
  const apostleMotionRef = useRef(apostleMotion);
  const residentEmoteRef = useRef<EmoteKind[]>([]);
  const residentMovementsRef = useRef<ResidentMovementState[]>(residentMovements);
  const lastRecoveryStepRef = useRef(backgroundCycleStep);
  const runtimeStateRef = useRef(runtimeState);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const residentNodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const previousBackgroundRef = useRef<SandboxBackgroundState | null>(null);
  const backgroundFadeTimeoutRef = useRef<number | null>(null);
  const observedDialogueTimeoutsRef = useRef<Set<number>>(new Set());
  const lastObservedDialogueEventIdRef = useRef<string | null>(null);
  const observedDialogueIdleSequenceRef = useRef(0);
  const [previousSandboxBackground, setPreviousSandboxBackground] =
    useState<SandboxBackgroundState | null>(null);

  const currentEvent = selectCurrentEvent(runtimeState);
  const observationPreset = selectObservationPreset(runtimeState);
  const activeCharacters = selectActiveCharacters(runtimeState);
  const eventArt = resolveEventArt(currentEvent.templateId);
  const activeAssetBundles = useMemo(
    () => selectActiveCharacterAssetBundleReadModels(runtimeState),
    [runtimeState],
  );
  const participantOverlays = useMemo(
    () =>
      createEventParticipantOverlayViewModels({
        event: currentEvent,
        characters: runtimeState.characters,
      }),
    [currentEvent, runtimeState.characters],
  );
  const ambientPersonalitySignature = useMemo(
    () =>
      activeCharacters
        .map((character) => JSON.stringify(character.profile.personality ?? {}))
        .join("|"),
    [activeCharacters],
  );
  const sandboxPaused = eventWindowOpen || Boolean(latestOutcome);
  const residentVisualPaused = eventWindowOpen && latestOutcome === null;

  const activeResidents = useMemo(
    () =>
      activeCharacters.map((character, index) => {
        const decoration = residentDecorations[index] ?? residentDecorations[0];
        const assetBundle = activeAssetBundles[index];
        const isPrimary = currentEvent.primaryCharacterId === character.id;
        const isSupporting =
          currentEvent.participantCharacterIds.includes(character.id) && !isPrimary;
        const animationReady = assetBundle
          ? isCharacterAnimationReady(assetBundle)
          : false;
        const spriteSheetPath =
          animationReady &&
          assetBundle?.spriteSheet.ready &&
          assetBundle.spriteSheet.path
            ? assetBundle.spriteSheet.path
            : null;
        const extendedSheetPath =
          animationReady &&
          assetBundle?.extendedSheet?.ready &&
          assetBundle.extendedSheet.path
            ? assetBundle.extendedSheet.path
            : null;
        const portraitPath =
          assetBundle?.portrait.ready && assetBundle.portrait.path
            ? assetBundle.portrait.path
            : null;
        const iconPath =
          assetBundle?.icon.ready && assetBundle.icon.path ? assetBundle.icon.path : null;
        const baseEmote = resolveResidentEmote({
          sandboxStage,
          isPrimary,
          isSupporting,
          latestOutcome,
        });
        const emote = resolveDisplayedResidentEmote(baseEmote, index, ambientResidentEmote);
        const movement = residentMovements[index] ?? {
          x: RESIDENT_DEFAULT_POSITIONS[index]?.x ?? 50,
          y: RESIDENT_DEFAULT_POSITIONS[index]?.y ?? 50,
          direction: null,
        };
        const motion = resolveSandboxResidentMotion({
          emote,
          isPrimary,
          latestOutcome,
          movementDirection: movement.direction,
          residentVisualPaused,
        });
        const spriteSheetMetadata = spriteSheetPath || extendedSheetPath
          ? resolveResidentSpriteSheetMetadata(
              assetBundle?.spriteSheet.metadata,
              assetBundle?.extendedSheet?.metadata,
              motion,
              Boolean(extendedSheetPath),
            )
          : null;

        return {
          id: character.id,
          displayName: character.profile.displayName,
          zoneLabel: decoration.zoneLabel,
          presetLabel: decoration.presetLabel,
          alertPriority: decoration.alertPriority,
          isPrimary,
          isSupporting,
          positionClassName: decoration.positionClassName,
          depthClassName: decoration.depthClassName,
          emote,
          motion,
          movement,
          visualMode: spriteSheetPath || extendedSheetPath
            ? "sprite"
            : portraitPath
              ? "portrait"
              : iconPath
                ? "icon"
                : "placeholder",
          portraitPath,
          iconPath,
          spriteSheetPath,
          extendedSheetPath,
          spriteSheetMetadata,
          statusSummary: [
            `活力 ${character.state.status.vitality}`,
            `調和 ${character.state.status.harmony}`,
          ],
        } satisfies ResidentViewModel;
      }),
    [
      activeAssetBundles,
      activeCharacters,
      ambientResidentEmote,
      currentEvent,
      latestOutcome,
      residentMovements,
      residentVisualPaused,
      sandboxStage,
    ],
  );

  const primaryResident = activeResidents.find((resident) => resident.isPrimary);
  const primaryResidentId = primaryResident?.id ?? activeResidents[0]?.id;
  const dialogueBubbleVisible = observedDialogueBubbles.length > 0;
  const activeResidentEmoteSignature = useMemo(
    () =>
      activeResidents
        .map((resident, index) => `${index}:${resident.emote ?? "none"}`)
        .join("|"),
    [activeResidents],
  );
  const tutorialBinding = getTutorialBinding(tutorialState, {
    routePath,
    stage: sandboxStage,
    eventWindowOpen,
  });
  const eventWindowInterventionTutorialActive =
    tutorialState.currentStepId === "intervene" && eventWindowOpen && !latestOutcome;
  const backgroundCyclePaused = eventWindowOpen || latestOutcome !== null;
  const sandboxBackground = useMemo(
    () => resolveSandboxBackground(backgroundCycleStep),
    [backgroundCycleStep],
  );
  const sandboxSeasonLabel = sandboxSeasonLabels[sandboxBackground.season];
  const sandboxDayPhaseLabel = sandboxDayPhaseLabels[sandboxBackground.dayPhase];
  const godPoints = runtimeState.session.godPoints;
  const recoveryPhaseProgress =
    godPoints >= MAX_GOD_POINTS
      ? 0
      : Math.min(
          1,
          (backgroundCycleStep - lastRecoveryStepRef.current) / GOD_POINT_RECOVERY_PHASES_PER_POINT,
        );
  const vitalityAriaLabel =
    godPoints >= MAX_GOD_POINTS
      ? `体力 ${godPoints} / ${MAX_GOD_POINTS}。満タン`
      : `体力 ${godPoints} / ${MAX_GOD_POINTS}。次の回復まで ${Math.round(recoveryPhaseProgress * 100)}%`;

  useEffect(() => {
    const previousBackground = previousBackgroundRef.current;
    if (
      previousBackground &&
      previousBackground.imagePath !== sandboxBackground.imagePath
    ) {
      setPreviousSandboxBackground(previousBackground);
      if (backgroundFadeTimeoutRef.current !== null) {
        window.clearTimeout(backgroundFadeTimeoutRef.current);
      }
      backgroundFadeTimeoutRef.current = window.setTimeout(() => {
        setPreviousSandboxBackground(null);
        backgroundFadeTimeoutRef.current = null;
      }, 950);
    }

    previousBackgroundRef.current = sandboxBackground;
  }, [sandboxBackground]);

  useEffect(
    () => () => {
      if (backgroundFadeTimeoutRef.current !== null) {
        window.clearTimeout(backgroundFadeTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      observedDialogueTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      observedDialogueTimeoutsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    setEventArtError(false);
  }, [currentEvent.templateId]);

  useEffect(() => {
    if (sandboxPaused || lastObservedDialogueEventIdRef.current === currentEvent.id) {
      return;
    }

    lastObservedDialogueEventIdRef.current = currentEvent.id;
    queueObservedDialogue("event_started", currentEvent.id);
  }, [currentEvent.id, sandboxPaused]);

  useEffect(() => {
    if (sandboxPaused) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const scheduleIdleDialogue = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        const idleSeed = `${currentEvent.id}-idle-${observedDialogueIdleSequenceRef.current}`;
        observedDialogueIdleSequenceRef.current += 1;
        queueObservedDialogue("idle_timer", idleSeed);
        scheduleIdleDialogue();
      }, OBSERVED_DIALOGUE_IDLE_DELAY_MS);
    };

    scheduleIdleDialogue();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [currentEvent.id, sandboxPaused, activeCharacters.length]);

  useEffect(() => {
    apostleMotionRef.current = apostleMotion;
  }, [apostleMotion]);

  useEffect(() => {
    residentEmoteRef.current = activeResidents.map((resident) => resident.emote);
  }, [activeResidents]);

  useEffect(() => {
    residentMovementsRef.current = residentMovements;
  }, [residentMovements]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    if (viewportRect.width <= 0 || viewportRect.height <= 0) {
      return;
    }

    const nextPlacements: Record<string, DialogueAnchorPlacement> = {};
    activeResidents.forEach((resident) => {
      const residentNode = residentNodeRefs.current[resident.id];
      const figureNode = residentNode?.querySelector<HTMLElement>(
        ".event-first-sandbox__resident-figure",
      );
      const anchorNode = figureNode ?? residentNode;
      if (!anchorNode) {
        return;
      }

      const anchorRect = anchorNode.getBoundingClientRect();
      nextPlacements[resident.id] = {
        left: clamp(
          ((anchorRect.left + anchorRect.width / 2 - viewportRect.left) /
            viewportRect.width) *
            100,
          8,
          92,
        ),
        top: clamp(((anchorRect.top - viewportRect.top) / viewportRect.height) * 100, 8, 84),
      };
    });

    setDialogueAnchorPlacements((current) =>
      areDialogueAnchorPlacementsEqual(current, nextPlacements)
        ? current
        : nextPlacements,
    );
  }, [activeResidents, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateViewportSize = () => {
      const rect = viewport.getBoundingClientRect();
      setViewportSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };

    updateViewportSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportSize);
      return () => {
        window.removeEventListener("resize", updateViewportSize);
      };
    }

    const resizeObserver = new ResizeObserver(updateViewportSize);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (backgroundCyclePaused) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBackgroundCycleStep((currentStep) => currentStep + 1);
    }, SANDBOX_BACKGROUND_PHASE_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [backgroundCyclePaused, backgroundCycleStep]);

  useEffect(() => {
    if (!sandboxPaused) {
      return;
    }

    setApostleMotion((current) => ({
      ...current,
      targetX: current.x,
      targetY: current.y,
      isMoving: false,
    }));
  }, [sandboxPaused]);

  useEffect(() => {
    if (!apostleMotion.isMoving) {
      return;
    }

    let animationFrameId = 0;

    function moveApostleTowardTarget() {
      const current = apostleMotionRef.current;
      const deltaX = current.targetX - current.x;
      const deltaY = current.targetY - current.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < 0.35) {
        setApostleMotion({
          ...current,
          x: current.targetX,
          y: current.targetY,
          isMoving: false,
        });
        return;
      }

      setApostleMotion({
        ...current,
        x: current.x + deltaX * 0.08,
        y: current.y + deltaY * 0.08,
        isMoving: true,
      });
      animationFrameId = window.requestAnimationFrame(moveApostleTowardTarget);
    }

    animationFrameId = window.requestAnimationFrame(moveApostleTowardTarget);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [apostleMotion.isMoving, apostleMotion.targetX, apostleMotion.targetY]);

  useEffect(() => {
    runtimeStateRef.current = runtimeState;
    musicRuntimeStateRef.current = runtimeState;
  }, [runtimeState]);

  useEffect(() => {
    if (backgroundCyclePaused) return;

    const elapsedTicks = backgroundCycleStep - lastRecoveryStepRef.current;
    if (elapsedTicks <= 0) return;

    if (runtimeStateRef.current.session.godPoints >= MAX_GOD_POINTS) {
      lastRecoveryStepRef.current = backgroundCycleStep;
      return;
    }

    const recoveryTicks = Math.floor(elapsedTicks / GOD_POINT_RECOVERY_PHASES_PER_POINT);
    lastRecoveryStepRef.current += recoveryTicks * GOD_POINT_RECOVERY_PHASES_PER_POINT;

    if (recoveryTicks <= 0) return;

    const result = recoverRuntimeGodPointsByPhaseTicks(runtimeStateRef.current, {
      elapsedPhaseTicks: recoveryTicks * GOD_POINT_RECOVERY_PHASES_PER_POINT,
      now: new Date().toISOString(),
    });
    if (result.recoveredAmount > 0) {
      onRuntimeStateChange(result.state);
    }
  }, [backgroundCycleStep, backgroundCyclePaused]);

  useEffect(() => {
    onFocusedEventIdChange(currentEvent.id);
  }, [currentEvent.id, onFocusedEventIdChange]);

  useEffect(() => {
    onStoryEntriesChange(storyEntries);
  }, [onStoryEntriesChange, storyEntries]);

  useEffect(() => {
    onActiveResidentsChange(activeResidents);
  }, [activeResidents, onActiveResidentsChange]);

  useEffect(() => {
    onTutorialStateChange(tutorialState.currentStepId);
  }, [onTutorialStateChange, tutorialState.currentStepId]);

  useEffect(() => {
    setTutorialState((current) =>
      ensureTutorialForContext(current, {
        routePath,
        stage: sandboxStage,
      }),
    );
  }, [routePath, sandboxStage]);

  useEffect(() => {
    persistTutorialState(tutorialState);
  }, [tutorialState]);

  useEffect(() => {
    if (!tutorialBinding) {
      return;
    }

    const target = document.querySelector(
      `[data-tutorial-anchor="${tutorialBinding.anchorId}"]`,
    );
    target?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [tutorialBinding]);

  useEffect(() => {
    if (sandboxPaused) {
      setAmbientResidentEmote(null);
      return;
    }

    let cancelled = false;
    let previousResidentIndex = -1;

    const intervalId = window.setInterval(() => {
      if (cancelled) {
        return;
      }
      setAmbientResidentEmote((current) => {
        const nextResidentIndex = current?.residentIndex ?? previousResidentIndex;
        const residentIndex =
          activeCharacters.length > 0
            ? (nextResidentIndex + 1 + activeCharacters.length) % activeCharacters.length
            : -1;
        const resident = activeCharacters[residentIndex];
        const next = createNextAmbientResidentEmote(
          nextResidentIndex,
          activeCharacters.length,
          Math.random(),
          resident?.profile.personality ?? {},
        );
        previousResidentIndex = next?.residentIndex ?? -1;
        return next;
      });
    }, MOVEMENT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeCharacters, activeCharacters.length, ambientPersonalitySignature, sandboxPaused]);

  useEffect(() => {
    if (sandboxPaused || !ambientResidentEmote) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAmbientResidentEmote((current) =>
        current === ambientResidentEmote ? null : current,
      );
    }, AMBIENT_EMOTE_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ambientResidentEmote, sandboxPaused]);

  useEffect(() => {
    if (sandboxPaused) {
      return;
    }

    activeResidents.forEach((resident, index) => {
      if (isResidentMovementBlockingEmote(resident.emote)) {
        freezeResidentMovementAtCurrentScreenPosition(index);
      }
    });
  }, [activeResidentEmoteSignature, sandboxPaused]);

  useEffect(() => {
    if (sandboxPaused) return;

    let cancelled = false;
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

    function scheduleMove(index: number, delayMs: number): void {
      const id = setTimeout(() => {
        pendingTimers.delete(id);
        if (cancelled) return;

        if (isResidentMovementBlockingEmote(residentEmoteRef.current[index])) {
          scheduleMove(index, 700);
          return;
        }

        const currentMovement = residentMovementsRef.current[index];
        if (!currentMovement) {
          scheduleMove(index, MOVEMENT_INTERVAL_MS);
          return;
        }

        const target = chooseResidentMoveTarget(currentMovement);

        setResidentMovements((prev) => {
          const current = prev[index];
          if (!current) return prev;
          const next = [...prev] as ResidentMovementState[];
          next[index] = target;
          return next;
        });
        const resetId = setTimeout(() => {
          pendingTimers.delete(resetId);
          if (cancelled) return;
          setResidentMovements((prev) => {
            const next = [...prev] as ResidentMovementState[];
            if (next[index]) next[index] = { ...next[index], direction: null };
            return next;
          });
        }, MOVEMENT_TRANSITION_MS);
        pendingTimers.add(resetId);
        scheduleMove(index, getNextResidentMoveDelay(target.y));
      }, delayMs);
      pendingTimers.add(id);
    }

    for (let i = 0; i < activeCharacters.length; i++) {
      scheduleMove(i, i * 1200 + Math.random() * 1000);
    }

    return () => {
      cancelled = true;
      pendingTimers.forEach(clearTimeout);
    };
  }, [activeCharacters.length, sandboxPaused]);

  function resolveObservedDialogueCharacters(trigger: DialogueTrigger) {
    if (trigger === "event_started" || trigger === "intervention_applied") {
      const participantIds = new Set(currentEvent.participantCharacterIds);
      return activeCharacters.filter((character) => participantIds.has(character.id));
    }

    return activeCharacters;
  }

  function createObservedDialogueBubbles(
    trigger: DialogueTrigger,
    seed: string,
  ): ObservedDialogueBubble[] {
    const dialogueCharacters = resolveObservedDialogueCharacters(trigger);
    const candidates = createObservedDialogueCandidates({
      trigger,
      characters: dialogueCharacters,
      event: currentEvent,
      restrictEventParticipants: trigger === "event_started" || trigger === "intervention_applied",
      now: createTimestamp(storyEntries.length + 1),
      seed,
      maxCandidates: 2,
    });
    const visibleCandidates = selectVisibleObservedDialogueCandidates(candidates, 2);
    if (visibleCandidates.length === 0) {
      return [];
    }

    return visibleCandidates.map((candidate) => ({
      id: candidate.id,
      characterId: candidate.characterId,
      text: candidate.text,
    }));
  }

  function queueObservedDialogue(trigger: DialogueTrigger, seed: string): void {
    showObservedDialogueBubbles(createObservedDialogueBubbles(trigger, seed));
  }

  function showObservedDialogueBubbles(nextBubbles: ObservedDialogueBubble[]): void {
    if (nextBubbles.length === 0) {
      return;
    }

    setObservedDialogueBubbles((current) => [...nextBubbles, ...current].slice(0, 2));

    nextBubbles.forEach((bubble, index) => {
      const timeoutId = window.setTimeout(
        () => {
          observedDialogueTimeoutsRef.current.delete(timeoutId);
          setObservedDialogueBubbles((current) =>
            current.filter((item) => item.id !== bubble.id),
          );
        },
        OBSERVED_DIALOGUE_DURATION_MS + index * 350,
      );
      observedDialogueTimeoutsRef.current.add(timeoutId);
    });
  }

  // Music Garden: sync rewardsEnabled with event window state
  useEffect(() => {
    const rewardsEnabled = !eventWindowOpen && !latestOutcome;
    setMusicState((prev) => ({ ...prev, rewardsEnabled }));
  }, [eventWindowOpen, latestOutcome]);

  // Music Garden: animation loop for tick and note activation
  useEffect(() => {
    if (!musicState.isPlaying) return;
    let lastTime = performance.now();
    let rafId = 0;

    function frame(now: number) {
      const delta = now - lastTime;
      lastTime = now;
      setMusicState((prev) => {
        if (!prev.isPlaying) return prev;
        const ticked = tickElapsed(prev, delta);
        const activated = activateNotes(ticked);
        musicAudioRef.current.scheduleNotes(activated.notes, activated.elapsedMs);
        return activated;
      });
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    musicAudioRef.current.resume();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [musicState.isPlaying]);

  const handleMidiFileLoad = useCallback((buffer: ArrayBuffer, fileName: string) => {
    musicAudioRef.current.stop();
    // Empty buffer is synthesised by the panel for non-MIDI file selection
    if (buffer.byteLength === 0) {
      setMusicState((prev) => ({
        ...prev,
        errorMessage: `${fileName}: .mid / .midi ファイルを選んでください`,
        isPlaying: false,
      }));
      return;
    }
    // Show loading state immediately so the UI stays responsive, then parse
    // on the next macrotask (parseMidi is synchronous and can take ~100ms on
    // large files, which would visibly block the main thread if called inline).
    setMusicState((prev) => ({
      ...prev,
      isPlaying: false,
      errorMessage: null,
      warnings: ["読み込み中…"],
    }));
    setTimeout(() => {
      const outcome = parseMidi(buffer);
      if (!outcome.ok) {
        setMusicState((prev) => ({ ...prev, errorMessage: outcome.error, warnings: [], isPlaying: false }));
        return;
      }
      const { notes, warnings } = outcome.result;
      const newState = musicResetSession(notes, warnings);
      setMusicState(newState);
      setMusicResetKey((k) => k + 1);
      musicAudioRef.current.resetSchedule();
    }, 0);
  }, []);

  const handleMusicPlay = useCallback(() => {
    // Call prepareForPlay from the direct user-gesture handler to satisfy
    // browser autoplay policy before the animation loop starts.
    musicAudioRef.current.prepareForPlay();
    setMusicState((prev) => {
      if (!prev.notes.length) return prev;
      return { ...prev, isPlaying: true };
    });
  }, []);

  const handleMusicPause = useCallback(() => {
    setMusicState((prev) => ({ ...prev, isPlaying: false }));
    musicAudioRef.current.pause();
  }, []);

  const handleMusicReset = useCallback(() => {
    musicAudioRef.current.stop();
    setMusicState((prev) => musicResetPlayback(prev));
    setMusicResetKey((k) => k + 1);
    musicAudioRef.current.resetSchedule();
  }, []);

  const handleMusicNoteClick = useCallback(
    (noteId: string) => {
      setMusicState((prev) => {
        const afterClick = musicHandleNoteClick(prev, noteId);
        if (afterClick.currentNoteStreak !== prev.currentNoteStreak) {
          const { musicState: afterReward, worldState: newWorld } = streakReward(
            afterClick,
            musicRuntimeStateRef.current,
          );
          if (newWorld !== musicRuntimeStateRef.current) {
            musicRuntimeStateRef.current = newWorld;
            onRuntimeStateChange(newWorld);
          }
          return afterReward;
        }
        return afterClick;
      });
    },
    [onRuntimeStateChange],
  );

  // handleNoteExpiry is handled entirely by the reward layer (which checks
  // rewardsEnabled and note.clicked). The visualizer only calls this when
  // rewardsEnabled=true, providing a consistent double-guard.
  const handleMusicNoteExpire = useCallback(
    (noteId: string) => {
      setMusicState((prev) => rewardHandleNoteExpiry(prev, noteId));
    },
    [],
  );

  function handleTutorialContinue() {
    setTutorialState((current) => advanceTutorialStep(current, "continue"));
  }

  function handleIntervention(type: InterventionKind) {
    freezeResidentMovementsAtCurrentScreenPosition();
    const previousInterventionIds = new Set(runtimeState.interventions.keys());
    const previousChangeSetIds = new Set(runtimeState.changeSets.keys());
    const applied = applyFocusedEventInterventionCommand(runtimeState, {
      type,
      now: createTimestamp(storyEntries.length + 1),
      idSeed: `${type}-${storyEntries.length + 1}`,
      playerReason:
        type === "help"
          ? "最初の良い変化を見届けたい"
          : "いまの出来事の流れを確かめたい",
    });

    const newIntervention = [...applied.state.interventions.values()].find(
      (intervention) => !previousInterventionIds.has(intervention.id),
    );
    const newChangeSets = [...applied.state.changeSets.values()].filter(
      (changeSet) => !previousChangeSetIds.has(changeSet.id),
    );

    const outcome = createOutcome({
      currentEvent,
      nextEvent: applied.nextEvent,
      interventionType: type,
      changeSetCount: newChangeSets.length,
      changeHighlights: newChangeSets.map((changeSet) =>
        describeChangeSet(changeSet.targetCharacterId, applied.state, changeSet.patch),
      ),
      godPointsAfter:
        newIntervention?.godPointsAfterApply ?? applied.state.session.godPoints,
    });

    onRuntimeStateChange(applied.state);
    const interventionBubbles = createObservedDialogueBubbles(
      "intervention_applied",
      `${currentEvent.id}-${type}`,
    );
    showObservedDialogueBubbles(interventionBubbles);
    setEventWindowOpen(true);
    setLatestOutcome(outcome);
    setSandboxStage("result");
    setStoryEntries((currentEntries) => [
      ...currentEntries,
      {
        id: `${outcome.eventId}-${type}`,
        title: `${interventionLabels[type]}で変化が起きました`,
        detail: outcome.summaryBody,
        timestampLabel: "いま",
        tags: [interventionLabels[type], `${outcome.godPointsAfter} pt`],
        tone: "result",
      },
    ]);
    setTutorialState((currentTutorial) =>
      advanceTutorialStep(currentTutorial, "intervened"),
    );
  }

  function handleResultReviewed() {
    const nextEvent = selectCurrentEvent(runtimeState);
    setStoryEntries((currentEntries) => [
      ...currentEntries,
      {
        id: `${nextEvent.id}-arrived`,
        title: "次の出来事が前に出ました",
        detail: nextEvent.summary,
        timestampLabel: "つぎ",
        tags: ["新しい出来事", ...nextEvent.situationTags.slice(0, 2)],
        tone: "pause",
      },
    ]);
    setLatestOutcome(null);
    setEventWindowOpen(false);
    setSandboxStage("focused-event");
    setTutorialState((currentTutorial) =>
      advanceTutorialStep(currentTutorial, "result-reviewed"),
    );
  }

  function handleViewportClick(event: MouseEvent<HTMLDivElement>) {
    if (sandboxPaused) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const nextX = clamp(((event.clientX - bounds.left) / bounds.width) * 100, 8, 92);
    const nextY = clamp(((event.clientY - bounds.top) / bounds.height) * 100, 18, 88);

    setApostleMotion((current) => ({
      ...current,
      targetX: nextX,
      targetY: nextY,
      isMoving: true,
      facing: nextX < current.x ? "left" : "right",
    }));
  }

  function handleResidentClick(event: MouseEvent<HTMLElement>, characterId: CharacterId) {
    event.stopPropagation();
    onOpenCharacterDetail(characterId);
  }

  function handleEventAlertBubbleClick(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    openEventWindowWithFrozenResidents();
  }

  function openEventWindowWithFrozenResidents() {
    if (eventWindowOpen || latestOutcome) {
      return;
    }

    freezeResidentMovementsAtCurrentScreenPosition();
    setEventWindowOpen(true);
  }

  function freezeResidentMovementsAtCurrentScreenPosition() {
    freezeResidentMovementAtCurrentScreenPosition();
  }

  function freezeResidentMovementAtCurrentScreenPosition(targetIndex?: number) {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const viewportWidth = viewportRect.width;
    const viewportHeight = viewportRect.height;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    setResidentMovements((current) =>
      current.map((movement, index) => {
        if (targetIndex !== undefined && index !== targetIndex) {
          return movement;
        }

        const residentId = activeCharacters[index]?.id;
        const residentNode = residentId ? residentNodeRefs.current[residentId] : null;
        if (!residentNode) {
          return { ...movement, direction: null };
        }

        const residentRect = residentNode.getBoundingClientRect();
        const currentX = ((residentRect.left - viewportRect.left) / viewportWidth) * 100;
        const currentY = ((residentRect.top - viewportRect.top) / viewportHeight) * 100;

        return {
          x: Number.isFinite(currentX)
            ? clamp(currentX, RESIDENT_BOUNDS.minX, RESIDENT_BOUNDS.maxX)
            : movement.x,
          y: Number.isFinite(currentY) ? currentY : movement.y,
          direction: null,
        };
      }),
    );
  }

  return (
    <section className="event-first-sandbox">
      <div
        ref={viewportRef}
        className={`event-first-sandbox__viewport event-first-sandbox__viewport--${sandboxStage} event-first-sandbox__viewport--season-${sandboxBackground.season} event-first-sandbox__viewport--phase-${sandboxBackground.dayPhase}${
          backgroundCyclePaused ? " event-first-sandbox__viewport--background-paused" : ""
        }${sandboxPaused ? " event-first-sandbox__viewport--paused" : ""
        }`}
        onClick={handleViewportClick}
        data-tutorial-anchor="tutorial-anchor-world"
        data-tutorial-highlighted={
          tutorialBinding?.anchorId === "tutorial-anchor-world" || undefined
        }
        data-sandbox-season={sandboxBackground.season}
        data-sandbox-day-phase={sandboxBackground.dayPhase}
      >
        <div className="event-first-sandbox__world-backdrop" aria-hidden="true">
          {previousSandboxBackground ? (
            <div
              key={`previous-${previousSandboxBackground.cycleStep}`}
              className="event-first-sandbox__world-backdrop-layer event-first-sandbox__world-backdrop-layer--previous"
              style={createSandboxBackgroundStyle(previousSandboxBackground)}
            />
          ) : null}
          <div
            key={`current-${sandboxBackground.cycleStep}`}
            className="event-first-sandbox__world-backdrop-layer event-first-sandbox__world-backdrop-layer--current"
            style={createSandboxBackgroundStyle(sandboxBackground)}
          />
        </div>
        <div
          className="event-first-sandbox__time-season-hud"
          aria-label={`箱庭の時間は${sandboxDayPhaseLabel}、季節は${sandboxSeasonLabel.label}です`}
        >
          <span
            key={`clock-${sandboxBackground.cycleStep}`}
            className="event-first-sandbox__clock"
            aria-hidden="true"
            style={createSandboxClockStyle(sandboxBackground)}
          >
            <span className="event-first-sandbox__clock-mark event-first-sandbox__clock-mark--zero" />
            <span className="event-first-sandbox__clock-mark event-first-sandbox__clock-mark--three" />
            <span className="event-first-sandbox__clock-mark event-first-sandbox__clock-mark--six" />
            <span className="event-first-sandbox__clock-mark event-first-sandbox__clock-mark--nine" />
            <span className="event-first-sandbox__clock-hand event-first-sandbox__clock-hand--hour" />
            <span className="event-first-sandbox__clock-hand event-first-sandbox__clock-hand--minute" />
          </span>
          <span className="event-first-sandbox__hud-pill">
            {sandboxDayPhaseLabel}
          </span>
          <span className="event-first-sandbox__hud-pill event-first-sandbox__hud-pill--season">
            <span className="event-first-sandbox__season-icon" aria-hidden="true">
              {sandboxSeasonLabel.icon}
            </span>
            {sandboxSeasonLabel.label}
          </span>
        </div>
        <div
          className="event-first-sandbox__vitality-hud"
          aria-label={vitalityAriaLabel}
        >
          <span className="event-first-sandbox__vitality-label" aria-hidden="true">体力</span>
          <span className="event-first-sandbox__vitality-pips" aria-hidden="true">
            {Array.from({ length: MAX_GOD_POINTS }, (_, i) => (
              <span
                key={i}
                className={`event-first-sandbox__vitality-pip${
                  i < godPoints ? " event-first-sandbox__vitality-pip--filled" : ""
                }`}
              />
            ))}
          </span>
          <span className="event-first-sandbox__vitality-recovery" aria-hidden="true">
            <span
              className="event-first-sandbox__vitality-recovery-fill"
              style={{ width: `${recoveryPhaseProgress * 100}%` }}
            />
          </span>
        </div>
        <div className="event-first-sandbox__sky" />
        <div className="event-first-sandbox__ground" />
        <MusicGardenVisualizer
          notes={musicState.notes}
          elapsedMs={musicState.elapsedMs}
          dimmed={sandboxPaused}
          rewardsEnabled={musicState.rewardsEnabled}
          resetKey={musicResetKey}
          onNoteClick={handleMusicNoteClick}
          onNoteExpire={handleMusicNoteExpire}
        />

        {activeResidents.map((resident) => {
          const visibleEmote = resolveVisibleResidentEmote({
            emote: resident.emote,
            dialogueBubbleVisible,
          });

          return (
            <article
              key={resident.id}
              ref={(node) => {
                residentNodeRefs.current[resident.id] = node;
              }}
              className={`event-first-sandbox__resident event-first-sandbox__resident--clickable ${resident.positionClassName} ${resident.depthClassName} event-first-sandbox__resident--visual-${resident.visualMode} event-first-sandbox__resident--motion-${resident.motion} ${
                resident.spriteSheetPath
                  ? "event-first-sandbox__resident--sprite-ready"
                  : "event-first-sandbox__resident--sprite-fallback"
              } ${
                isVariableWidthFailedResident(resident)
                  ? "event-first-sandbox__resident--failed-variable"
                  : ""
              } ${
                sandboxPaused ? "event-first-sandbox__resident--position-frozen" : ""
              } ${
                residentVisualPaused ? "event-first-sandbox__resident--paused" : ""
              }`}
              data-resident-depth={resident.depthClassName.replace(
                "event-first-sandbox__resident--depth-",
                "",
              )}
              data-resident-motion={resident.motion}
              data-resident-visual={resident.visualMode}
              style={{
                ...createResidentStyle(resident),
                ...createResidentPlacementStyle(resident, viewportSize.width),
              }}
            >
              <div className="event-first-sandbox__resident-anchor">
                {visibleEmote === "event-alert" ? (
                  <button
                    type="button"
                    className={`event-first-sandbox__emote event-first-sandbox__emote--${visibleEmote}`}
                    aria-label="イベント子画面を開く"
                    aria-haspopup="dialog"
                    aria-expanded={eventWindowOpen || latestOutcome !== null}
                    disabled={eventWindowOpen || latestOutcome !== null}
                    onClick={handleEventAlertBubbleClick}
                  >
                    {emoteLabels[visibleEmote]}
                  </button>
                ) : visibleEmote ? (
                  <span
                    className={`event-first-sandbox__emote event-first-sandbox__emote--${visibleEmote}`}
                  >
                    {emoteLabels[visibleEmote]}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="event-first-sandbox__resident-card"
                  aria-label={`${resident.displayName}の詳細を開く`}
                  onClick={(event) => handleResidentClick(event, resident.id)}
                >
                  <div className="event-first-sandbox__resident-figure" aria-hidden="true">
                    {resident.spriteSheetPath ? (
                      <span className="event-first-sandbox__resident-sprite" />
                    ) : resident.portraitPath ? (
                      <img src={resident.portraitPath} alt="" />
                    ) : resident.iconPath ? (
                      <img src={resident.iconPath} alt="" />
                    ) : (
                      <span className="event-first-sandbox__resident-placeholder" />
                    )}
                  </div>
                </button>
              </div>
            </article>
          );
        })}
        <div
          className="event-first-sandbox__dialogue-layer"
          aria-live="polite"
          aria-atomic="false"
        >
          {observedDialogueBubbles.map((bubble) => {
            const resident = activeResidents.find((item) => item.id === bubble.characterId);
            if (!resident) {
              return null;
            }

            return (
              <div
                key={bubble.id}
                className="event-first-sandbox__dialogue-bubble"
                style={createDialogueBubblePlacementStyle(
                  resident,
                  viewportSize,
                  dialogueAnchorPlacements[resident.id],
                )}
                aria-label={`${resident.displayName}のひとこと`}
              >
                <span>{bubble.text}</span>
              </div>
            );
          })}
        </div>
        <div
          className={`event-first-sandbox__apostle-runner event-first-sandbox__apostle-runner--${
            apostleMotion.isMoving ? `moving-${apostleMotion.facing}` : "idle"
          }${sandboxPaused ? " event-first-sandbox__apostle-runner--paused" : ""}`}
          aria-label="使徒が箱庭の中を小走りで移動しています"
          role="img"
          style={{
            left: `${apostleMotion.x}%`,
            top: `${apostleMotion.y}%`,
          }}
        />
      </div>

      <section
        className="event-first-sandbox__focus-card"
        data-tutorial-anchor="tutorial-anchor-event"
        data-tutorial-highlighted={
          tutorialBinding?.anchorId === "tutorial-anchor-event" || undefined
        }
      >
        <p className="eyebrow">いまの出来事</p>
        <div className="event-first-sandbox__event-meta">
          <span className="event-first-sandbox__event-mark">出来事</span>
          <span>
            {currentEvent.situationTags.length > 0
              ? currentEvent.situationTags.slice(0, 2).join(" / ")
              : "変化の気配"}
          </span>
        </div>
        <h2>{createEventHeadline(currentEvent, primaryResident?.displayName ?? "住民")}</h2>
        <p className="event-first-sandbox__focus-summary">{currentEvent.summary}</p>
        <div className="event-first-sandbox__resident-list" aria-label="いまの出来事にいる住民">
          {activeResidents.map((resident) => {
            const isEventEntryResident = resident.id === primaryResidentId;
            const roleLabel = resident.isPrimary
              ? "主役"
              : resident.isSupporting
                ? "脇役"
                : "見守り中";

            return (
              <article
                key={`focus-${resident.id}`}
                className={`event-first-sandbox__resident-row${
                  resident.isPrimary ? " event-first-sandbox__resident-row--primary" : ""
                }`}
              >
                <button
                  type="button"
                  className="character-icon-placeholder event-first-sandbox__character-icon-button"
                  aria-label={`${resident.displayName}の詳細を開く`}
                  onClick={() => onOpenCharacterDetail(resident.id)}
                >
                  {resident.displayName.slice(0, 1)}
                </button>
                <div className="event-first-sandbox__resident-row-main">
                  <span className="event-first-sandbox__group-label">{roleLabel}</span>
                  <strong>{resident.displayName}</strong>
                  <span>{resident.zoneLabel}</span>
                </div>
                <div className="event-first-sandbox__resident-row-status">
                  {resident.statusSummary.map((summary) => (
                    <span key={`${resident.id}-${summary}`}>{summary}</span>
                  ))}
                </div>
                {isEventEntryResident ? (
                  <Button
                    type="button"
                    variant="primary"
                    className="event-first-sandbox__event-entry-button"
                    data-tutorial-anchor="tutorial-anchor-event-entry"
                    data-tutorial-highlighted={
                      tutorialBinding?.anchorId === "tutorial-anchor-event-entry" || undefined
                    }
                    disabled={eventWindowOpen || !!latestOutcome}
                    onClick={openEventWindowWithFrozenResidents}
                  >
                    <span className="event-first-sandbox__event-entry-mark">!</span>
                    <span>
                      {eventWindowOpen || latestOutcome
                        ? "詳細を表示中"
                        : "イベント詳細を見る"}
                    </span>
                  </Button>
                ) : (
                  <span className="event-first-sandbox__resident-row-note">
                    {resident.isSupporting ? "関わりあり" : "待機中"}
                  </span>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {eventWindowOpen || latestOutcome ? (
        <section
          className={`event-first-sandbox__event-window${
            latestOutcome ? " event-first-sandbox__event-window--result" : ""
          }`}
          role="dialog"
          aria-labelledby="event-first-sandbox-event-window-title"
        >
          <div className="event-first-sandbox__event-window-chrome">
            <span>イベント子画面</span>
            <span>関わり方を決めるまで閉じられません</span>
          </div>
          {latestOutcome ? (
            <div
              className="event-first-sandbox__event-window-body event-first-sandbox__event-window-body--result"
              data-tutorial-anchor="tutorial-anchor-result"
              data-tutorial-highlighted={
                tutorialBinding?.anchorId === "tutorial-anchor-result" || undefined
              }
            >
              <p className="eyebrow">結果</p>
              <h2 id="event-first-sandbox-event-window-title">{latestOutcome.summaryTitle}</h2>
              <p>{latestOutcome.summaryBody}</p>
              <ul className="event-first-sandbox__result-list">
                {latestOutcome.changeHighlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
              <div className="event-first-sandbox__result-footer">
                <span>残りの力: {latestOutcome.godPointsAfter}</span>
                <span>次の出来事: {latestOutcome.nextEventHeadline}</span>
              </div>
              <Button type="button" variant="primary" onClick={handleResultReviewed}>
                結果を受け取る
              </Button>
            </div>
          ) : (
            <div className="event-first-sandbox__event-window-body">
              <div className="event-first-sandbox__event-window-status">
                <strong id="event-first-sandbox-event-window-title">見守り中</strong>
                <span>出来事の絵を確認してから、関わり方を選びます。</span>
              </div>
              <div className="event-first-sandbox__event-art-frame">
                <img
                  key={eventArt.assetId}
                  src={eventArtError ? eventArt.fallbackSrc : eventArt.src}
                  alt={eventArt.alt}
                  className="event-first-sandbox__event-art-image"
                  onError={() => setEventArtError(true)}
                />
                <div
                  className="event-first-sandbox__event-participant-layer"
                  aria-label="イベント参加キャラ"
                >
                  {participantOverlays.map((participant) => (
                    <img
                      key={`${currentEvent.id}:${participant.characterId}`}
                      src={participant.src}
                      alt={participant.alt}
                      className={[
                        "event-first-sandbox__event-participant",
                        `event-first-sandbox__event-participant--${participant.slot}`,
                        `event-first-sandbox__event-participant--${participant.role}`,
                        `event-first-sandbox__event-participant--count-${participantOverlays.length}`,
                      ].join(" ")}
                      title={participant.displayName}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="event-first-sandbox__event-details">
                <strong>観察プリセット</strong>
                <p>小さな出来事を静かに見守ります。</p>
                <div className="event-first-sandbox__tag-row">
                  {observationPreset.worldStatusTags.map((tag) => (
                    <span key={`world-${tag}`}>世界: {tag}</span>
                  ))}
                  {observationPreset.eventSituationTags.map((tag) => (
                    <span key={`event-${tag}`}>出来事: {tag}</span>
                  ))}
                </div>
              </div>
              <div
                className="event-first-sandbox__interventions"
                aria-label="イベントへの関わり方"
                data-tutorial-anchor="tutorial-anchor-event-interventions"
                data-tutorial-highlighted={
                  tutorialBinding?.anchorId === "tutorial-anchor-event-interventions" || undefined
                }
              >
                {(Object.keys(interventionLabels) as InterventionKind[]).map((type) => {
                  const canAfford = godPoints >= BALANCED_INTERVENTION_COSTS[type];
                  return (
                    <Button
                      key={type}
                      type="button"
                      variant={type === "help" ? "primary" : "secondary"}
                      className={`event-first-sandbox__intervention-button event-first-sandbox__intervention-button--${type}`}
                      disabled={!canAfford}
                      title={!canAfford ? "体力が足りません" : undefined}
                      onClick={() => handleIntervention(type)}
                    >
                      {interventionLabels[type]}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {manualSweepEnabled ? (
        <aside className="event-first-sandbox__manual-sweep-note">
          <strong>manual-sweep mode</strong>
          <span>runtime 出力先: {manualSweepRuntimeDirectory}</span>
        </aside>
      ) : null}

      {tutorialState.currentStepId === "observe-world" ? (
        <TutorialOverlay
          stepId="01 / 04"
          title="まず箱庭を見る"
          body="住民の位置と気配をざっと見れば十分です。主役は次のカードで分かります。"
          anchorLabel="箱庭の見取り図"
          primaryActionLabel="次へ"
          onPrimaryAction={handleTutorialContinue}
        />
      ) : null}

      {tutorialState.currentStepId === "inspect-event" ? (
        <TutorialOverlay
          stepId="02 / 04"
          title="次は出来事を見る"
          body="主役、脇役、いま起きていることの 3 つが読めれば、次の操作を決められます。"
          anchorLabel="いまの出来事"
          primaryActionLabel="介入へ"
          onPrimaryAction={handleTutorialContinue}
        />
      ) : null}

      {tutorialState.currentStepId === "intervene" && !eventWindowInterventionTutorialActive ? (
        <TutorialOverlay
          stepId="03 / 04"
          title="箱庭の住人に何かが起きています。"
          body="「イベント詳細を見る」をクリックしてみましょう。"
          anchorLabel="イベント詳細を見る"
          anchorId="tutorial-anchor-event-entry"
          placement="anchor-right"
          showAnchorHint={false}
        />
      ) : null}

      {tutorialState.currentStepId === "read-result" && latestOutcome ? (
        <TutorialOverlay
          stepId="04 / 04"
          title="最後に結果を見る"
          body="ここで良い変化や次の出来事が分かれば、event-first の箱庭ループに入れます。"
          anchorLabel="結果カード"
          primaryActionLabel="結果を受け取る"
          onPrimaryAction={handleResultReviewed}
        />
      ) : null}
      <MusicGardenPanel
        state={musicState}
        warnings={musicState.warnings}
        onFileLoad={handleMidiFileLoad}
        onPlay={handleMusicPlay}
        onPause={handleMusicPause}
        onReset={handleMusicReset}
      />
    </section>
  );
}

function createInitialStoryEntries(state: RuntimeWorldState): StoryLogEntry[] {
  const event = selectCurrentEvent(state);
  const preset = selectObservationPreset(state);

  return [
    {
      id: `${event.id}-current`,
      title: "出来事が前に出ました",
      detail: event.summary,
      timestampLabel: "いま",
      tags: [...preset.worldStatusTags.slice(0, 1), ...preset.eventSituationTags.slice(0, 2)],
      tone: "event",
    },
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function chooseResidentMoveTarget(current: ResidentMovementState): ResidentMovementState {
  if (current.y >= RESIDENT_BOTTOM_STRONG_RETURN_Y) {
    const direction: ResidentMoveDirection = Math.random() < 0.65 ? "up" : "back";
    return {
      x: clamp(current.x + randomBetween(-10, 10), RESIDENT_BOUNDS.minX, RESIDENT_BOUNDS.maxX),
      y: randomBetween(48, 58),
      direction,
    };
  }

  if (current.y >= RESIDENT_BOTTOM_RETURN_Y) {
    const direction: ResidentMoveDirection = Math.random() < 0.58 ? "up" : "back";
    return {
      x: clamp(current.x + randomBetween(-12, 12), RESIDENT_BOUNDS.minX, RESIDENT_BOUNDS.maxX),
      y: randomBetween(54, 66),
      direction,
    };
  }

  const directions: ResidentMoveDirection[] =
    current.y <= RESIDENT_BOUNDS.minY + 8
      ? ["down", "forward", "left", "right", "right", "left"]
      : ["left", "right", "up", "down", "forward", "back"];
  const direction = directions[Math.floor(Math.random() * directions.length)] ?? "up";
  const [dx, dy] = RESIDENT_MOVE_STEP[direction];

  return {
    x: clamp(current.x + dx, RESIDENT_BOUNDS.minX, RESIDENT_BOUNDS.maxX),
    y: clamp(current.y + dy, RESIDENT_BOUNDS.minY, RESIDENT_BOUNDS.maxY),
    direction,
  };
}

function getNextResidentMoveDelay(y: number): number {
  if (y >= RESIDENT_BOTTOM_STRONG_RETURN_Y) {
    return MOVEMENT_TRANSITION_MS + 700 + Math.random() * 500;
  }
  if (y >= RESIDENT_BOTTOM_RETURN_Y) {
    return MOVEMENT_TRANSITION_MS + 900 + Math.random() * 700;
  }
  return MOVEMENT_INTERVAL_MS + Math.random() * 2000;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function resolveSandboxBackground(cycleStep: number): SandboxBackgroundState {
  const normalizedStep = Math.max(0, cycleStep);
  const dayPhaseIndex = normalizedStep % sandboxDayPhases.length;
  const seasonIndex =
    Math.floor(normalizedStep / sandboxDayPhases.length) % sandboxSeasons.length;
  const dayPhase = sandboxDayPhases[dayPhaseIndex];
  const season = sandboxSeasons[seasonIndex];
  const seasonImages = sandboxBackgroundImages[season];
  const imagePath =
    seasonImages[dayPhase] ??
    seasonImages.noon ??
    DEFAULT_SANDBOX_BACKGROUND_PATH;
  const hourHandStartDegrees = dayPhaseIndex * 180;

  return {
    cycleStep: normalizedStep,
    season,
    dayPhase,
    seasonIndex,
    dayPhaseIndex,
    hourHandStartDegrees,
    hourHandEndDegrees: hourHandStartDegrees + 180,
    minuteHandStartDegrees: 0,
    minuteHandEndDegrees: 360,
    imagePath,
    fallbackImagePath: DEFAULT_SANDBOX_BACKGROUND_PATH,
  };
}

function createSandboxBackgroundStyle(
  background: SandboxBackgroundState,
): CSSProperties {
  const phaseVisual = sandboxDayPhaseVisuals[background.dayPhase];
  const seasonVisual = sandboxSeasonVisuals[background.season];

  return {
    "--sandbox-world-background": `url("${background.imagePath}")`,
    "--sandbox-world-background-fallback": `url("${background.fallbackImagePath}")`,
    "--sandbox-background-brightness": String(phaseVisual.brightness),
    "--sandbox-background-opacity": String(phaseVisual.opacity),
    "--sandbox-background-saturation": String(
      seasonVisual?.saturation ?? phaseVisual.saturation,
    ),
  } as CSSProperties;
}

function createSandboxClockStyle(background: SandboxBackgroundState): CSSProperties {
  return {
    "--sandbox-clock-hour-start": `${background.hourHandStartDegrees}deg`,
    "--sandbox-clock-hour-end": `${background.hourHandEndDegrees}deg`,
    "--sandbox-clock-minute-start": `${background.minuteHandStartDegrees}deg`,
    "--sandbox-clock-minute-end": `${background.minuteHandEndDegrees}deg`,
  } as CSSProperties;
}

function createEventHeadline(event: WorldEvent, primaryCharacterName: string): string {
  if (event.participantCharacterIds.length > 1) {
    return `${primaryCharacterName}を中心に、小さな出来事が広がっています`;
  }

  return `${primaryCharacterName}のそばで、いま気になる変化が起きています`;
}

function resolveResidentSpriteSheetMetadata(
  motionMetadata: { frameWidth: number; frameHeight: number; columns: number; rows: number; motions: object } | null | undefined,
  extendedMetadata: { frameWidth: number; frameHeight: number; columns: number; rows: number; motions: object } | null | undefined,
  motion: ResidentMotionKey,
  extendedSheetAvailable: boolean,
): ResidentViewModel["spriteSheetMetadata"] {
  const useExtended = extendedSheetAvailable && EXTENDED_SHEET_MOTIONS.has(motion);
  const active = useExtended ? extendedMetadata : motionMetadata;
  if (!active) return null;

  const slots = active.motions as Record<string, { row: number; frames: number } | undefined>;
  const slot = slots[motion] ?? slots.idle;
  return {
    frameWidth: active.frameWidth,
    frameHeight: active.frameHeight,
    columns: active.columns,
    rows: active.rows,
    row: slot?.row ?? 0,
    frames: slot?.frames ?? active.columns,
  };
}

function resolveSandboxResidentMotion(input: {
  emote: EmoteKind;
  isPrimary: boolean;
  latestOutcome: InterventionOutcome | null;
  movementDirection: ResidentMovementState["direction"];
  residentVisualPaused: boolean;
}): ResidentMotionKey {
  if (input.residentVisualPaused) {
    return "waiting";
  }

  if (input.latestOutcome?.interventionType === "trial" && input.isPrimary) {
    return "failed";
  }

  const hasUiSignalEmote =
    input.emote === "event-alert" || input.emote === "talk-request";
  if (input.movementDirection !== null && hasUiSignalEmote) {
    return resolveResidentMotion(null, input.residentVisualPaused, input.movementDirection);
  }

  if (input.emote === "event-alert") {
    return "review";
  }

  if (input.emote === "talk-request") {
    return "waving";
  }

  return resolveResidentMotion(
    input.emote,
    input.residentVisualPaused,
    input.movementDirection,
  );
}

function isVariableWidthFailedResident(resident: ResidentViewModel): boolean {
  return resident.motion === "failed" && resident.spriteSheetMetadata?.frames === 5;
}

function createResidentStyle(resident: ResidentViewModel): CSSProperties {
  const useExtended = EXTENDED_SHEET_MOTIONS.has(resident.motion) && resident.extendedSheetPath !== null;
  const activeSheetPath = useExtended ? resident.extendedSheetPath : resident.spriteSheetPath;
  if (!activeSheetPath) return {};

  const metadata = resident.spriteSheetMetadata;
  const failedFrameMaxSpan = isVariableWidthFailedResident(resident) ? 2 : 1;
  const displayScale = resolveResidentDisplayScale(metadata);

  return {
    "--resident-sprite-sheet": `url("${activeSheetPath}")`,
    "--resident-frame-width": metadata ? `${metadata.frameWidth}px` : undefined,
    "--resident-frame-height": metadata ? `${metadata.frameHeight}px` : undefined,
    "--resident-frame-max-span": failedFrameMaxSpan,
    "--resident-display-scale": displayScale.toFixed(3),
    "--resident-sheet-width": metadata
      ? `${metadata.frameWidth * metadata.columns}px`
      : undefined,
    "--resident-sheet-height": metadata
      ? `${metadata.frameHeight * metadata.rows}px`
      : undefined,
    "--resident-sheet-x-end": metadata
      ? `-${metadata.frameWidth * metadata.frames}px`
      : undefined,
    "--resident-motion-row": metadata
      ? `-${metadata.row * metadata.frameHeight}px`
      : undefined,
    "--resident-sprite-frames": metadata?.frames,
} as CSSProperties;
}

function resolveResidentDisplayScale(metadata: ResidentSpriteMetadata | null): number {
  if (!metadata) {
    return 1.5;
  }

  if (metadata.frameWidth === 148 && metadata.frameHeight === 144 && metadata.columns === 6) {
    return 1.0;
  }

  if (metadata.frameWidth === 156 && metadata.frameHeight === 144 && metadata.columns === 4) {
    return 1.82;
  }

  if (metadata.frameWidth === 180 && metadata.frameHeight === 170 && metadata.columns === 4) {
    return 1.5;
  }

  return 1.5;
}

function resolveResidentEmoteTopInset(metadata: ResidentSpriteMetadata | null): number {
  if (!metadata) {
    return 0;
  }

  if (metadata.frameWidth === 148 && metadata.frameHeight === 144) {
    return 18;
  }

  if (metadata.frameWidth === 156 && metadata.frameHeight === 144) {
    return 18;
  }

  if (metadata.frameWidth === 180 && metadata.frameHeight === 170) {
    return 24;
  }

  if (metadata.frameWidth === 118 && metadata.frameHeight === 136) {
    return 12;
  }

  if (metadata.frameWidth === 127 && metadata.frameHeight === 126) {
    return 4;
  }

  return 0;
}

function createResidentPlacementStyle(
  resident: ResidentViewModel,
  viewportWidth: number,
): CSSProperties {
  const perspective = resolveResidentPerspective(resident.movement.y);
  const safeLeft = resolveResidentSafeLeftPercent(
    resident,
    perspective.scale,
    viewportWidth,
  );

  return {
    left: `${safeLeft}%`,
    top: `${resident.movement.y}%`,
    "--resident-scale": perspective.scale.toFixed(3),
    "--resident-shadow-scale": perspective.shadowScale.toFixed(3),
    zIndex: perspective.zIndex,
  } as CSSProperties;
}

function resolveResidentSafeLeftPercent(
  resident: ResidentViewModel,
  perspectiveScale: number,
  viewportWidth: number,
): number {
  if (
    viewportWidth <= 0 ||
    resident.visualMode !== "sprite" ||
    !resident.spriteSheetMetadata
  ) {
    return resident.movement.x;
  }

  const frameSpan = isVariableWidthFailedResident(resident) ? 2 : 1;
  const displayScale = resolveResidentDisplayScale(resident.spriteSheetMetadata);
  const baseWidth =
    resident.spriteSheetMetadata.frameWidth * frameSpan * displayScale;
  const scaleOverflow = Math.max(0, (baseWidth * perspectiveScale - baseWidth) / 2);
  const minLeftPx = RESIDENT_VIEWPORT_EDGE_CLEARANCE_PX + scaleOverflow;
  const maxLeftPx =
    viewportWidth -
    RESIDENT_VIEWPORT_EDGE_CLEARANCE_PX -
    baseWidth -
    scaleOverflow;

  if (maxLeftPx <= minLeftPx) {
    const centeredLeftPx = Math.max(0, (viewportWidth - baseWidth) / 2);
    return clamp((centeredLeftPx / viewportWidth) * 100, 0, 100);
  }

  return clamp(
    resident.movement.x,
    (minLeftPx / viewportWidth) * 100,
    (maxLeftPx / viewportWidth) * 100,
  );
}

function createDialogueBubblePlacementStyle(
  resident: ResidentViewModel,
  viewportSize: { width: number; height: number },
  placement?: DialogueAnchorPlacement,
): CSSProperties {
  if (placement) {
    const horizontalInsetPercent = resolveDialogueBubbleHorizontalInsetPercent(
      viewportSize.width,
    );

    return {
      left: `${clamp(placement.left, horizontalInsetPercent, 100 - horizontalInsetPercent)}%`,
      top: `${clamp(placement.top, 8, 84)}%`,
    } as CSSProperties;
  }

  const perspective = resolveResidentPerspective(resident.movement.y);
  const safeLeft = resolveResidentSafeLeftPercent(
    resident,
    perspective.scale,
    viewportSize.width,
  );
  const visualWidth = resolveResidentVisualWidthPx(resident, perspective.scale);
  const visualCenterOffset =
    viewportSize.width > 0 ? (visualWidth / 2 / viewportSize.width) * 100 : 0;
  const headInset = resolveResidentHeadInsetPercent(
    resident,
    perspective.scale,
    viewportSize.height,
  );
  const horizontalInsetPercent = resolveDialogueBubbleHorizontalInsetPercent(
    viewportSize.width,
  );

  return {
    left: `${clamp(
      safeLeft + visualCenterOffset,
      horizontalInsetPercent,
      100 - horizontalInsetPercent,
    )}%`,
    top: `${clamp(resident.movement.y + headInset, 8, 84)}%`,
  } as CSSProperties;
}

function resolveDialogueBubbleHorizontalInsetPercent(viewportWidth: number): number {
  const estimatedBubbleWidth = viewportWidth > 0 ? Math.min(220, viewportWidth * 0.48) : 180;
  return viewportWidth > 0
    ? clamp(((estimatedBubbleWidth / 2 + 12) / viewportWidth) * 100, 12, 34)
    : 18;
}

function resolveResidentVisualWidthPx(
  resident: ResidentViewModel,
  perspectiveScale: number,
): number {
  const metadata = resident.spriteSheetMetadata;
  if (!metadata) {
    return 96 * perspectiveScale;
  }

  const frameSpan = isVariableWidthFailedResident(resident) ? 2 : 1;
  return metadata.frameWidth * frameSpan * resolveResidentDisplayScale(metadata) * perspectiveScale;
}

function resolveResidentHeadInsetPercent(
  resident: ResidentViewModel,
  perspectiveScale: number,
  viewportHeight: number,
): number {
  const metadata = resident.spriteSheetMetadata;
  if (!metadata || viewportHeight <= 0) {
    return 0;
  }

  const insetPx =
    resolveResidentEmoteTopInset(metadata) *
    resolveResidentDisplayScale(metadata) *
    perspectiveScale;
  return (insetPx / viewportHeight) * 100;
}

function areDialogueAnchorPlacementsEqual(
  current: Record<string, DialogueAnchorPlacement>,
  next: Record<string, DialogueAnchorPlacement>,
): boolean {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) => {
    const currentPlacement = current[key];
    const nextPlacement = next[key];
    return (
      currentPlacement !== undefined &&
      Math.abs(currentPlacement.left - nextPlacement.left) < 0.2 &&
      Math.abs(currentPlacement.top - nextPlacement.top) < 0.2
    );
  });
}

function resolveResidentPerspective(y: number): {
  scale: number;
  shadowScale: number;
  zIndex: number;
} {
  const rawDepth = clamp(
    (y - RESIDENT_PERSPECTIVE_RANGE.minY) /
      (RESIDENT_PERSPECTIVE_RANGE.maxY - RESIDENT_PERSPECTIVE_RANGE.minY),
    0,
    1,
  );
  const depth = smoothPerspectiveDepth(rawDepth);

  return {
    scale: 0.52 + depth * 0.48,
    shadowScale: 0.62 + depth * 0.38,
    zIndex: Math.round(12 + depth * 56),
  };
}

function smoothPerspectiveDepth(depth: number): number {
  return depth * depth * depth * (depth * (depth * 6 - 15) + 10);
}

function describeChangeSet(
  characterId: string,
  appliedState: RuntimeWorldState,
  patch: Record<string, unknown>,
): string {
  const character = appliedState.characters.get(characterId);
  const label = character?.profile.displayName ?? characterId;
  const visiblePatch = createVisibleChangePatchForSandboxUi(patch);
  const delta = Object.entries(visiblePatch)
    .map(([key, value]) => `${key} ${Number(value) > 0 ? "+" : ""}${value}`)
    .join(", ");
  if (!delta) return `${label}: 内面に小さな変化が残りました`;
  return `${label}: ${delta}`;
}

function createOutcome(input: {
  currentEvent: WorldEvent;
  nextEvent: WorldEvent;
  interventionType: InterventionKind;
  changeSetCount: number;
  changeHighlights: string[];
  godPointsAfter: number;
}): InterventionOutcome {
  const nextPrimaryCharacterName =
    typeof input.nextEvent.structuredPayload?.primaryCharacterName === "string"
      ? input.nextEvent.structuredPayload.primaryCharacterName
      : "住民";

  const summaryTitle =
    input.interventionType === "help"
      ? "良い変化が箱庭に広がりました"
      : input.interventionType === "trial"
        ? "小さな試練が次の動きを生みました"
        : "見守ったぶんだけ、次の気配が見えました";

  const summaryBody =
    input.interventionType === "help"
      ? `${input.changeSetCount} 件の変化が積まれ、主役たちの空気がやわらぎました。`
      : input.interventionType === "trial"
        ? `${input.changeSetCount} 件の変化が積まれ、住民たちの背筋が少し伸びました。`
        : `${input.changeSetCount} 件の変化が積まれ、住民たちの気づきが増えました。`;

  return {
    eventId: input.currentEvent.id,
    interventionType: input.interventionType,
    summaryTitle,
    summaryBody,
    changeHighlights: input.changeHighlights,
    godPointsAfter: input.godPointsAfter,
    nextEventHeadline: createEventHeadline(input.nextEvent, nextPrimaryCharacterName),
  };
}
