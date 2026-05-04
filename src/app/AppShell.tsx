import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createSeedRuntimeWorld } from "../application/runtimeBootstrap.js";
import {
  selectActiveCharacters,
  selectCurrentEvent,
  selectObservationPreset,
} from "../application/runtimeSelectors.js";
import { EventFirstSandbox, type ActiveResidentPreview } from "../features/events/EventFirstSandbox.js";
import { StoryLogPanel, type StoryLogEntry } from "../features/story/StoryLogPanel.js";
import { NewCharacterTutorialSurface } from "../features/tutorial/NewCharacterTutorialSurface.js";
import {
  persistTutorialState,
  readTutorialState,
  type TutorialState,
} from "../features/tutorial/tutorialStateMachine.js";
import { getManualSweepState } from "../platform/manualSweep.js";
import { navigationRoutes, parseRoute, type AppRoute } from "../routes/routes.js";
import { createRuntimeWorldState, type RuntimeWorldState } from "../state/runtimeState.js";
import { Button } from "../ui/Button.js";
import { Panel } from "../ui/Panel.js";

type PanelId = "roster" | "relations" | "logs" | "passport";

const PLAYER_DISPLAY_NAME_STORAGE_KEY = "godsandbox.player-display-name.v1";

interface SandboxUiState {
  focusedEventId: string | null;
  openPanels: PanelId[];
  mobileSheet: PanelId | null;
  routePath: string;
  tutorialStateId: string | null;
}

const panelLabels: Record<PanelId, string> = {
  roster: "住民",
  relations: "観察",
  logs: "ログ",
  passport: "記録",
};

function getCurrentRoute(): AppRoute {
  return parseRoute(window.location.pathname);
}

function readStoredPlayerDisplayName(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PLAYER_DISPLAY_NAME_STORAGE_KEY)?.trim() ?? "";
}

function createInitialRuntimeState(): RuntimeWorldState {
  const seedState = createSeedRuntimeWorld();
  const storedName = readStoredPlayerDisplayName();

  if (!storedName) {
    return seedState;
  }

  return createRuntimeWorldState({
    ...seedState,
    session: {
      ...seedState.session,
      playerDisplayName: storedName,
    },
  });
}

export function AppShell() {
  const [manualSweep] = useState(() => getManualSweepState(window.location.search));
  const [runtimeState, setRuntimeState] = useState<RuntimeWorldState>(() =>
    createInitialRuntimeState(),
  );
  const [playerDisplayName, setPlayerDisplayName] = useState(() =>
    readStoredPlayerDisplayName(),
  );
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [route, setRoute] = useState<AppRoute>(() => getCurrentRoute());
  const [uiState, setUiState] = useState<SandboxUiState>(() => ({
    focusedEventId: createInitialRuntimeState().session.currentEventId,
    openPanels: ["roster", "logs"],
    mobileSheet: null,
    routePath: getCurrentRoute().path,
    tutorialStateId: null,
  }));
  const [storyEntries, setStoryEntries] = useState<StoryLogEntry[]>([]);
  const [activeResidents, setActiveResidents] = useState<ActiveResidentPreview[]>([]);
  const [newcomerTutorialCompleted, setNewcomerTutorialCompleted] = useState(
    () => readTutorialState().newcomerCompleted,
  );

  const manualSweepQuery = useMemo(
    () => (manualSweep.enabled ? "?mode=manual-sweep" : ""),
    [manualSweep.enabled],
  );
  const showSupplementaryPanels = route.id === "sandbox";

  useEffect(() => {
    if (route.id === "character-editor" && route.params?.characterId === "new") {
      setUiState((current) => ({
        ...current,
        tutorialStateId: newcomerTutorialCompleted ? null : "newcomer-roster",
      }));
      return;
    }

    if (route.id !== "sandbox") {
      setUiState((current) => ({
        ...current,
        tutorialStateId: null,
        mobileSheet: null,
      }));
    }
  }, [newcomerTutorialCompleted, route]);

  const handleFocusedEventIdChange = useCallback((focusedEventId: string) => {
    setUiState((current) =>
      current.focusedEventId === focusedEventId ? current : { ...current, focusedEventId },
    );
  }, []);

  const handleStoryEntriesChange = useCallback((entries: StoryLogEntry[]) => {
    setStoryEntries(entries);
  }, []);

  const handleActiveResidentsChange = useCallback((residents: ActiveResidentPreview[]) => {
    setActiveResidents((current) =>
      areResidentPreviewsEqual(current, residents) ? current : residents,
    );
  }, []);

  const handleTutorialStateChange = useCallback((tutorialStateId: string | null) => {
    setUiState((current) =>
      current.tutorialStateId === tutorialStateId
        ? current
        : { ...current, tutorialStateId },
    );
  }, []);

  const navigate = useCallback(
    (path: string) => {
      const nextPath = path.includes("?") ? path : `${path}${manualSweepQuery}`;
      window.history.pushState({}, "", nextPath);
      const nextRoute = parseRoute(window.location.pathname);
      setRoute(nextRoute);
      setUiState((current) => ({
        ...current,
        routePath: nextRoute.path,
      }));
    },
    [manualSweepQuery],
  );

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftDisplayName.trim();
    if (!name) {
      return;
    }

    setPlayerDisplayName(name);
    window.localStorage.setItem(PLAYER_DISPLAY_NAME_STORAGE_KEY, name);
    setRuntimeState((current) =>
      createRuntimeWorldState({
        ...current,
        session: {
          ...current.session,
          playerDisplayName: name,
        },
      }),
    );
    navigate("/sandbox");
  }

  function togglePanel(panelId: PanelId) {
    setUiState((current) => {
      const isOpen = current.openPanels.includes(panelId);
      return {
        ...current,
        openPanels: isOpen
          ? current.openPanels.filter((openPanel) => openPanel !== panelId)
          : [...current.openPanels, panelId],
      };
    });
  }

  function openMobileSheet(panelId: PanelId) {
    setUiState((current) => ({
      ...current,
      mobileSheet: current.mobileSheet === panelId ? null : panelId,
    }));
  }

  function acknowledgeNewcomerTutorial() {
    const existing = readTutorialState();
    const next: TutorialState = {
      ...existing,
      activeFlowId: null,
      currentStepId: null,
      newcomerCompleted: true,
    };
    persistTutorialState(next);
    setNewcomerTutorialCompleted(true);
    setUiState((current) => ({
      ...current,
      tutorialStateId: null,
    }));
  }

  if (!playerDisplayName) {
    return (
      <main className="login-screen">
        <section className="login-card" aria-labelledby="login-title">
          <p className="eyebrow">GodSandbox MVP2</p>
          <h1 id="login-title">新米神様として箱庭を開く</h1>
          <p>
            ここでは、ログインは認証ではなくゲーム内表示名の入力だけです。入力した名前は、
            物語や案内が呼びかけるために使います。
          </p>
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="player-display-name">表示名</label>
            <input
              id="player-display-name"
              value={draftDisplayName}
              onChange={(event) => setDraftDisplayName(event.target.value)}
              placeholder="例: 新米神様"
            />
            <Button type="submit" variant="primary">
              箱庭へ入る
            </Button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-shell">
        <div>
          <p className="eyebrow">GodSandbox</p>
          <h1>{playerDisplayName}の箱庭</h1>
        </div>
        <nav className="top-shell__nav" aria-label="主要画面">
          {navigationRoutes.map((navRoute) => (
            <Button
              key={navRoute.path}
              type="button"
              variant={route.id === navRoute.id ? "primary" : "ghost"}
              onClick={() => navigate(navRoute.path)}
            >
              {navRoute.label}
            </Button>
          ))}
        </nav>
      </header>

      <main className={showSupplementaryPanels ? "shell-layout" : "shell-layout shell-layout--single"}>
        <section
          className={route.id === "sandbox" ? "sandbox-stage" : "route-stage"}
          aria-label={route.id === "sandbox" ? "箱庭主画面" : "現在の画面"}
        >
          <PrimaryRouteSurface
            route={route}
            runtimeState={runtimeState}
            storyEntries={storyEntries}
            newcomerTutorialCompleted={newcomerTutorialCompleted}
            manualSweepEnabled={manualSweep.enabled}
            manualSweepRuntimeDirectory={manualSweep.runtimeDirectory}
            onRuntimeStateChange={setRuntimeState}
            onFocusedEventIdChange={handleFocusedEventIdChange}
            onStoryEntriesChange={handleStoryEntriesChange}
            onActiveResidentsChange={handleActiveResidentsChange}
            onTutorialStateChange={handleTutorialStateChange}
            onAcknowledgeNewcomerTutorial={acknowledgeNewcomerTutorial}
            onNavigate={navigate}
          />
        </section>

        {showSupplementaryPanels ? (
          <aside className="desktop-panels" aria-label="補助パネル">
            <div className="panel-toggle-row">
              {(Object.keys(panelLabels) as PanelId[]).map((panelId) => (
                <Button key={panelId} type="button" onClick={() => togglePanel(panelId)}>
                  {uiState.openPanels.includes(panelId) ? "閉じる" : "開く"}{" "}
                  {panelLabels[panelId]}
                </Button>
              ))}
            </div>
            <div className="desktop-panels__grid">
              {uiState.openPanels.map((panelId) => (
                <ShellPanel
                  key={panelId}
                  panelId={panelId}
                  runtimeState={runtimeState}
                  storyEntries={storyEntries}
                  activeResidents={activeResidents}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </aside>
        ) : null}
      </main>

      {showSupplementaryPanels ? (
        <footer className="mobile-sheet-dock" aria-label="モバイル補助シート">
          <div className="mobile-sheet-dock__buttons">
            {(Object.keys(panelLabels) as PanelId[]).map((panelId) => (
              <Button key={panelId} type="button" onClick={() => openMobileSheet(panelId)}>
                {panelLabels[panelId]}
              </Button>
            ))}
          </div>
          {uiState.mobileSheet ? (
            <div className="mobile-sheet" role="dialog" aria-label={`${panelLabels[uiState.mobileSheet]}シート`}>
              <ShellPanel
                panelId={uiState.mobileSheet}
                runtimeState={runtimeState}
                storyEntries={storyEntries}
                activeResidents={activeResidents}
                onNavigate={navigate}
              />
            </div>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

type PrimaryRouteSurfaceProps = {
  route: AppRoute;
  runtimeState: RuntimeWorldState;
  storyEntries: StoryLogEntry[];
  newcomerTutorialCompleted: boolean;
  manualSweepEnabled: boolean;
  manualSweepRuntimeDirectory: string;
  onRuntimeStateChange: (state: RuntimeWorldState) => void;
  onFocusedEventIdChange: (focusedEventId: string) => void;
  onStoryEntriesChange: (entries: StoryLogEntry[]) => void;
  onActiveResidentsChange: (residents: ActiveResidentPreview[]) => void;
  onTutorialStateChange: (tutorialStateId: string | null) => void;
  onAcknowledgeNewcomerTutorial: () => void;
  onNavigate: (path: string) => void;
};

function PrimaryRouteSurface({
  route,
  runtimeState,
  storyEntries,
  newcomerTutorialCompleted,
  manualSweepEnabled,
  manualSweepRuntimeDirectory,
  onRuntimeStateChange,
  onFocusedEventIdChange,
  onStoryEntriesChange,
  onActiveResidentsChange,
  onTutorialStateChange,
  onAcknowledgeNewcomerTutorial,
  onNavigate,
}: PrimaryRouteSurfaceProps) {
  if (route.id === "sandbox") {
    return (
      <EventFirstSandbox
        runtimeState={runtimeState}
        routePath={route.path}
        manualSweepEnabled={manualSweepEnabled}
        manualSweepRuntimeDirectory={manualSweepRuntimeDirectory}
        onRuntimeStateChange={onRuntimeStateChange}
        onFocusedEventIdChange={onFocusedEventIdChange}
        onStoryEntriesChange={onStoryEntriesChange}
        onActiveResidentsChange={onActiveResidentsChange}
        onTutorialStateChange={onTutorialStateChange}
      />
    );
  }

  if (route.id === "character-editor" && route.params?.characterId === "new") {
    return (
      <NewCharacterTutorialSurface
        isFirstVisit={!newcomerTutorialCompleted}
        onAcknowledge={onAcknowledgeNewcomerTutorial}
        onReturnToSandbox={() => onNavigate("/sandbox")}
      />
    );
  }

  if (route.id === "logs") {
    return <StoryLogPanel entries={storyEntries} />;
  }

  if (route.id === "roster") {
    const activeCharacters = selectActiveCharacters(runtimeState);
    const pendingCount = runtimeState.session.pendingActivationCharacterIds.length;

    return (
      <Panel title="住民の見取り図">
        <div className="route-stack">
          <p className="panel-note">
            activeSlots[4] は常に 4 名です。新しい住民は、まず住民一覧へ入り、あとで 1 名だけ入れ替えます。
          </p>
          <div className="roster-preview__list">
            {activeCharacters.map((character) => (
              <article key={character.id} className="roster-preview__card">
                <strong>{character.profile.displayName}</strong>
                <span>活力 {character.state.status.vitality}</span>
                <span>調和 {character.state.status.harmony}</span>
              </article>
            ))}
          </div>
          <p className="panel-route-note">待機中の新しい住民: {pendingCount}名</p>
          <div className="panel-action-stack">
            <Button type="button" variant="primary" onClick={() => onNavigate("/character-editor/new")}>
              新しい住民を迎える
            </Button>
            <Button type="button" variant="ghost" onClick={() => onNavigate("/sandbox")}>
              箱庭へ戻る
            </Button>
          </div>
        </div>
      </Panel>
    );
  }

  if (route.id === "relations") {
    const preset = selectObservationPreset(runtimeState);
    const currentEvent = selectCurrentEvent(runtimeState);

    return (
      <Panel title="観察プリセット">
        <div className="route-stack">
          <p className="panel-note">
            いまは <strong>{currentEvent.summary}</strong> を中心に見ています。主画面ではこの出来事が最優先です。
          </p>
          <div className="preset-preview">
            <strong>{preset.summary}</strong>
            <div className="preset-preview__tags">
              {preset.worldStatusTags.map((tag) => (
                <span key={`world-${tag}`}>世界: {tag}</span>
              ))}
              {preset.eventSituationTags.map((tag) => (
                <span key={`event-${tag}`}>出来事: {tag}</span>
              ))}
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={() => onNavigate("/sandbox")}>
            箱庭へ戻る
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={route.label}>
      <div className="route-placeholder">
        <p>
          この route は補助面の受け口です。今回の主導線は `/sandbox` の event-first 体験に絞っています。
        </p>
        <Button type="button" variant="primary" onClick={() => onNavigate("/sandbox")}>
          箱庭へ戻る
        </Button>
      </div>
    </Panel>
  );
}

function ShellPanel({
  panelId,
  runtimeState,
  storyEntries,
  activeResidents,
  onNavigate,
}: {
  panelId: PanelId;
  runtimeState: RuntimeWorldState;
  storyEntries: StoryLogEntry[];
  activeResidents: ActiveResidentPreview[];
  onNavigate: (path: string) => void;
}) {
  if (panelId === "logs") {
    return <StoryLogPanel entries={storyEntries} />;
  }

  if (panelId === "roster") {
    const fallbackResidents = selectActiveCharacters(runtimeState).map((character) => ({
      id: character.id,
      displayName: character.profile.displayName,
      zoneLabel: "箱庭のどこか",
      presetLabel: "観察中",
      alertPriority: "ふつう",
      isPrimary: false,
      isSupporting: false,
      statusSummary: [
        `活力 ${character.state.status.vitality}`,
        `調和 ${character.state.status.harmony}`,
      ],
    }));
    const residents = activeResidents.length > 0 ? activeResidents : fallbackResidents;

    return (
      <Panel title="住民">
        <div className="roster-preview">
          <p className="panel-note">
            いま箱庭に出ている 4 人です。主役と脇役の見分けは sandbox 側と揃えています。
          </p>
          <div className="roster-preview__list">
            {residents.map((resident) => (
              <article key={resident.id} className="roster-preview__card">
                <strong>{resident.displayName}</strong>
                <span>{resident.zoneLabel}</span>
                <span>
                  {resident.isPrimary
                    ? "主役"
                    : resident.isSupporting
                      ? "脇役"
                      : "見守り中"}
                </span>
              </article>
            ))}
          </div>
          <div className="panel-action-stack">
            <Button type="button" variant="ghost" onClick={() => onNavigate("/roster")}>
              住民一覧を開く
            </Button>
            <Button type="button" variant="ghost" onClick={() => onNavigate("/character-editor/new")}>
              新しい住民を迎える
            </Button>
          </div>
        </div>
      </Panel>
    );
  }

  if (panelId === "relations") {
    const preset = selectObservationPreset(runtimeState);

    return (
      <Panel title="観察">
        <div className="preset-preview">
          <strong>{preset.summary}</strong>
          <p className="panel-note">
            観察プリセットは selector の返り値をそのまま使い、見た目だけ UI で差を付けています。
          </p>
          <div className="preset-preview__tags">
            {preset.worldStatusTags.map((tag) => (
              <span key={`world-${tag}`}>世界: {tag}</span>
            ))}
            {preset.eventSituationTags.map((tag) => (
              <span key={`event-${tag}`}>出来事: {tag}</span>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="記録">
      <div className="panel-action-stack">
        <p className="panel-note">
          Snapshot と Passport は別ステップのままです。この PBI では発行 UI へ踏み込みません。
        </p>
        <Button type="button" variant="ghost" onClick={() => onNavigate("/passports")}>
          記録 route を開く
        </Button>
      </div>
    </Panel>
  );
}

function areResidentPreviewsEqual(
  left: ActiveResidentPreview[],
  right: ActiveResidentPreview[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((resident, index) => {
    const other = right[index];
    if (!other) {
      return false;
    }

    return (
      resident.id === other.id &&
      resident.displayName === other.displayName &&
      resident.zoneLabel === other.zoneLabel &&
      resident.presetLabel === other.presetLabel &&
      resident.alertPriority === other.alertPriority &&
      resident.isPrimary === other.isPrimary &&
      resident.isSupporting === other.isSupporting &&
      resident.statusSummary.join("|") === other.statusSummary.join("|")
    );
  });
}
