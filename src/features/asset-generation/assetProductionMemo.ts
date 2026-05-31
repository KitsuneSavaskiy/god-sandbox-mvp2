export type AssetJobTone = "working" | "waiting" | "ready" | "blocked";

export interface AssetGenerationJobStatus {
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

export interface AssetValidationCheck {
  check?: string;
  label?: string;
  path?: string;
  passed?: boolean;
  expected?: string;
  actual?: string;
  reason?: string;
  scope?: string;
  side?: string;
  row?: number;
  column?: number;
  required?: number;
}

export interface AssetContractReport {
  candidateOnly?: boolean;
  slug?: string;
  contractId?: string;
  generatedAt?: string;
  passCount?: number;
  failCount?: number;
  hardGatePassed?: boolean;
  qualityGateStatus?: string;
  marginCheckStatus?: string;
  contentCheckStatus?: string;
  identityConsistencyNeedsHumanReview?: boolean;
  checks?: AssetValidationCheck[];
}

export interface AssetRetryFailure {
  check?: string;
  filePath?: string;
  reason?: string;
  scope?: string;
  promptPatch?: string;
}

export interface AssetRetryPlan {
  candidateOnly?: boolean;
  slug?: string;
  contractId?: string;
  generatedAt?: string;
  failures?: AssetRetryFailure[];
  passCount?: number;
  failCount?: number;
}

export interface FriendlyProgress {
  title: string;
  description: string;
  tone: AssetJobTone;
  waitingFor?: string;
}

export interface FriendlyValidationFailure {
  title: string;
  target: string;
  action: string;
  detail?: string;
}

export interface AssetProductionMemo {
  progress: FriendlyProgress;
  waitingItems: string[];
  failureItems: FriendlyValidationFailure[];
  nextActions: Array<{
    label: string;
    description: string;
    command?: string;
    path?: string;
  }>;
  warnings: string[];
  reviewPack: {
    title: string;
    description: string;
    command?: string;
    path?: string;
  };
  validation: {
    title: string;
    description: string;
    reportPath?: string;
    retryPlanPath?: string;
  };
  eventExpressions?: {
    title: string;
    description: string;
    expectedLabels: string[];
  };
  technicalDetails: Array<{ label: string; value: string }>;
}

export const EVENT_STANDING_EXPECTED_LABELS = [
  "通常",
  "笑顔",
  "怒り",
  "悲しみ",
  "驚き",
  "心配",
  "決意",
  "衝撃",
];

const FRIENDLY_STATUS: Record<string, FriendlyProgress> = {
  pending: {
    title: "制作依頼を受け取りました",
    description: "この子の候補づくりを始めるため、ローカルの作業メモを用意しています。",
    tone: "working",
    waitingFor: "特徴メモの作成",
  },
  "prompt-pack-ready": {
    title: "この子の特徴をまとめています",
    description: "名前、性格、口調、元画像をもとに、候補づくり用の特徴メモを準備しました。",
    tone: "working",
    waitingFor: "ローカル補助への受け渡し",
  },
  "gen2-dispatched": {
    title: "ローカル補助に渡しました",
    description: "候補画像を作るための受け渡しが終わりました。次は画像ファイルが届くのを待ちます。",
    tone: "waiting",
    waitingFor: "候補画像の到着",
  },
  "watcher-intake-done": {
    title: "制作の準備が整いました",
    description: "候補画像を確認するための場所と次の作業がそろいました。",
    tone: "ready",
  },
  "watcher-intake-failed": {
    title: "候補づくりの準備で止まりました",
    description: "受け取った内容を作業場所へ移すところで問題が起きました。",
    tone: "blocked",
  },
  cancelled: {
    title: "依頼を取り消しました",
    description: "この候補づくりは止まっています。必要ならもう一度送信してください。",
    tone: "blocked",
  },
  error: {
    title: "うまく進めませんでした",
    description: "入力内容、元画像、またはローカル補助の設定で止まっています。",
    tone: "blocked",
  },
};

const VALIDATION_FAILURE_COPY: Record<string, { title: string; action: string }> = {
  "file-exists": {
    title: "必要な候補がまだ届いていません",
    action: "足りない画像を incoming フォルダーに置いてから、確認をやり直してください。",
  },
  "required-content": {
    title: "画像が透明だけです",
    action: "見えるキャラクター絵が入るように、その画像を作り直してください。",
  },
  "alpha-channel": {
    title: "背景が透過されていません",
    action: "透明背景つきのPNGとして保存し直してください。",
  },
  dimensions: {
    title: "画像サイズが規格と違います",
    action: "指定された幅と高さで作り直してください。",
  },
  "pixel-margin": {
    title: "端に寄りすぎています",
    action: "キャラクターが画像やコマの端に触れないよう、余白を空けて作り直してください。",
  },
  "canvas-size-consistency": {
    title: "表情画像のサイズが揃っていません",
    action: "同じ表情セットの画像を、すべて同じ幅と高さで作り直してください。",
  },
  "png-signature": {
    title: "PNG画像として読めません",
    action: "拡張子だけでなく、中身もPNG形式になるよう保存し直してください。",
  },
};

const TERMINAL_STATUSES = new Set(["error", "cancelled", "watcher-intake-failed", "watcher-intake-done"]);

export function isAssetJobPollingTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function describeAssetJobProgress(status: string): FriendlyProgress {
  return FRIENDLY_STATUS[status] ?? {
    title: "状態を確認しています",
    description: "ローカルの制作メモを読み取り中です。",
    tone: "working",
    waitingFor: status,
  };
}

export function translateValidationFailure(check: AssetValidationCheck | AssetRetryFailure): FriendlyValidationFailure {
  const checkType = check.check ?? "unknown";
  const copy = VALIDATION_FAILURE_COPY[checkType] ?? {
    title: "自動確認で直す点があります",
    action: "詳細を確認して、対象の画像を作り直してください。",
  };
  const target =
    "label" in check && check.label
      ? check.label
      : "filePath" in check && check.filePath
        ? basenameForDisplay(check.filePath)
        : "path" in check && check.path
          ? basenameForDisplay(check.path)
          : "対象画像";

  const detailParts = [
    "reason" in check ? check.reason : undefined,
    "expected" in check && check.expected ? `期待: ${check.expected}` : undefined,
    "actual" in check && check.actual ? `実際: ${check.actual}` : undefined,
    "row" in check && typeof check.row === "number" ? `行: ${check.row}` : undefined,
    "column" in check && typeof check.column === "number" ? `列: ${check.column}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return {
    title: copy.title,
    target,
    action: "promptPatch" in check && check.promptPatch ? check.promptPatch : copy.action,
    detail: detailParts.join(" / ") || undefined,
  };
}

export function getAssetProductionMemo(
  job: AssetGenerationJobStatus,
  report = coerceContractReport(job.validationReport),
  retryPlan = coerceRetryPlan(job.retryPlan),
): AssetProductionMemo {
  const progress = describeAssetJobProgress(job.status);
  const slug = normalizeSlug(job.assetBundleId);
  const validation = buildValidationSummary(slug, report, retryPlan);
  const reviewPack = buildReviewPackSummary(slug);
  const failureItems = buildFailureItems(job, report, retryPlan);
  const waitingItems = buildWaitingItems(job, progress, report);
  const warnings = buildWarnings(job, report);
  const nextActions = buildNextActions(job, slug, report, retryPlan);
  const eventExpressions = shouldShowEventExpressions(job, report)
    ? {
        title: "イベント用の表情",
        description: "この制作では8種類の表情が必要です。足りないものがあれば、確認パックや自動確認で見つけます。",
        expectedLabels: EVENT_STANDING_EXPECTED_LABELS,
      }
    : undefined;

  return {
    progress,
    waitingItems,
    failureItems,
    nextActions,
    warnings,
    reviewPack,
    validation,
    eventExpressions,
    technicalDetails: buildTechnicalDetails(job, slug, validation, reviewPack),
  };
}

function buildValidationSummary(
  slug: string | undefined,
  report: AssetContractReport | undefined,
  retryPlan: AssetRetryPlan | undefined,
): AssetProductionMemo["validation"] {
  const reportPath = slug ? `assets/generated/residents/${slug}/qa/asset-contract-report.json` : undefined;
  const retryPlanPath = slug ? `assets/generated/residents/${slug}/qa/retry-plan.json` : undefined;

  if (!report) {
    return {
      title: "自動確認レポートはまだありません",
      description: "候補画像が届いたあと、サイズや透過などの確認結果がここに入ります。",
      reportPath,
      retryPlanPath,
    };
  }

  const failCount = report.failCount ?? report.checks?.filter((check) => check.passed === false).length ?? 0;
  if (failCount > 0) {
    return {
      title: "自動確認で直す点があります",
      description: `通った確認は ${report.passCount ?? 0} 件、直す確認は ${failCount} 件です。修正案があれば下に表示します。`,
      reportPath,
      retryPlanPath,
    };
  }

  const humanReview = report.identityConsistencyNeedsHumanReview
    ? " ただし、同じキャラクターに見えるかは人の確認が必要です。"
    : "";

  return {
    title: "自動確認は通っています",
    description: `サイズ、透過、必須ファイルの確認では大きな問題は見つかっていません。${humanReview}`,
    reportPath,
    retryPlanPath: retryPlan ? retryPlanPath : undefined,
  };
}

function buildReviewPackSummary(slug: string | undefined): AssetProductionMemo["reviewPack"] {
  if (!slug) {
    return {
      title: "確認パックはまだ準備中です",
      description: "候補づくりの名前を取得できたら、確認パックの場所と作成コマンドを表示します。",
    };
  }

  return {
    title: "確認パックを準備する",
    description: "候補画像を見比べるHTMLを作れます。ブラウザから直接開けない場合は、下のパスを開いてください。",
    command: `npm run assetgen:review-pack -- --slug ${slug}`,
    path: `assets/generated/residents/${slug}/review-pack/index.html`,
  };
}

function buildFailureItems(
  job: AssetGenerationJobStatus,
  report: AssetContractReport | undefined,
  retryPlan: AssetRetryPlan | undefined,
): FriendlyValidationFailure[] {
  const retryFailures = retryPlan?.failures ?? [];
  if (retryFailures.length > 0) {
    return retryFailures.map(translateValidationFailure);
  }

  const failedChecks = report?.checks?.filter((check) => check.passed === false) ?? [];
  if (failedChecks.length > 0) {
    return failedChecks.map(translateValidationFailure);
  }

  const failureReason = job.failureReason ?? job.error;
  if (failureReason) {
    return [{
      title: job.status === "watcher-intake-failed" ? "作業場所への受け渡しで止まりました" : "候補づくりが止まりました",
      target: job.assetBundleId ?? job.jobId,
      action: "入力内容、元画像の場所、ローカル補助の設定を確認してください。",
      detail: failureReason,
    }];
  }

  return [];
}

function buildWaitingItems(
  job: AssetGenerationJobStatus,
  progress: FriendlyProgress,
  report: AssetContractReport | undefined,
): string[] {
  const items: string[] = [];

  if (progress.waitingFor) items.push(progress.waitingFor);
  if (job.status === "gen2-dispatched") {
    items.push("候補画像が incoming フォルダーへ届くこと");
  }
  if (!report) {
    items.push("候補画像の自動確認レポート");
  }
  if (job.lanes?.includes("event-standing-expressions")) {
    items.push("イベント用の表情8枚");
  }

  return [...new Set(items)];
}

function buildWarnings(job: AssetGenerationJobStatus, report: AssetContractReport | undefined): string[] {
  const warnings: string[] = [];
  if (job.gen2Bridge === "fake" || job.validationOnly === true || job.candidateEligible === false) {
    warnings.push("これは動作確認用です。見た目候補としては使えません。");
  }
  if (report?.identityConsistencyNeedsHumanReview) {
    warnings.push("表情が同じキャラクターに見えるかは、自動では判断できません。人の確認が必要です。");
  }
  return warnings;
}

function buildNextActions(
  job: AssetGenerationJobStatus,
  slug: string | undefined,
  report: AssetContractReport | undefined,
  retryPlan: AssetRetryPlan | undefined,
): AssetProductionMemo["nextActions"] {
  const actions: AssetProductionMemo["nextActions"] = [];

  if (job.status === "error" || job.status === "watcher-intake-failed") {
    actions.push({
      label: "止まった理由を確認する",
      description: "下の開発者向け詳細で、元のエラー文と対象パスを確認します。",
    });
  }

  if (slug) {
    actions.push({
      label: "確認パックを準備する",
      description: "候補画像を一覧で見られるHTMLを作ります。",
      command: `npm run assetgen:review-pack -- --slug ${slug}`,
      path: `assets/generated/residents/${slug}/review-pack/index.html`,
    });
  }

  if (slug && !report) {
    actions.push({
      label: "自動確認を実行する",
      description: "サイズ、透過、余白、空画像を確認します。必要な契約IDは作った候補の種類に合わせて選びます。",
      command: `npm run assetgen:validate-contract -- --slug ${slug} --contract resident-po-combined-preview-v1 --asset-dir assets/generated/residents/${slug}/incoming`,
      path: `assets/generated/residents/${slug}/qa/asset-contract-report.json`,
    });
  }

  if (retryPlan?.failures && retryPlan.failures.length > 0) {
    actions.push({
      label: "修正案に沿って作り直す",
      description: "下の修正案を生成側の指示に反映して、対象画像だけを作り直します。",
      path: slug ? `assets/generated/residents/${slug}/qa/retry-plan.md` : undefined,
    });
  }

  return actions;
}

function buildTechnicalDetails(
  job: AssetGenerationJobStatus,
  slug: string | undefined,
  validation: AssetProductionMemo["validation"],
  reviewPack: AssetProductionMemo["reviewPack"],
): AssetProductionMemo["technicalDetails"] {
  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "jobId", value: job.jobId },
    { label: "raw status", value: job.status },
    { label: "assetBundleId", value: slug },
    { label: "previewMode", value: job.previewMode },
    { label: "gen2Bridge", value: job.gen2Bridge },
    { label: "lanes", value: job.lanes?.join(", ") },
    { label: "status file", value: `.godsandbox/jobs/local-app-server/${job.jobId}.json` },
    { label: "watcher request", value: `.godsandbox/jobs/${job.jobId}-request.json` },
    { label: "promptPackDir", value: job.promptPackDir },
    { label: "handoffPath", value: job.handoffPath },
    { label: "handoffType", value: job.handoffType },
    { label: "validationOnly", value: formatBoolean(job.validationOnly) },
    { label: "candidateEligible", value: formatBoolean(job.candidateEligible) },
    { label: "validation report", value: validation.reportPath },
    { label: "retry plan", value: validation.retryPlanPath },
    { label: "review pack", value: reviewPack.path },
    { label: "error", value: job.error ?? job.failureReason },
    { label: "createdAt", value: job.createdAt },
    { label: "updatedAt", value: job.updatedAt ?? job.watcherUpdatedAt },
  ];

  return rows
    .filter((row): row is { label: string; value: string } => row.value !== undefined && row.value !== null && row.value !== "")
    .map((row) => ({ label: row.label, value: row.value }));
}

function shouldShowEventExpressions(job: AssetGenerationJobStatus, report: AssetContractReport | undefined): boolean {
  return Boolean(
    job.lanes?.includes("event-standing-expressions") ||
    report?.contractId === "event-standing-expression-set-v1",
  );
}

function coerceContractReport(input: unknown): AssetContractReport | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  return input as AssetContractReport;
}

function coerceRetryPlan(input: unknown): AssetRetryPlan | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  return input as AssetRetryPlan;
}

function normalizeSlug(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function basenameForDisplay(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  return normalized.split("/").filter(Boolean).pop() ?? filePath;
}

function formatBoolean(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "true" : "false";
}
