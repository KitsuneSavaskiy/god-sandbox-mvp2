import { useEffect, useMemo, useState } from "react";
import type { AppearanceVariant, Character } from "../../domain/models.js";
import { Button } from "../../ui/Button.js";
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

type DetailAssetBundle = {
  displayName: string;
  bundleId: string;
  portraitAssetId: string;
  iconAssetId: string;
  spriteSheetAssetId: string;
};

const expressionKeys = ["neutral", "happy", "angry", "sad", "surprised"] as const;

const expressionLabels: Record<(typeof expressionKeys)[number], string> = {
  neutral: "通常",
  happy: "喜び",
  angry: "怒り",
  sad: "悲しみ",
  surprised: "驚き",
};

const defaultCharacterDetailBundles: Record<string, DetailAssetBundle> = {
  chr_ryo: createDefaultDetailBundle("Eve", "eve"),
  chr_mina: createDefaultDetailBundle("Garan", "garan"),
  chr_towa: createDefaultDetailBundle("Ryo", "ryo"),
  chr_sena: createDefaultDetailBundle("Suzu", "suzu"),
};

export function CharacterDetailPanel({ character, onClose }: CharacterDetailPanelProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);
  const detailBundle = resolveDetailAssetBundle(character);
  const expressionVariants = useMemo(
    () => createExpressionVariants(character, detailBundle),
    [character, detailBundle],
  );
  const [selectedExpressionId, setSelectedExpressionId] = useState<string | null>(
    () => expressionVariants[0]?.id ?? null,
  );
  const [expressionFailed, setExpressionFailed] = useState(false);
  const detailDisplayName = resolveDetailDisplayName(character);
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
  const description = readStringField(character, "description");
  const speechStyle = character.profile.speechStyleId ?? readStringField(character, "speechStyleId");
  const age = character.profile.age ?? readStringField(character, "age");

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
          <h2 id="character-detail-panel-title">{detailDisplayName}</h2>
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
              alt={`${detailDisplayName}の立ち絵`}
              onError={() => setPortraitFailed(true)}
            />
          ) : (
            <div className="character-detail-panel__portrait-placeholder" aria-label="立ち絵未生成">
              <span>{detailDisplayName.slice(0, 1)}</span>
              <strong>立ち絵は未生成</strong>
            </div>
          )}
          <figcaption>
            立ち絵は登録済みassetがあれば表示します。未登録の場合はplaceholderで止めます。
          </figcaption>
        </figure>

        <section className="character-detail-panel__section" aria-labelledby="character-detail-profile">
          <h3 id="character-detail-profile">基本設定</h3>
          <dl className="character-detail-panel__definition-list">
            <div>
              <dt>名前</dt>
              <dd>{detailDisplayName}</dd>
            </div>
            <div>
              <dt>保存名</dt>
              <dd>{character.profile.displayName}</dd>
            </div>
            <div>
              <dt>役割</dt>
              <dd>{character.state.narrativeRole ?? "未設定"}</dd>
            </div>
            <div>
              <dt>説明</dt>
              <dd>{description || "未設定"}</dd>
            </div>
            <div>
              <dt>口調</dt>
              <dd>{speechStyle || "未設定"}</dd>
            </div>
            <div>
              <dt>年齢</dt>
              <dd>{age || "未設定"}</dd>
            </div>
          </dl>
        </section>

        <section className="character-detail-panel__section" aria-labelledby="character-detail-expressions">
          <h3 id="character-detail-expressions">表情差分</h3>
          {expressionVariants.length ? (
            <>
              <div className="character-detail-panel__expression-viewer">
                {selectedExpressionSource && !expressionFailed && selectedExpression ? (
                  <img
                    src={selectedExpressionSource}
                    alt={`${detailDisplayName}の${getExpressionLabel(selectedExpression)}`}
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

function createAssetReferences(
  character: Character,
  expressionVariants: AppearanceVariant[],
  detailBundle: DetailAssetBundle | null,
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
  detailBundle: DetailAssetBundle | null,
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
  detailBundle: DetailAssetBundle | null,
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

function resolveDetailDisplayName(character: Character): string {
  return resolveDetailAssetBundle(character)?.displayName ?? character.profile.displayName;
}

function resolveDetailAssetBundle(character: Character): DetailAssetBundle | null {
  return defaultCharacterDetailBundles[character.id] ?? null;
}

function createDefaultDetailBundle(displayName: string, bundleId: string): DetailAssetBundle {
  return {
    displayName,
    bundleId,
    portraitAssetId: `${bundleId}-portrait-neutral`,
    iconAssetId: `${bundleId}-icon`,
    spriteSheetAssetId: `${bundleId}-sprite-sheet`,
  };
}

function createExpressionVariants(
  character: Character,
  detailBundle: DetailAssetBundle | null,
): AppearanceVariant[] {
  if (character.profile.appearance.variantAssetIds.length > 0) {
    return character.profile.appearance.variantAssetIds;
  }

  if (!detailBundle) {
    return [];
  }

  return expressionKeys.map((key) => ({
    id: `${detailBundle.bundleId}-expression-${key}`,
    emotion: key,
    assetId: `${detailBundle.bundleId}-expression-${key}`,
  }));
}

function getExpressionLabel(variant: AppearanceVariant): string {
  return expressionLabels[variant.emotion as (typeof expressionKeys)[number]] ?? variant.emotion ?? "表情";
}

function toAssetFileToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "expression";
}
