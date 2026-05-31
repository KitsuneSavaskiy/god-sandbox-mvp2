/**
 * Local Asset Generation Client
 *
 * Calls the GodSandbox Local AppServer at http://127.0.0.1:8787.
 * NEVER calls external image APIs. NEVER reads or uses API keys.
 *
 * The server is a local-only loopback process (tools/app-server/asset-generation-server.mjs).
 * Generated output goes to .godsandbox/jobs/ and assets/generated/ — both gitignored.
 * Promotion to public/art/ happens only via a separate PO approval flow.
 */

export interface CreateCharacterJobParams {
  displayName: string;
  personality: string;
  tone: string;
  age: number;
  /** Repo-relative path to an existing .png file (e.g. "assets/generated/residents/mychar/reference/portrait.png") */
  portraitPath: string;
  assetBundleId?: string;
  previewMode?: "po-combined" | "canonical-two-sheet";
  gen2Bridge?: "fake" | "manual-drop" | "hot-folder" | "local-cli";
  lanes?: string[];
}

export interface CreateCharacterJobResult {
  jobId: string;
  status: string;
}

export interface StagePortraitFileResult {
  slug: string;
  portraitPath: string;
  bytes: number;
  status: "staged";
}

export interface LocalAssetGenerationJobStatus {
  jobId: string;
  status: string;
  assetBundleId?: string | null;
  lanes?: string[];
  previewMode?: string | null;
  gen2Bridge?: string | null;
  promptPackDir?: string | null;
  promptPackFiles?: string[];
  handoffPath?: string | null;
  handoffType?: string | null;
  validationOnly?: boolean;
  candidateEligible?: boolean;
  error?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  watcherUpdatedAt?: string | null;
  validationReport?: unknown;
  retryPlan?: unknown;
}

export interface HealthCheckResult {
  ok: boolean;
  error?: string;
}

export class LocalAssetGenerationError extends Error {
  statusCode?: number;
  details: string[];

  constructor(message: string, options: { statusCode?: number; details?: string[] } = {}) {
    super(message);
    this.name = "LocalAssetGenerationError";
    this.statusCode = options.statusCode;
    this.details = options.details ?? [];
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const PORTRAIT_UPLOAD_TIMEOUT_MS = 30_000;

function makeAbortController(): { controller: AbortController; timerId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return { controller, timerId };
}

/**
 * Creates a client pointing at the given base URL.
 * Default base URL: http://127.0.0.1:8787 (loopback only).
 */
export function createLocalAssetGenerationClient(baseUrl = "http://127.0.0.1:8787") {
  async function checkHealth(): Promise<HealthCheckResult> {
    const { controller, timerId } = makeAbortController();
    try {
      const res = await fetch(`${baseUrl}/healthz`, { signal: controller.signal });
      clearTimeout(timerId);
      if (res.ok) return { ok: true };
      return { ok: false, error: `AppServer returned HTTP ${res.status}` };
    } catch (err) {
      clearTimeout(timerId);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("aborted") || msg.includes("abort")) {
        return { ok: false, error: "AppServer応答タイムアウト — 起動していない可能性があります" };
      }
      return { ok: false, error: `AppServerに接続できません — 起動しているか確認してください (${msg})` };
    }
  }

  async function createCharacterJob(params: CreateCharacterJobParams): Promise<CreateCharacterJobResult> {
    const { controller, timerId } = makeAbortController();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/local/asset-generation/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timerId);
    } catch (err) {
      clearTimeout(timerId);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("aborted") || msg.includes("abort")) {
        throw new LocalAssetGenerationError(
          "送信に時間がかかりすぎました。AppServer が起動しているか確認してください。",
          { details: ["request timeout"] },
        );
      }
      throw new LocalAssetGenerationError(
        "AppServer に接続できません。起動しているか確認してください。",
        { details: [msg] },
      );
    }

    if (res.status === 422) {
      let details: string[] = [];
      try {
        const body = (await res.json()) as { error?: string; details?: string[] };
        details = body.details ?? (body.error ? [body.error] : []);
      } catch {
        // ignore JSON parse error
      }
      throw new LocalAssetGenerationError(
        "入力内容を確認してください。必須項目、立ち絵パス、画像形式のどれかが条件に合っていません。",
        { statusCode: 422, details },
      );
    }

    if (res.status === 400) {
      let detail = "HTTP 400";
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) detail = body.error;
      } catch {
        // ignore
      }
      throw new LocalAssetGenerationError(
        "ローカル補助の設定を確認してください。候補づくりを始める前の設定で止まりました。",
        { statusCode: 400, details: [detail] },
      );
    }

    if (!res.ok) {
      throw new LocalAssetGenerationError(
        "AppServer 側でエラーが起きました。少し待ってから、開発者向け詳細を確認してください。",
        { statusCode: res.status, details: [`HTTP ${res.status}`] },
      );
    }

    const data = (await res.json()) as { jobId: string; status: string };
    return { jobId: data.jobId, status: data.status };
  }

  async function getJobStatus(jobId: string): Promise<LocalAssetGenerationJobStatus> {
    const { controller, timerId } = makeAbortController();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/local/asset-generation/jobs/${encodeURIComponent(jobId)}`, {
        signal: controller.signal,
      });
      clearTimeout(timerId);
    } catch (err) {
      clearTimeout(timerId);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("aborted") || msg.includes("abort")) {
        throw new LocalAssetGenerationError(
          "制作メモの確認に時間がかかりすぎました。AppServer が動いているか確認してください。",
          { details: ["request timeout"] },
        );
      }
      throw new LocalAssetGenerationError(
        "制作メモを読み取れません。AppServer が起動しているか確認してください。",
        { details: [msg] },
      );
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) detail = `${detail}: ${body.error}`;
      } catch {
        // ignore
      }
      throw new LocalAssetGenerationError(
        res.status === 404
          ? "制作メモがまだ見つかりません。同じ作業場所で AppServer が動いているか確認してください。"
          : "制作メモの読み取りでエラーが起きました。",
        { statusCode: res.status, details: [detail] },
      );
    }

    return (await res.json()) as LocalAssetGenerationJobStatus;
  }

  async function stagePortraitFile(file: File, slug: string): Promise<StagePortraitFileResult> {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), PORTRAIT_UPLOAD_TIMEOUT_MS);
    let res: Response;
    const mediaType = file.type === "image/png" ? "image/png" : "application/octet-stream";
    try {
      res = await fetch(`${baseUrl}/api/local/asset-generation/portraits?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": mediaType },
        body: file,
        signal: controller.signal,
      });
      clearTimeout(timerId);
    } catch (err) {
      clearTimeout(timerId);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("aborted") || msg.includes("abort")) {
        throw new LocalAssetGenerationError(
          "立ち絵アップロードがタイムアウトしました。AppServer が起動しているか確認してください。",
          { details: ["request timeout"] },
        );
      }
      throw new LocalAssetGenerationError(
        "AppServer に接続できません。起動しているか確認してください。",
        { details: [msg] },
      );
    }

    if (res.status === 413) {
      throw new LocalAssetGenerationError(
        "立ち絵PNGが大きすぎます。10MB以下のPNGを選んでください。",
        { statusCode: 413, details: ["max upload size is 10MB"] },
      );
    }

    if (res.status === 415 || res.status === 422 || res.status === 400) {
      let details: string[] = [];
      try {
        const body = (await res.json()) as { error?: string; details?: string[] };
        details = body.details ?? (body.error ? [body.error] : []);
      } catch {
        // ignore JSON parse error
      }
      throw new LocalAssetGenerationError(
        "立ち絵PNGを確認してください。PNG形式、slug、ファイルサイズのどれかが条件に合っていません。",
        { statusCode: res.status, details },
      );
    }

    if (!res.ok) {
      throw new LocalAssetGenerationError(
        "AppServer 側で立ち絵の一時保存に失敗しました。",
        { statusCode: res.status, details: [`HTTP ${res.status}`] },
      );
    }

    const data = (await res.json()) as StagePortraitFileResult;
    return {
      slug: data.slug,
      portraitPath: data.portraitPath,
      bytes: data.bytes,
      status: data.status,
    };
  }

  return { checkHealth, createCharacterJob, getJobStatus, stagePortraitFile };
}
