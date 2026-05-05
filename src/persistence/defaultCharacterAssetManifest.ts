import { CURRENT_SAVE_VERSION } from "./migrations.js";
import type { AssetManifest, AssetManifestEntry, SpriteSheetMetadata } from "./assetManifest.js";

const updatedAt = "2026-05-04T00:00:00.000Z";

export const DEFAULT_RESIDENT_SPRITE_SHEET_METADATA: SpriteSheetMetadata = {
  frameWidth: 96,
  frameHeight: 96,
  columns: 6,
  rows: 11,
  motions: {
    idle: { row: 0, frames: 6 },
    "walk-up": { row: 1, frames: 6 },
    "walk-down": { row: 2, frames: 6 },
    "walk-left": { row: 3, frames: 6 },
    "walk-right": { row: 4, frames: 6 },
    "walk-forward": { row: 5, frames: 6 },
    "walk-back": { row: 6, frames: 6 },
    "emote-happy": { row: 7, frames: 6 },
    "emote-angry": { row: 8, frames: 6 },
    "emote-sad": { row: 9, frames: 6 },
    "emote-surprised": { row: 10, frames: 6 },
  },
};

function createResidentSpriteSheetPlaceholder(
  bundleId: string,
  ownerCharacterId: string,
): AssetManifestEntry {
  return {
    id: `${bundleId}-sprite-sheet`,
    ownerCharacterId,
    kind: "sprite-sheet",
    plannedRelativePath: `art/characters/defaults/${bundleId}/sprites/resident-sprite-sheet.png`,
    fallbackAssetId: `${bundleId}-portrait-neutral`,
    generatedFromAssetIds: [`${bundleId}-portrait-neutral`],
    isPlaceholder: true,
    missingReason: "not-generated-yet",
    spriteSheet: DEFAULT_RESIDENT_SPRITE_SHEET_METADATA,
  };
}

export const DEFAULT_CHARACTER_ASSET_MANIFEST: AssetManifest = {
  saveVersion: CURRENT_SAVE_VERSION,
  updatedAt,
  entries: [
    {
      id: "eve-portrait-neutral",
      ownerCharacterId: "chr_eve",
      kind: "appearance-source",
      relativePath: "art/characters/defaults/eve/portrait.png",
    },
    createResidentSpriteSheetPlaceholder("eve", "chr_eve"),
    {
      id: "eve-expression-happy",
      ownerCharacterId: "chr_eve",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/eve/expressions/happy.png",
      generatedFromAssetIds: ["eve-portrait-neutral"],
    },
    {
      id: "eve-expression-angry",
      ownerCharacterId: "chr_eve",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/eve/expressions/angry.png",
      generatedFromAssetIds: ["eve-portrait-neutral"],
    },
    {
      id: "eve-expression-sad",
      ownerCharacterId: "chr_eve",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/eve/expressions/sad.png",
      generatedFromAssetIds: ["eve-portrait-neutral"],
    },
    {
      id: "eve-expression-surprised",
      ownerCharacterId: "chr_eve",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/eve/expressions/surprised.png",
      generatedFromAssetIds: ["eve-portrait-neutral"],
    },
    {
      id: "garan-portrait-neutral",
      ownerCharacterId: "chr_garan",
      kind: "appearance-source",
      relativePath: "art/characters/defaults/garan/portrait.png",
    },
    createResidentSpriteSheetPlaceholder("garan", "chr_garan"),
    {
      id: "garan-expression-happy",
      ownerCharacterId: "chr_garan",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/garan/expressions/happy.png",
      generatedFromAssetIds: ["garan-portrait-neutral"],
    },
    {
      id: "garan-expression-angry",
      ownerCharacterId: "chr_garan",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/garan/expressions/angry.png",
      generatedFromAssetIds: ["garan-portrait-neutral"],
    },
    {
      id: "garan-expression-sad",
      ownerCharacterId: "chr_garan",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/garan/expressions/sad.png",
      generatedFromAssetIds: ["garan-portrait-neutral"],
    },
    {
      id: "garan-expression-surprised",
      ownerCharacterId: "chr_garan",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/garan/expressions/surprised.png",
      generatedFromAssetIds: ["garan-portrait-neutral"],
    },
    {
      id: "ryo-portrait-neutral",
      ownerCharacterId: "chr_ryo",
      kind: "appearance-source",
      relativePath: "art/characters/defaults/ryo/portrait.png",
    },
    createResidentSpriteSheetPlaceholder("ryo", "chr_ryo"),
    {
      id: "ryo-expression-happy",
      ownerCharacterId: "chr_ryo",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/ryo/expressions/happy.png",
      generatedFromAssetIds: ["ryo-portrait-neutral"],
    },
    {
      id: "ryo-expression-angry",
      ownerCharacterId: "chr_ryo",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/ryo/expressions/angry.png",
      generatedFromAssetIds: ["ryo-portrait-neutral"],
    },
    {
      id: "ryo-expression-sad",
      ownerCharacterId: "chr_ryo",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/ryo/expressions/sad.png",
      generatedFromAssetIds: ["ryo-portrait-neutral"],
    },
    {
      id: "ryo-expression-surprised",
      ownerCharacterId: "chr_ryo",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/ryo/expressions/surprised.png",
      generatedFromAssetIds: ["ryo-portrait-neutral"],
    },
    {
      id: "suzu-portrait-neutral",
      ownerCharacterId: "chr_suzu",
      kind: "appearance-source",
      relativePath: "art/characters/defaults/suzu/portrait.png",
    },
    createResidentSpriteSheetPlaceholder("suzu", "chr_suzu"),
    {
      id: "suzu-expression-happy",
      ownerCharacterId: "chr_suzu",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/suzu/expressions/happy.png",
      generatedFromAssetIds: ["suzu-portrait-neutral"],
    },
  ],
};
