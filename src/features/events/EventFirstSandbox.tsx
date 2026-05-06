import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { selectActiveCharacterAssetBundleReadModels } from "../../application/characterAssetBundles.js";
import { applyFocusedEventInterventionCommand } from "../../application/runtimeCommands.js";
import {
  selectActiveCharacters,
  selectCurrentEvent,
  selectObservationPreset,
} from "../../application/runtimeSelectors.js";
import type { CharacterId, InterventionKind, WorldEvent } from "../../domain/models.js";
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
import { createTimestamp } from "./EventFirstSandboxTimestamp.js";
import "./EventFirstSandbox.css";

type EmoteKind =
  | "joy"
  | "anger"
  | "sadness"
  | "surprise"
  | "talk-request"
  | "event-alert";

type ResidentDecoration = {
  zoneLabel: string;
  presetLabel: string;
  alertPriority: string;
  positionClassName: string;
  depthClassName: string;
};

type ResidentMotionKey =
  | "idle"
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

type ResidentViewModel = ActiveResidentPreview & {
  emote: EmoteKind;
  positionClassName: string;
  depthClassName: string;
  motion: ResidentMotionKey;
  visualMode: "sprite" | "portrait" | "icon" | "placeholder";
  portraitPath: string | null;
  iconPath: string | null;
  spriteSheetPath: string | null;
  spriteSheetMetadata: {
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    row: number;
    frames: number;
  } | null;
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

const emoteLabels: Record<EmoteKind, string> = {
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
  const [backgroundCycleStep, setBackgroundCycleStep] = useState(() =>
    sandboxDayPhases.indexOf("noon"),
  );
  const apostleMotionRef = useRef(apostleMotion);
  const previousBackgroundRef = useRef<SandboxBackgroundState | null>(null);
  const backgroundFadeTimeoutRef = useRef<number | null>(null);
  const [previousSandboxBackground, setPreviousSandboxBackground] =
    useState<SandboxBackgroundState | null>(null);

  const currentEvent = selectCurrentEvent(runtimeState);
  const observationPreset = selectObservationPreset(runtimeState);
  const activeCharacters = selectActiveCharacters(runtimeState);
  const activeAssetBundles = useMemo(
    () => selectActiveCharacterAssetBundleReadModels(runtimeState),
    [runtimeState],
  );
  const sandboxPaused = eventWindowOpen || Boolean(latestOutcome);

  const activeResidents = useMemo(
    () =>
      activeCharacters.map((character, index) => {
        const decoration = residentDecorations[index] ?? residentDecorations[0];
        const assetBundle = activeAssetBundles[index];
        const isPrimary = currentEvent.primaryCharacterId === character.id;
        const isSupporting =
          currentEvent.participantCharacterIds.includes(character.id) && !isPrimary;
        const spriteSheetPath =
          assetBundle?.spriteSheet.ready &&
          assetBundle.spriteSheet.path
            ? assetBundle.spriteSheet.path
            : null;
        const portraitPath =
          assetBundle?.portrait.ready && assetBundle.portrait.path
            ? assetBundle.portrait.path
            : null;
        const iconPath =
          assetBundle?.icon.ready && assetBundle.icon.path ? assetBundle.icon.path : null;
        const motion = resolveResidentMotion({
          residentIndex: index,
          isPaused: sandboxPaused,
          isPrimary,
          isSupporting,
          latestOutcome,
        });
        const spriteSheetMetadata = spriteSheetPath
          ? resolveResidentSpriteSheetMetadata(assetBundle?.spriteSheet.metadata, motion)
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
          emote: resolveResidentEmote({
            sandboxStage,
            isPrimary,
            isSupporting,
            latestOutcome,
          }),
          motion,
          visualMode: spriteSheetPath
            ? "sprite"
            : portraitPath
              ? "portrait"
              : iconPath
                ? "icon"
                : "placeholder",
          portraitPath,
          iconPath,
          spriteSheetPath,
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
      currentEvent,
      latestOutcome,
      sandboxPaused,
      sandboxStage,
    ],
  );

  const primaryResident = activeResidents.find((resident) => resident.isPrimary);
  const primaryResidentId = primaryResident?.id ?? activeResidents[0]?.id;
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

  useEffect(() => {
    apostleMotionRef.current = apostleMotion;
  }, [apostleMotion]);

  useEffect(() => {
    if (backgroundCyclePaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setBackgroundCycleStep((currentStep) => currentStep + 1);
    }, SANDBOX_BACKGROUND_PHASE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [backgroundCyclePaused]);

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

  function handleTutorialContinue() {
    setTutorialState((current) => advanceTutorialStep(current, "continue"));
  }

  function handleIntervention(type: InterventionKind) {
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

    if (eventWindowOpen || latestOutcome) {
      return;
    }

    setEventWindowOpen(true);
  }

  return (
    <section className="event-first-sandbox">
      <div
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
            <span className="event-first-sandbox__clock-mark event-first-sandbox__clock-mark--zero">
              0
            </span>
            <span className="event-first-sandbox__clock-mark event-first-sandbox__clock-mark--three">
              3
            </span>
            <span className="event-first-sandbox__clock-mark event-first-sandbox__clock-mark--six">
              6
            </span>
            <span className="event-first-sandbox__clock-mark event-first-sandbox__clock-mark--nine">
              9
            </span>
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
        <div className="event-first-sandbox__sky" />
        <div className="event-first-sandbox__ground" />

        {activeResidents.map((resident) => (
          <article
            key={resident.id}
            className={`event-first-sandbox__resident event-first-sandbox__resident--clickable ${resident.positionClassName} ${resident.depthClassName} event-first-sandbox__resident--visual-${resident.visualMode} event-first-sandbox__resident--motion-${resident.motion} ${
              resident.spriteSheetPath
                ? "event-first-sandbox__resident--sprite-ready"
                : "event-first-sandbox__resident--sprite-fallback"
            } ${
              sandboxPaused ? "event-first-sandbox__resident--paused" : ""
            }`}
            data-resident-depth={resident.depthClassName.replace(
              "event-first-sandbox__resident--depth-",
              "",
            )}
            data-resident-motion={resident.motion}
            data-resident-visual={resident.visualMode}
            style={createResidentStyle(resident)}
          >
            {resident.emote === "event-alert" ? (
              <button
                type="button"
                className={`event-first-sandbox__emote event-first-sandbox__emote--${resident.emote}`}
                aria-label="イベント子画面を開く"
                aria-haspopup="dialog"
                aria-expanded={eventWindowOpen || latestOutcome !== null}
                disabled={eventWindowOpen || latestOutcome !== null}
                onClick={handleEventAlertBubbleClick}
              >
                {emoteLabels[resident.emote]}
              </button>
            ) : (
              <span
                className={`event-first-sandbox__emote event-first-sandbox__emote--${resident.emote}`}
              >
                {emoteLabels[resident.emote]}
              </span>
            )}
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
          </article>
        ))}
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
                    onClick={() => setEventWindowOpen(true)}
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
              <div
                className="event-first-sandbox__event-image-placeholder"
                aria-label="イベント画像の仮枠"
              >
                <strong>イベント画像</strong>
                <span>ここに出来事の絵が入ります</span>
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
                {(Object.keys(interventionLabels) as InterventionKind[]).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={type === "help" ? "primary" : "secondary"}
                    className={`event-first-sandbox__intervention-button event-first-sandbox__intervention-button--${type}`}
                    onClick={() => handleIntervention(type)}
                  >
                    {interventionLabels[type]}
                  </Button>
                ))}
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
  return {
    "--sandbox-world-background": `url("${background.imagePath}")`,
    "--sandbox-world-background-fallback": `url("${background.fallbackImagePath}")`,
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

function resolveResidentEmote(input: {
  sandboxStage: SandboxExperienceStage;
  isPrimary: boolean;
  isSupporting: boolean;
  latestOutcome: InterventionOutcome | null;
}): EmoteKind {
  if (input.sandboxStage === "focused-event") {
    if (input.isPrimary) {
      return "event-alert";
    }
    if (input.isSupporting) {
      return "talk-request";
    }
    return "joy";
  }

  if (!input.latestOutcome) {
    return "joy";
  }

  if (input.latestOutcome.interventionType === "help") {
    return input.isPrimary ? "joy" : input.isSupporting ? "surprise" : "talk-request";
  }

  if (input.latestOutcome.interventionType === "trial") {
    return input.isPrimary ? "anger" : input.isSupporting ? "surprise" : "sadness";
  }

  return input.isPrimary ? "talk-request" : "joy";
}

function resolveResidentMotion(input: {
  residentIndex: number;
  isPaused: boolean;
  isPrimary: boolean;
  isSupporting: boolean;
  latestOutcome: InterventionOutcome | null;
}): ResidentViewModel["motion"] {
  if (input.isPaused) {
    return "idle";
  }

  if (input.latestOutcome?.interventionType === "help") {
    return input.isPrimary ? "emote-happy" : "walk-forward";
  }

  if (input.latestOutcome?.interventionType === "trial") {
    return input.isPrimary ? "emote-angry" : "walk-back";
  }

  if (input.latestOutcome?.interventionType === "watch") {
    return input.isPrimary ? "emote-surprised" : "idle";
  }

  if (input.isPrimary) {
    return "walk-forward";
  }

  if (input.isSupporting) {
    return input.residentIndex % 2 === 0 ? "walk-left" : "walk-right";
  }

  const patrolMotions = [
    "walk-right",
    "walk-left",
    "walk-down",
    "walk-up",
  ] as const satisfies readonly ResidentMotionKey[];
  return patrolMotions[input.residentIndex % patrolMotions.length];
}

function resolveResidentSpriteSheetMetadata(
  metadata: {
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    motions: object;
  } | null | undefined,
  motion: ResidentMotionKey,
): ResidentViewModel["spriteSheetMetadata"] {
  if (!metadata) {
    return null;
  }

  const motionSlots = metadata.motions as Record<
    string,
    { row: number; frames: number } | undefined
  >;
  const motionSlot =
    motionSlots[motion] ??
    motionSlots[motion.startsWith("walk") ? "walk" : "idle"] ??
    motionSlots.idle;

  return {
    frameWidth: metadata.frameWidth,
    frameHeight: metadata.frameHeight,
    columns: metadata.columns,
    rows: metadata.rows,
    row: motionSlot?.row ?? 0,
    frames: motionSlot?.frames ?? metadata.columns,
  };
}

function createResidentStyle(resident: ResidentViewModel): CSSProperties {
  if (!resident.spriteSheetPath) {
    return {};
  }

  const metadata = resident.spriteSheetMetadata;

  return {
    "--resident-sprite-sheet": `url("${resident.spriteSheetPath}")`,
    "--resident-frame-size": metadata ? `${metadata.frameWidth}px` : undefined,
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

function describeChangeSet(
  characterId: string,
  appliedState: RuntimeWorldState,
  patch: Record<string, unknown>,
): string {
  const character = appliedState.characters.get(characterId);
  const label = character?.profile.displayName ?? characterId;
  const delta = Object.entries(patch)
    .map(([key, value]) => `${key} ${Number(value) > 0 ? "+" : ""}${value}`)
    .join(", ");
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
