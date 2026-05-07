const SIDEKICK_JOB_VERSION = "godsandbox-sidekick-job/v0";

const SUPPORTED_JOB_TYPES = ["character-asset-bundle", "character-narrative-pack"] as const;

const ASSET_REQUESTED_OUTPUTS = [
  "residentSpriteSheet",
  "portraitExpressions",
  "derivedIcon",
] as const;

const NARRATIVE_REQUESTED_OUTPUTS = [
  "voiceProfile",
  "dialogueLines",
  "commentBubbles",
  "eventSeeds",
  "interventionResponses",
  "storyLogCandidates",
] as const;

const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9_-]{1,64}$/;
const CHARACTER_ID_PATTERN = /^chr_[a-z0-9_-]{1,60}$/;

type SupportedJobType = (typeof SUPPORTED_JOB_TYPES)[number];

type CharacterProfile = {
  displayName: string;
  personality: string;
  tone: string;
  age: number;
  portraitRef: string;
};

type SidekickJobBase = {
  jobVersion: typeof SIDEKICK_JOB_VERSION;
  jobId: string;
  jobType: SupportedJobType;
  createdAt: string;
  characterId: string;
  assetBundleId: string;
  worldDirectoryName: string;
  characterProfile: CharacterProfile;
  requestedOutputs: Record<string, unknown>;
};

export type CharacterAssetBundleJob = SidekickJobBase & {
  jobType: "character-asset-bundle";
};

export type CharacterNarrativePackJob = SidekickJobBase & {
  jobType: "character-narrative-pack";
};

export type SidekickJob = CharacterAssetBundleJob | CharacterNarrativePackJob;

export type SidekickJobValidationIssueCode =
  | "missing-field"
  | "invalid-field"
  | "unsupported-job-type"
  | "invalid-requested-output"
  | "unsafe-content";

export type SidekickJobValidationIssue = {
  code: SidekickJobValidationIssueCode;
  path: string;
  message: string;
};

export type SidekickJobValidationResult =
  | {
      ok: true;
      job: SidekickJob;
      issues: [];
    }
  | {
      ok: false;
      issues: SidekickJobValidationIssue[];
    };

type JsonRecord = Record<string, unknown>;

export function validateSidekickJob(input: unknown): SidekickJobValidationResult {
  const issues: SidekickJobValidationIssue[] = [];

  if (!isPlainRecord(input)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-field",
          path: "$",
          message: "Job must be a JSON object.",
        },
      ],
    };
  }

  collectUnsafeContentIssues(input, "$", issues);
  validateRequiredString(input, "jobVersion", issues, (value) => value === SIDEKICK_JOB_VERSION);
  validateRequiredString(input, "jobId", issues, isSafeIdentifier);
  validateJobType(input, issues);
  validateRequiredString(input, "createdAt", issues, isIsoDateString);
  validateRequiredString(input, "characterId", issues, isCharacterId);
  validateRequiredString(input, "assetBundleId", issues, isAssetBundleId);
  validateCharacterAssetBoundary(input, issues);
  validateRequiredString(input, "worldDirectoryName", issues, isWorldDirectoryName);
  validateCharacterProfile(input, issues);
  validateRequestedOutputs(input, issues);

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  return {
    ok: true,
    job: input as SidekickJob,
    issues: [],
  };
}

export function formatSidekickJobValidationIssues(
  issues: SidekickJobValidationIssue[],
): string[] {
  return issues.map((issue) => `${issue.path}: ${issue.message}`);
}

function validateRequiredString(
  input: JsonRecord,
  fieldName: keyof SidekickJobBase,
  issues: SidekickJobValidationIssue[],
  predicate: (value: string) => boolean,
): void {
  const value = input[fieldName];
  if (typeof value !== "string" || value.length === 0) {
    issues.push({
      code: "missing-field",
      path: String(fieldName),
      message: `${String(fieldName)} is required.`,
    });
    return;
  }

  if (!predicate(value)) {
    issues.push({
      code: "invalid-field",
      path: String(fieldName),
      message: `${String(fieldName)} has an invalid format.`,
    });
  }
}

function validateJobType(input: JsonRecord, issues: SidekickJobValidationIssue[]): void {
  const jobType = input.jobType;
  if (typeof jobType !== "string" || jobType.length === 0) {
    issues.push({
      code: "missing-field",
      path: "jobType",
      message: "jobType is required.",
    });
    return;
  }

  if (!isSupportedJobType(jobType)) {
    issues.push({
      code: "unsupported-job-type",
      path: "jobType",
      message: "jobType is not supported by this validator.",
    });
  }
}

function validateCharacterAssetBoundary(
  input: JsonRecord,
  issues: SidekickJobValidationIssue[],
): void {
  if (typeof input.characterId !== "string" || typeof input.assetBundleId !== "string") {
    return;
  }

  if (input.characterId === input.assetBundleId) {
    issues.push({
      code: "invalid-field",
      path: "assetBundleId",
      message: "characterId and assetBundleId must be different fields.",
    });
  }

  if (input.assetBundleId.startsWith("chr_")) {
    issues.push({
      code: "invalid-field",
      path: "assetBundleId",
      message: "assetBundleId must be an asset key, not a character id.",
    });
  }

  const expectedAssetBundleId = input.characterId.replace(/^chr_/, "");
  if (expectedAssetBundleId && input.assetBundleId !== expectedAssetBundleId) {
    issues.push({
      code: "invalid-field",
      path: "assetBundleId",
      message: "assetBundleId must match the characterId slug in MVP jobs.",
    });
  }
}

function validateCharacterProfile(input: JsonRecord, issues: SidekickJobValidationIssue[]): void {
  const profile = input.characterProfile;
  if (!isPlainRecord(profile)) {
    issues.push({
      code: "missing-field",
      path: "characterProfile",
      message: "characterProfile is required.",
    });
    return;
  }

  if (typeof profile.displayName !== "string" || profile.displayName.trim().length === 0) {
    issues.push({ code: "missing-field", path: "characterProfile.displayName", message: "displayName is required." });
  }
  if (typeof profile.personality !== "string" || profile.personality.trim().length === 0) {
    issues.push({ code: "missing-field", path: "characterProfile.personality", message: "personality is required." });
  }
  if (typeof profile.tone !== "string" || profile.tone.trim().length === 0) {
    issues.push({ code: "missing-field", path: "characterProfile.tone", message: "tone is required." });
  }
  if (typeof profile.age !== "number" || !Number.isInteger(profile.age) || profile.age < 0) {
    issues.push({ code: "invalid-field", path: "characterProfile.age", message: "age must be a non-negative integer." });
  }
  if (typeof profile.portraitRef !== "string" || profile.portraitRef.trim().length === 0) {
    issues.push({ code: "missing-field", path: "characterProfile.portraitRef", message: "portraitRef is required." });
  }
}

function validateRequestedOutputs(input: JsonRecord, issues: SidekickJobValidationIssue[]): void {
  const requestedOutputs = input.requestedOutputs;
  if (!isPlainRecord(requestedOutputs)) {
    issues.push({
      code: "missing-field",
      path: "requestedOutputs",
      message: "requestedOutputs is required.",
    });
    return;
  }

  const outputNames = Object.keys(requestedOutputs);
  if (outputNames.length === 0) {
    issues.push({
      code: "invalid-requested-output",
      path: "requestedOutputs",
      message: "requestedOutputs must include at least one output.",
    });
    return;
  }

  if (!isSupportedJobType(input.jobType)) {
    return;
  }

  const allowedOutputs =
    input.jobType === "character-asset-bundle"
      ? ASSET_REQUESTED_OUTPUTS
      : NARRATIVE_REQUESTED_OUTPUTS;
  const allowedOutputSet = new Set<string>(allowedOutputs);
  let hasEnabledOutput = false;

  for (const outputName of outputNames) {
    if (!allowedOutputSet.has(outputName)) {
      issues.push({
        code: "invalid-requested-output",
        path: `requestedOutputs.${outputName}`,
        message: "requested output is not allowed for this job type.",
      });
      continue;
    }

    if (requestedOutputs[outputName] !== true) {
      issues.push({
        code: "invalid-requested-output",
        path: `requestedOutputs.${outputName}`,
        message: "requested output value must be true.",
      });
      continue;
    }

    hasEnabledOutput = true;
  }

  if (!hasEnabledOutput) {
    issues.push({
      code: "invalid-requested-output",
      path: "requestedOutputs",
      message: "requestedOutputs must include at least one enabled output.",
    });
  }
}

function collectUnsafeContentIssues(
  value: unknown,
  path: string,
  issues: SidekickJobValidationIssue[],
): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectUnsafeContentIssues(item, `${path}[${index}]`, issues);
    }
    return;
  }

  if (isPlainRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      const childPath = path === "$" ? key : `${path}.${key}`;
      if (looksLikeSensitiveKey(key)) {
        issues.push({
          code: "unsafe-content",
          path: childPath,
          message: "sensitive-looking field is not allowed in job JSON.",
        });
        continue;
      }

      collectUnsafeContentIssues(item, childPath, issues);
    }
    return;
  }

  if (typeof value === "string") {
    if (looksLikeSecretValue(value)) {
      issues.push({
        code: "unsafe-content",
        path,
        message: "secret-looking value is not allowed in job JSON.",
      });
    }

    if (looksLikeHostAbsolutePath(value)) {
      issues.push({
        code: "unsafe-content",
        path,
        message: "host absolute path is not allowed in job JSON.",
      });
    }
  }
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedJobType(value: unknown): value is SupportedJobType {
  return typeof value === "string" && SUPPORTED_JOB_TYPES.includes(value as SupportedJobType);
}

function isSafeIdentifier(value: string): boolean {
  return SAFE_IDENTIFIER_PATTERN.test(value);
}

function isCharacterId(value: string): boolean {
  return CHARACTER_ID_PATTERN.test(value);
}

function isAssetBundleId(value: string): boolean {
  return isSafeIdentifier(value) && !value.startsWith("chr_");
}

function isWorldDirectoryName(value: string): boolean {
  return SAFE_IDENTIFIER_PATTERN.test(value);
}

function isIsoDateString(value: string): boolean {
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && value.includes("T");
}

function looksLikeSensitiveKey(key: string): boolean {
  return /(?:api[_-]?key|secret|token|pat|password|credential|private[_-]?key)/i.test(key);
}

function looksLikeSecretValue(value: string): boolean {
  return (
    /sk-[A-Za-z0-9_-]{16,}/.test(value) ||
    /ghp_[A-Za-z0-9_]{16,}/.test(value) ||
    /gh[ousr]_[A-Za-z0-9_]{16,}/.test(value) ||
    /github_pat_[A-Za-z0-9_]{16,}/.test(value) ||
    /xox[baprs]-[A-Za-z0-9-]{16,}/.test(value) ||
    /AKIA[0-9A-Z]{16}/.test(value) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)
  );
}

function looksLikeHostAbsolutePath(value: string): boolean {
  return (
    /^[A-Za-z]:[\\/]/.test(value) ||
    /^\\\\[^\\]+\\[^\\]+/.test(value) ||
    /^\/(?:Users|home)\/[^/]+/.test(value) ||
    /^file:\/\//i.test(value)
  );
}
