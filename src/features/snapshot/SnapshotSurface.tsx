import { FormEvent, useState } from "react";
import { selectRoster } from "../../application/runtimeSelectors.js";
import type { CharacterId, CharacterSnapshot } from "../../domain/models.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import { Button } from "../../ui/Button";
import "./SnapshotSurface.css";

type SnapshotSurfaceProps = {
  state: RuntimeWorldState;
  onIssueSnapshot: (input: {
    characterId: CharacterId;
    memo?: string;
    tags: string[];
  }) => void;
};

export function SnapshotSurface({ state, onIssueSnapshot }: SnapshotSurfaceProps) {
  const roster = selectRoster(state);
  const [characterId, setCharacterId] = useState<CharacterId>(roster[0]?.id ?? "");
  const [tags, setTags] = useState("first-export");
  const [memo, setMemo] = useState("");
  const snapshots = [...state.snapshots.values()].reverse();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!characterId) {
      return;
    }

    onIssueSnapshot({
      characterId,
      memo: memo.trim() || undefined,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setMemo("");
  }

  return (
    <section className="snapshot-surface" aria-labelledby="snapshot-title">
      <div>
        <p className="eyebrow">Step 1 / Snapshot</p>
        <h2 id="snapshot-title">まず、今の住民を固定記録にする</h2>
        <p>
          Snapshot は箱庭の中の記録です。Passport 発行とは別ステップにして、
          どの時点を外へ持ち出すか選べるようにします。
        </p>
      </div>

      <div className="snapshot-surface__layout">
        <form className="snapshot-form" onSubmit={handleSubmit}>
          <label>
            記録する住民
            <select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
              {roster.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.profile.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            tag
            <input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <label>
            memo
            <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
          </label>
          <Button type="submit" variant="primary">
            Snapshotを記録
          </Button>
        </form>

        <SnapshotList snapshots={snapshots} />
      </div>
    </section>
  );
}

function SnapshotList({ snapshots }: { snapshots: CharacterSnapshot[] }) {
  return (
    <section className="snapshot-list" aria-label="Snapshot一覧">
      <h3>記録済み Snapshot</h3>
      <div className="snapshot-list__items">
        {snapshots.length ? (
          snapshots.map((snapshot) => (
            <article className="snapshot-item" key={snapshot.id}>
              <h4>{snapshot.character.profile.displayName}</h4>
              <p>ID: {snapshot.id}</p>
              <p>tags: {snapshot.annotations.tags.join(", ") || "なし"}</p>
              <p>{snapshot.annotations.memo ?? "memo なし"}</p>
            </article>
          ))
        ) : (
          <p>まだ Snapshot はありません。</p>
        )}
      </div>
    </section>
  );
}
