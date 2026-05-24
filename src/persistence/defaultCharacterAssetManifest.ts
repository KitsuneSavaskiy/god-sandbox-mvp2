import { CURRENT_SAVE_VERSION } from "./migrations.js";
import {
  assertRequiredSpriteSheetMotions,
  type AssetManifest,
  type AssetManifestEntry,
  type SpriteSheetMetadata,
} from "./assetManifest.js";

const updatedAt = "2026-05-07T00:00:00.000Z";
const EVE_PO_PREVIEW_COMBINED_SHEET_PATH =
  "art/characters/defaults/eve/sprites/resident-sprite-sheet-combined-preview-v14.png";
const RYO_PO_PREVIEW_COMBINED_SHEET_PATH =
  "art/characters/defaults/ryo/sprites/resident-sprite-sheet-combined-preview-v12.png";
const GARAN_PO_PREVIEW_COMBINED_SHEET_PATH =
  "art/characters/defaults/garan/sprites/resident-sprite-sheet-combined-preview-v21.png";
const SUZU_PO_PREVIEW_COMBINED_SHEET_PATH =
  "art/characters/defaults/suzu/sprites/resident-sprite-sheet-combined-preview-v2.png";

const EVE_PO_PREVIEW_COMBINED_MOTION_METADATA: SpriteSheetMetadata = {
  kind: "motion",
  frameWidth: 118,
  frameHeight: 136,
  columns: 7,
  rows: 14,
  motions: {
    idle: { row: 0, frames: 7 },
    "walk-right": { row: 1, frames: 7 },
    "walk-left": { row: 2, frames: 7 },
    waving: { row: 3, frames: 7 },
    jumping: { row: 4, frames: 7 },
    failed: { row: 5, frames: 5 },
    waiting: { row: 6, frames: 7 },
    running: { row: 1, frames: 7 },
    review: { row: 7, frames: 7 },
  },
};

const EVE_PO_PREVIEW_COMBINED_EXTENDED_METADATA: SpriteSheetMetadata = {
  kind: "extended",
  frameWidth: 118,
  frameHeight: 136,
  columns: 7,
  rows: 14,
  motions: {
    "walk-up": { row: 8, frames: 7 },
    "walk-down": { row: 9, frames: 7 },
    "walk-forward": { row: 9, frames: 7 },
    "walk-back": { row: 8, frames: 7 },
    "emote-happy": { row: 10, frames: 7 },
    "emote-angry": { row: 11, frames: 7 },
    "emote-sad": { row: 12, frames: 7 },
    "emote-surprised": { row: 13, frames: 7 },
  },
};

const RYO_PO_PREVIEW_COMBINED_MOTION_METADATA: SpriteSheetMetadata = {
  kind: "motion",
  frameWidth: 148,
  frameHeight: 144,
  columns: 6,
  rows: 14,
  motions: {
    idle: { row: 0, frames: 6 },
    "walk-right": { row: 1, frames: 6 },
    "walk-left": { row: 2, frames: 6 },
    waving: { row: 3, frames: 6 },
    jumping: { row: 4, frames: 6 },
    failed: { row: 5, frames: 6 },
    waiting: { row: 6, frames: 6 },
    running: { row: 1, frames: 6 },
    review: { row: 7, frames: 6 },
  },
};

const RYO_PO_PREVIEW_COMBINED_EXTENDED_METADATA: SpriteSheetMetadata = {
  kind: "extended",
  frameWidth: 148,
  frameHeight: 144,
  columns: 6,
  rows: 14,
  motions: {
    "walk-up": { row: 8, frames: 6 },
    "walk-down": { row: 9, frames: 6 },
    "walk-forward": { row: 9, frames: 6 },
    "walk-back": { row: 8, frames: 6 },
    "emote-happy": { row: 10, frames: 6 },
    "emote-angry": { row: 11, frames: 6 },
    "emote-sad": { row: 12, frames: 6 },
    "emote-surprised": { row: 13, frames: 6 },
  },
};

const GARAN_PO_PREVIEW_COMBINED_MOTION_METADATA: SpriteSheetMetadata = {
  kind: "motion",
  frameWidth: 118,
  frameHeight: 136,
  columns: 7,
  rows: 14,
  motions: {
    idle: { row: 0, frames: 7 },
    "walk-right": { row: 1, frames: 7 },
    "walk-left": { row: 2, frames: 7 },
    waving: { row: 3, frames: 7 },
    jumping: { row: 4, frames: 7 },
    failed: { row: 5, frames: 7 },
    waiting: { row: 6, frames: 7 },
    running: { row: 1, frames: 7 },
    review: { row: 7, frames: 7 },
  },
};

const GARAN_PO_PREVIEW_COMBINED_EXTENDED_METADATA: SpriteSheetMetadata = {
  kind: "extended",
  frameWidth: 118,
  frameHeight: 136,
  columns: 7,
  rows: 14,
  motions: {
    "walk-up": { row: 8, frames: 7 },
    "walk-down": { row: 9, frames: 7 },
    "walk-forward": { row: 9, frames: 7 },
    "walk-back": { row: 8, frames: 7 },
    "emote-happy": { row: 10, frames: 7 },
    "emote-angry": { row: 11, frames: 7 },
    "emote-sad": { row: 12, frames: 7 },
    "emote-surprised": { row: 13, frames: 7 },
  },
};

const SUZU_PO_PREVIEW_COMBINED_MOTION_METADATA: SpriteSheetMetadata = {
  kind: "motion",
  frameWidth: 148,
  frameHeight: 144,
  columns: 6,
  rows: 14,
  motions: {
    idle: { row: 0, frames: 6 },
    "walk-right": { row: 2, frames: 6 },
    "walk-left": { row: 1, frames: 6 },
    waving: { row: 3, frames: 6 },
    jumping: { row: 4, frames: 6 },
    failed: { row: 5, frames: 6 },
    waiting: { row: 6, frames: 6 },
    running: { row: 1, frames: 6 },
    review: { row: 7, frames: 6 },
  },
};

const SUZU_PO_PREVIEW_COMBINED_EXTENDED_METADATA: SpriteSheetMetadata = {
  kind: "extended",
  frameWidth: 148,
  frameHeight: 144,
  columns: 6,
  rows: 14,
  motions: {
    "walk-up": { row: 8, frames: 6 },
    "walk-down": { row: 9, frames: 6 },
    "walk-forward": { row: 9, frames: 6 },
    "walk-back": { row: 8, frames: 6 },
    "emote-happy": { row: 10, frames: 6 },
    "emote-angry": { row: 11, frames: 6 },
    "emote-sad": { row: 12, frames: 6 },
    "emote-surprised": { row: 13, frames: 6 },
  },
};

// Sheet 1: hatch-pet native format (8 columns × 9 rows, 192×208 px per frame)
// Rows: idle / walk-right / walk-left / waving / jumping / failed / waiting / running / review
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
    waving: { row: 3, frames: 8 },
    jumping: { row: 4, frames: 8 },
    failed: { row: 5, frames: 8 },
    waiting: { row: 6, frames: 8 },
    running: { row: 7, frames: 8 },
    review: { row: 8, frames: 8 },
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

assertRequiredSpriteSheetMotions(DEFAULT_MOTION_SHEET_METADATA, "default-motion-sheet");
assertRequiredSpriteSheetMotions(DEFAULT_EXTENDED_SHEET_METADATA, "default-extended-sheet");
assertRequiredSpriteSheetMotions(
  EVE_PO_PREVIEW_COMBINED_MOTION_METADATA,
  "eve-po-preview-combined-motion-sheet",
);
assertRequiredSpriteSheetMotions(
  EVE_PO_PREVIEW_COMBINED_EXTENDED_METADATA,
  "eve-po-preview-combined-extended-sheet",
);
assertRequiredSpriteSheetMotions(
  RYO_PO_PREVIEW_COMBINED_MOTION_METADATA,
  "ryo-po-preview-combined-motion-sheet",
);
assertRequiredSpriteSheetMotions(
  RYO_PO_PREVIEW_COMBINED_EXTENDED_METADATA,
  "ryo-po-preview-combined-extended-sheet",
);
assertRequiredSpriteSheetMotions(
  GARAN_PO_PREVIEW_COMBINED_MOTION_METADATA,
  "garan-po-preview-combined-motion-sheet",
);
assertRequiredSpriteSheetMotions(
  GARAN_PO_PREVIEW_COMBINED_EXTENDED_METADATA,
  "garan-po-preview-combined-extended-sheet",
);
assertRequiredSpriteSheetMotions(
  SUZU_PO_PREVIEW_COMBINED_MOTION_METADATA,
  "suzu-po-preview-combined-motion-sheet",
);
assertRequiredSpriteSheetMotions(
  SUZU_PO_PREVIEW_COMBINED_EXTENDED_METADATA,
  "suzu-po-preview-combined-extended-sheet",
);

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

function createEvePoPreviewCombinedMotionSheet(): AssetManifestEntry {
  return {
    id: "eve-sprite-sheet",
    ownerCharacterId: "chr_eve",
    kind: "sprite-sheet",
    status: "ready",
    sourcePath: "assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.png",
    publicPath: `/${EVE_PO_PREVIEW_COMBINED_SHEET_PATH}`,
    relativePath: EVE_PO_PREVIEW_COMBINED_SHEET_PATH,
    fallbackAssetId: "eve-portrait-neutral",
    generatedFromAssetIds: ["eve-portrait-neutral"],
    spriteSheet: EVE_PO_PREVIEW_COMBINED_MOTION_METADATA,
  };
}

function createEvePoPreviewCombinedExtendedSheet(): AssetManifestEntry {
  return {
    id: "eve-sprite-sheet-extended",
    ownerCharacterId: "chr_eve",
    kind: "sprite-sheet-extended",
    status: "ready",
    sourcePath: "assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.png",
    publicPath: `/${EVE_PO_PREVIEW_COMBINED_SHEET_PATH}`,
    relativePath: EVE_PO_PREVIEW_COMBINED_SHEET_PATH,
    fallbackAssetId: "eve-portrait-neutral",
    generatedFromAssetIds: ["eve-portrait-neutral"],
    spriteSheet: EVE_PO_PREVIEW_COMBINED_EXTENDED_METADATA,
  };
}

function createRyoPoPreviewCombinedMotionSheet(): AssetManifestEntry {
  return {
    id: "ryo-sprite-sheet",
    ownerCharacterId: "chr_ryo",
    kind: "sprite-sheet",
    status: "ready",
    sourcePath: "assets/generated/residents/ryo/po-preview/resident-sprite-sheet-combined.png",
    publicPath: `/${RYO_PO_PREVIEW_COMBINED_SHEET_PATH}`,
    relativePath: RYO_PO_PREVIEW_COMBINED_SHEET_PATH,
    fallbackAssetId: "ryo-portrait-neutral",
    generatedFromAssetIds: ["ryo-portrait-neutral"],
    spriteSheet: RYO_PO_PREVIEW_COMBINED_MOTION_METADATA,
  };
}

function createRyoPoPreviewCombinedExtendedSheet(): AssetManifestEntry {
  return {
    id: "ryo-sprite-sheet-extended",
    ownerCharacterId: "chr_ryo",
    kind: "sprite-sheet-extended",
    status: "ready",
    sourcePath: "assets/generated/residents/ryo/po-preview/resident-sprite-sheet-combined.png",
    publicPath: `/${RYO_PO_PREVIEW_COMBINED_SHEET_PATH}`,
    relativePath: RYO_PO_PREVIEW_COMBINED_SHEET_PATH,
    fallbackAssetId: "ryo-portrait-neutral",
    generatedFromAssetIds: ["ryo-portrait-neutral"],
    spriteSheet: RYO_PO_PREVIEW_COMBINED_EXTENDED_METADATA,
  };
}

function createGaranPoPreviewCombinedMotionSheet(): AssetManifestEntry {
  return {
    id: "garan-sprite-sheet",
    ownerCharacterId: "chr_garan",
    kind: "sprite-sheet",
    status: "ready",
    sourcePath: "assets/generated/residents/garan/po-preview/resident-sprite-sheet-combined.png",
    publicPath: `/${GARAN_PO_PREVIEW_COMBINED_SHEET_PATH}`,
    relativePath: GARAN_PO_PREVIEW_COMBINED_SHEET_PATH,
    fallbackAssetId: "garan-portrait-neutral",
    generatedFromAssetIds: ["garan-portrait-neutral"],
    spriteSheet: GARAN_PO_PREVIEW_COMBINED_MOTION_METADATA,
  };
}

function createGaranPoPreviewCombinedExtendedSheet(): AssetManifestEntry {
  return {
    id: "garan-sprite-sheet-extended",
    ownerCharacterId: "chr_garan",
    kind: "sprite-sheet-extended",
    status: "ready",
    sourcePath: "assets/generated/residents/garan/po-preview/resident-sprite-sheet-combined.png",
    publicPath: `/${GARAN_PO_PREVIEW_COMBINED_SHEET_PATH}`,
    relativePath: GARAN_PO_PREVIEW_COMBINED_SHEET_PATH,
    fallbackAssetId: "garan-portrait-neutral",
    generatedFromAssetIds: ["garan-portrait-neutral"],
    spriteSheet: GARAN_PO_PREVIEW_COMBINED_EXTENDED_METADATA,
  };
}

function createSuzuPoPreviewCombinedMotionSheet(): AssetManifestEntry {
  return {
    id: "suzu-sprite-sheet",
    ownerCharacterId: "chr_suzu",
    kind: "sprite-sheet",
    status: "ready",
    sourcePath: "assets/generated/residents/suzu/po-preview/resident-sprite-sheet-combined.png",
    publicPath: `/${SUZU_PO_PREVIEW_COMBINED_SHEET_PATH}`,
    relativePath: SUZU_PO_PREVIEW_COMBINED_SHEET_PATH,
    fallbackAssetId: "suzu-portrait-neutral",
    generatedFromAssetIds: ["suzu-portrait-neutral"],
    spriteSheet: SUZU_PO_PREVIEW_COMBINED_MOTION_METADATA,
  };
}

function createSuzuPoPreviewCombinedExtendedSheet(): AssetManifestEntry {
  return {
    id: "suzu-sprite-sheet-extended",
    ownerCharacterId: "chr_suzu",
    kind: "sprite-sheet-extended",
    status: "ready",
    sourcePath: "assets/generated/residents/suzu/po-preview/resident-sprite-sheet-combined.png",
    publicPath: `/${SUZU_PO_PREVIEW_COMBINED_SHEET_PATH}`,
    relativePath: SUZU_PO_PREVIEW_COMBINED_SHEET_PATH,
    fallbackAssetId: "suzu-portrait-neutral",
    generatedFromAssetIds: ["suzu-portrait-neutral"],
    spriteSheet: SUZU_PO_PREVIEW_COMBINED_EXTENDED_METADATA,
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
    createEvePoPreviewCombinedMotionSheet(),
    createEvePoPreviewCombinedExtendedSheet(),
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
    createGaranPoPreviewCombinedMotionSheet(),
    createGaranPoPreviewCombinedExtendedSheet(),
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
    createRyoPoPreviewCombinedMotionSheet(),
    createRyoPoPreviewCombinedExtendedSheet(),
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
    createSuzuPoPreviewCombinedMotionSheet(),
    createSuzuPoPreviewCombinedExtendedSheet(),
    {
      id: "suzu-expression-happy",
      ownerCharacterId: "chr_suzu",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/suzu/expressions/happy.png",
      generatedFromAssetIds: ["suzu-portrait-neutral"],
    },
    {
      id: "suzu-expression-angry",
      ownerCharacterId: "chr_suzu",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/suzu/expressions/angry.png",
      generatedFromAssetIds: ["suzu-portrait-neutral"],
    },
    {
      id: "suzu-expression-sad",
      ownerCharacterId: "chr_suzu",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/suzu/expressions/sad.png",
      generatedFromAssetIds: ["suzu-portrait-neutral"],
    },
    {
      id: "suzu-expression-surprised",
      ownerCharacterId: "chr_suzu",
      kind: "appearance-variant",
      relativePath: "art/characters/defaults/suzu/expressions/surprised.png",
      generatedFromAssetIds: ["suzu-portrait-neutral"],
    },
  ],
};
