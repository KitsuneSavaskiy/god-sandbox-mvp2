export type AssetGenLane =
  | "resident-sprite-sheet"
  | "portrait-expressions"
  | "derived-icon"
  | "event-standing-expressions";

export type AssetGenPresetId = "welcome" | "expressions" | "event-ready";

export interface AssetGenPreset {
  id: AssetGenPresetId;
  title: string;
  description: string;
  lanes: readonly AssetGenLane[];
  includesEventExpressions: boolean;
  outcomes: readonly string[];
}

export const LOCAL_APP_SERVER_HELP_COMMAND = "npm run assetgen:server";
export const LOCAL_APP_SERVER_DOWN_TITLE = "ローカル補助がまだ準備中です";
export const FAKE_BRIDGE_WARNING = "これは動作確認用です。見た目候補としては使えません。";

export const ASSETGEN_PRESETS: readonly AssetGenPreset[] = [
  {
    id: "welcome",
    title: "まず箱庭に来てもらう",
    description: "歩く姿、表情、一覧で使う小さな絵の候補を準備します。",
    lanes: ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
    includesEventExpressions: false,
    outcomes: ["箱庭で歩く候補", "顔まわりの表情候補", "一覧で使う小さな絵"],
  },
  {
    id: "expressions",
    title: "表情を増やす",
    description: "会話や確認画面で使う表情候補を中心に増やします。",
    lanes: ["portrait-expressions", "event-standing-expressions"],
    includesEventExpressions: true,
    outcomes: ["顔まわりの表情候補", "イベント用の表情候補"],
  },
  {
    id: "event-ready",
    title: "イベントでも使えるようにする",
    description: "箱庭で歩く姿に加えて、イベント用の表情候補まで準備します。",
    lanes: [
      "resident-sprite-sheet",
      "portrait-expressions",
      "event-standing-expressions",
      "derived-icon",
    ],
    includesEventExpressions: true,
    outcomes: ["箱庭で歩く候補", "顔まわりの表情候補", "イベント用の表情候補", "一覧で使う小さな絵"],
  },
];

export const DEFAULT_ASSETGEN_PRESET_ID: AssetGenPresetId = "welcome";

export const FRIENDLY_JOB_STATUS_TEXT: Record<string, string> = {
  pending: "制作依頼を受け取りました",
  "prompt-pack-ready": "この子の特徴をまとめています",
  "gen2-dispatched": "ローカル補助に渡しました",
  "watcher-intake-done": "制作の準備が整いました",
  error: "うまく進めませんでした",
  cancelled: "制作依頼を止めました",
};

export function getAssetGenPreset(presetId: AssetGenPresetId): AssetGenPreset {
  return ASSETGEN_PRESETS.find((preset) => preset.id === presetId) ?? ASSETGEN_PRESETS[0];
}

export function getPresetLanes(presetId: AssetGenPresetId): AssetGenLane[] {
  return [...getAssetGenPreset(presetId).lanes];
}

export function getFriendlyJobStatus(status: string): string {
  return FRIENDLY_JOB_STATUS_TEXT[status] ?? "制作状況を確認しています";
}

export function createAssetBundleSlug(displayName: string, fallbackToken: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  if (/^[a-z0-9][a-z0-9_-]{0,59}$/.test(slug)) {
    return slug;
  }

  return fallbackToken
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "character";
}
