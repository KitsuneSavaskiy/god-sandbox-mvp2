import type { AssetId, CharacterId } from "../domain/models.js";

export type SpriteSheetMotionName =
  | "idle"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review"
  | "walk-up"
  | "walk-down"
  | "walk-left"
  | "walk-right"
  | "walk-forward"
  | "walk-back"
  | "emote-happy"
  | "emote-angry"
  | "emote-sad"
  | "emote-surprised";

export type SpriteSheetKind = "motion" | "extended";

export type SpriteSheetMotionSlot = {
  row: number;
  frames: number;
};

export type SpriteSheetMetadata = {
  kind: SpriteSheetKind;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  motions: Partial<Record<SpriteSheetMotionName, SpriteSheetMotionSlot>>;
};

export const REQUIRED_MOTION_SHEET_MOTIONS = [
  "idle",
  "walk-right",
  "walk-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
] as const satisfies readonly SpriteSheetMotionName[];

export const REQUIRED_EXTENDED_SHEET_MOTIONS = [
  "walk-up",
  "walk-down",
  "walk-forward",
  "walk-back",
  "emote-happy",
  "emote-angry",
  "emote-sad",
  "emote-surprised",
] as const satisfies readonly SpriteSheetMotionName[];

export type AssetReadinessStatus =
  | "ready"
  | "needs_review"
  | "placeholder"
  | "rejected"
  | "missing";

export type AssetReadyApproval = {
  approvedBy: string;
  approvedAt: string;
  approvalRole: "PO" | "manual-reviewer";
};

export function promoteAssetToReady(input: {
  currentStatus: AssetReadinessStatus;
  review: AssetReadyApproval;
}): "ready" {
  if (input.currentStatus !== "needs_review") {
    throw new Error(
      `Cannot promote to ready from '${input.currentStatus}'. Asset must be in 'needs_review' state first.`
    );
  }
  if (!input.review.approvedBy || !input.review.approvedAt) {
    throw new Error("Cannot promote to ready without approvedBy and approvedAt.");
  }
  if (input.review.approvalRole !== "PO" && input.review.approvalRole !== "manual-reviewer") {
    throw new Error(
      `Invalid approvalRole '${String(input.review.approvalRole)}'. Must be 'PO' or 'manual-reviewer'.`,
    );
  }
  return "ready";
}

export type AssetMissingReason =
  | "not-generated-yet"
  | "asset-not-registered"
  | "source-not-adopted"
  | "rejected"
  | "invalid-metadata";

export type AssetManifestEntry = {
  id: AssetId;
  ownerCharacterId?: CharacterId;
  kind:
    | "appearance-source"
    | "appearance-variant"
    | "icon"
    | "sprite-sheet"
    | "sprite-sheet-extended"
    | "video-source";
  status?: AssetReadinessStatus;
  sourcePath?: string;
  publicPath?: string;
  relativePath?: string;
  plannedRelativePath?: string;
  contentHash?: string;
  fallbackAssetId?: AssetId;
  generatedFromAssetIds?: AssetId[];
  isPlaceholder?: boolean;
  missingReason?: AssetMissingReason;
  spriteSheet?: SpriteSheetMetadata;
};

export type AssetManifest = {
  saveVersion: number;
  updatedAt: string;
  entries: AssetManifestEntry[];
};

export function getRequiredSpriteSheetMotions(
  kind: SpriteSheetKind,
): readonly SpriteSheetMotionName[] {
  return kind === "motion"
    ? REQUIRED_MOTION_SHEET_MOTIONS
    : REQUIRED_EXTENDED_SHEET_MOTIONS;
}

export function assertRequiredSpriteSheetMotions(
  metadata: SpriteSheetMetadata,
  assetId = "sprite-sheet",
): SpriteSheetMetadata {
  const missing = getRequiredSpriteSheetMotions(metadata.kind).filter(
    (motion) => metadata.motions[motion] === undefined,
  );
  if (missing.length > 0) {
    throw new Error(
      `Sprite sheet metadata is missing required ${metadata.kind} rows for ${assetId}: ${missing.join(", ")}`,
    );
  }
  return metadata;
}

export function resolveAssetRelativePath(
  manifest: AssetManifest,
  assetId: AssetId,
): string {
  const entry = manifest.entries.find((item) => item.id === assetId);
  if (!entry || !entry.relativePath || entry.isPlaceholder) {
    throw new Error(`Asset not found in manifest: ${assetId}`);
  }
  return entry.relativePath;
}
