import { useState, useCallback, useEffect, useMemo } from "react";
import {
  createLocalAssetGenerationClient,
  LocalAssetGenerationError,
  type LocalAssetGenerationJobStatus,
} from "../../application/localAssetGenerationClient.js";
import {
  getAssetProductionMemo,
  isAssetJobPollingTerminal,
  type AssetGenerationJobStatus,
  type AssetProductionMemo,
} from "./assetProductionMemo.js";
import { Button } from "../../ui/Button.js";
import { Panel } from "../../ui/Panel.js";
import "./CharacterAssetGenForm.css";

const BRIDGE_DESCRIPTIONS: Record<string, string> = {
  fake: "テスト・ドライラン専用。画像は生成されません。jobId と prompt-pack の生成確認に使います。",
  "manual-drop": "生成システムが手動ファイルドロップを待機するモード。環境変数 GODSANDBOX_GEN2_MANUAL_DROP_FOLDER が必要です。",
  "hot-folder": "ローカル hot-folder 監視サービス連携。環境変数 GODSANDBOX_GEN2_HOT_FOLDER が必要です。",
  "local-cli": "ローカル CLI を直接実行します。環境変数 GODSANDBOX_GEN2_LOCAL_CLI_COMMAND が必要です。",
};

const PREVIEW_MODE_DESCRIPTIONS: Record<string, string> = {
  "po-combined": "po-combined: 826×1904 / 14行×7列 / 118×136px フレーム（推奨）",
  "canonical-two-sheet": "canonical-two-sheet: Sheet1 (motion) + Sheet2 (extended) の2枚構成",
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const MAX_PORTRAIT_UPLOAD_BYTES = 10 * 1024 * 1024;

type FormStatus =
  | { kind: "idle" }
  | { kind: "checking-health" }
  | { kind: "server-ok" }
  | { kind: "server-down"; error: string }
  | { kind: "staging-portrait" }
  | { kind: "portrait-staged"; slug: string; portraitPath: string; bytes: number }
  | { kind: "submitting" }
  | {
      kind: "submitted";
      jobId: string;
      initialStatus: string;
      jobStatus?: LocalAssetGenerationJobStatus;
      pollingError?: string;
      pollingDetails?: string[];
    }
  | { kind: "error"; error: string; details?: string[] };

const LOCAL_APP_SERVER_URL = "http://127.0.0.1:8787";

function deriveSlugFromDisplayName(displayName: string) {
  return displayName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)
    .replace(/^[^a-z0-9]+/, "");
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function buildRequestedLanes(includeEventStandingExpressions: boolean) {
  const lanes = ["resident-sprite-sheet", "portrait-expressions", "derived-icon"];
  if (includeEventStandingExpressions) lanes.push("event-standing-expressions");
  return lanes;
}

function getErrorMessageAndDetails(err: unknown): { message: string; details?: string[] } {
  if (err instanceof LocalAssetGenerationError) {
    return { message: err.message, details: err.details };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}

function makeInitialJobStatus({
  jobId,
  status,
  assetBundleId,
  lanes,
  previewMode,
  gen2Bridge,
}: {
  jobId: string;
  status: string;
  assetBundleId: string;
  lanes: string[];
  previewMode: "po-combined" | "canonical-two-sheet";
  gen2Bridge: "fake" | "manual-drop" | "hot-folder" | "local-cli";
}): LocalAssetGenerationJobStatus {
  return {
    jobId,
    status,
    assetBundleId: assetBundleId || null,
    lanes,
    previewMode,
    gen2Bridge,
  };
}

function ProductionMemo({
  memo,
  pollingError,
  pollingDetails,
}: {
  memo: AssetProductionMemo;
  pollingError?: string;
  pollingDetails?: string[];
}) {
  return (
    <section className={`assetgen-form__memo assetgen-form__memo--${memo.progress.tone}`} aria-live="polite">
      <div className="assetgen-form__memo-header">
        <span className="assetgen-form__eyebrow">候補づくりの制作メモ</span>
        <h3>{memo.progress.title}</h3>
        <p>{memo.progress.description}</p>
      </div>

      {memo.warnings.map((warning) => (
        <div className="assetgen-form__notice assetgen-form__notice--warning" key={warning}>
          {warning}
        </div>
      ))}

      {pollingError && (
        <div className="assetgen-form__notice assetgen-form__notice--warning">
          <strong>制作メモの再確認が止まっています</strong>
          <p>{pollingError}</p>
          {pollingDetails && pollingDetails.length > 0 && (
            <details className="assetgen-form__inline-details">
              <summary>詳しい内容</summary>
              <ul>
                {pollingDetails.map((detail) => (
                  <li key={detail}><code>{detail}</code></li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {memo.waitingItems.length > 0 && (
        <div className="assetgen-form__memo-section">
          <h4>待っていること</h4>
          <ul>
            {memo.waitingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {memo.failureItems.length > 0 && (
        <div className="assetgen-form__memo-section assetgen-form__memo-section--alert">
          <h4>直すこと</h4>
          <ul className="assetgen-form__fix-list">
            {memo.failureItems.map((failure) => (
              <li key={`${failure.title}-${failure.target}`}>
                <strong>{failure.title}</strong>
                <span>{failure.target}</span>
                <p>{failure.action}</p>
                {failure.detail && <small>{failure.detail}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="assetgen-form__memo-section">
        <h4>自動確認</h4>
        <p>{memo.validation.title}</p>
        <span className="assetgen-form__hint">{memo.validation.description}</span>
        {memo.validation.reportPath && (
          <p className="assetgen-form__path-line">
            レポート: <code>{memo.validation.reportPath}</code>
          </p>
        )}
        {memo.validation.retryPlanPath && (
          <p className="assetgen-form__path-line">
            修正案: <code>{memo.validation.retryPlanPath}</code>
          </p>
        )}
      </div>

      {memo.eventExpressions && (
        <div className="assetgen-form__memo-section">
          <h4>{memo.eventExpressions.title}</h4>
          <p>{memo.eventExpressions.description}</p>
          <ul className="assetgen-form__label-list">
            {memo.eventExpressions.expectedLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="assetgen-form__memo-section">
        <h4>{memo.reviewPack.title}</h4>
        <p>{memo.reviewPack.description}</p>
        {memo.reviewPack.command && (
          <p className="assetgen-form__path-line">
            コマンド: <code>{memo.reviewPack.command}</code>
          </p>
        )}
        {memo.reviewPack.path && (
          <p className="assetgen-form__path-line">
            開く場所: <code>{memo.reviewPack.path}</code>
          </p>
        )}
      </div>

      {memo.nextActions.length > 0 && (
        <div className="assetgen-form__memo-section">
          <h4>次にできること</h4>
          <ul className="assetgen-form__action-list">
            {memo.nextActions.map((action) => (
              <li key={`${action.label}-${action.command ?? action.path ?? action.description}`}>
                <strong>{action.label}</strong>
                <span>{action.description}</span>
                {action.command && <code>{action.command}</code>}
                {action.path && <code>{action.path}</code>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="assetgen-form__details">
        <summary>開発者向けの詳細</summary>
        <dl>
          {memo.technicalDetails.map((row) => (
            <div key={row.label} className="assetgen-form__detail-row">
              <dt>{row.label}</dt>
              <dd><code>{row.value}</code></dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

export function CharacterAssetGenForm() {
  const [displayName, setDisplayName] = useState("");
  const [personality, setPersonality] = useState("");
  const [tone, setTone] = useState("");
  const [age, setAge] = useState("");
  const [portraitPath, setPortraitPath] = useState("");
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [assetBundleId, setAssetBundleId] = useState("");
  const [previewMode, setPreviewMode] = useState<"po-combined" | "canonical-two-sheet">("po-combined");
  const [gen2Bridge, setGen2Bridge] = useState<"fake" | "manual-drop" | "hot-folder" | "local-cli">("fake");
  const [includeEventStandingExpressions, setIncludeEventStandingExpressions] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const client = useMemo(() => createLocalAssetGenerationClient(LOCAL_APP_SERVER_URL), []);

  const handleCheckHealth = useCallback(async () => {
    setStatus({ kind: "checking-health" });
    const result = await client.checkHealth();
    if (result.ok) {
      setServerReady(true);
      setStatus({ kind: "server-ok" });
    } else {
      setServerReady(false);
      setStatus({ kind: "server-down", error: result.error ?? "AppServer未起動" });
    }
  }, [client]);

  const handleStagePortrait = useCallback(async () => {
    if (!portraitFile) {
      setStatus({ kind: "error", error: "立ち絵PNGを選んでください。" });
      return;
    }
    if (portraitFile.size > MAX_PORTRAIT_UPLOAD_BYTES) {
      setStatus({ kind: "error", error: "立ち絵PNGが大きすぎます。10MB以下にしてください。" });
      return;
    }
    if (portraitFile.type && portraitFile.type !== "image/png") {
      setStatus({ kind: "error", error: "PNGファイルだけアップロードできます。" });
      return;
    }

    const explicitSlug = assetBundleId.trim();
    const slug = explicitSlug || deriveSlugFromDisplayName(displayName);
    if (!slug || !SLUG_PATTERN.test(slug)) {
      setStatus({
        kind: "error",
        error: "アセットバンドルIDは英小文字・数字・ハイフン・アンダースコアで入力してください。",
      });
      return;
    }

    setStatus({ kind: "staging-portrait" });
    try {
      const result = await client.stagePortraitFile(portraitFile, slug);
      setServerReady(true);
      setAssetBundleId(result.slug);
      setPortraitPath(result.portraitPath);
      setStatus({
        kind: "portrait-staged",
        slug: result.slug,
        portraitPath: result.portraitPath,
        bytes: result.bytes,
      });
    } catch (err) {
      const { message, details } = getErrorMessageAndDetails(err);
      setStatus({ kind: "error", error: message, details });
    }
  }, [assetBundleId, client, displayName, portraitFile]);

  const handleSubmit = useCallback(async () => {
    const ageNum = parseInt(age, 10);
    if (
      !displayName.trim() || !personality.trim() || !tone.trim() ||
      isNaN(ageNum) || ageNum < 0 || !portraitPath.trim()
    ) {
      setStatus({ kind: "error", error: "すべての必須フィールドを入力してください。" });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const lanes = buildRequestedLanes(includeEventStandingExpressions);
      const result = await client.createCharacterJob({
        displayName: displayName.trim(),
        personality: personality.trim(),
        tone: tone.trim(),
        age: ageNum,
        portraitPath: portraitPath.trim(),
        assetBundleId: assetBundleId.trim() || undefined,
        previewMode,
        gen2Bridge,
        lanes,
      });
      setServerReady(true);
      setStatus({
        kind: "submitted",
        jobId: result.jobId,
        initialStatus: result.status,
        jobStatus: makeInitialJobStatus({
          jobId: result.jobId,
          status: result.status,
          assetBundleId: assetBundleId.trim(),
          lanes,
          previewMode,
          gen2Bridge,
        }),
      });
    } catch (err) {
      const { message, details } = getErrorMessageAndDetails(err);
      setStatus({ kind: "error", error: message, details });
    }
  }, [
    assetBundleId,
    age,
    client,
    displayName,
    gen2Bridge,
    includeEventStandingExpressions,
    personality,
    portraitPath,
    previewMode,
    tone,
  ]);

  useEffect(() => {
    if (status.kind !== "submitted") return;
    if (status.jobStatus && isAssetJobPollingTerminal(status.jobStatus.status)) return;

    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const pollJobStatus = async () => {
      try {
        const jobStatus = await client.getJobStatus(status.jobId);
        if (stopped) return;

        setStatus((current) => {
          if (current.kind !== "submitted" || current.jobId !== status.jobId) return current;
          return {
            ...current,
            jobStatus,
            pollingError: undefined,
            pollingDetails: undefined,
          };
        });

        if (isAssetJobPollingTerminal(jobStatus.status) && intervalId) {
          clearInterval(intervalId);
        }
      } catch (err) {
        if (stopped) return;
        const { message, details } = getErrorMessageAndDetails(err);
        setStatus((current) => {
          if (current.kind !== "submitted" || current.jobId !== status.jobId) return current;
          return {
            ...current,
            pollingError: message,
            pollingDetails: details,
          };
        });
      }
    };

    pollJobStatus();
    intervalId = setInterval(pollJobStatus, 2500);

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [client, status.kind, status.kind === "submitted" ? status.jobId : undefined]);

  const serverOk = serverReady;
  const isSubmitting = status.kind === "submitting";
  const isStagingPortrait = status.kind === "staging-portrait";
  const isBusy = isSubmitting || isStagingPortrait;
  const productionMemo = useMemo(() => {
    if (status.kind !== "submitted") return null;
    const jobStatus: AssetGenerationJobStatus = status.jobStatus ?? {
      jobId: status.jobId,
      status: status.initialStatus,
    };
    return getAssetProductionMemo(jobStatus);
  }, [status]);

  return (
    <Panel title="キャラ候補づくり (ローカル)">
      <div className="assetgen-form">
        <div className="assetgen-form__notice assetgen-form__notice--info">
          <strong>ローカル専用ツール</strong>
          <ul>
            <li>画像生成APIキー不要。Local AppServer (127.0.0.1) のみ使用します</li>
            <li>作られるものは<strong>まだ候補</strong>です。public/art への昇格・ready化は別PBIのPO承認フローで実施します</li>
            <li>AppServer が起動していることが前提です (<code>npm run assetgen:server</code>)</li>
          </ul>
        </div>

        <div className="assetgen-form__server-check">
          <Button variant="secondary" onClick={handleCheckHealth} disabled={status.kind === "checking-health"}>
            {status.kind === "checking-health" ? "確認中…" : "AppServer 起動確認"}
          </Button>
          {status.kind === "server-ok" && (
            <span className="assetgen-form__status assetgen-form__status--ok">✓ AppServer 起動中</span>
          )}
          {status.kind === "server-down" && (
            <span className="assetgen-form__status assetgen-form__status--error">✗ {status.error}</span>
          )}
        </div>

        <fieldset className="assetgen-form__fields" disabled={isBusy}>
          <legend>キャラクター情報</legend>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">表示名 <span aria-hidden>*</span></span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例: リョウ"
            />
          </label>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">性格 <span aria-hidden>*</span></span>
            <input
              type="text"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="例: 明るい・世話好き"
            />
          </label>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">口調 <span aria-hidden>*</span></span>
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="例: タメ口"
            />
          </label>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">年齢 <span aria-hidden>*</span></span>
            <input
              type="number"
              value={age}
              min={0}
              max={120}
              onChange={(e) => setAge(e.target.value)}
              placeholder="例: 18"
            />
          </label>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">立ち絵PNG <span aria-hidden>*</span></span>
            <input
              type="file"
              accept="image/png"
              onChange={(e) => {
                setPortraitFile(e.target.files?.[0] ?? null);
                setPortraitPath("");
              }}
            />
            <span className="assetgen-form__hint">
              10MB以下のPNG。AppServerがPNG署名を確認して assets/generated に一時保存します。
            </span>
          </label>

          <div className="assetgen-form__portrait-stage">
            <Button
              variant="secondary"
              onClick={handleStagePortrait}
              disabled={!serverOk || isBusy || !portraitFile}
              title={!serverOk ? "AppServer起動確認が必要です" : undefined}
            >
              {isStagingPortrait ? "一時保存中…" : "立ち絵PNGを一時保存"}
            </Button>
            {portraitFile && (
              <span className="assetgen-form__hint">
                {portraitFile.name} ({formatBytes(portraitFile.size)})
              </span>
            )}
          </div>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">一時保存された立ち絵 <span aria-hidden>*</span></span>
            <input
              type="text"
              value={portraitPath}
              readOnly
              placeholder="PNGを一時保存すると自動で入ります"
            />
            <span className="assetgen-form__hint">
              生成依頼にはこのrepo相対パスを使います。手入力は不要です。
            </span>
          </label>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">候補づくり用ID (省略可)</span>
            <input
              type="text"
              value={assetBundleId}
              onChange={(e) => setAssetBundleId(e.target.value)}
              placeholder="例: ryo (英数字・ハイフン・アンダースコア)"
            />
          </label>
        </fieldset>

        <fieldset className="assetgen-form__fields" disabled={isBusy}>
          <legend>候補づくり設定</legend>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">プレビューモード</span>
            <select
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as typeof previewMode)}
            >
              <option value="po-combined">po-combined (推奨)</option>
              <option value="canonical-two-sheet">canonical-two-sheet</option>
            </select>
            <span className="assetgen-form__hint">{PREVIEW_MODE_DESCRIPTIONS[previewMode]}</span>
          </label>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">ローカル補助の受け渡し方法</span>
            <select
              value={gen2Bridge}
              onChange={(e) => setGen2Bridge(e.target.value as typeof gen2Bridge)}
            >
              <option value="fake">テスト用 (fake)</option>
              <option value="manual-drop">手動で受け渡す (manual-drop)</option>
              <option value="hot-folder">監視フォルダー (hot-folder)</option>
              <option value="local-cli">ローカルCLI (local-cli)</option>
            </select>
            <span className="assetgen-form__hint">{BRIDGE_DESCRIPTIONS[gen2Bridge]}</span>
          </label>

          <label className="assetgen-form__checkbox">
            <input
              type="checkbox"
              checked={includeEventStandingExpressions}
              onChange={(e) => setIncludeEventStandingExpressions(e.target.checked)}
            />
            <span>
              イベント用の表情8枚も候補に含める
              <small>通常、笑顔、怒り、悲しみ、驚き、心配、決意、衝撃を確認します。</small>
            </span>
          </label>
        </fieldset>

        <div className="assetgen-form__actions">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!serverOk || isBusy}
            title={!serverOk ? "AppServer起動確認が必要です" : undefined}
          >
            {isSubmitting ? "送信中…" : "候補づくりを依頼"}
          </Button>
        </div>

        {status.kind === "portrait-staged" && (
          <div className="assetgen-form__result assetgen-form__result--success">
            <strong>立ち絵PNGを受け取りました</strong>
            <p>このまま候補づくりの依頼を送れます。</p>
            <details className="assetgen-form__inline-details">
              <summary>開発者向けの詳細</summary>
              <dl>
                <dt>slug</dt>
                <dd><code>{status.slug}</code></dd>
                <dt>path</dt>
                <dd><code>{status.portraitPath}</code></dd>
                <dt>size</dt>
                <dd>{formatBytes(status.bytes)}</dd>
              </dl>
            </details>
          </div>
        )}

        {status.kind === "submitted" && (
          productionMemo && (
            <ProductionMemo
              memo={productionMemo}
              pollingError={status.pollingError}
              pollingDetails={status.pollingDetails}
            />
          )
        )}

        {status.kind === "error" && (
          <div className="assetgen-form__result assetgen-form__result--error">
            <strong>✗ エラー</strong>
            <p>{status.error}</p>
            {status.details && status.details.length > 0 && (
              <details className="assetgen-form__inline-details">
                <summary>詳しい内容</summary>
                <ul>
                  {status.details.map((detail) => (
                    <li key={detail}><code>{detail}</code></li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
