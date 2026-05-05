import type { Character } from "../../domain/models.js";
import {
  resolveCharacterAssetBundleReadModel,
  type CharacterAssetBundleReadModel,
} from "../../application/characterAssetBundles.js";

export type CharacterAnimationAssetStatusTone =
  | "ready"
  | "reviewing"
  | "fallback"
  | "missing";

export type CharacterAnimationAssetStatus = {
  label: "準備済み" | "未生成" | "確認中" | "通常画像で代用中";
  tone: CharacterAnimationAssetStatusTone;
  summary: string;
  nextAction: string;
};

export function resolveCharacterAnimationAssetStatusForCharacter(
  character: Character,
): CharacterAnimationAssetStatus {
  return resolveCharacterAnimationAssetStatus(
    resolveCharacterAssetBundleReadModel(character),
  );
}

export function resolveCharacterAnimationAssetStatus(
  readModel: CharacterAssetBundleReadModel,
): CharacterAnimationAssetStatus {
  const sprite = readModel.spriteSheet;

  if (sprite.ready && sprite.path) {
    return {
      label: "準備済み",
      tone: "ready",
      summary: "箱庭用の小さなアニメ素材を表示できます。",
      nextAction: "このまま箱庭でアニメ表示に使えます。",
    };
  }

  if (sprite.path && !sprite.ready) {
    return {
      label: "確認中",
      tone: "reviewing",
      summary: "素材候補はありますが、採用前の確認が残っています。",
      nextAction: "検査が終わるまでは通常画像で表示します。",
    };
  }

  if (sprite.fallbackPath) {
    return {
      label: "通常画像で代用中",
      tone: "fallback",
      summary: "箱庭用アニメ素材はまだ未生成です。",
      nextAction: "完成するまでは登録済みの通常画像で表示します。",
    };
  }

  return {
    label: "未生成",
    tone: "missing",
    summary: "箱庭用アニメ素材はまだありません。",
    nextAction: "素材を作る場合は、外部の生成画面と検査手順を使います。",
  };
}
