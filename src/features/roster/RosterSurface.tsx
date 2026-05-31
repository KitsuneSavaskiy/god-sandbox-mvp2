import {
  selectPendingActivationCharacters,
  selectRoster,
} from "../../application/runtimeSelectors.js";
import type { Character, CharacterId } from "../../domain/models.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import { resolveCharacterAnimationAssetStatusForCharacter } from "../residents/characterAssetStatus.js";
import { Button } from "../../ui/Button";
import "./RosterSurface.css";

type RosterSurfaceProps = {
  state: RuntimeWorldState;
  provisionalPortraits?: Record<string, string>;
  onAddNew: () => void;
  onEdit: (characterId: CharacterId) => void;
  onOpenDetail: (characterId: CharacterId) => void;
  onReplaceActiveSlot: (slotIndex: number, characterId: CharacterId) => void;
};

export function RosterSurface({
  state,
  provisionalPortraits = {},
  onAddNew,
  onEdit,
  onOpenDetail,
  onReplaceActiveSlot,
}: RosterSurfaceProps) {
  const roster = selectRoster(state);
  const pending = selectPendingActivationCharacters(state);
  const activeCharacters = state.session.activeSlots.map((characterId) =>
    roster.find((character) => character.id === characterId),
  ).filter((character): character is Character => Boolean(character));

  return (
    <section className="roster-surface" aria-labelledby="roster-title">
      <div className="roster-surface__header">
        <p className="eyebrow">住民管理</p>
        <h2 id="roster-title">住民一覧と箱庭にいる4人を分けて管理する</h2>
        <p>
          新しい住民は住民一覧に保存されます。作成時に選んだ枠へ呼ぶこともでき、
          あとから下の4枠で戻せます。
        </p>
        <div className="roster-surface__actions">
          <Button type="button" variant="primary" onClick={onAddNew}>
            新しい住民を追加
          </Button>
        </div>
      </div>

      <section className="roster-surface__section" aria-labelledby="active-slots-title">
        <h3 id="active-slots-title">箱庭にいる4人</h3>
        <div className="active-slot-grid">
          {activeCharacters.map((character, slotIndex) => (
            <ActiveSlotCard
              key={`${slotIndex}-${character.id}`}
              character={character}
              slotIndex={slotIndex}
              roster={roster}
              activeCharacterIds={state.session.activeSlots}
              provisionalPortraits={provisionalPortraits}
              onOpenDetail={onOpenDetail}
              onReplaceActiveSlot={onReplaceActiveSlot}
            />
          ))}
        </div>
      </section>

      <section className="roster-surface__section" aria-labelledby="pending-title">
        <h3 id="pending-title">追加済みだが未配置</h3>
        <div className="pending-list">
          {pending.length ? (
            pending.map((character) => <span key={character.id}>{character.profile.displayName}</span>)
          ) : (
            <span>待機中の住民はいません</span>
          )}
        </div>
      </section>

      <section className="roster-surface__section" aria-labelledby="roster-list-title">
        <h3 id="roster-list-title">住民一覧</h3>
        <div className="roster-grid">
          {roster.map((character) => (
            <RosterCard
              key={character.id}
              character={character}
              provisionalPortraits={provisionalPortraits}
              onEdit={onEdit}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

function ActiveSlotCard({
  character,
  slotIndex,
  roster,
  activeCharacterIds,
  provisionalPortraits,
  onOpenDetail,
  onReplaceActiveSlot,
}: {
  character: Character;
  slotIndex: number;
  roster: Character[];
  activeCharacterIds: readonly CharacterId[];
  provisionalPortraits: Record<string, string>;
  onOpenDetail: (characterId: CharacterId) => void;
  onReplaceActiveSlot: (slotIndex: number, characterId: CharacterId) => void;
}) {
  const candidates = roster.filter(
    (candidate) => candidate.id === character.id || !activeCharacterIds.includes(candidate.id),
  );
  const assetStatus = resolveCharacterAnimationAssetStatusForCharacter(character);
  const hasProvisionalPortrait =
    Boolean(provisionalPortraits[character.id]) && assetStatus.tone !== "ready";

  return (
    <article className="active-slot-card">
      <p className="eyebrow">Slot {slotIndex + 1}</p>
      <div className="roster-card__name-row">
        <button
          type="button"
          className="character-icon-placeholder roster-card__icon-button"
          aria-label={`${character.profile.displayName}の詳細を開く`}
          onClick={() => onOpenDetail(character.id)}
        >
          {character.profile.displayName.slice(0, 1)}
        </button>
        <h4>{character.profile.displayName}</h4>
      </div>
      <span className={`roster-card__asset-status roster-card__asset-status--${assetStatus.tone}`}>
        箱庭アニメ: {assetStatus.label}
      </span>
      {hasProvisionalPortrait ? (
        <span className="roster-card__provisional-badge">仮の姿</span>
      ) : null}
      <p className="active-slot-card__meta">
        ここは、いま箱庭にいる4人です。新しい住民を迎えたあとも、この枠から入れ替えを選べます。
      </p>
      <label>
        <span className="active-slot-card__meta">この枠を入れ替える</span>
        <select
          value={character.id}
          onChange={(event) => onReplaceActiveSlot(slotIndex, event.target.value)}
        >
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.profile.displayName}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function RosterCard({
  character,
  provisionalPortraits,
  onEdit,
  onOpenDetail,
}: {
  character: Character;
  provisionalPortraits: Record<string, string>;
  onEdit: (characterId: CharacterId) => void;
  onOpenDetail: (characterId: CharacterId) => void;
}) {
  const assetStatus = resolveCharacterAnimationAssetStatusForCharacter(character);
  const hasProvisionalPortrait =
    Boolean(provisionalPortraits[character.id]) && assetStatus.tone !== "ready";

  return (
    <article className="roster-card">
      <p className="eyebrow">{character.state.narrativeRole ?? "住民"}</p>
      <div className="roster-card__name-row">
        <button
          type="button"
          className="character-icon-placeholder roster-card__icon-button"
          aria-label={`${character.profile.displayName}の詳細を開く`}
          onClick={() => onOpenDetail(character.id)}
        >
          {character.profile.displayName.slice(0, 1)}
        </button>
        <h4>{character.profile.displayName}</h4>
      </div>
      <span className={`roster-card__asset-status roster-card__asset-status--${assetStatus.tone}`}>
        箱庭アニメ: {assetStatus.label}
      </span>
      {hasProvisionalPortrait ? (
        <span className="roster-card__provisional-badge">仮の姿</span>
      ) : null}
      <p className="roster-card__meta roster-card__asset">
        画像: {character.profile.appearance.primaryAssetId}
      </p>
      <p className="roster-card__meta">
        口調: {character.profile.speechStyleId ?? "未設定"} / 年齢: {character.profile.age ?? "未設定"}
      </p>
      <div className="roster-card__actions">
        <Button type="button" onClick={() => onEdit(character.id)}>
          再編集
        </Button>
      </div>
    </article>
  );
}
