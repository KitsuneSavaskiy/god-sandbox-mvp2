import { useState, useCallback } from "react";
import { createLocalAssetGenerationClient } from "../../application/localAssetGenerationClient.js";
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

type FormStatus =
  | { kind: "idle" }
  | { kind: "checking-health" }
  | { kind: "server-ok" }
  | { kind: "server-down"; error: string }
  | { kind: "submitting" }
  | { kind: "submitted"; jobId: string; status: string }
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
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const client = createLocalAssetGenerationClient(LOCAL_APP_SERVER_URL);

  const handleCheckHealth = useCallback(async () => {
    setStatus({ kind: "checking-health" });
    const result = await client.checkHealth();
    if (result.ok) {
      setStatus({ kind: "server-ok" });
    } else {
      setStatus({ kind: "server-down", error: result.error ?? "AppServer未起動" });
    }
  }, []);

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
      const result = await client.createCharacterJob({
        displayName: displayName.trim(),
        personality: personality.trim(),
        tone: tone.trim(),
        age: ageNum,
        portraitPath: portraitPath.trim(),
        assetBundleId: assetBundleId.trim() || undefined,
        previewMode,
        gen2Bridge,
        lanes: ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
      });
      setStatus({ kind: "submitted", jobId: result.jobId, status: result.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", error: msg });
    }
  }, [displayName, personality, tone, age, portraitPath, assetBundleId, previewMode, gen2Bridge]);

  const serverOk = status.kind === "server-ok" || status.kind === "submitted";
  const isSubmitting = status.kind === "submitting";

  return (
    <Panel title="キャラ素材生成 (Dev / Local AppServer)">
      <div className="assetgen-form">
        <div className="assetgen-form__notice assetgen-form__notice--info">
          <strong>ローカル専用ツール</strong>
          <ul>
            <li>画像生成APIキー不要 — Local AppServer (127.0.0.1) のみ使用します</li>
            <li>生成物は<strong>candidate状態</strong>です。public/art への昇格・ready化は別PBIのPO承認フローで実施します</li>
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

        <fieldset className="assetgen-form__fields" disabled={isSubmitting}>
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
            <span className="assetgen-form__label">立ち絵パス (repo相対) <span aria-hidden>*</span></span>
            <input
              type="text"
              value={portraitPath}
              onChange={(e) => setPortraitPath(e.target.value)}
              placeholder="例: assets/generated/residents/ryo/reference/portrait.png"
            />
            <span className="assetgen-form__hint">
              リポジトリルートからの相対パス。絶対パス・../ 不可。ファイルが存在しないと422エラーになります。
            </span>
          </label>

          <label className="assetgen-form__field">
            <span className="assetgen-form__label">アセットバンドルID (省略可)</span>
            <input
              type="text"
              value={assetBundleId}
              onChange={(e) => setAssetBundleId(e.target.value)}
              placeholder="例: ryo (英数字・ハイフン・アンダースコア)"
            />
          </label>
        </fieldset>

        <fieldset className="assetgen-form__fields" disabled={isSubmitting}>
          <legend>生成設定</legend>

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
            <span className="assetgen-form__label">Gen2 Bridge モード</span>
            <select
              value={gen2Bridge}
              onChange={(e) => setGen2Bridge(e.target.value as typeof gen2Bridge)}
            >
              <option value="fake">fake (テスト専用)</option>
              <option value="manual-drop">manual-drop</option>
              <option value="hot-folder">hot-folder</option>
              <option value="local-cli">local-cli</option>
            </select>
            <span className="assetgen-form__hint">{BRIDGE_DESCRIPTIONS[gen2Bridge]}</span>
          </label>
        </fieldset>

        <div className="assetgen-form__actions">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!serverOk || isSubmitting}
            title={!serverOk ? "AppServer起動確認が必要です" : undefined}
          >
            {isSubmitting ? "送信中…" : "生成依頼を送信"}
          </Button>
        </div>

        {status.kind === "submitted" && (
          <div className="assetgen-form__result assetgen-form__result--success">
            <strong>✓ 生成ジョブを作成しました</strong>
            <dl>
              <dt>Job ID</dt>
              <dd><code>{status.jobId}</code></dd>
              <dt>Status</dt>
              <dd>{status.status}</dd>
            </dl>
            <p className="assetgen-form__hint">
              生成物の確認: <code>.godsandbox/jobs/{status.jobId}-request.json</code><br />
              ステータス確認: <code>.godsandbox/jobs/local-app-server/{status.jobId}.json</code>
            </p>
          </div>
        )}

        {status.kind === "error" && (
          <div className="assetgen-form__result assetgen-form__result--error">
            <strong>✗ エラー</strong>
            <p>{status.error}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
