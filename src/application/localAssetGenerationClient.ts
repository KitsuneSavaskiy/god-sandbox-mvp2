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

export interface HealthCheckResult {
  ok: boolean;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

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
        throw new Error("リクエストがタイムアウトしました — AppServerが起動しているか確認してください");
      }
      throw new Error(`AppServerに接続できません — 起動しているか確認してください (${msg})`);
    }

    if (res.status === 422) {
      let details: string[] = [];
      try {
        const body = (await res.json()) as { error?: string; details?: string[] };
        details = body.details ?? (body.error ? [body.error] : []);
      } catch {
        // ignore JSON parse error
      }
      const detail = details.length > 0 ? `: ${details.join("; ")}` : "";
      throw new Error(`入力検証エラー (HTTP 422)${detail}`);
    }

    if (res.status === 400) {
      let msg = "リクエストエラー (HTTP 400)";
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = `${msg}: ${body.error}`;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    if (!res.ok) {
      throw new Error(`AppServerエラー (HTTP ${res.status})`);
    }

    const data = (await res.json()) as { jobId: string; status: string };
    return { jobId: data.jobId, status: data.status };
  }

  return { checkHealth, createCharacterJob };
}
