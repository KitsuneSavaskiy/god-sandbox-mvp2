import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createSeedRuntimeWorld } from "../application/runtimeBootstrap.js";
import {
  issueCharacterPassportCommand,
  issueCharacterSnapshotCommand,
  replaceActiveSlotCommand,
} from "../application/runtimeCommands.js";
import {
  selectActiveCharacters,
  selectCurrentEvent,
  selectObservationPreset,
  selectPendingActivationCharacters,
  selectRoster,
} from "../application/runtimeSelectors.js";
import type { CharacterId } from "../domain/models.js";
import { addCharacterToRoster } from "../domain/session.js";
import { CharacterEditor } from "../features/character-creator/CharacterEditor";
import {
  applyDraftToCharacter,
  createCharacterFromDraft,
  type CharacterDraft,
} from "../features/character-creator/characterDraft";
import { SidekickSetupSurface } from "../features/sidekick/SidekickSetupSurface";
import {
  writeSidekickJobRequest,
  type SidekickRepoRootHandle,
} from "../features/sidekick/sidekickJobWriter";
import { LINE3_CHARACTER_TEMPLATE } from "../features/character-creator/characterTemplate";
import { EventFirstSandbox, type ActiveResidentPreview } from "../features/events/EventFirstSandbox.js";
import { DialoguePreviewSurface } from "../features/dialogue-preview/DialoguePreviewSurface";
import { ExternalHandoffSurface } from "../features/external-handoff/ExternalHandoffSurface";
import { PassportSurface } from "../features/passport/PassportSurface";
import { CharacterDetailPanel } from "../features/residents/CharacterDetailPanel";
import { RosterSurface } from "../features/roster/RosterSurface";
import { SnapshotSurface } from "../features/snapshot/SnapshotSurface";
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

type PanelId = "roster" | "logs";

const PLAYER_DISPLAY_NAME_STORAGE_KEY = "godsandbox.player-display-name.v1";

interface SandboxUiState {
  focusedEventId: string | null;
  detailCharacterId: CharacterId | null;
  drawerPanel: PanelId | null;
  routePath: string;
  tutorialStateId: string | null;
}

const panelLabels: Record<PanelId, string> = {
  roster: "住民",
  logs: "ログ",
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
    detailCharacterId: null,
    drawerPanel: null,
    routePath: getCurrentRoute().path,
    tutorialStateId: null,
  }));
  const [storyEntries, setStoryEntries] = useState<StoryLogEntry[]>([]);
  const [activeResidents, setActiveResidents] = useState<ActiveResidentPreview[]>([]);
  const [newcomerTutorialCompleted, setNewcomerTutorialCompleted] = useState(
    () => readTutorialState().newcomerCompleted,
  );
  const [sidekickDirHandle, setSidekickDirHandle] = useState<SidekickRepoRootHandle | null>(null);

  const manualSweepQuery = useMemo(
    () => (manualSweep.enabled ? "?mode=manual-sweep" : ""),
    [manualSweep.enabled],
  );
  const showSandboxDrawerButtons = route.id === "sandbox";

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
        drawerPanel: null,
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

  function toggleDrawer(panelId: PanelId) {
    setUiState((current) => {
      return {
        ...current,
        drawerPanel: current.drawerPanel === panelId ? null : panelId,
      };
    });
  }

  function closeDrawer() {
    setUiState((current) => ({
      ...current,
      drawerPanel: null,
    }));
  }

  function openCharacterDetail(characterId: CharacterId) {
    setUiState((current) => ({
      ...current,
      detailCharacterId: characterId,
    }));
  }

  function closeCharacterDetail() {
    setUiState((current) => ({
      ...current,
      detailCharacterId: null,
    }));
  }

  async function handleSidekickConnect() {
    const picker = (
      window as unknown as { showDirectoryPicker?: () => Promise<SidekickRepoRootHandle> }
    ).showDirectoryPicker;
    if (!picker) return;
    try {
      const handle = await picker();
      setSidekickDirHandle(handle);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.warn("[sidekick] connect failed:", e);
      }
    }
  }

  function handleSidekickDisconnect() {
    setSidekickDirHandle(null);
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

  function saveCharacterDraft(draft: CharacterDraft, portraitFile?: File) {
    const now = new Date().toISOString();

    setRuntimeState((current) => {
      const characters = new Map(current.characters);

      if (draft.id && characters.has(draft.id)) {
        const existing = characters.get(draft.id);
        if (!existing) {
          return current;
        }

        characters.set(draft.id, applyDraftToCharacter(existing, draft, LINE3_CHARACTER_TEMPLATE, now));
        return createRuntimeWorldState({ ...current, characters });
      }

      const characterId = createCharacterId(draft.displayName, now);
      const character = createCharacterFromDraft(draft, LINE3_CHARACTER_TEMPLATE, characterId, now);
      characters.set(character.id, character);

      return createRuntimeWorldState({
        ...current,
        characters,
        session: addCharacterToRoster(current.session, character.id),
      });
    });

    if (sidekickDirHandle) {
      writeSidekickJobRequest(sidekickDirHandle, {
        displayName: draft.displayName,
        personality: draft.personalityNote,
        tone: draft.speechStyleId,
        age: draft.age,
        portraitFile,
      }).catch((error: unknown) => {
        console.warn("[sidekick] job request write failed:", error);
      });
    }

    navigate("/roster");
  }

  function replaceActiveCharacter(slotIndex: number, characterId: CharacterId) {
    setRuntimeState((current) => replaceActiveSlotCommand(current, { slotIndex, characterId }));
  }

  function issueSnapshot(input: { characterId: CharacterId; memo?: string; tags: string[] }) {
    setRuntimeState(
      (current) =>
        issueCharacterSnapshotCommand(current, {
          characterId: input.characterId,
          snapshotId: createRecordId("snp", input.characterId),
          now: new Date().toISOString(),
          sourceEventId: current.session.currentEventId,
          annotationTags: input.tags,
          memo: input.memo,
        }).state,
    );
  }

  function issuePassport(snapshotId: string) {
    setRuntimeState(
      (current) =>
        issueCharacterPassportCommand(current, {
          snapshotId,
          passportId: createRecordId("psp", snapshotId),
          fileNameToken: createPassportFileNameToken(current, snapshotId),
          schemaVersion: 1,
          now: new Date().toISOString(),
        }).state,
    );
  }

  const detailCharacter = uiState.detailCharacterId
    ? runtimeState.characters.get(uiState.detailCharacterId)
    : undefined;

    if (!playerDisplayName) {
      return (
        <main className="login-screen">
          <section className="login-card" aria-labelledby="login-title">
            <p className="eyebrow">GOD SANDBOX MVP2</p>
            <h1 id="login-title">ようこそ箱庭の神様</h1>
            <p className="login-card__description">
              あなたは、この小さな世界を見守る神です。
              <br />
              名前を入力して、箱庭に降臨してください
            </p>
            <form className="login-form" onSubmit={handleLogin}>
              <label className="login-form__label" htmlFor="player-display-name">
                表示名
              </label>
              <input
                id="player-display-name"
                value={draftDisplayName}
                onChange={(event) => setDraftDisplayName(event.target.value)}
                placeholder="神の名を入力..."
              />
              <Button type="submit" variant="primary">
                はじめる
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

      <main className="shell-layout shell-layout--single">
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
            sidekickIsConnected={sidekickDirHandle !== null}
            sidekickFolderName={sidekickDirHandle?.name}
            onRuntimeStateChange={setRuntimeState}
            onFocusedEventIdChange={handleFocusedEventIdChange}
            onStoryEntriesChange={handleStoryEntriesChange}
            onActiveResidentsChange={handleActiveResidentsChange}
            onOpenCharacterDetail={openCharacterDetail}
            onTutorialStateChange={handleTutorialStateChange}
            onAcknowledgeNewcomerTutorial={acknowledgeNewcomerTutorial}
            onSidekickConnect={handleSidekickConnect}
            onSidekickDisconnect={handleSidekickDisconnect}
            onCancelEditor={() => navigate("/roster")}
            onEdit={(characterId) => navigate(`/character-editor/${encodeURIComponent(characterId)}`)}
            onIssuePassport={issuePassport}
            onIssueSnapshot={issueSnapshot}
            onNavigate={navigate}
            onReplaceActiveSlot={replaceActiveCharacter}
            onSaveCharacter={saveCharacterDraft}
          />
        </section>
      </main>

      {showSandboxDrawerButtons ? (
        <aside
          className={`edge-drawer${uiState.drawerPanel ? " edge-drawer--open" : ""}${
            uiState.drawerPanel ? ` edge-drawer--${uiState.drawerPanel}` : ""
          }`}
          aria-label="補助ドロワー"
        >
          <div className="edge-drawer__buttons">
            <Button
              type="button"
              className="edge-drawer__resident-button"
              onClick={() => toggleDrawer("roster")}
            >
              {panelLabels.roster}
            </Button>
            <Button
              type="button"
              className="edge-drawer__log-button"
              onClick={() => toggleDrawer("logs")}
            >
              {panelLabels.logs}
            </Button>
          </div>
          {uiState.drawerPanel ? (
            <div
              className="edge-drawer__panel"
              role="dialog"
              aria-label={`${panelLabels[uiState.drawerPanel]}ドロワー`}
            >
              <div className="edge-drawer__header">
                <strong>{panelLabels[uiState.drawerPanel]}</strong>
                <Button type="button" variant="ghost" onClick={closeDrawer}>
                  閉じる
                </Button>
              </div>
              <ShellPanel
                panelId={uiState.drawerPanel}
                runtimeState={runtimeState}
                storyEntries={storyEntries}
                activeResidents={activeResidents}
                onOpenCharacterDetail={openCharacterDetail}
                onNavigate={navigate}
              />
            </div>
          ) : null}
        </aside>
      ) : null}

      {detailCharacter ? (
        <CharacterDetailPanel
          character={detailCharacter}
          onClose={closeCharacterDetail}
        />
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
  sidekickIsConnected: boolean;
  sidekickFolderName: string | undefined;
  onRuntimeStateChange: (state: RuntimeWorldState) => void;
  onFocusedEventIdChange: (focusedEventId: string) => void;
  onStoryEntriesChange: (entries: StoryLogEntry[]) => void;
  onActiveResidentsChange: (residents: ActiveResidentPreview[]) => void;
  onOpenCharacterDetail: (characterId: CharacterId) => void;
  onTutorialStateChange: (tutorialStateId: string | null) => void;
  onAcknowledgeNewcomerTutorial: () => void;
  onSidekickConnect: () => void;
  onSidekickDisconnect: () => void;
  onCancelEditor: () => void;
  onEdit: (characterId: CharacterId) => void;
  onIssuePassport: (snapshotId: string) => void;
  onIssueSnapshot: (input: { characterId: CharacterId; memo?: string; tags: string[] }) => void;
  onNavigate: (path: string) => void;
  onReplaceActiveSlot: (slotIndex: number, characterId: CharacterId) => void;
  onSaveCharacter: (draft: CharacterDraft, portraitFile?: File) => void;
};

function PrimaryRouteSurface({
  route,
  runtimeState,
  storyEntries,
  newcomerTutorialCompleted,
  manualSweepEnabled,
  manualSweepRuntimeDirectory,
  sidekickIsConnected,
  sidekickFolderName,
  onRuntimeStateChange,
  onFocusedEventIdChange,
  onStoryEntriesChange,
  onActiveResidentsChange,
  onOpenCharacterDetail,
  onTutorialStateChange,
  onAcknowledgeNewcomerTutorial,
  onSidekickConnect,
  onSidekickDisconnect,
  onCancelEditor,
  onEdit,
  onIssuePassport,
  onIssueSnapshot,
  onNavigate,
  onReplaceActiveSlot,
  onSaveCharacter,
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
        onOpenCharacterDetail={onOpenCharacterDetail}
        onTutorialStateChange={onTutorialStateChange}
      />
    );
  }

  if (route.id === "roster") {
    return (
      <RosterSurface
        state={runtimeState}
        onAddNew={() => onNavigate("/character-editor/new")}
        onEdit={onEdit}
        onOpenDetail={onOpenCharacterDetail}
        onReplaceActiveSlot={onReplaceActiveSlot}
      />
    );
  }

  if (route.id === "character-editor") {
    const characterId = route.params?.characterId;
    const character = characterId && characterId !== "new" ? runtimeState.characters.get(characterId) : undefined;
    const mode =
      character && runtimeState.session.activeSlots.includes(character.id)
        ? "initial"
        : character
          ? "edit"
          : "new";

    if (characterId === "new" && !newcomerTutorialCompleted) {
      return (
        <NewCharacterTutorialSurface
          isFirstVisit
          onAcknowledge={onAcknowledgeNewcomerTutorial}
          onReturnToSandbox={() => onNavigate("/sandbox")}
        />
      );
    }

    return (
      <CharacterEditor
        character={character}
        mode={mode}
        onCancel={onCancelEditor}
        onSave={onSaveCharacter}
      />
    );
  }

  if (route.id === "passports" || route.id === "passport-detail") {
    return (
      <div className="route-stage route-stage--stack">
        <SnapshotSurface state={runtimeState} onIssueSnapshot={onIssueSnapshot} />
        <PassportSurface state={runtimeState} onIssuePassport={onIssuePassport} />
      </div>
    );
  }

  if (route.id === "sidekick-setup") {
    return (
      <SidekickSetupSurface
        isConnected={sidekickIsConnected}
        connectedFolderName={sidekickFolderName}
        supportsFileSystemAccess={typeof window !== "undefined" && "showDirectoryPicker" in window}
        onConnect={onSidekickConnect}
        onDisconnect={onSidekickDisconnect}
        onReturnToSandbox={() => onNavigate("/sandbox")}
      />
    );
  }

  if (route.id === "handoff") {
    return <ExternalHandoffSurface state={runtimeState} />;
  }

  if (route.id === "dialogue-preview") {
    return <DialoguePreviewSurface state={runtimeState} />;
  }

  if (route.id === "logs") {
    return <StoryLogPanel entries={storyEntries} />;
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
  onOpenCharacterDetail,
  onNavigate,
}: {
  panelId: PanelId;
  runtimeState: RuntimeWorldState;
  storyEntries: StoryLogEntry[];
  activeResidents: ActiveResidentPreview[];
  onOpenCharacterDetail: (characterId: CharacterId) => void;
  onNavigate: (path: string) => void;
}) {
  if (panelId === "logs") {
    return <StoryLogPanel entries={storyEntries} />;
  }

  if (panelId === "roster") {
    const roster = selectRoster(runtimeState);
    const pending = selectPendingActivationCharacters(runtimeState);
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
            住民一覧 {roster.length}名 / 待機中 {pending.length}名 / 箱庭にいる住民{" "}
            {runtimeState.session.activeSlots.length}名。
          </p>
          <div className="roster-preview__list">
            {residents.map((resident) => (
              <article key={resident.id} className="roster-preview__card">
                <div className="roster-preview__name-row">
                  <button
                    type="button"
                    className="character-icon-placeholder roster-preview__icon-button"
                    aria-label={`${resident.displayName}の詳細を開く`}
                    onClick={() => onOpenCharacterDetail(resident.id)}
                  >
                    {resident.displayName.slice(0, 1)}
                  </button>
                  <strong>{resident.displayName}</strong>
                </div>
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

  return <StoryLogPanel entries={storyEntries} />;
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

function createCharacterId(displayName: string, now: string): CharacterId {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chr_${slug || "resident"}_${Date.parse(now).toString(36)}`;
}

function createRecordId(prefix: string, sourceId: string): string {
  return `${prefix}_${sourceId.replace(/[^a-zA-Z0-9]+/g, "_")}_${Date.now().toString(36)}`;
}

function createPassportFileNameToken(state: RuntimeWorldState, snapshotId: string): string {
  const snapshot = state.snapshots.get(snapshotId);
  const name = String(snapshot?.character.profile.displayName ?? "character")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${name || "character"}--${snapshotId}`;
}
