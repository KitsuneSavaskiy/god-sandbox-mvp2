import type { CharacterPassport, CharacterSnapshot } from "../../domain/models.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import { Button } from "../../ui/Button";
import "./PassportSurface.css";

type PassportSurfaceProps = {
  state: RuntimeWorldState;
  onIssuePassport: (snapshotId: string) => void;
};

export function PassportSurface({ state, onIssuePassport }: PassportSurfaceProps) {
  const snapshots = [...state.snapshots.values()].reverse();
  const passports = [...state.passports.values()].reverse();
  const issuedSnapshotIds = new Set(passports.map((passport) => passport.snapshotId));

  return (
    <section className="passport-surface" aria-labelledby="passport-title">
      <div>
        <p className="eyebrow">Step 2 / Passport</p>
        <h2 id="passport-title">Snapshotから単体キャラ Passport を発行する</h2>
        <p>
          Passport は外へ持ち出すための派生ファイルです。Snapshot を残すだけでは発行されません。
        </p>
      </div>

      <div className="passport-surface__grid">
        <section className="passport-list" aria-label="Passport発行元 Snapshot">
          <h3>発行できる Snapshot</h3>
          {snapshots.length ? (
            snapshots.map((snapshot) => (
              <SnapshotPassportSource
                key={snapshot.id}
                snapshot={snapshot}
                issued={issuedSnapshotIds.has(snapshot.id)}
                onIssuePassport={onIssuePassport}
              />
            ))
          ) : (
            <p>先に Snapshot を記録してください。</p>
          )}
        </section>

        <section className="passport-export-list" aria-label="発行済み Passport">
          <h3>発行済み Passport</h3>
          {passports.length ? (
            passports.map((passport) => <PassportCard key={passport.id} passport={passport} />)
          ) : (
            <p>まだ Passport はありません。</p>
          )}
        </section>
      </div>
    </section>
  );
}

function SnapshotPassportSource({
  snapshot,
  issued,
  onIssuePassport,
}: {
  snapshot: CharacterSnapshot;
  issued: boolean;
  onIssuePassport: (snapshotId: string) => void;
}) {
  return (
    <article className="passport-source">
      <h4>{snapshot.character.profile.displayName}</h4>
      <code>{snapshot.id}</code>
      <p>記録日時: {snapshot.createdAt}</p>
      <Button
        type="button"
        variant={issued ? "secondary" : "primary"}
        onClick={() => onIssuePassport(snapshot.id)}
      >
        {issued ? "もう一度発行" : "Passportを発行"}
      </Button>
    </article>
  );
}

function PassportCard({ passport }: { passport: CharacterPassport }) {
  return (
    <article className="passport-card">
      <h4>{String(passport.display.character.name ?? "Unnamed")}</h4>
      <code>{passport.fileNameToken}.json</code>
      <pre className="passport-card__display">{JSON.stringify(passport.display, null, 2)}</pre>
    </article>
  );
}
