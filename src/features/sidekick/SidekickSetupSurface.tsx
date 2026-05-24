import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import "./SidekickSetupSurface.css";

interface SidekickSetupSurfaceProps {
  isConnected: boolean;
  connectedFolderName?: string;
  supportsFileSystemAccess: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReturnToSandbox: () => void;
}

export function SidekickSetupSurface({
  isConnected,
  connectedFolderName,
  supportsFileSystemAccess,
  onConnect,
  onDisconnect,
  onReturnToSandbox,
}: SidekickSetupSurfaceProps) {
  return (
    <section className="sidekick-setup-surface" aria-labelledby="sidekick-setup-title">
      <Panel title="Codex サイドキック設定">
        <div className="sidekick-setup-surface__body">
          <p className="sidekick-setup-surface__lead">
            Codex サイドキックは、住民の見た目画像と5項目から箱庭アニメや立ち絵候補の準備を助けるローカル補助役です。
            使わなくても GodSandbox は通常画像で遊べます。
          </p>

          <div className="sidekick-setup-surface__flow" aria-label="サイドキック利用の流れ">
            <article>
              <span>1</span>
              <strong>新しい住民を保存</strong>
              <p>名前、見た目画像、性格、口調、年齢を入力します。</p>
            </article>
            <article>
              <span>2</span>
              <strong>制作依頼を渡す</strong>
              <p>接続済みなら、ローカル作業フォルダへ依頼が保存されます。</p>
            </article>
            <article>
              <span>3</span>
              <strong>候補を確認する</strong>
              <p>候補は自動採用されません。確認してから使います。</p>
            </article>
          </div>

          <div className="sidekick-setup-surface__step">
            <h3 id="sidekick-setup-title" className="sidekick-setup-surface__step-title">
              ステップ 1: ウォッチャーを起動する
            </h3>
            <p>最初の一度だけ、リポジトリのターミナルで以下を実行してください。</p>
            <pre className="sidekick-setup-surface__command">npm run sidekick:watch</pre>
            <small>
              一度起動すれば、住民を保存した時に制作依頼を見つけられます。
              候補ができても、確認するまではゲーム内で使いません。
            </small>
          </div>

          <div className="sidekick-setup-surface__step">
            <h3 className="sidekick-setup-surface__step-title">
              ステップ 2: リポジトリフォルダを接続する
            </h3>
            {!supportsFileSystemAccess ? (
              <p className="sidekick-setup-surface__notice sidekick-setup-surface__notice--warn">
                このブラウザはファイルシステムアクセスに対応していません。
                Chrome または Edge をお使いください。
              </p>
            ) : isConnected ? (
              <div className="sidekick-setup-surface__connected">
                <p className="sidekick-setup-surface__notice sidekick-setup-surface__notice--ok">
                  接続中: {connectedFolderName ?? "リポジトリフォルダ"}
                </p>
                <p>
                  住民を保存すると、5項目の入力内容が自動で受け渡され、
                  ウォッチャーが Codex サイドキックへ制作依頼を渡します。
                </p>
                <Button type="button" variant="ghost" onClick={onDisconnect}>
                  切断する
                </Button>
              </div>
            ) : (
              <div className="sidekick-setup-surface__connect">
                <p>
                  「フォルダを接続する」を押して、リポジトリのルートフォルダ（
                  <code>package.json</code> があるフォルダ）を選んでください。接続後は、住民を保存するだけで制作依頼を渡せます。
                </p>
                <Button type="button" variant="primary" onClick={onConnect}>
                  フォルダを接続する
                </Button>
              </div>
            )}
          </div>

          <div className="sidekick-setup-surface__actions">
            <Button type="button" variant="ghost" onClick={onReturnToSandbox}>
              箱庭へ戻る
            </Button>
          </div>
        </div>
      </Panel>
    </section>
  );
}
