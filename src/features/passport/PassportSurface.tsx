import { useState } from "react";
import type { CharacterPassport, CharacterSnapshot } from "../../domain/models.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import { Button } from "../../ui/Button";
import { PassportConfirmScreen } from "./PassportConfirmScreen.js";
import { PassportJsonViewer } from "./PassportJsonViewer.js";
import { hasSeenPassportConfirm, markPassportConfirmSeen } from "./passportConfirmStorage.js";
import "./PassportSurface.css";

type PassportSurfaceProps = {
  state: RuntimeWorldState;
  onIssuePassport: (snapshotId: string) => void;
};

type ConfirmPending = { snapshotId: string; characterName: string };

export function PassportSurface({ state, onIssuePassport }: PassportSurfaceProps) {
  const [confirmPending, setConfirmPending] = useState<ConfirmPending | null>(null);

  const snapshots = [...state.snapshots.values()].reverse();
  const passports = [...state.passports.values()].reverse();
  const issuedSnapshotIds = new Set(passports.map((passport) => passport.snapshotId));

  function handleIssuePassport(snapshotId: string, characterName: string) {
    if (!hasSeenPassportConfirm()) {
      setConfirmPending({ snapshotId, characterName });
    } else {
      onIssuePassport(snapshotId);
    }
  }

  function handleConfirm() {
    if (!confirmPending) return;
    markPassportConfirmSeen();
    onIssuePassport(confirmPending.snapshotId);
    setConfirmPending(null);
  }

  function handleCancel() {
    setConfirmPending(null);
  }

  return (
    <section className="passport-surface" aria-labelledby="passport-title">
      {confirmPending && (
        <PassportConfirmScreen
          characterName={confirmPending.characterName}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

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
                onIssuePassport={handleIssuePassport}
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
  onIssuePassport: (snapshotId: string, characterName: string) => void;
}) {
  return (
    <article className="passport-source">
      <h4>{snapshot.character.profile.displayName}</h4>
      <code>{snapshot.id}</code>
      <p>記録日時: {snapshot.createdAt}</p>
      <Button
        type="button"
        variant={issued ? "secondary" : "primary"}
        onClick={() => onIssuePassport(snapshot.id, snapshot.character.profile.displayName)}
      >
        {issued ? "もう一度発行" : "Passportを発行"}
      </Button>
    </article>
  );
}

function PassportCard({ passport }: { passport: CharacterPassport }) {
  return (
    <article className="passport-card">
      <h4>{passport.display.character.name}</h4>
      <code>{passport.fileNameToken}.json</code>
      <PassportJsonViewer passport={passport} />
    </article>
  );
}
