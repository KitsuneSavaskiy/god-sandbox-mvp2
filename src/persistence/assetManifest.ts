import type { AssetId, CharacterId } from "../domain/models.js";

export type SpriteSheetMotionName =
  | "idle"
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

export type SpriteSheetMotionSlot = {
  row: number;
  frames: number;
};

export type SpriteSheetMetadata = {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  motions: Record<SpriteSheetMotionName, SpriteSheetMotionSlot>;
};

export type AssetReadinessStatus = "ready" | "placeholder" | "rejected" | "missing";

export type AssetMissingReason =
  | "not-generated-yet"
  | "asset-not-registered"
  | "source-not-adopted"
  | "rejected";

export type AssetManifestEntry = {
  id: AssetId;
  ownerCharacterId?: CharacterId;
  kind:
    | "appearance-source"
    | "appearance-variant"
    | "icon"
    | "sprite-sheet"
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
