import { useEffect, useMemo, useState } from "react";
import { applyFocusedEventInterventionCommand } from "../../application/runtimeCommands.js";
import {
  selectActiveCharacters,
  selectCurrentEvent,
  selectObservationPreset,
} from "../../application/runtimeSelectors.js";
import type { InterventionKind, WorldEvent } from "../../domain/models.js";
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

type ResidentViewModel = ActiveResidentPreview & {
  emote: EmoteKind;
  positionClassName: string;
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

interface EventFirstSandboxProps {
  runtimeState: RuntimeWorldState;
  routePath: string;
  manualSweepEnabled: boolean;
  manualSweepRuntimeDirectory: string;
  onRuntimeStateChange: (state: RuntimeWorldState) => void;
  onFocusedEventIdChange: (focusedEventId: string) => void;
  onStoryEntriesChange: (entries: StoryLogEntry[]) => void;
  onActiveResidentsChange: (residents: ActiveResidentPreview[]) => void;
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
  },
  {
    zoneLabel: "木陰の小道",
    presetLabel: "会話の気配",
    alertPriority: "高め",
    positionClassName: "event-first-sandbox__resident--two",
  },
  {
    zoneLabel: "風の見張り台",
    presetLabel: "変化に敏感",
    alertPriority: "ふつう",
    positionClassName: "event-first-sandbox__resident--three",
  },
  {
    zoneLabel: "灯りの広場",
    presetLabel: "賑わい観察",
    alertPriority: "ふつう",
    positionClassName: "event-first-sandbox__resident--four",
  },
];

const emoteLabels: Record<EmoteKind, string> = {
  joy: "嬉",
  anger: "怒",
  sadness: "涙",
  surprise: "驚",
  "talk-request": "話",
  "event-alert": "注",
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

  const currentEvent = selectCurrentEvent(runtimeState);
  const observationPreset = selectObservationPreset(runtimeState);
  const activeCharacters = selectActiveCharacters(runtimeState);

  const activeResidents = useMemo(
    () =>
      activeCharacters.map((character, index) => {
        const decoration = residentDecorations[index] ?? residentDecorations[0];
        const isPrimary = currentEvent.primaryCharacterId === character.id;
        const isSupporting =
          currentEvent.participantCharacterIds.includes(character.id) && !isPrimary;

        return {
          id: character.id,
          displayName: character.profile.displayName,
          zoneLabel: decoration.zoneLabel,
          presetLabel: decoration.presetLabel,
          alertPriority: decoration.alertPriority,
          isPrimary,
          isSupporting,
          positionClassName: decoration.positionClassName,
          emote: resolveResidentEmote({
            sandboxStage,
            isPrimary,
            isSupporting,
            latestOutcome,
          }),
          statusSummary: [
            `活力 ${character.state.status.vitality}`,
            `調和 ${character.state.status.harmony}`,
          ],
        } satisfies ResidentViewModel;
      }),
    [activeCharacters, currentEvent, latestOutcome, sandboxStage],
  );

  const primaryResident = activeResidents.find((resident) => resident.isPrimary);
  const supportingResidents = activeResidents.filter((resident) => resident.isSupporting);
  const tutorialBinding = getTutorialBinding(tutorialState, {
    routePath,
    stage: sandboxStage,
    eventWindowOpen,
  });
  const eventWindowInterventionTutorialActive =
    tutorialState.currentStepId === "intervene" && eventWindowOpen && !latestOutcome;

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
      {
        id: `${outcome.eventId}-${type}`,
        title: `${interventionLabels[type]}で変化が起きました`,
        detail: outcome.summaryBody,
        timestampLabel: "いま",
        tags: [interventionLabels[type], `${outcome.godPointsAfter} pt`],
        tone: "result",
      },
      ...currentEntries,
    ]);
    setTutorialState((currentTutorial) =>
      advanceTutorialStep(currentTutorial, "intervened"),
    );
  }

  function handleResultReviewed() {
    const nextEvent = selectCurrentEvent(runtimeState);
    setStoryEntries((currentEntries) => [
      {
        id: `${nextEvent.id}-arrived`,
        title: "次の出来事が前に出ました",
        detail: nextEvent.summary,
        timestampLabel: "つぎ",
        tags: ["新しい出来事", ...nextEvent.situationTags.slice(0, 2)],
        tone: "pause",
      },
      ...currentEntries,
    ]);
    setLatestOutcome(null);
    setEventWindowOpen(false);
    setSandboxStage("focused-event");
    setTutorialState((currentTutorial) =>
      advanceTutorialStep(currentTutorial, "result-reviewed"),
    );
  }

  return (
    <section className="event-first-sandbox">
      <div
        className={`event-first-sandbox__viewport event-first-sandbox__viewport--${sandboxStage}`}
        data-tutorial-anchor="tutorial-anchor-world"
        data-tutorial-highlighted={
          tutorialBinding?.anchorId === "tutorial-anchor-world" || undefined
        }
      >
        <div className="event-first-sandbox__sky" />
        <div className="event-first-sandbox__ground" />
        <div className="event-first-sandbox__pause-banner">
          {sandboxStage === "focused-event"
            ? "いまは出来事に注目しているので、箱庭の時間と歩き回りは少し止まっています。"
            : "変化を受け取ったあと、次の出来事へ向けて箱庭がまた動き出します。"}
        </div>

        {activeResidents.map((resident) => (
          <article
            key={resident.id}
            className={`event-first-sandbox__resident ${resident.positionClassName} ${
              sandboxStage === "focused-event" ? "event-first-sandbox__resident--paused" : ""
            }`}
          >
            <span className="event-first-sandbox__emote">
              {emoteLabels[resident.emote]}
            </span>
            <div className="event-first-sandbox__resident-card">
              <strong>{resident.displayName}</strong>
              <span>{resident.zoneLabel}</span>
              <span>
                {resident.isPrimary
                  ? "主役"
                  : resident.isSupporting
                    ? "脇役"
                    : "見守り中"}
              </span>
            </div>
          </article>
        ))}
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
        <div className="event-first-sandbox__resident-groups">
          <div>
            <span className="event-first-sandbox__group-label">主役</span>
            <strong>{primaryResident?.displayName ?? "未設定"}</strong>
            <p>{primaryResident?.zoneLabel ?? "箱庭中央"}</p>
          </div>
          <div>
            <span className="event-first-sandbox__group-label">脇役</span>
            <strong>
              {supportingResidents.length > 0
                ? supportingResidents.map((resident) => resident.displayName).join(" / ")
                : "今は主役のみ"}
            </strong>
            <p>
              {supportingResidents.length > 0
                ? "主役の出来事に重なる気配があります。"
                : "今回はこの子の様子が中心です。"}
            </p>
          </div>
        </div>
        <div className="event-first-sandbox__event-entry">
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
            <span>{eventWindowOpen || latestOutcome ? "イベント子画面を表示中" : "イベント詳細を見る"}</span>
          </Button>
          <p className="event-first-sandbox__hint">
            関わり方の選択はイベント子画面の中で行います。
          </p>
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
              <div className="event-first-sandbox__event-window-copy">
                <p className="eyebrow">イベント子画面</p>
                <h2 id="event-first-sandbox-event-window-title">
                  {createEventHeadline(currentEvent, primaryResident?.displayName ?? "住民")}
                </h2>
                <p>{currentEvent.summary}</p>
              </div>
              <div className="event-first-sandbox__event-details">
                <strong>観察プリセット</strong>
                <p>{observationPreset.summary}</p>
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

      {tutorialState.currentStepId === "intervene" ? (
        <TutorialOverlay
          stepId="03 / 04"
          title={
            eventWindowInterventionTutorialActive
              ? "子画面の中で関わり方を選びます"
              : "出来事の詳しい声を聞く番です"
          }
          body={
            eventWindowInterventionTutorialActive
              ? "見守る / 助ける / 試練 は、このイベント子画面の中だけにあります。いまの出来事カードには戻しません。"
              : "気になる出来事を開くと、神様がどう関わるかを選べます。見守る / 助ける / 試練 は、イベント子画面の中だけに表示されます。"
          }
          anchorLabel={
            eventWindowInterventionTutorialActive
              ? "見守る / 助ける / 試練"
              : "! イベント詳細を見る"
          }
          placement="top"
          primaryActionLabel={eventWindowInterventionTutorialActive ? undefined : "イベント詳細を見る"}
          onPrimaryAction={
            eventWindowInterventionTutorialActive ? undefined : () => setEventWindowOpen(true)
          }
          trailingContent={
            <span className="event-first-sandbox__tutorial-note">
              {eventWindowInterventionTutorialActive
                ? "子画面内の選択肢を1つ押すと結果へ進みます"
                : "まずは ! マーク付きの詳細ボタンを開きます"}
            </span>
          }
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

function createTimestamp(stepIndex: number): string {
  return `2026-05-04T08:${String(stepIndex).padStart(2, "0")}:00.000Z`;
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
