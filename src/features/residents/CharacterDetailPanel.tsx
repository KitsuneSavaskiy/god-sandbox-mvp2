import { useEffect, useMemo, useState } from "react";
import type { AppearanceVariant, Character } from "../../domain/models.js";
import { Button } from "../../ui/Button.js";
import {
  createCharacterDetailReadModel,
  getExpressionLabel,
  type CharacterDetailAssetBundle,
  type CharacterDetailInfoItem,
} from "./characterDetailReadModel.js";
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
  const detailBundle = readModel.assetBundle;
  const expressionVariants = readModel.expressions;
  const [selectedExpressionId, setSelectedExpressionId] = useState<string | null>(
    () => expressionVariants[0]?.id ?? null,
  );
  const [expressionFailed, setExpressionFailed] = useState(false);
  const portraitSource = useMemo(
    () => resolveDisplayAssetUrl(character, detailBundle),
    [character, detailBundle],
  );
  const selectedExpression =
    expressionVariants.find((variant) => variant.id === selectedExpressionId) ??
    expressionVariants[0];
  const selectedExpressionSource = selectedExpression
    ? resolveExpressionAssetUrl(character, selectedExpression, detailBundle)
    : null;
  const references = createAssetReferences(character, expressionVariants, detailBundle);

  useEffect(() => {
    setPortraitFailed(false);
  }, [character.id, portraitSource]);

  useEffect(() => {
    setSelectedExpressionId(expressionVariants[0]?.id ?? null);
    setExpressionFailed(false);
  }, [character.id, expressionVariants]);

  useEffect(() => {
    setExpressionFailed(false);
  }, [selectedExpressionId, selectedExpressionSource]);

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
          <figcaption>
            立ち絵は登録済みassetがあれば表示します。未登録の場合はplaceholderで止めます。
          </figcaption>
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

        <section className="character-detail-panel__section" aria-labelledby="character-detail-unresolved">
          <h3 id="character-detail-unresolved">未確定メモ</h3>
          <InfoList items={readModel.unresolvedItems} />
        </section>

        <section className="character-detail-panel__section" aria-labelledby="character-detail-expressions">
          <h3 id="character-detail-expressions">表情差分</h3>
          {expressionVariants.length ? (
            <>
              <div className="character-detail-panel__expression-viewer">
                {selectedExpressionSource && !expressionFailed && selectedExpression ? (
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
                {expressionVariants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={
                      variant.id === selectedExpression?.id
                        ? "character-detail-panel__expression-button character-detail-panel__expression-button--active"
                        : "character-detail-panel__expression-button"
                    }
                    onClick={() => setSelectedExpressionId(variant.id)}
                  >
                    <span>{getExpressionLabel(variant)}</span>
                    <small>{variant.assetId}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="character-detail-panel__empty">
              表情差分は未登録です。生成とasset登録はLine 4の成果物を参照します。
            </p>
          )}
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
  character: Character,
  expressionVariants: AppearanceVariant[],
  detailBundle: CharacterDetailAssetBundle | null,
): AssetReference[] {
  return [
    {
      label: "立ち絵 / portrait",
      value: detailBundle?.portraitAssetId ?? character.profile.appearance.primaryAssetId,
      note: detailBundle
        ? "Sprint7標準住民画像のportrait asset IDです。"
        : "表示できる画像pathが登録されていれば上の枠に出ます。",
    },
    {
      label: "icon",
      value: detailBundle?.iconAssetId ?? (readStringField(character, "iconAssetId") || "未生成"),
      note: "未ロードなら名前の頭文字placeholderを使います。",
    },
    {
      label: "sprite sheet",
      value: detailBundle?.spriteSheetAssetId ?? character.profile.appearance.spriteSheetAssetId ?? "未生成",
      note: "箱庭内spriteはLine 4のasset登録後に参照します。",
    },
    {
      label: "表情差分",
      value: expressionVariants.length ? `${expressionVariants.length}件` : "未登録",
      note: "画像生成とasset登録はLine 4の成果物を参照します。",
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

function resolveDisplayAssetUrl(
  character: Character,
  detailBundle: CharacterDetailAssetBundle | null,
): string | null {
  const assetId = character.profile.appearance.primaryAssetId;
  if (assetId.startsWith("/") || assetId.startsWith("data:")) {
    return assetId;
  }

  if (assetId.startsWith("http://") || assetId.startsWith("https://")) {
    return assetId;
  }

  if (detailBundle) {
    return `/art/residents/${detailBundle.bundleId}/portrait-neutral.png`;
  }

  return `/art/residents/${character.id}/standing.png`;
}

function resolveExpressionAssetUrl(
  character: Character,
  variant: AppearanceVariant,
  detailBundle: CharacterDetailAssetBundle | null,
): string | null {
  const assetId = variant.assetId;
  if (assetId.startsWith("/") || assetId.startsWith("data:")) {
    return assetId;
  }

  if (assetId.startsWith("http://") || assetId.startsWith("https://")) {
    return assetId;
  }

  const fileToken = toAssetFileToken(variant.emotion || variant.id);
  if (detailBundle) {
    return `/art/residents/${detailBundle.bundleId}/expressions/${fileToken}.png`;
  }

  return `/art/residents/${character.id}/expressions/${fileToken}.png`;
}

function toAssetFileToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "expression";
}
