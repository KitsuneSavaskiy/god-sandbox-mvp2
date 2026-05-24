# GodSandbox MVP2

GodSandbox は、プレイヤーが神視点で 4 人の住民を見守り、イベントに介入しながら物語変化を楽しむ箱庭ゲームです。  
本リポジトリは MVP 実装（`god-sandbox-mvp2`）を管理します。

## ゲーム仕様（MVP）

- 初期状態は常に 4 名（Eve / Garan / Ryo / Suzu）で開始。
- プレイの中心はキャラクター単体ではなく **イベント**。
- プレイヤーの主な介入は以下の 3 つ:
  - 見守る
  - 助ける
  - 試練
- 介入結果として、キャラクターの状態・関係・物語が変化。
- 任意タイミングで snapshot を記録し、Character Passport を発行可能。
- 保存はローカルファイルベース（MVP 範囲）。
- MVP では **死亡・寿命・勲章は扱わない**。

詳細な正本仕様は [docs/product/godsandbox-user-flow.md](docs/product/godsandbox-user-flow.md) と [docs/architecture/](docs/architecture/) を参照してください。

## セットアップ

```bash
npm ci
```

- `npm ci`: `package-lock.json` に固定された依存関係をクリーンにインストールし、開発・ビルド・テストを再現可能にするために必要です。

## ゲームの起動方法

```bash
npm run dev
```

- 開発サーバーを起動します。
- ブラウザで表示された URL（通常 `http://127.0.0.1:5173`）を開くとゲームを確認できます。

## 開発コマンド

| コマンド | 目的 | なぜ必要か |
| --- | --- | --- |
| `npm run dev` | 開発サーバー起動 | 実際の画面・導線を手元で確認するため |
| `npm run typecheck` | TypeScript 型検査 | 仕様変更時の型崩れを早期に検出するため |
| `npm run build` | 本番向けビルド生成 | リリース相当のビルドが成立することを確認するため |
| `npm run test:domain` | ドメイン層テスト実行 | ゲームの中核ロジック（イベント/介入/状態変化）が壊れていないことを確認するため |
| `npm run test:ai` | AI 関連テスト実行 | AI 出力のスキーマ/ガード/安全制約が維持されていることを確認するため |

## 設計ドキュメント（外部設計 / 内部設計）

### 外部設計（ユーザー体験・仕様）

- 完成版ユーザーフロー: [docs/product/godsandbox-user-flow.md](docs/product/godsandbox-user-flow.md)
- UI 状態モデル: [docs/architecture/ui-state-model.md](docs/architecture/ui-state-model.md)
- イベントと介入仕様: [docs/architecture/event-and-intervention-spec.md](docs/architecture/event-and-intervention-spec.md)
- Snapshot / Passport 仕様: [docs/architecture/snapshot-passport-spec.md](docs/architecture/snapshot-passport-spec.md)

### 内部設計（実装構造・技術仕様）

- システム仕様: [docs/architecture/system-spec.md](docs/architecture/system-spec.md)
- ローカル保存仕様: [docs/architecture/local-persistence-spec.md](docs/architecture/local-persistence-spec.md)
- AI アーキテクチャ: [docs/architecture/ai-architecture.md](docs/architecture/ai-architecture.md)
- テスト戦略: [docs/architecture/testing-strategy.md](docs/architecture/testing-strategy.md)

## 主要ドキュメント

- 完成版ユーザーフロー: [docs/product/godsandbox-user-flow.md](docs/product/godsandbox-user-flow.md)
- アーキテクチャ仕様: [docs/architecture/](docs/architecture/)
- 運用ルール: [docs/agent-operating-rules.md](docs/agent-operating-rules.md)
- PR チェックリスト: [docs/agent-pr-checklists.md](docs/agent-pr-checklists.md)
