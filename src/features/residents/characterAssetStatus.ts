import type { Character } from "../../domain/models.js";
import {
  isCharacterAnimationReady,
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
  const extended = readModel.extendedSheet;
  const readyPair = isCharacterAnimationReady(readModel);
  const partialReady = sprite.ready || extended.ready;
  const reviewPending =
    isReviewPending(sprite.status, sprite.missingReason) ||
    isReviewPending(extended.status, extended.missingReason);

  if (readyPair) {
    return {
      label: "準備済み",
      tone: "ready",
      summary: "Sheet 1 と Sheet 2 の両方を箱庭で表示できます。",
      nextAction: "このまま箱庭でアニメ表示に使えます。",
    };
  }

  if (partialReady) {
    return {
      label: "確認が必要",
      tone: "reviewing",
      summary: "片方のシートだけ準備されています。2枚そろうまでは ready にしません。",
      nextAction: "Sheet 1 と Sheet 2 の両方が通るまでは通常画像で表示します。",
    };
  }

  if (reviewPending) {
    return {
      label: "確認が必要",
      tone: "reviewing",
      summary: "箱庭用アニメ素材の候補はありますが、まだ採用されていません。",
      nextAction: "2枚そろって確認できるまでは通常画像で表示します。",
    };
  }

  if (isMissing(sprite.status, sprite.missingReason) || isMissing(extended.status, extended.missingReason)) {
    return {
      label: "未生成",
      tone: "missing",
      summary: "箱庭用アニメ素材はまだ登録されていません。",
      nextAction: "必要になったら外部の生成画面と検査手順で準備できます。",
    };
  }

  if (
    isNotGeneratedYet(sprite.status, sprite.missingReason) &&
    isNotGeneratedYet(extended.status, extended.missingReason)
  ) {
    return {
      label: "通常画像で代用中",
      tone: "fallback",
      summary: "箱庭用アニメ素材はまだ2枚とも未生成です。",
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

function isReviewPending(
  status: CharacterAssetBundleReadModel["spriteSheet"]["status"],
  missingReason: CharacterAssetBundleReadModel["spriteSheet"]["missingReason"],
): boolean {
  return (
    status === "rejected" ||
    missingReason === "invalid-metadata" ||
    missingReason === "rejected" ||
    missingReason === "source-not-adopted"
  );
}

function isMissing(
  status: CharacterAssetBundleReadModel["spriteSheet"]["status"],
  missingReason: CharacterAssetBundleReadModel["spriteSheet"]["missingReason"],
): boolean {
  return status === "missing" || missingReason === "asset-not-registered";
}

function isNotGeneratedYet(
  status: CharacterAssetBundleReadModel["spriteSheet"]["status"],
  missingReason: CharacterAssetBundleReadModel["spriteSheet"]["missingReason"],
): boolean {
  return status === "placeholder" && missingReason === "not-generated-yet";
}
