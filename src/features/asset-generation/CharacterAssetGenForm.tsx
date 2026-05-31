import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createLocalAssetGenerationClient } from "../../application/localAssetGenerationClient.js";
import { Button } from "../../ui/Button.js";
import { Panel } from "../../ui/Panel.js";
import {
  ASSETGEN_PRESETS,
  DEFAULT_ASSETGEN_PRESET_ID,
  FAKE_BRIDGE_WARNING,
  LOCAL_APP_SERVER_DOWN_TITLE,
  LOCAL_APP_SERVER_HELP_COMMAND,
  createAssetBundleSlug,
  getAssetGenPreset,
  getFriendlyJobStatus,
  getPresetLanes,
  type AssetGenLane,
  type AssetGenPresetId,
} from "./characterAssetGenFlow.js";
import "./CharacterAssetGenForm.css";

type BridgeMode = "fake" | "manual-drop" | "hot-folder" | "local-cli";
type PreviewMode = "po-combined" | "canonical-two-sheet";

type FormStatus =
  | { kind: "idle" }
  | { kind: "checking-health" }
  | { kind: "server-ready" }
  | { kind: "server-down"; error?: string }
  | { kind: "staging" }
  | { kind: "submitting"; portraitPath: string }
  | {
      kind: "submitted";
      jobId: string;
      jobStatus: string;
      error?: string;
      portraitPath: string;
      lanes: AssetGenLane[];
      bridgeMode: BridgeMode;
      previewMode: PreviewMode;
      presetId: AssetGenPresetId;
    }
  | { kind: "error"; error: string };

const LOCAL_APP_SERVER_URL = "http://127.0.0.1:8787";
const DEFAULT_TONE = "その子らしい自然な話し方";
const DEFAULT_AGE = 18;
const FINAL_JOB_STATUSES = new Set(["gen2-dispatched", "watcher-intake-done", "error", "cancelled"]);

export function CharacterAssetGenForm() {
  const [displayName, setDisplayName] = useState("");
  const [personality, setPersonality] = useState("");
  const [tone, setTone] = useState("");
  const [age, setAge] = useState("");
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreviewUrl, setPortraitPreviewUrl] = useState<string | null>(null);
  const [assetBundleId, setAssetBundleId] = useState("");
  const [presetId, setPresetId] = useState<AssetGenPresetId>(DEFAULT_ASSETGEN_PRESET_ID);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("po-combined");
  const [bridgeMode, setBridgeMode] = useState<BridgeMode>("fake");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const client = useMemo(() => createLocalAssetGenerationClient(LOCAL_APP_SERVER_URL), []);
  const selectedPreset = getAssetGenPreset(presetId);
  const isBusy =
    status.kind === "checking-health" ||
    status.kind === "staging" ||
    status.kind === "submitting";
  const canSubmit = displayName.trim().length > 0 && personality.trim().length > 0 && portraitFile !== null && !isBusy;

  useEffect(() => {
    if (!portraitFile) {
      setPortraitPreviewUrl(null);
      return undefined;
    }

    const nextUrl = URL.createObjectURL(portraitFile);
    setPortraitPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [portraitFile]);

  useEffect(() => {
    if (status.kind !== "submitted" || FINAL_JOB_STATUSES.has(status.jobStatus)) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      client.getCharacterJobStatus(status.jobId)
        .then((jobStatus) => {
          setStatus((current) => {
            if (current.kind !== "submitted" || current.jobId !== status.jobId) {
              return current;
            }

            return {
              ...current,
              jobStatus: jobStatus.status,
              error: jobStatus.error,
            };
          });
        })
        .catch(() => {
          // 状況確認だけの失敗なので、依頼そのものは止めない。
        });
    }, 1_500);

    return () => window.clearInterval(timerId);
  }, [client, status]);

  const handleCheckHealth = useCallback(async () => {
    setStatus({ kind: "checking-health" });
    const result = await client.checkHealth();
    setStatus(result.ok ? { kind: "server-ready" } : { kind: "server-down", error: result.error });
  }, [client]);

  function handlePortraitFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setPortraitFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPortraitFile(null);
      setStatus({ kind: "error", error: "PNG、JPG、WebP などの画像ファイルを選んでください。" });
      return;
    }

    setPortraitFile(file);
    setStatus({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = displayName.trim();
    const trimmedPersonality = personality.trim();
    const trimmedTone = tone.trim() || DEFAULT_TONE;
    const ageNumber = age.trim().length > 0 ? Number.parseInt(age, 10) : DEFAULT_AGE;

    if (!trimmedName || !trimmedPersonality || !portraitFile) {
      setStatus({ kind: "error", error: "名前、ひとこと性格、見た目画像を入れてください。" });
      return;
    }

    if (!Number.isInteger(ageNumber) || ageNumber < 0) {
      setStatus({ kind: "error", error: "年齢は空欄、または 0 以上の数字にしてください。" });
      return;
    }

    setStatus({ kind: "checking-health" });
    const health = await client.checkHealth();
    if (!health.ok) {
      setStatus({ kind: "server-down", error: health.error });
      return;
    }

    const slug = createAssetBundleSlug(
      assetBundleId.trim() || trimmedName,
      `character-${Date.now().toString(36)}`,
    );
    const lanes = getPresetLanes(presetId);

    try {
      setStatus({ kind: "staging" });
      const staged = await client.stagePortraitFile(portraitFile, slug);

      setStatus({ kind: "submitting", portraitPath: staged.portraitPath });
      const result = await client.createCharacterJob({
        displayName: trimmedName,
        personality: trimmedPersonality,
        tone: trimmedTone,
        age: ageNumber,
        portraitPath: staged.portraitPath,
        assetBundleId: slug,
        previewMode,
        gen2Bridge: bridgeMode,
        lanes,
      });

      setStatus({
        kind: "submitted",
        jobId: result.jobId,
        jobStatus: result.status,
        portraitPath: staged.portraitPath,
        lanes,
        bridgeMode,
        previewMode,
        presetId,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        error: error instanceof Error ? error.message : "うまく進めませんでした。",
      });
    }
  }

  return (
    <Panel title="この子を箱庭に迎える">
      <form className="assetgen-form" onSubmit={handleSubmit}>
        <section className="assetgen-form__simple-mode" aria-label="この子を迎える入力">
          <div className="assetgen-form__intro">
            <p>
              1枚絵、名前、ひとこと性格から、箱庭で使う候補を準備します。
              候補は自動では採用されません。確認してから使います。
            </p>
          </div>

          {bridgeMode === "fake" ? (
            <div className="assetgen-form__notice assetgen-form__notice--warning" role="note">
              {FAKE_BRIDGE_WARNING}
            </div>
          ) : null}

          <div className="assetgen-form__field assetgen-form__field--wide">
            <span id="assetgen-portrait-label" className="assetgen-form__label">見た目画像 *</span>
            <div className="assetgen-form__image-picker" aria-labelledby="assetgen-portrait-label">
              <label className="assetgen-form__file-button">
                画像を選ぶ
                <input
                  type="file"
                  accept="image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp"
                  onChange={handlePortraitFileChange}
                  disabled={isBusy}
                />
              </label>
              <div className="assetgen-form__image-summary">
                <strong>{portraitFile ? portraitFile.name : "画像ファイルを選んでください"}</strong>
                <small>個人PCのパスを入力する必要はありません。</small>
              </div>
              {portraitPreviewUrl ? (
                <figure className="assetgen-form__image-preview">
                  <img src={portraitPreviewUrl} alt="選んだ見た目画像のプレビュー" />
                </figure>
              ) : null}
            </div>
          </div>

          <div className="assetgen-form__grid">
            <label className="assetgen-form__field">
              <span className="assetgen-form__label">名前 *</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例: りん"
                disabled={isBusy}
              />
            </label>

            <label className="assetgen-form__field">
              <span className="assetgen-form__label">ひとこと性格 *</span>
              <input
                type="text"
                value={personality}
                onChange={(event) => setPersonality(event.target.value)}
                placeholder="例: 小さな変化にすぐ気づく"
                disabled={isBusy}
              />
            </label>
          </div>

          <section className="assetgen-form__presets" aria-labelledby="assetgen-preset-title">
            <div>
              <h3 id="assetgen-preset-title">候補を見る</h3>
              <p>最初に準備したい範囲を選びます。</p>
            </div>
            <div className="assetgen-form__preset-grid">
              {ASSETGEN_PRESETS.map((preset) => (
                <label
                  key={preset.id}
                  className={`assetgen-form__preset${preset.id === presetId ? " assetgen-form__preset--selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="assetgen-preset"
                    value={preset.id}
                    checked={preset.id === presetId}
                    onChange={() => setPresetId(preset.id)}
                    disabled={isBusy}
                  />
                  <span>
                    <strong>{preset.title}</strong>
                    <small>{preset.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="assetgen-form__character-check" aria-labelledby="assetgen-character-check-title">
            <div>
              <h3 id="assetgen-character-check-title">この子らしさを確認する</h3>
              <p>{selectedPreset.description}</p>
            </div>
            <ul>
              {selectedPreset.outcomes.map((outcome) => (
                <li key={outcome}>{outcome}</li>
              ))}
              <li>
                イベントで使う立ち姿の表情:
                {" "}
                {selectedPreset.includesEventExpressions ? "含みます" : "今回は含みません"}
              </li>
            </ul>
          </section>

          <details className="assetgen-form__optional-details">
            <summary>口調・年齢を足す</summary>
            <div className="assetgen-form__grid">
              <label className="assetgen-form__field">
                <span className="assetgen-form__label">口調</span>
                <input
                  type="text"
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                  placeholder="例: やわらかい敬語"
                  disabled={isBusy}
                />
              </label>

              <label className="assetgen-form__field">
                <span className="assetgen-form__label">年齢</span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  placeholder="空欄でも進められます"
                  disabled={isBusy}
                />
              </label>
            </div>
          </details>

          <div className="assetgen-form__actions">
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              {isBusy ? "準備中..." : "箱庭に迎える"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleCheckHealth} disabled={isBusy}>
              ローカル補助を確認
            </Button>
          </div>

          {status.kind === "server-ready" ? (
            <div className="assetgen-form__notice assetgen-form__notice--success" role="status">
              ローカル補助の準備ができています。
            </div>
          ) : null}

          {status.kind === "server-down" ? (
            <div className="assetgen-form__notice assetgen-form__notice--warning" role="alert">
              <strong>{LOCAL_APP_SERVER_DOWN_TITLE}</strong>
              <p>別のターミナルで次のコマンドを実行してから、もう一度試してください。</p>
              <code>{LOCAL_APP_SERVER_HELP_COMMAND}</code>
            </div>
          ) : null}

          {status.kind === "staging" || status.kind === "submitting" ? (
            <div className="assetgen-form__progress" role="status">
              <strong>
                {status.kind === "staging" ? "見た目画像を準備しています" : "制作依頼を渡しています"}
              </strong>
              <p>この画面は候補づくりまでです。できた候補はあとで確認します。</p>
            </div>
          ) : null}

          {status.kind === "submitted" ? (
            <div className="assetgen-form__progress assetgen-form__progress--success" role="status">
              <strong>{getFriendlyJobStatus(status.jobStatus)}</strong>
              <p>
                できた候補は自動では採用されません。
                「候補を見る」で確認してから、この子らしいものだけ使います。
              </p>
              {status.error ? <p>{status.error}</p> : null}
            </div>
          ) : null}

          {status.kind === "error" ? (
            <div className="assetgen-form__notice assetgen-form__notice--error" role="alert">
              <strong>{getFriendlyJobStatus("error")}</strong>
              <p>{status.error}</p>
            </div>
          ) : null}
        </section>

        <details className="assetgen-form__technical-details">
          <summary>技術詳細</summary>
          <div className="assetgen-form__technical-grid">
            <label className="assetgen-form__field">
              <span className="assetgen-form__label">識別名</span>
              <input
                type="text"
                value={assetBundleId}
                onChange={(event) => setAssetBundleId(event.target.value)}
                placeholder="空欄なら自動で決めます"
                disabled={isBusy}
              />
            </label>

            <label className="assetgen-form__field">
              <span className="assetgen-form__label">previewMode</span>
              <select
                value={previewMode}
                onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}
                disabled={isBusy}
              >
                <option value="po-combined">po-combined</option>
                <option value="canonical-two-sheet">canonical-two-sheet</option>
              </select>
            </label>

            <label className="assetgen-form__field">
              <span className="assetgen-form__label">gen2Bridge</span>
              <select
                value={bridgeMode}
                onChange={(event) => setBridgeMode(event.target.value as BridgeMode)}
                disabled={isBusy}
              >
                <option value="fake">fake</option>
                <option value="manual-drop">manual-drop</option>
                <option value="hot-folder">hot-folder</option>
                <option value="local-cli">local-cli</option>
              </select>
            </label>
          </div>

          <dl className="assetgen-form__technical-list">
            <dt>jobId</dt>
            <dd>{status.kind === "submitted" ? <code>{status.jobId}</code> : "未作成"}</dd>
            <dt>portraitPath</dt>
            <dd>
              {status.kind === "submitted" || status.kind === "submitting"
                ? <code>{status.portraitPath}</code>
                : "画像を準備すると入ります"}
            </dd>
            <dt>lanes</dt>
            <dd><code>{getPresetLanes(presetId).join(", ")}</code></dd>
            <dt>bridge mode</dt>
            <dd><code>{bridgeMode}</code></dd>
          </dl>
        </details>
      </form>
    </Panel>
  );
}
