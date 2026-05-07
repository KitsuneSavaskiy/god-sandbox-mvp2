import {
  DEFAULT_RESIDENT_SPRITE_SHEET_METADATA,
} from "./defaultCharacterAssetManifest.js";
import type { ResidentSpriteManifest } from "./residentSpriteManifest.js";

const updatedAt = "2026-05-05T00:00:00.000Z";

function createDefaultResidentSpriteManifestEntry(
  residentId: string,
  bundleId: string,
) {
  const publicPath = `/art/characters/defaults/${bundleId}/sprites/resident-sprite-sheet.png`;

  return {
    residentId,
    spriteSheet: {
      assetId: `${bundleId}-sprite-sheet`,
      status: "placeholder" as const,
      sourcePath: `assets/residents/${bundleId}/sprites/resident-sprite-sheet.png`,
      publicPath,
      frameSize: {
        width: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.frameWidth,
        height: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.frameHeight,
      },
      columns: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.columns,
      rows: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.rows,
      fallbackAssetId: `${bundleId}-portrait-neutral`,
      missingReason: "not-generated-yet" as const,
      motions: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA.motions,
    },
  };
}

export const DEFAULT_RESIDENT_SPRITE_MANIFEST: ResidentSpriteManifest = {
  schemaVersion: "resident-sprite-manifest-v1",
  updatedAt,
  residents: [
    createDefaultResidentSpriteManifestEntry("chr_eve", "eve"),
    createDefaultResidentSpriteManifestEntry("chr_garan", "garan"),
    createDefaultResidentSpriteManifestEntry("chr_ryo", "ryo"),
    createDefaultResidentSpriteManifestEntry("chr_suzu", "suzu"),
  ],
};
