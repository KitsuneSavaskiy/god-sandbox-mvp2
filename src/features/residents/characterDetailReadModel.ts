import type { AppearanceVariant, Character } from "../../domain/models.js";

export type CharacterExpressionKey = "neutral" | "happy" | "angry" | "sad" | "surprised";

export type CharacterDetailAssetBundle = {
  displayName: string;
  bundleId: string;
  portraitAssetId: string;
  iconAssetId: string;
  spriteSheetAssetId: string;
};

export type CharacterDetailInfoSource =
  | "user-input"
  | "generated-recognition"
  | "placeholder";

export type CharacterDetailInfoItem = {
  label: string;
  value: string;
  source: CharacterDetailInfoSource;
  needsUserConfirmation?: boolean;
};

export type CharacterDetailReadModel = {
  displayName: string;
  savedDisplayName: string;
  assetBundle: CharacterDetailAssetBundle | null;
  expressions: AppearanceVariant[];
  settingItems: CharacterDetailInfoItem[];
  visualMemoItems: CharacterDetailInfoItem[];
  unresolvedItems: CharacterDetailInfoItem[];
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
    settingItems: createUserInputItems(character, assetBundle),
    visualMemoItems: createGeneratedRecognitionItems(character),
    unresolvedItems: createPlaceholderItems(character),
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

function createUserInputItems(
  character: Character,
  assetBundle: CharacterDetailAssetBundle | null,
): CharacterDetailInfoItem[] {
  return [
    {
      label: "名前",
      value: assetBundle?.displayName ?? character.profile.displayName,
      source: "user-input",
    },
    {
      label: "保存名",
      value: character.profile.displayName,
      source: "user-input",
    },
    ...optionalUserInputItem("性格メモ", readStringField(character, "description")),
    ...optionalUserInputItem("口調", character.profile.speechStyleId ?? readStringField(character, "speechStyleId")),
    ...optionalUserInputItem(
      "年齢",
      character.profile.age === undefined
        ? readStringField(character, "age")
        : String(character.profile.age),
    ),
    ...optionalUserInputItem("役割", character.state.narrativeRole),
  ];
}

function createGeneratedRecognitionItems(character: Character): CharacterDetailInfoItem[] {
  const recognitionFields = [
    ["見た目", "generatedRecognition"],
    ["見た目", "visualRecognition"],
    ["見た目", "visualDescription"],
    ["見た目", "appearanceMemo"],
    ["服装・色", "outfitRecognition"],
    ["表情", "expressionRecognition"],
    ["持ち物", "itemRecognition"],
  ] as const;

  return recognitionFields.flatMap(([label, fieldId]) => {
    const value = readStringField(character, fieldId);
    if (!value) {
      return [];
    }

    return [
      {
        label,
        value,
        source: "generated-recognition" as const,
        needsUserConfirmation: true,
      },
    ];
  });
}

function createPlaceholderItems(character: Character): CharacterDetailInfoItem[] {
  const placeholders: CharacterDetailInfoItem[] = [];

  if (!character.state.narrativeRole) {
    placeholders.push({
      label: "役割",
      value: "未設定",
      source: "placeholder",
    });
  }

  if (!character.profile.speechStyleId && !readStringField(character, "speechStyleId")) {
    placeholders.push({
      label: "口調",
      value: "未設定",
      source: "placeholder",
    });
  }

  if (character.profile.age === undefined && !readStringField(character, "age")) {
    placeholders.push({
      label: "年齢",
      value: "未設定",
      source: "placeholder",
    });
  }

  if (createGeneratedRecognitionItems(character).length === 0) {
    placeholders.push({
      label: "見た目メモ",
      value: "AI認識メモはまだありません",
      source: "placeholder",
    });
  }

  return placeholders;
}

function optionalUserInputItem(
  label: string,
  value: string | undefined,
): CharacterDetailInfoItem[] {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return [];
  }

  return [
    {
      label,
      value: normalizedValue,
      source: "user-input",
    },
  ];
}

function readStringField(character: Character, fieldId: string): string {
  const value = character.profile.templateFieldValues[fieldId];
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}
