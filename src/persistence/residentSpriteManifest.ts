import type { AssetId, CharacterId } from "../domain/models.js";
import type {
  AssetManifest,
  AssetManifestEntry,
  AssetMissingReason,
  AssetReadinessStatus,
  SpriteSheetKind,
  SpriteSheetMotionName,
  SpriteSheetMotionSlot,
} from "./assetManifest.js";

export const RESIDENT_SPRITE_MANIFEST_SCHEMA_VERSION =
  "resident-sprite-manifest-v1";

export type ResidentSpriteFrameSize = {
  width: number;
  height: number;
};

export type ResidentSpriteManifestSpriteSheet = {
  assetId: AssetId;
  status: AssetReadinessStatus;
  sourcePath?: string;
  publicPath?: string;
  frameSize: ResidentSpriteFrameSize;
  columns: number;
  rows: number;
  motions: Partial<Record<SpriteSheetMotionName, SpriteSheetMotionSlot>>;
  fallbackAssetId?: AssetId;
  missingReason?: AssetMissingReason;
  kind?: SpriteSheetKind;
};

export type ResidentSpriteManifestEntry = {
  residentId: CharacterId;
  spriteSheet: ResidentSpriteManifestSpriteSheet;
};

export type ResidentSpriteManifest = {
  schemaVersion: typeof RESIDENT_SPRITE_MANIFEST_SCHEMA_VERSION;
  updatedAt: string;
  residents: ResidentSpriteManifestEntry[];
};

// Legacy bridge for older motion-sheet-only data.
// The 2-sheet ready contract lives in defaultCharacterAssetManifest.ts and
// characterAssetBundles.ts. Do not use this bridge to promote a resident ready.

const unmanagedAssetPathSegments = new Set([
  "incoming",
  "_incoming",
  "tmp",
  "_tmp",
  "rejected",
  "_rejected",
  "user-uploads",
  "_user-uploads",
]);

export function createAssetManifestWithResidentSprites(
  baseManifest: AssetManifest,
  residentSpriteManifest: ResidentSpriteManifest | null | undefined,
): AssetManifest {
  if (!residentSpriteManifest) {
    return baseManifest;
  }

  const residentSpriteEntries =
    residentSpriteManifestToAssetManifestEntries(residentSpriteManifest);
  const entriesById = new Map<AssetId, AssetManifestEntry>();

  for (const entry of baseManifest.entries) {
    entriesById.set(entry.id, entry);
  }

  for (const entry of residentSpriteEntries) {
    entriesById.set(entry.id, entry);
  }

  return {
    ...baseManifest,
    updatedAt: residentSpriteManifest.updatedAt,
    entries: [...entriesById.values()],
  };
}

export function residentSpriteManifestToAssetManifestEntries(
  manifest: ResidentSpriteManifest,
): AssetManifestEntry[] {
  return manifest.residents.map((resident) =>
    residentSpriteEntryToAssetManifestEntry(resident),
  );
}

export function residentSpriteEntryToAssetManifestEntry(
  resident: ResidentSpriteManifestEntry,
): AssetManifestEntry {
  const spriteSheet = resident.spriteSheet;
  const status = resolveResidentSpriteStatus(spriteSheet);
  const relativePath =
    status === "ready" ? publicPathToRelativePath(spriteSheet.publicPath) : undefined;
  const plannedRelativePath =
    status === "ready" ? undefined : publicPathToRelativePath(spriteSheet.publicPath);

  return {
    id: spriteSheet.assetId,
    ownerCharacterId: resident.residentId,
    kind: "sprite-sheet",
    status,
    sourcePath: spriteSheet.sourcePath,
    publicPath: spriteSheet.publicPath,
    relativePath,
    plannedRelativePath,
    fallbackAssetId: spriteSheet.fallbackAssetId,
    isPlaceholder: status !== "ready",
    missingReason:
      status === "ready"
        ? undefined
        : resolveResidentSpriteMissingReason(spriteSheet, status),
    spriteSheet: {
      kind: spriteSheet.kind ?? "motion",
      frameWidth: spriteSheet.frameSize.width,
      frameHeight: spriteSheet.frameSize.height,
      columns: spriteSheet.columns,
      rows: spriteSheet.rows,
      motions: spriteSheet.motions,
    },
  };
}

export function resolveResidentSpriteStatus(
  spriteSheet: ResidentSpriteManifestSpriteSheet,
): AssetReadinessStatus {
  if (spriteSheet.status !== "ready") {
    return spriteSheet.status;
  }

  if (!spriteSheet.publicPath) {
    return "missing";
  }

  if (
    isUnmanagedAssetPipelinePath(spriteSheet.sourcePath) ||
    isUnmanagedAssetPipelinePath(spriteSheet.publicPath)
  ) {
    return "placeholder";
  }

  return "ready";
}

export function isUnmanagedAssetPipelinePath(path: string | undefined): boolean {
  if (!path) {
    return false;
  }

  const segments = path
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  return segments.some((segment) => unmanagedAssetPathSegments.has(segment));
}

function resolveResidentSpriteMissingReason(
  spriteSheet: ResidentSpriteManifestSpriteSheet,
  status: AssetReadinessStatus,
): AssetMissingReason {
  if (
    spriteSheet.status === "ready" &&
    status === "placeholder" &&
    (isUnmanagedAssetPipelinePath(spriteSheet.sourcePath) ||
      isUnmanagedAssetPipelinePath(spriteSheet.publicPath))
  ) {
    return "source-not-adopted";
  }

  if (status === "rejected") {
    return "rejected";
  }

  if (status === "missing") {
    return spriteSheet.missingReason ?? "asset-not-registered";
  }

  return spriteSheet.missingReason ?? "not-generated-yet";
}

function publicPathToRelativePath(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  return path.replace(/^\/+/, "");
}
