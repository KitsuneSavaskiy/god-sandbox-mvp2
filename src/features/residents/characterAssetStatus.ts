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
  label: "準備済み" | "未生成" | "確認が必要" | "通常画像で代用中";
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

  if (sprite.status === "ready") {
    return {
      label: "準備済み",
      tone: "ready",
      summary: "箱庭用の小さなアニメ素材を表示できます。",
      nextAction: "このまま箱庭でアニメ表示に使えます。",
    };
  }

  if (
    sprite.status === "rejected" ||
    sprite.missingReason === "rejected" ||
    sprite.missingReason === "source-not-adopted"
  ) {
    return {
      label: "確認が必要",
      tone: "reviewing",
      summary: "箱庭用アニメ素材の候補はありますが、まだ採用されていません。",
      nextAction: "安全に確認できるまでは通常画像で表示します。",
    };
  }

  if (
    sprite.status === "missing" ||
    sprite.missingReason === "asset-not-registered"
  ) {
    return {
      label: "未生成",
      tone: "missing",
      summary: "箱庭用アニメ素材はまだ登録されていません。",
      nextAction: "必要になったら外部の生成画面と検査手順で準備できます。",
    };
  }

  if (
    sprite.status === "placeholder" &&
    sprite.missingReason === "not-generated-yet"
  ) {
    return {
      label: "通常画像で代用中",
      tone: "fallback",
      summary: "箱庭用アニメ素材はまだ未生成です。",
      nextAction: "完成するまでは登録済みの通常画像で表示します。",
    };
  }

  return {
    label: "通常画像で代用中",
    tone: "fallback",
    summary: "箱庭用アニメ素材は準備中です。",
    nextAction: "確認できるまでは登録済みの通常画像で表示します。",
  };
}
