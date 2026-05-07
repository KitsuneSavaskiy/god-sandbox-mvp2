import { useEffect, useMemo, useState } from "react";
import type { Character } from "../../domain/models.js";
import type {
  CharacterAssetBundleReadModel,
  CharacterExpressionSlot,
  ResolvedCharacterAssetRef,
} from "../../application/characterAssetBundles.js";
import { Button } from "../../ui/Button.js";
import {
  createCharacterDetailReadModel,
  getExpressionLabel,
  type CharacterExpressionKey,
  type CharacterDetailInfoItem,
} from "./characterDetailReadModel.js";
import { resolveCharacterAnimationAssetStatus } from "./characterAssetStatus.js";
import "./CharacterDetailPanel.css";

type CharacterDetailPanelProps = {
  character: Character;
  onClose: () => void;
};

type AssetReference = {
  label: string;
  value: string;
  note: string;
};

export function CharacterDetailPanel({ character, onClose }: CharacterDetailPanelProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);
  const readModel = useMemo(
    () => createCharacterDetailReadModel(character),
    [character],
  );
  const assetReadModel = readModel.assetReadModel;
  const expressionSlots = readModel.expressionSlots;
  const [selectedExpressionKey, setSelectedExpressionKey] =
    useState<CharacterExpressionKey>(
      () => expressionSlots[0]?.key ?? "neutral",
  );
  const [expressionFailed, setExpressionFailed] = useState(false);
  const portraitSource = assetReadModel.portrait.path;
  const selectedExpression =
    expressionSlots.find((slot) => slot.key === selectedExpressionKey) ??
    expressionSlots[0];
  const selectedExpressionSource = selectedExpression
    ? resolveExpressionDisplayPath(selectedExpression, expressionFailed)
    : null;
  const selectedExpressionUsesFallback = Boolean(
    selectedExpression?.isPlaceholder ||
      (expressionFailed &&
        selectedExpression?.fallbackPath &&
        selectedExpression.fallbackPath !== selectedExpression.path),
  );
  const selectedExpressionCanRender = Boolean(
    selectedExpressionSource &&
      (!expressionFailed ||
        (selectedExpression?.fallbackPath &&
          selectedExpression.fallbackPath !== selectedExpression.path)),
  );
  const animationAssetStatus =
    resolveCharacterAnimationAssetStatus(assetReadModel);
  const references = createAssetReferences(assetReadModel, expressionSlots);

  useEffect(() => {
    setPortraitFailed(false);
  }, [character.id, portraitSource]);

  useEffect(() => {
    setSelectedExpressionKey(expressionSlots[0]?.key ?? "neutral");
    setExpressionFailed(false);
  }, [character.id, expressionSlots]);

  useEffect(() => {
    setExpressionFailed(false);
  }, [selectedExpressionKey, selectedExpression?.path, selectedExpression?.fallbackPath]);

  return (
    <aside
      className="character-detail-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="character-detail-panel-title"
    >
      <div className="character-detail-panel__chrome">
        <div>
          <p className="eyebrow">Character detail</p>
          <h2 id="character-detail-panel-title">{readModel.displayName}</h2>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          閉じる
        </Button>
      </div>

      <div className="character-detail-panel__body">
        <figure className="character-detail-panel__portrait-card">
          {portraitSource && !portraitFailed ? (
            <img
              src={portraitSource}
              alt={`${readModel.displayName}の立ち絵`}
              onError={() => setPortraitFailed(true)}
            />
          ) : (
            <div className="character-detail-panel__portrait-placeholder" aria-label="立ち絵未生成">
              <span>{readModel.displayName.slice(0, 1)}</span>
              <strong>立ち絵は未生成</strong>
            </div>
          )}
        </figure>

        <section className="character-detail-panel__section" aria-labelledby="character-detail-profile">
          <h3 id="character-detail-profile">設定</h3>
          <InfoList items={readModel.settingItems} />
        </section>

        <section className="character-detail-panel__section" aria-labelledby="character-detail-recognition">
          <h3 id="character-detail-recognition">見た目メモ</h3>
          {readModel.visualMemoItems.length ? (
            <>
              <p className="character-detail-panel__section-note">
                AI認識メモは未確認です。公式loreではなく、ユーザー確認待ちの説明として扱います。
              </p>
              <InfoList items={readModel.visualMemoItems} />
            </>
          ) : (
            <p className="character-detail-panel__empty">AI認識メモは未生成です。</p>
          )}
        </section>

        <section
          className="character-detail-panel__section character-detail-panel__section--expressions"
          aria-labelledby="character-detail-expressions"
        >
          <h3 id="character-detail-expressions">表情差分</h3>
          {expressionSlots.length ? (
            <>
              <div className="character-detail-panel__expression-viewer">
                {selectedExpressionCanRender && selectedExpressionSource && selectedExpression ? (
                  <img
                    src={selectedExpressionSource}
                    alt={`${readModel.displayName}の${getExpressionLabel(selectedExpression)}`}
                    onError={() => setExpressionFailed(true)}
                  />
                ) : (
                  <div
                    className="character-detail-panel__expression-placeholder"
                    aria-label="表情差分未ロード"
                  >
                    <span>{selectedExpression ? getExpressionLabel(selectedExpression) : "表情"}</span>
                    <strong>表情差分は未ロード</strong>
                    <small>生成とasset登録はLine 4の成果物を参照します。</small>
                  </div>
                )}
              </div>
              <div className="character-detail-panel__expression-switcher" aria-label="表情差分切り替え">
                {expressionSlots.map((slot) => (
                  <button
                    key={slot.key}
                    type="button"
                    className={
                      slot.key === selectedExpression?.key
                        ? `character-detail-panel__expression-button character-detail-panel__expression-button--active${
                            slot.isPlaceholder ? " character-detail-panel__expression-button--fallback" : ""
                          }`
                        : `character-detail-panel__expression-button${
                            slot.isPlaceholder ? " character-detail-panel__expression-button--fallback" : ""
                          }`
                    }
                    onClick={() => setSelectedExpressionKey(slot.key)}
                  >
                    <span>{getExpressionLabel(slot)}</span>
                  </button>
                ))}
              </div>
              {selectedExpression ? (
                <ExpressionStatus slot={selectedExpression} isFallback={selectedExpressionUsesFallback} />
              ) : null}
            </>
          ) : (
            <p className="character-detail-panel__empty">
              表情差分は未登録です。生成とasset登録はLine 4の成果物を参照します。
            </p>
          )}
        </section>

        <section
          className="character-detail-panel__section character-detail-panel__section--animation-asset"
          aria-labelledby="character-detail-animation-asset"
        >
          <div className="character-detail-panel__animation-header">
            <h3 id="character-detail-animation-asset">箱庭用アニメ素材</h3>
            <span
              className={`character-detail-panel__asset-status character-detail-panel__asset-status--${animationAssetStatus.tone}`}
            >
              {animationAssetStatus.label}
            </span>
          </div>
          <p className="character-detail-panel__animation-summary">
            {animationAssetStatus.summary}
          </p>
          <p className="character-detail-panel__animation-note">
            {animationAssetStatus.nextAction}
          </p>
          <details className="character-detail-panel__asset-guide">
            <summary>素材を作る手順を見る</summary>
            <ol>
              <li>別ブラウザの生成画面で、住民の小さな箱庭用アニメ画像を作ります。</li>
              <li>透明背景、192×208px枠、余白、文字混入がないかを確認します。</li>
              <li>採用できる画像だけを開発側で登録します。この画面から外部サービスや課金設定は扱いません。</li>
            </ol>
          </details>
        </section>

        <section className="character-detail-panel__section" aria-labelledby="character-detail-unresolved">
          <h3 id="character-detail-unresolved">未確定メモ</h3>
          <InfoList items={readModel.unresolvedItems} />
        </section>

        <section className="character-detail-panel__section" aria-labelledby="character-detail-assets">
          <h3 id="character-detail-assets">asset参照</h3>
          <div className="character-detail-panel__asset-list">
            {references.map((reference) => (
              <article key={reference.label} className="character-detail-panel__asset-row">
                <span>{reference.label}</span>
                <strong>{reference.value}</strong>
                <small>{reference.note}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function ExpressionStatus({
  slot,
  isFallback,
}: {
  slot: CharacterExpressionSlot;
  isFallback: boolean;
}) {
  if (slot.isPlaceholder) {
    return (
      <p className="character-detail-panel__expression-status">
        未生成。neutral fallback中です。
      </p>
    );
  }

  if (isFallback) {
    return (
      <p className="character-detail-panel__expression-status">
        neutral fallback中です。
      </p>
    );
  }

  return null;
}

function InfoList({ items }: { items: CharacterDetailInfoItem[] }) {
  if (items.length === 0) {
    return <p className="character-detail-panel__empty">未設定</p>;
  }

  return (
    <dl className="character-detail-panel__definition-list">
      {items.map((item) => (
        <div key={`${item.source}-${item.label}-${item.value}`}>
          <dt>
            <span>{item.label}</span>
            <SourceBadge source={item.source} />
          </dt>
          <dd>{item.value}</dd>
          {item.needsUserConfirmation ? (
            <dd className="character-detail-panel__source-note">未確認。ユーザー確認までは公式設定にしません。</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

function SourceBadge({ source }: { source: CharacterDetailInfoItem["source"] }) {
  const label =
    source === "user-input"
      ? "ユーザー入力"
      : source === "generated-recognition"
        ? "AI認識メモ"
        : "未設定";

  return (
    <span className={`character-detail-panel__source-badge character-detail-panel__source-badge--${source}`}>
      {label}
    </span>
  );
}

function createAssetReferences(
  assetReadModel: CharacterAssetBundleReadModel,
  expressionSlots: CharacterExpressionSlot[],
): AssetReference[] {
  const readyExpressionCount = expressionSlots.filter((slot) => !slot.isPlaceholder).length;
  const fallbackExpressionCount = expressionSlots.length - readyExpressionCount;

  return [
    {
      label: "立ち絵 / portrait",
      value: formatAssetValue(assetReadModel.portrait),
      note: createAssetNote(assetReadModel.portrait, "登録済みの立ち絵参照です。"),
    },
    {
      label: "icon",
      value: formatAssetValue(assetReadModel.icon),
      note: createAssetNote(assetReadModel.icon, "未登録なら名前の頭文字placeholderを使います。"),
    },
    {
      label: "箱庭アニメ素材 (Sheet 1)",
      value: formatAssetValue(assetReadModel.spriteSheet),
      note: createAssetNote(assetReadModel.spriteSheet, "motion sheet の参照状態です。"),
    },
    {
      label: "箱庭アニメ拡張素材 (Sheet 2)",
      value: formatAssetValue(assetReadModel.extendedSheet),
      note: createAssetNote(assetReadModel.extendedSheet, "extended sheet の参照状態です。"),
    },
    {
      label: "表情差分",
      value: `${readyExpressionCount}/5 実画像`,
      note:
        fallbackExpressionCount > 0
          ? `${fallbackExpressionCount}件はneutral fallback中です。`
          : "5件すべてLine 4 read modelで解決されています。",
    },
  ];
}

function resolveExpressionDisplayPath(
  slot: CharacterExpressionSlot,
  hasImageFailed: boolean,
): string | null {
  if (hasImageFailed && slot.fallbackPath && slot.fallbackPath !== slot.path) {
    return slot.fallbackPath;
  }

  return slot.path ?? slot.fallbackPath;
}

function formatAssetValue(asset: ResolvedCharacterAssetRef): string {
  if (!asset.assetId) {
    return "未生成";
  }

  return asset.assetId;
}

function createAssetNote(
  asset: ResolvedCharacterAssetRef,
  fallbackNote: string,
): string {
  if (asset.path) {
    return `${fallbackNote} path: ${asset.path}`;
  }

  return `${fallbackNote} path未登録`;
}
