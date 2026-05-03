import type { AssetId, CharacterId } from "../domain/models.js";

export type AssetManifestEntry = {
  id: AssetId;
  ownerCharacterId?: CharacterId;
  kind: "appearance-source" | "appearance-variant" | "sprite-sheet" | "video-source";
  relativePath: string;
  contentHash?: string;
  generatedFromAssetIds?: AssetId[];
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
  if (!entry) {
    throw new Error(`Asset not found in manifest: ${assetId}`);
  }
  return entry.relativePath;
}
