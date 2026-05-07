# Codex 実行エントリーポイント

状態: 管理対象の正本ドキュメント

この文書は GodSandbox の実装を担当する Codex が、広い指示（「/docs を全部読んで仕様通りに実装してPRして」など）を受けた場合の行動プロトコルを定義する。

**表記揺れについて：** ユーザーが「/doc」「/docs」「docs/」「ドキュメント」などのいずれの表現で指示した場合も、リポジトリルートの `docs/` ディレクトリを指すと解釈する。

**Codex はまずこのファイルを読んでから他のドキュメントを参照すること。**

---

## 1. 最初に読む順番

広い実装指示を受けた場合、以下の順で読む。

1. `docs/product/codex-execution-entrypoint.md`（このファイル）
2. `docs/product/spec-integration-matrix.md`（仕様優先順位・実装参照フロー）
3. `docs/product/mvp-implementation-plan.md`（PBI 一覧・Done 条件）
4. 対象 PBI の「仕様参照」に列挙されているドキュメント
5. 対象 PBI の「変更対象ファイル」

---

## 2. 広い指示を受けた場合のデフォルト動作

ユーザーが「/docs を読んで仕様通りに実装してPRして」「仕様通りに進めて」などの広い指示をした場合、Codex は次のように動く。

1. `mvp-implementation-plan.md` を開き、PBI 一覧を確認する
2. Done 条件を満たしていない最小の PBI 番号（PBI 1 から順に）を 1 つ選ぶ
3. その 1 PBI だけを実装して PR を出す

**複数 PBI を 1 つの PR にまとめてはならない。**
ただし、選んだ PBI の Done 条件を満たすために必要な型定義・ユーティリティ関数の追加は同一 PR に含めてよい。

---

## 3. PR 粒度

| 許可 | 禁止 |
|---|---|
| PBI 1 つ分の実装 + そのテスト | PBI 1〜8 をまとめた巨大 PR |
| PBI の Done 条件に必要な型追加 | 仕様に書かれていない追加機能 |
| 既存テストの修正（対象 PBI の範囲内） | 対象 PBI 以外のファイルへの変更 |

---

## 4. 仕様矛盾時の停止条件

以下の状況を発見したら、**実装を止めて docs 修正 PR または質問を出す**。実装を続行しない。

```
- spec-integration-matrix.md と mvp-implementation-plan.md が同じ実装方針を矛盾して定義している
- product spec と architecture spec が同じ型を別定義している
- 変更対象ファイルが存在しない
- Done 条件のテストコマンドで検証できない構造になっている
- UI に出してはいけない値（faith 数値・五行値など）を表示しなければ実装できない設計になっている
```

矛盾を発見した場合の報告形式：

```
矛盾箇所: [ファイルA] §X と [ファイルB] §Y が矛盾
内容: [具体的な矛盾]
提案: [どちらを優先すべきか、または両方を修正すべきか]
```

---

## 5. 必須テストコマンド

各 PR で必ず実行する（存在しないスクリプトを追加してはならない）：

```bash
npm run typecheck        # 型エラーゼロ
npm run test:domain      # Unit + Integration テスト全通過
npm run build            # ビルド成功
```

`npm run test:ui` は現時点では未整備。将来の PBI で追加する。CI 組み込みまで手動実行不要。

---

## 6. 実装前チェックリスト（PR 本文に記録）

PR を作成する前に、PR の本文に以下を記録する。

```markdown
## 実装記録

- 選んだ PBI: PBI N（名称）
- 読んだ仕様ファイル:
  - docs/product/...
- 変更対象ファイル:
  - src/domain/...
- 触らない範囲:
  - （PBI N で触らないと明示されたもの）
- 実行したテストコマンド:
  - npm run typecheck: PASS
  - npm run test:domain: PASS
  - npm run build: PASS
```

---

## 7. PR 作成条件（Done 基準）

PR を出してよい条件はすべて満たすこと：

- [ ] 対象 PBI の Done 条件をすべて満たしている
- [ ] `npm run typecheck` が成功する
- [ ] `npm run test:domain` が成功する
- [ ] `npm run build` が成功する
- [ ] 信仰度数値・五行内部値が UI / Passport JSON のうち禁止されている箇所に出ていない
- [ ] 対象 PBI の Done 条件に必要な関連ファイル以外を変更していない（型追加・seed 更新・テスト追加・ユーティリティ追加は、そのPBI に必要であれば同一 PR に含めてよい）

---

## 8. スコープ外の扱い

`mvp-implementation-plan.md` に「MVP 期間中に実装しないもの」として列挙されているものは、たとえ実装可能であっても実装しない。

```
実装しないもの（一部）:
- 4名全員の sprite 完成
- 完全な五行計算式の永続保存
- 外部ゲーム完全互換パッケージ
- API キー UI
- 信仰度の画面表示
- 死亡・寿命・勲章
- 恋愛チャット機能
- npm run test:ui
```

不確かな場合は、実装せずに質問する。

---

## 9. このファイルと他のドキュメントの関係

| ドキュメント | このファイルとの関係 |
|---|---|
| `spec-integration-matrix.md` | 仕様の優先順位と実装参照フローの正本。このファイルより詳細な仕様情報を持つ |
| `mvp-implementation-plan.md` | PBI 分解と Done 条件の正本。どのファイルを変更するかはここを見る |
| `core-experience-spec.md` | プロダクト体験原則の正本。設計方向に迷ったらここを確認する |
| `godsandbox-user-flow.md` | ユーザー導線の正本。UI フローに迷ったらここを確認する |
