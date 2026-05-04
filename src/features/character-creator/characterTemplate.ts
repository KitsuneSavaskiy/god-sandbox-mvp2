import type { CharacterTemplate } from "../../domain/models.js";

export const LINE3_CHARACTER_TEMPLATE: CharacterTemplate = {
  id: "line3-character-lifecycle-template",
  name: "住民プロフィール",
  description: "初回4名設定と後続追加で共通利用する editor template。",
  editableFields: [
    {
      id: "imageAssetId",
      label: "見た目画像",
      type: "asset-picker",
      required: true,
      defaultValue: "",
    },
    {
      id: "personalityNote",
      label: "性格メモ",
      type: "textarea",
      required: false,
      defaultValue: "",
    },
    {
      id: "speechStyleId",
      label: "口調",
      type: "text",
      required: false,
      defaultValue: "",
    },
    {
      id: "age",
      label: "年齢",
      type: "number",
      required: false,
      defaultValue: "",
    },
  ],
  defaultProfilePatch: {
    personality: {},
    templateFieldValues: {},
  },
};
