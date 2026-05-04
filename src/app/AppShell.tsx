import { FormEvent, useMemo, useState } from "react";
import { getManualSweepState } from "../platform/manualSweep";
import { navigationRoutes, parseRoute, type AppRoute } from "../routes/routes";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

type PanelId = "roster" | "relations" | "logs" | "passport";

interface FocusedEventPreview {
  id: string;
  title: string;
  summary: string;
  participantLabels: string[];
}

interface SandboxUiState {
  focusedEventId: string | null;
  openPanels: PanelId[];
  mobileSheet: PanelId | null;
  routePath: string;
}

const focusedEvent: FocusedEventPreview = {
  id: "event-first-sprout",
  title: "朝の泉で、小さな迷いが生まれています",
  summary:
    "住民たちはまだ仮の姿です。ここは Line 2 以降の event runtime を受け取るための focusedEvent 枠です。",
  participantLabels: ["Aki", "Rin"]
};

const panelLabels: Record<PanelId, string> = {
  roster: "住民",
  relations: "関係",
  logs: "ログ",
  passport: "Passport"
};

function getCurrentRoute(): AppRoute {
  return parseRoute(window.location.pathname);
}

export function AppShell() {
  const [playerDisplayName, setPlayerDisplayName] = useState("");
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [route, setRoute] = useState<AppRoute>(() => getCurrentRoute());
  const [uiState, setUiState] = useState<SandboxUiState>(() => ({
    focusedEventId: focusedEvent.id,
    openPanels: ["roster", "logs"],
    mobileSheet: null,
    routePath: getCurrentRoute().path
  }));

  const manualSweep = useMemo(() => getManualSweepState(window.location.search), []);

  function navigate(path: string) {
    window.history.pushState({}, "", path);
    const nextRoute = parseRoute(window.location.pathname);
    setRoute(nextRoute);
    setUiState((current) => ({ ...current, routePath: nextRoute.path }));
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftDisplayName.trim();
    if (!name) {
      return;
    }
    setPlayerDisplayName(name);
    navigate("/sandbox");
  }

  function togglePanel(panelId: PanelId) {
    setUiState((current) => {
      const isOpen = current.openPanels.includes(panelId);
      return {
        ...current,
        openPanels: isOpen
          ? current.openPanels.filter((openPanel) => openPanel !== panelId)
          : [...current.openPanels, panelId]
      };
    });
  }

  function openMobileSheet(panelId: PanelId) {
    setUiState((current) => ({
      ...current,
      mobileSheet: current.mobileSheet === panelId ? null : panelId
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
            今後の shell や tutorial が呼びかけるために使います。
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

      <main className="shell-layout">
        <section className="sandbox-stage" aria-label="箱庭主画面">
          <div className="sandbox-viewport">
            <div className="sandbox-viewport__sky" />
            <div className="sandbox-viewport__ground">
              <span className="sandbox-viewport__resident sandbox-viewport__resident--one" />
              <span className="sandbox-viewport__resident sandbox-viewport__resident--two" />
              <span className="sandbox-viewport__resident sandbox-viewport__resident--three" />
              <span className="sandbox-viewport__resident sandbox-viewport__resident--four" />
            </div>
            <div className="sandbox-viewport__caption">
              <strong>Sandbox viewport</strong>
              <span>Line 2 の activeSlots[4] と focusedEvent を受ける場所</span>
            </div>
          </div>

          <div className="event-focus-card" aria-live="polite">
            <p className="eyebrow">focusedEvent</p>
            <h2>{focusedEvent.title}</h2>
            <p>{focusedEvent.summary}</p>
            <div className="event-focus-card__participants">
              {focusedEvent.participantLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="intervention-controls" aria-label="介入操作">
              <Button type="button">見守る</Button>
              <Button type="button" variant="primary">
                助ける
              </Button>
              <Button type="button">試練</Button>
            </div>
          </div>

          {manualSweep.enabled ? (
            <aside className="manual-sweep-note">
              <strong>manual-sweep mode</strong>
              <span>runtime 出力先: {manualSweep.runtimeDirectory}</span>
            </aside>
          ) : null}
        </section>

        <aside className="desktop-panels" aria-label="補助パネル">
          <div className="panel-toggle-row">
            {(Object.keys(panelLabels) as PanelId[]).map((panelId) => (
              <Button key={panelId} type="button" onClick={() => togglePanel(panelId)}>
                {uiState.openPanels.includes(panelId) ? "閉じる" : "開く"} {panelLabels[panelId]}
              </Button>
            ))}
          </div>
          <div className="desktop-panels__grid">
            {uiState.openPanels.map((panelId) => (
              <ShellPanel key={panelId} panelId={panelId} route={route} />
            ))}
          </div>
        </aside>
      </main>

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
            <ShellPanel panelId={uiState.mobileSheet} route={route} />
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function ShellPanel({ panelId, route }: { panelId: PanelId; route: AppRoute }) {
  const title = panelLabels[panelId];

  return (
    <Panel title={title}>
      {panelId === "roster" ? (
        <p>roster と activeSlots[4] を表示する受け口です。キャラクター意味は Line 2 / Line 3 が接続します。</p>
      ) : null}
      {panelId === "relations" ? <p>relation surface の受け口です。関係値の意味はまだ持ちません。</p> : null}
      {panelId === "logs" ? <p>story log surface の受け口です。focusedEvent 履歴の表示枠として使います。</p> : null}
      {panelId === "passport" ? <p>snapshot と passport を分けて扱う surface の受け口です。</p> : null}
      <p className="panel-route-note">現在 route: {route.path}</p>
    </Panel>
  );
}
