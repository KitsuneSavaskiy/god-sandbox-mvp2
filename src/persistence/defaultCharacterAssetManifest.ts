import { CURRENT_SAVE_VERSION } from "./migrations.js";
import type { AssetManifest, AssetManifestEntry, SpriteSheetMetadata } from "./assetManifest.js";

const updatedAt = "2026-05-07T00:00:00.000Z";

// Sheet 1: hatch-pet native format (8 columns × 9 rows, 192×208 px per frame)
// Rows: idle / run-right / run-left / waving / jumping / failed / waiting / running / review
export const DEFAULT_MOTION_SHEET_METADATA: SpriteSheetMetadata = {
  kind: "motion",
  frameWidth: 192,
  frameHeight: 208,
  columns: 8,
  rows: 9,
  motions: {
    idle: { row: 0, frames: 8 },
    "walk-right": { row: 1, frames: 8 },
    "walk-left": { row: 2, frames: 8 },
    // Fallback approximations for Sheet 2 motions when extended sheet is absent
    "walk-up": { row: 0, frames: 8 },
    "walk-down": { row: 0, frames: 8 },
    "walk-forward": { row: 7, frames: 8 },
    "walk-back": { row: 2, frames: 8 },
    "emote-happy": { row: 3, frames: 8 },
    "emote-angry": { row: 0, frames: 8 },
    "emote-sad": { row: 5, frames: 8 },
    "emote-surprised": { row: 4, frames: 8 },
  },
};

// Sheet 2: GodSandbox extended sheet — 2.5D directions + emotes
// Also uses hatch-pet tool with a different prompt; same canvas dimensions as Sheet 1
export const DEFAULT_EXTENDED_SHEET_METADATA: SpriteSheetMetadata = {
  kind: "extended",
  frameWidth: 192,
  frameHeight: 208,
  columns: 8,
  rows: 9,
  motions: {
    "walk-up": { row: 0, frames: 8 },
    "walk-down": { row: 1, frames: 8 },
    "walk-forward": { row: 2, frames: 8 },
    "walk-back": { row: 3, frames: 8 },
    "emote-happy": { row: 4, frames: 8 },
    "emote-angry": { row: 5, frames: 8 },
    "emote-sad": { row: 6, frames: 8 },
    "emote-surprised": { row: 7, frames: 8 },
  },
};

// Keep legacy export alias so runtime.test.ts can update incrementally
export const DEFAULT_RESIDENT_SPRITE_SHEET_METADATA = DEFAULT_MOTION_SHEET_METADATA;

function createResidentMotionSheetPlaceholder(
  bundleId: string,
  ownerCharacterId: string,
  missingReason: AssetManifestEntry["missingReason"] = "not-generated-yet",
): AssetManifestEntry {
  return {
    id: `${bundleId}-sprite-sheet`,
    ownerCharacterId,
    kind: "sprite-sheet",
    status: "placeholder",
    sourcePath: `assets/residents/${bundleId}/sprites/resident-sprite-sheet.png`,
    publicPath: `/art/characters/defaults/${bundleId}/sprites/resident-sprite-sheet.png`,
    plannedRelativePath: `art/characters/defaults/${bundleId}/sprites/resident-sprite-sheet.png`,
    fallbackAssetId: `${bundleId}-portrait-neutral`,
    generatedFromAssetIds: [`${bundleId}-portrait-neutral`],
    isPlaceholder: true,
    missingReason,
    spriteSheet: DEFAULT_MOTION_SHEET_METADATA,
  };
}

function createResidentExtendedSheetPlaceholder(
  bundleId: string,
  ownerCharacterId: string,
): AssetManifestEntry {
  return {
    id: `${bundleId}-sprite-sheet-extended`,
    ownerCharacterId,
    kind: "sprite-sheet-extended",
    status: "placeholder",
    sourcePath: `assets/residents/${bundleId}/sprites/resident-sprite-sheet-extended.png`,
    publicPath: `/art/characters/defaults/${bundleId}/sprites/resident-sprite-sheet-extended.png`,
    plannedRelativePath: `art/characters/defaults/${bundleId}/sprites/resident-sprite-sheet-extended.png`,
    fallbackAssetId: `${bundleId}-portrait-neutral`,
    generatedFromAssetIds: [`${bundleId}-portrait-neutral`],
    isPlaceholder: true,
    missingReason: "not-generated-yet",
    spriteSheet: DEFAULT_EXTENDED_SHEET_METADATA,
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
    createResidentMotionSheetPlaceholder("eve", "chr_eve"),
    createResidentExtendedSheetPlaceholder("eve", "chr_eve"),
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
    createResidentMotionSheetPlaceholder("garan", "chr_garan"),
    createResidentExtendedSheetPlaceholder("garan", "chr_garan"),
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
    createResidentMotionSheetPlaceholder("ryo", "chr_ryo"),
    createResidentExtendedSheetPlaceholder("ryo", "chr_ryo"),
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
    createResidentMotionSheetPlaceholder("suzu", "chr_suzu"),
    createResidentExtendedSheetPlaceholder("suzu", "chr_suzu"),
    {
      id: "suzu-expression-happy",
      ownerCharacterId: "chr_suzu",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/suzu/expressions/happy.png",
      generatedFromAssetIds: ["suzu-portrait-neutral"],
    },
  ],
};
