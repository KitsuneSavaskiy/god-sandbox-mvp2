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

詳細な正本仕様は `docs/product/godsandbox-user-flow.md` と `docs/architecture/` を参照してください。

## セットアップ

```bash
npm ci
```

## 開発コマンド

```bash
npm run dev
npm run typecheck
npm run build
npm run test:domain
npm run test:ai
```

## 主要ドキュメント

- 完成版ユーザーフロー: `docs/product/godsandbox-user-flow.md`
- アーキテクチャ仕様: `docs/architecture/`
- 運用ルール: `docs/agent-operating-rules.md`
- PR チェックリスト: `docs/agent-pr-checklists.md`
