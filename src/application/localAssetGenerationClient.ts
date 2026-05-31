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
  portraitPath: string;
}

export interface CharacterJobStatusResult {
  jobId: string;
  status: string;
  error?: string;
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
      if (res.ok) return { ok: true };
      return { ok: false, error: "ローカル補助が応答できませんでした。" };
    } catch {
      return { ok: false, error: "ローカル補助がまだ準備中です。" };
    } finally {
      clearTimeout(timerId);
    }
  }

  async function stagePortraitFile(file: File, slug: string): Promise<StagePortraitFileResult> {
    const { controller, timerId } = makeAbortController();
    const formData = new FormData();
    formData.append("portrait", file);
    formData.append("slug", slug);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/local/asset-generation/portraits`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
    } catch {
      throw new Error("見た目画像をローカル補助へ渡せませんでした。ローカル補助の準備を確認してください。");
    } finally {
      clearTimeout(timerId);
    }

    if (res.status === 404 || res.status === 405) {
      throw new Error(
        "見た目画像を準備する機能がまだ使えません。準備が終わってからもう一度試してください。",
      );
    }

    if (!res.ok) {
      throw new Error("見た目画像を準備できませんでした。画像ファイルを確認してください。");
    }

    let data: { portraitPath?: unknown };
    try {
      data = (await res.json()) as { portraitPath?: unknown };
    } catch {
      throw new Error("見た目画像の準備結果を読み取れませんでした。");
    }

    if (typeof data.portraitPath !== "string" || data.portraitPath.trim().length === 0) {
      throw new Error("見た目画像の保存先を受け取れませんでした。");
    }

    return { portraitPath: data.portraitPath };
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
        throw new Error("ローカル補助の返事が間に合いませんでした。もう一度試してください。");
      }
      throw new Error("ローカル補助へつながりませんでした。準備ができているか確認してください。");
    }

    if (res.status === 422) {
      try {
        await res.json();
      } catch {
        // ignore JSON parse error
      }
      throw new Error("入力内容を確認してください。画像ファイルが使えるか、ローカル補助の設定を見てください。");
    }

    if (res.status === 400) {
      let msg = "ローカル補助の設定を確認してください。";
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error?.includes("gen2Bridge")) {
          msg = "ローカル補助の技術設定がまだ準備できていません。";
        }
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    if (!res.ok) {
      throw new Error("ローカル補助で処理できませんでした。少し待ってから再度試してください。");
    }

    const data = (await res.json()) as { jobId: string; status: string };
    return { jobId: data.jobId, status: data.status };
  }

  async function getCharacterJobStatus(jobId: string): Promise<CharacterJobStatusResult> {
    const { controller, timerId } = makeAbortController();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/local/asset-generation/jobs/${encodeURIComponent(jobId)}`, {
        signal: controller.signal,
      });
    } catch {
      throw new Error("制作状況を確認できませんでした。");
    } finally {
      clearTimeout(timerId);
    }

    if (!res.ok) {
      throw new Error("制作状況を確認できませんでした。");
    }

    const data = (await res.json()) as { jobId?: string; status?: string; error?: string };
    return {
      jobId: data.jobId ?? jobId,
      status: data.status ?? "pending",
      error: data.error,
    };
  }

  return { checkHealth, stagePortraitFile, createCharacterJob, getCharacterJobStatus };
}
