import { Button } from "../../ui/Button.js";
import { Panel } from "../../ui/Panel.js";
import "./NewCharacterTutorialSurface.css";

interface NewCharacterTutorialSurfaceProps {
  isFirstVisit: boolean;
  sidekickIsConnected: boolean;
  sidekickFolderName?: string;
  onAcknowledge: () => void;
  onOpenSidekickSetup: () => void;
  onReturnToSandbox: () => void;
}

export function NewCharacterTutorialSurface({
  isFirstVisit,
  sidekickIsConnected,
  sidekickFolderName,
  onAcknowledge,
  onOpenSidekickSetup,
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
          <p className="new-character-tutorial-surface__lead">
            名前、見た目画像、性格、口調、年齢を入れると、新しい住民を住民一覧に保存できます。
            箱庭の4人は自動では入れ替わらず、あとであなたが選べます。
          </p>

          <div className="new-character-tutorial-surface__cards" aria-label="新しい住民作成の流れ">
            <article className="new-character-tutorial-surface__card">
              <span className="new-character-tutorial-surface__step">1</span>
              <h3>5項目を入力</h3>
              <p>見た目画像とプロフィールが、住民のもとになります。</p>
            </article>
            <article className="new-character-tutorial-surface__card">
              <span className="new-character-tutorial-surface__step">2</span>
              <h3>住民一覧に保存</h3>
              <p>保存しても、今いる4人とはすぐ入れ替わりません。</p>
            </article>
            <article className="new-character-tutorial-surface__card">
              <span className="new-character-tutorial-surface__step">3</span>
              <h3>候補を確認</h3>
              <p>Codex サイドキックが用意した候補は、確認してから使います。</p>
            </article>
          </div>

          <div className="new-character-tutorial-surface__sidekick">
            <strong>Codex サイドキックは任意です</strong>
            <p>
              サイドキックは、箱庭アニメや立ち絵候補の準備を助けるローカル補助役です。
              使わなくても、通常画像と標準文でそのまま遊べます。
            </p>
            <p>
              {sidekickIsConnected
                ? `現在は ${sidekickFolderName ?? "リポジトリフォルダ"} に接続中です。保存すると制作依頼を渡せます。`
                : "先に設定しておくと、保存した住民の制作依頼を渡しやすくなります。"}
            </p>
          </div>

          <ul className="new-character-tutorial-surface__guardrails">
            <li>候補は自動採用されません。</li>
            <li>サイドキック待ちで箱庭は止まりません。</li>
            <li>外部サービスの鍵をこの画面に入力する必要はありません。</li>
          </ul>

          <p>この案内は初回だけ表示されます。</p>
          <div className="new-character-tutorial-surface__actions">
            {isFirstVisit ? (
              <Button type="button" variant="primary" onClick={onAcknowledge}>
                入力を始める
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={onOpenSidekickSetup}>
              サイドキック設定を見る
            </Button>
            <Button
              type="button"
              variant="ghost"
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
