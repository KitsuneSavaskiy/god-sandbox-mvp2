import type { AppearanceVariant, Character } from "../../domain/models.js";

export type CharacterExpressionKey = "neutral" | "happy" | "angry" | "sad" | "surprised";

export type CharacterDetailAssetBundle = {
  displayName: string;
  bundleId: string;
  portraitAssetId: string;
  iconAssetId: string;
  spriteSheetAssetId: string;
};

export type CharacterDetailReadModel = {
  displayName: string;
  savedDisplayName: string;
  assetBundle: CharacterDetailAssetBundle | null;
  expressions: AppearanceVariant[];
};

const expressionKeys: CharacterExpressionKey[] = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "surprised",
];

const expressionLabels: Record<CharacterExpressionKey, string> = {
  neutral: "通常",
  happy: "喜び",
  angry: "怒り",
  sad: "悲しみ",
  surprised: "驚き",
};

const defaultAssetBundlesByCharacterId: Record<string, CharacterDetailAssetBundle> = {
  chr_ryo: createDefaultAssetBundle("Eve", "eve"),
  chr_mina: createDefaultAssetBundle("Garan", "garan"),
  chr_towa: createDefaultAssetBundle("Ryo", "ryo"),
  chr_sena: createDefaultAssetBundle("Suzu", "suzu"),
};

export function createCharacterDetailReadModel(
  character: Character,
): CharacterDetailReadModel {
  const assetBundle = defaultAssetBundlesByCharacterId[character.id] ?? null;

  return {
    displayName: assetBundle?.displayName ?? character.profile.displayName,
    savedDisplayName: character.profile.displayName,
    assetBundle,
    expressions: createExpressionVariants(character, assetBundle),
  };
}

export function getExpressionLabel(variant: AppearanceVariant): string {
  return (
    expressionLabels[variant.emotion as CharacterExpressionKey] ??
    variant.emotion ??
    "表情"
  );
}

function createDefaultAssetBundle(
  displayName: string,
  bundleId: string,
): CharacterDetailAssetBundle {
  return {
    displayName,
    bundleId,
    portraitAssetId: `${bundleId}-portrait-neutral`,
    iconAssetId: `${bundleId}-icon`,
    spriteSheetAssetId: `${bundleId}-sprite-sheet`,
  };
}

function createExpressionVariants(
  character: Character,
  assetBundle: CharacterDetailAssetBundle | null,
): AppearanceVariant[] {
  if (character.profile.appearance.variantAssetIds.length > 0) {
    return character.profile.appearance.variantAssetIds;
  }

  if (!assetBundle) {
    return [];
  }

  return expressionKeys.map((key) => ({
    id: `${assetBundle.bundleId}-expression-${key}`,
    emotion: key,
    assetId: `${assetBundle.bundleId}-expression-${key}`,
  }));
}
