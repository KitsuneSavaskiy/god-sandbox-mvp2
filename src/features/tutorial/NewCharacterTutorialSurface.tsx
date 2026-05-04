import { Button } from "../../ui/Button.js";
import { Panel } from "../../ui/Panel.js";
import "./NewCharacterTutorialSurface.css";

interface NewCharacterTutorialSurfaceProps {
  isFirstVisit: boolean;
  onAcknowledge: () => void;
  onReturnToSandbox: () => void;
}

export function NewCharacterTutorialSurface({
  isFirstVisit,
  onAcknowledge,
  onReturnToSandbox,
}: NewCharacterTutorialSurfaceProps) {
  return (
    <section
      className="new-character-tutorial-surface"
      data-tutorial-anchor="tutorial-anchor-newcomer"
      data-tutorial-highlighted={isFirstVisit || undefined}
    >
      <Panel title="新しい住民を迎える前に">
        <div className="new-character-tutorial-surface__body">
          <p>
            新しい住民は、まず <strong>住民一覧</strong> に加わります。今箱庭にいる 4 人は、その場では崩れません。
          </p>
          <ol>
            <li>新しい住民の準備を始める</li>
            <li>住民一覧へ加える</li>
            <li>あとで入れ替えたい 1 人を選ぶ</li>
          </ol>
          <p>
            この案内は初回だけ必須です。いまは「4 人をすぐ壊さずに新しい子を迎えられる」と分かれば十分です。
          </p>
          <div className="new-character-tutorial-surface__actions">
            {isFirstVisit ? (
              <Button type="button" variant="primary" onClick={onAcknowledge}>
                わかりました
              </Button>
            ) : null}
            <Button
              type="button"
              variant={isFirstVisit ? "secondary" : "primary"}
              onClick={onReturnToSandbox}
            >
              箱庭へ戻る
            </Button>
          </div>
        </div>
      </Panel>
    </section>
  );
}
