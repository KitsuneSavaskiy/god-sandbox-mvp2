export interface AssetgenPreset {
  id: string;
  label: string;
  desc: string;
  lanes: readonly string[];
}

export const ASSETGEN_PRESETS: readonly AssetgenPreset[] = [
  {
    id: "simple",
    label: "まず試す",
    desc: "箱庭アニメ用スプライト・立ち絵表情・派生アイコン",
    lanes: ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
  },
  {
    id: "full",
    label: "イベント用まで作る",
    desc: "箱庭アニメ・立ち絵表情・イベント用表情・派生アイコン",
    lanes: [
      "resident-sprite-sheet",
      "portrait-expressions",
      "event-standing-expressions",
      "derived-icon",
    ],
  },
  {
    id: "expressions-only",
    label: "表情だけ作る",
    desc: "立ち絵表情・イベント用表情のみ",
    lanes: ["portrait-expressions", "event-standing-expressions"],
  },
];

export const DEFAULT_PRESET_ID = "simple";

export function lanesForPreset(presetId: string): string[] {
  const preset = ASSETGEN_PRESETS.find((p) => p.id === presetId);
  return [...(preset ?? ASSETGEN_PRESETS[0]).lanes];
}

export const JOB_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: "受付完了",
  "prompt-pack-ready": "制作指示を準備しました",
  "gen2-dispatched": "ローカル補助に受け渡し済み",
  "watcher-intake-done": "画像候補待ち",
  error: "エラーが発生しました",
  cancelled: "キャンセルされました",
  "not-found": "ジョブが見つかりません",
};

export function labelForStatus(status: string): string {
  return JOB_STATUS_LABELS[status] ?? status;
}

export const ORDERED_JOB_STEPS = [
  { id: "pending", label: "受付完了" },
  { id: "prompt-pack-ready", label: "制作指示を準備しました" },
  { id: "gen2-dispatched", label: "ローカル補助に受け渡し済み" },
  { id: "watcher-intake-done", label: "画像候補待ち" },
] as const;

export function stepIndexForStatus(status: string): number {
  return ORDERED_JOB_STEPS.findIndex((s) => s.id === status);
}
