import { useState, useCallback, useEffect, useMemo } from "react";
import { createLocalAssetGenerationClient } from "../../application/localAssetGenerationClient.js";
import { Button } from "../../ui/Button.js";
import { Panel } from "../../ui/Panel.js";
import {
  ASSETGEN_PRESETS,
  DEFAULT_PRESET_ID,
  ORDERED_JOB_STEPS,
  lanesForPreset,
  stepIndexForStatus,
} from "./assetgenPresets.js";
import "./CharacterAssetGenForm.css";

const BRIDGE_DESCRIPTIONS: Record<string, string> = {
  fake: "動作確認専用。画像は生成されません。制作指示ファイル生成の確認に使います。",
  "manual-drop": "手動ファイルドロップ待機モード。環境変数 GODSANDBOX_GEN2_MANUAL_DROP_FOLDER が必要です。",
  "hot-folder": "ローカル hot-folder 監視連携。環境変数 GODSANDBOX_GEN2_HOT_FOLDER が必要です。",
  "local-cli": "ローカル CLI 直接実行。環境変数 GODSANDBOX_GEN2_LOCAL_CLI_COMMAND が必要です。",
};

const PREVIEW_MODE_DESCRIPTIONS: Record<string, string> = {
  "po-combined": "826×1904 / 14行×7列（推奨）",
  "canonical-two-sheet": "Sheet1 (動き) + Sheet2 (拡張) の2枚構成",
};

type FormStatus =
  | { kind: "idle" }
  | { kind: "checking-health" }
  | { kind: "server-ok" }
  | { kind: "server-down"; error: string }
  | { kind: "submitting" }
  | { kind: "submitted"; jobId: string; jobStatus: string; gen2Bridge: string }
  | { kind: "error"; error: string };

const LOCAL_APP_SERVER_URL = "http://127.0.0.1:8787";

export function CharacterAssetGenForm() {
  const [displayName, setDisplayName] = useState("");
  const [personality, setPersonality] = useState("");
  const [tone, setTone] = useState("");
  const [age, setAge] = useState("");
  const [portraitPath, setPortraitPath] = useState("");
  const [assetBundleId, setAssetBundleId] = useState("");
  const [previewMode, setPreviewMode] = useState<"po-combined" | "canonical-two-sheet">("po-combined");
  const [gen2Bridge, setGen2Bridge] = useState<"fake" | "manual-drop" | "hot-folder" | "local-cli">("fake");
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [polledSlug, setPolledSlug] = useState<string | null>(null);

  const client = useMemo(() => createLocalAssetGenerationClient(LOCAL_APP_SERVER_URL), []);

  const handleCheckHealth = useCallback(async () => {
    setStatus((prev) => {
      if (prev.kind === "submitted") return prev;
      return { kind: "checking-health" };
    });
    const result = await client.checkHealth();
    setStatus((prev) => {
      if (prev.kind === "submitted") return prev;
      return result.ok
        ? { kind: "server-ok" }
        : { kind: "server-down", error: result.error ?? "AppServer未起動" };
    });
  }, [client]);

  useEffect(() => {
    void handleCheckHealth();
  }, [handleCheckHealth]);

  useEffect(() => {
    if (!submittedJobId) return;
    const jobId = submittedJobId;
    const intervalId = setInterval(async () => {
      const result = await client.getJobStatus(jobId);
      if (result.assetBundleId) setPolledSlug(result.assetBundleId);
      setStatus((prev) => {
        if (prev.kind !== "submitted" || prev.jobId !== jobId) return prev;
        return { ...prev, jobStatus: result.status };
      });
      if (result.status === "error" || result.status === "cancelled") {
        setSubmittedJobId(null);
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [submittedJobId, client]);

  const handleSubmit = useCallback(async () => {
    const ageNum = parseInt(age, 10);
    if (
      !displayName.trim() || !personality.trim() || !tone.trim() ||
      isNaN(ageNum) || ageNum < 0 || !portraitPath.trim()
    ) {
      setStatus({ kind: "error", error: "必須フィールドをすべて入力してください。" });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const result = await client.createCharacterJob({
        displayName: displayName.trim(),
        personality: personality.trim(),
        tone: tone.trim(),
        age: ageNum,
        portraitPath: portraitPath.trim(),
        assetBundleId: assetBundleId.trim() || undefined,
        previewMode,
        gen2Bridge,
        lanes: lanesForPreset(selectedPresetId),
      });
      setSubmittedJobId(result.jobId);
      setStatus({ kind: "submitted", jobId: result.jobId, jobStatus: "pending", gen2Bridge });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", error: msg });
    }
  }, [displayName, personality, tone, age, portraitPath, assetBundleId, previewMode, gen2Bridge, selectedPresetId, client]);

  const serverReady = status.kind === "server-ok" || status.kind === "submitted";
  const isSubmitting = status.kind === "submitting";
  const isFake = gen2Bridge === "fake";

  return (
    <Panel title="うちの子を迎える">
      <div className="assetgen-form">

        {/* Server status bar */}
        <div className="assetgen-form__server-bar">
          {status.kind === "idle" || status.kind === "checking-health" ? (
            <span className="assetgen-form__server-checking">
              {status.kind === "checking-health" ? "ローカル補助サーバーを確認中…" : "起動確認中…"}
            </span>
          ) : status.kind === "server-down" ? (
            <div className="assetgen-form__notice assetgen-form__notice--warning">
              <strong>ローカル補助サーバーが起動していません</strong>
              <p>以下のコマンドで起動してから、もう一度お試しください：</p>
              <code className="assetgen-form__command">npm run assetgen:server</code>
              <Button variant="secondary" onClick={handleCheckHealth}>再確認</Button>
            </div>
          ) : status.kind === "server-ok" ? (
            <span className="assetgen-form__status assetgen-form__status--ok">✓ ローカル補助サーバー起動中</span>
          ) : null}
        </div>

        {/* Step 1 */}
        <div className="assetgen-form__step">
          <div className="assetgen-form__step-header">
            <span className="assetgen-form__step-num">①</span>
            <span className="assetgen-form__step-title">見た目画像と名前を入れる</span>
          </div>
          <fieldset className="assetgen-form__fields" disabled={isSubmitting}>
            <label className="assetgen-form__field">
              <span className="assetgen-form__label">見た目画像のパス <span aria-hidden>*</span></span>
              <input
                type="text"
                value={portraitPath}
                onChange={(e) => setPortraitPath(e.target.value)}
                placeholder="例: assets/generated/residents/ryo/reference/portrait.png"
              />
              <span className="assetgen-form__hint">
                リポジトリルートからの相対パス。透明背景のPNGを推奨します。
              </span>
            </label>

            <label className="assetgen-form__field">
              <span className="assetgen-form__label">名前 <span aria-hidden>*</span></span>
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
          </fieldset>
        </div>

        {/* Step 2 */}
        <div className="assetgen-form__step">
          <div className="assetgen-form__step-header">
            <span className="assetgen-form__step-num">②</span>
            <span className="assetgen-form__step-title">作りたい候補を選ぶ</span>
          </div>
          <div className="assetgen-form__presets" role="radiogroup" aria-label="作りたい候補">
            {ASSETGEN_PRESETS.map((preset) => (
              <label
                key={preset.id}
                className={`assetgen-form__preset${selectedPresetId === preset.id ? " assetgen-form__preset--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="preset"
                  value={preset.id}
                  checked={selectedPresetId === preset.id}
                  onChange={() => setSelectedPresetId(preset.id)}
                  disabled={isSubmitting}
                />
                <span className="assetgen-form__preset-label">{preset.label}</span>
                <span className="assetgen-form__preset-desc">{preset.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Advanced settings */}
        <details className="assetgen-form__advanced">
          <summary className="assetgen-form__advanced-summary">詳細設定（上級者向け）</summary>
          <div className="assetgen-form__advanced-body">
            <fieldset className="assetgen-form__fields" disabled={isSubmitting}>
              <label className="assetgen-form__field">
                <span className="assetgen-form__label">アセットID（省略可）</span>
                <input
                  type="text"
                  value={assetBundleId}
                  onChange={(e) => setAssetBundleId(e.target.value)}
                  placeholder="例: ryo (英数字・ハイフン・アンダースコア)"
                />
                <span className="assetgen-form__hint">省略すると名前から自動生成されます。</span>
              </label>

              <label className="assetgen-form__field">
                <span className="assetgen-form__label">生成モード</span>
                <select
                  value={gen2Bridge}
                  onChange={(e) => setGen2Bridge(e.target.value as typeof gen2Bridge)}
                >
                  <option value="fake">動作確認専用 (fake)</option>
                  <option value="manual-drop">manual-drop</option>
                  <option value="hot-folder">hot-folder</option>
                  <option value="local-cli">local-cli</option>
                </select>
                <span className="assetgen-form__hint">{BRIDGE_DESCRIPTIONS[gen2Bridge]}</span>
              </label>

              <label className="assetgen-form__field">
                <span className="assetgen-form__label">スプライトシート形式</span>
                <select
                  value={previewMode}
                  onChange={(e) => setPreviewMode(e.target.value as typeof previewMode)}
                >
                  <option value="po-combined">po-combined（推奨）</option>
                  <option value="canonical-two-sheet">canonical-two-sheet</option>
                </select>
                <span className="assetgen-form__hint">{PREVIEW_MODE_DESCRIPTIONS[previewMode]}</span>
              </label>
            </fieldset>
          </div>
        </details>

        {/* Fake bridge warning */}
        {isFake && status.kind !== "submitted" && (
          <div className="assetgen-form__notice assetgen-form__notice--warning" data-testid="fake-bridge-warning">
            <strong>動作確認モードです</strong>
            <p>
              現在の設定では見た目候補画像は生成されません。
              実際の候補を作るには、詳細設定から「manual-drop」「hot-folder」「local-cli」のいずれかを選んでください。
            </p>
          </div>
        )}

        {/* Step 3 */}
        <div className="assetgen-form__step">
          <div className="assetgen-form__step-header">
            <span className="assetgen-form__step-num">③</span>
            <span className="assetgen-form__step-title">ローカル補助へ渡す</span>
          </div>
          <div className="assetgen-form__actions">
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!serverReady || isSubmitting}
              title={!serverReady ? "ローカル補助サーバーの起動が必要です" : undefined}
            >
              {isSubmitting ? "受け渡し中…" : "うちの子を迎える"}
            </Button>
            {!serverReady && status.kind !== "server-down" && status.kind !== "checking-health" && (
              <Button variant="secondary" onClick={handleCheckHealth}>
                サーバー再確認
              </Button>
            )}
          </div>
          <p className="assetgen-form__hint">
            生成物は確認待ち候補として保存されます。自動で箱庭に追加されることはありません。
          </p>
        </div>

        {/* Error */}
        {status.kind === "error" && (
          <div className="assetgen-form__result assetgen-form__result--error">
            <strong>✗ エラーが発生しました</strong>
            <p>{status.error}</p>
          </div>
        )}

        {/* Progress card */}
        {status.kind === "submitted" && (
          <div className="assetgen-form__progress-card">
            <div className="assetgen-form__progress-header">
              <strong>
                {status.gen2Bridge === "fake"
                  ? "動作確認用として受け付けました"
                  : "制作候補の準備を始めました"}
              </strong>
              <code className="assetgen-form__job-id">{status.jobId}</code>
            </div>

            {status.gen2Bridge === "fake" && (
              <div className="assetgen-form__notice assetgen-form__notice--warning assetgen-form__notice--inline" data-testid="fake-bridge-submitted-warning">
                これは動作確認用です。見た目候補としては使えません。
              </div>
            )}

            <ol className="assetgen-form__progress-steps" aria-label="進行状況">
              {ORDERED_JOB_STEPS.map((step, i) => {
                const activeIdx = stepIndexForStatus(status.jobStatus);
                const stepState =
                  activeIdx === -1 ? (i === 0 ? "active" : "waiting")
                  : i < activeIdx ? "done"
                  : i === activeIdx ? "active"
                  : "waiting";
                return (
                  <li
                    key={step.id}
                    className={`assetgen-form__progress-step assetgen-form__progress-step--${stepState}`}
                  >
                    <span className="assetgen-form__progress-dot" aria-hidden />
                    {step.label}
                  </li>
                );
              })}
            </ol>

            <p className="assetgen-form__hint">
              画像の生成はローカル補助ツールが担います。ローカルのツールが動いていれば、しばらくすると候補が届きます。
            </p>

            {polledSlug && (
              <div className="assetgen-form__review-pack">
                <strong>確認パック：</strong>
                <code className="assetgen-form__command">
                  npm run assetgen:review-pack -- --slug {polledSlug}
                </code>
                <span className="assetgen-form__hint">
                  または <code>assets/generated/residents/{polledSlug}/review-pack/index.html</code> を開いてください
                </span>
              </div>
            )}
          </div>
        )}

      </div>
    </Panel>
  );
}
