import type { FaithBand } from "../../domain/models.js";

export const PASSPORT_FORBIDDEN_WORDS = [
  "API",
  "プロンプト",
  "トークン",
  "モデル",
  "自動的に生成",
  "システムプロンプト",
] as const;

export const PASSPORT_CONFIRM_TEXTS = {
  title: "この子を外の世界へ連れていく前に",
  bodyLines: [
    "Passportには、キャラクターの名前・話し方・箱庭での記憶・神との距離感が含まれます。",
    "陰陽五行の内部値やアカウント情報は含まれません。",
    "この時点では外のAIには何も送られません。",
    "内容をコピーして外のAIに貼り付けたときだけ、そのAIが読むことができます。",
  ],
  confirm: "内容を確認しました",
  cancel: "キャンセル",
} as const;

export const FAITH_BAND_LABELS: Record<FaithBand, string> = {
  disbelieves: "まだ距離がある",
  uncertain: "少し迷いがある",
  senses_presence: "気配を感じている",
  believes: "信頼が芽生えている",
  devoted: "深く結びついている",
};

export const EXTERNAL_AI_TEXT_LABEL = "外のAIでこの子と話すための文章";
export const COPY_BUTTON_LABEL = "外のAIでこの子と話すための文章をコピー";
export const COPY_DONE_LABEL = "コピーしました";
