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
            住民を保存すると、Codex サイドキックが自動でスプライトシートを生成します。
            以下の手順で一度だけ設定してください。
          </p>

          <div className="sidekick-setup-surface__step">
            <h3 id="sidekick-setup-title" className="sidekick-setup-surface__step-title">
              ステップ 1: ウォッチャーを起動する
            </h3>
            <p>リポジトリのターミナルで以下を実行してください。</p>
            <pre className="sidekick-setup-surface__command">npm run sidekick:watch</pre>
            <small>
              一度起動すれば、住民を保存するたびに Codex サイドキックが自動で動きます。
              ゲームを閉じてもウォッチャーは動き続けます。
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
                  住民を保存するとジョブリクエストが自動で書き出され、
                  ウォッチャーが Codex サイドキックを起動します。
                </p>
                <Button type="button" variant="ghost" onClick={onDisconnect}>
                  切断する
                </Button>
              </div>
            ) : (
              <div className="sidekick-setup-surface__connect">
                <p>
                  「フォルダを接続する」を押して、リポジトリのルートフォルダ（
                  <code>package.json</code> があるフォルダ）を選んでください。
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
