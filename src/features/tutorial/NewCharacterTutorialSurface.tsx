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
      <Panel title="新しい住民を迎えます">
        <div className="new-character-tutorial-surface__body">
          <p>
            新しい住民を作っても、今の箱庭の4人はすぐには変わりません。
          </p>
          <p>
            まずは住民一覧に保存します。入れ替えは、あとで好きなタイミングで選べます。
          </p>
          <ol>
            <li>新しい住民を作る</li>
            <li>住民一覧に保存する</li>
            <li>あとで4人の中から入れ替える相手を選ぶ</li>
          </ol>
          <p>この案内は初回だけ表示されます。</p>
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
