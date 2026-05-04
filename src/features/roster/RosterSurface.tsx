import {
  selectPendingActivationCharacters,
  selectRoster,
} from "../../application/runtimeSelectors.js";
import type { Character, CharacterId } from "../../domain/models.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import { Button } from "../../ui/Button";
import "./RosterSurface.css";

type RosterSurfaceProps = {
  state: RuntimeWorldState;
  onAddNew: () => void;
  onEdit: (characterId: CharacterId) => void;
  onReplaceActiveSlot: (slotIndex: number, characterId: CharacterId) => void;
};

export function RosterSurface({
  state,
  onAddNew,
  onEdit,
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
        <p className="eyebrow">Roster / activeSlots[4]</p>
        <h2 id="roster-title">所有住民と箱庭に出る4名を分けて管理する</h2>
        <p>
          新しい住民はまず roster に追加されます。activeSlots は常に4名のまま保ち、
          入れ替えたい時だけ下の4枠から選びます。
        </p>
        <div className="roster-surface__actions">
          <Button type="button" variant="primary" onClick={onAddNew}>
            新しい住民を追加
          </Button>
        </div>
      </div>

      <section className="roster-surface__section" aria-labelledby="active-slots-title">
        <h3 id="active-slots-title">箱庭に出ている4名</h3>
        <div className="active-slot-grid">
          {activeCharacters.map((character, slotIndex) => (
            <ActiveSlotCard
              key={`${slotIndex}-${character.id}`}
              character={character}
              slotIndex={slotIndex}
              roster={roster}
              activeCharacterIds={state.session.activeSlots}
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
        <h3 id="roster-list-title">roster 全員</h3>
        <div className="roster-grid">
          {roster.map((character) => (
            <RosterCard key={character.id} character={character} onEdit={onEdit} />
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
  onReplaceActiveSlot,
}: {
  character: Character;
  slotIndex: number;
  roster: Character[];
  activeCharacterIds: readonly CharacterId[];
  onReplaceActiveSlot: (slotIndex: number, characterId: CharacterId) => void;
}) {
  const candidates = roster.filter(
    (candidate) => candidate.id === character.id || !activeCharacterIds.includes(candidate.id),
  );

  return (
    <article className="active-slot-card">
      <p className="eyebrow">Slot {slotIndex + 1}</p>
      <h4>{character.profile.displayName}</h4>
      <p className="active-slot-card__meta">
        ここは active な4名の枠です。roster への追加とは別操作で入れ替えます。
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
  onEdit,
}: {
  character: Character;
  onEdit: (characterId: CharacterId) => void;
}) {
  return (
    <article className="roster-card">
      <p className="eyebrow">{character.state.narrativeRole ?? "住民"}</p>
      <h4>{character.profile.displayName}</h4>
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

