import {
  resolveCharacterAssetBundleReadModel,
  type CharacterAssetBundleReadModel,
  type CharacterDetailTextField,
  type CharacterExpressionSlot,
  type ReadModelValueSource,
} from "../../application/characterAssetBundles.js";
import type { Character, CharacterExpressionId } from "../../domain/models.js";

export type CharacterExpressionKey = CharacterExpressionId;

export type CharacterDetailInfoSource = ReadModelValueSource;

export type CharacterDetailInfoItem = {
  label: string;
  value: string;
  source: CharacterDetailInfoSource;
  needsUserConfirmation?: boolean;
};

export type CharacterDetailReadModel = {
  displayName: string;
  savedDisplayName: string;
  assetReadModel: CharacterAssetBundleReadModel;
  expressionSlots: CharacterExpressionSlot[];
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

const basicSettingLabels: Record<
  keyof CharacterAssetBundleReadModel["basicSettings"],
  string
> = {
  narrativeRole: "役割",
  speechStyle: "口調",
  age: "年齢",
  introduction: "説明メモ",
};

export function createCharacterDetailReadModel(
  character: Character,
): CharacterDetailReadModel {
  const assetReadModel = resolveCharacterAssetBundleReadModel(character);
  const fieldItems = createBasicSettingItems(assetReadModel.basicSettings);

  return {
    displayName: assetReadModel.displayName,
    savedDisplayName: character.profile.displayName,
    assetReadModel,
    expressionSlots: expressionKeys.map((key) => assetReadModel.expressions[key]),
    settingItems: [
      {
        label: "名前",
        value: assetReadModel.displayName,
        source: "user-input",
      },
      ...fieldItems.filter((item) => item.source === "user-input"),
    ],
    visualMemoItems: fieldItems.filter(
      (item) => item.source === "generated-recognition",
    ),
    unresolvedItems: fieldItems.filter((item) => item.source === "placeholder"),
  };
}

export function getExpressionLabel(
  slot: Pick<CharacterExpressionSlot, "key">,
): string {
  return expressionLabels[slot.key] ?? "表情";
}

function createBasicSettingItems(
  settings: CharacterAssetBundleReadModel["basicSettings"],
): CharacterDetailInfoItem[] {
  return (Object.entries(settings) as Array<
    [keyof CharacterAssetBundleReadModel["basicSettings"], CharacterDetailTextField]
  >).map(([key, field]) => ({
    label: basicSettingLabels[key],
    value: field.isPlaceholder ? "未設定" : field.value,
    source: field.source,
    needsUserConfirmation: field.needsUserConfirmation,
  }));
}
