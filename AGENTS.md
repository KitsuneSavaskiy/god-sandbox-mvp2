# AGENTS.md

## 目的

- この repository は `god-sandbox-mvp2` の MVP 専用です。
- 変更は小さく、巻き戻し可能で、現在の PBI scope 内に保ちます。

## 作業を始めるとき

1. `npm run sprint9:dispatch -- --status` を実行して現在の Wave 状態と依存関係を確認する。
2. 担当 Issue の最新 dispatch comment（`<!-- sprint9-dispatch ... -->` マーカー）を読む。これが作業指示の正本。
3. dispatch comment 内の `requiredDocs` リストを順番に読む。
4. 実装に入る。

dispatch comment がまだない場合はまだ作業開始タイミングではない（Wave gate 未解放）。PO に確認すること。

## 最初に読むもの

- 完成版ユーザーフローの正本は `docs/product/godsandbox-user-flow.md` です。
- アーキテクチャとシステム仕様の正本は `docs/architecture/` にあります。
- 固定運用ルール、レーン境界表、PBI差分指示テンプレ、現在状態メモのテンプレは `docs/agent-operating-rules.md` にあります。
- PR の事前確認と監査チェックリストは `docs/agent-pr-checklists.md` にあります。
- Line 別の責務境界と必読 docs は `docs/architecture/line-responsibilities.md` にあります。
- dispatch ツールの仕様（Wave gate、mode、idempotency）は `docs/operations/sprint9-line-dispatch-generator.md` にあります。

## 最重要ルール

- `main` へ直接 push しません。
- PBI が要求する場合は `Issue -> branch -> PR` の順で進めます。
- 現在の checkout と宣言済み file scope を越えて変更しません。scope 外のファイル、外部サービス、有償 workflow に触れる前には停止して確認を取ります。
- agent は原則として自分の判断で approve / merge しません。
- PR 作成者は自分の PR を approve しません。
- 同じ PR で実装役と監査役を兼任しません。
- PO が明示許可した監査役だけが、blocker 解消、CI 成功、changed files の scope 確認がそろった場合に限り approve / merge できます。
- policy、workflow、permission、secret、billing、dependency、protected path の変更では `manual-review-required` を使います。
- `AGENTS.md`、`CLAUDE.md`、commit する docs には、個人パス、secret、API key、token、ローカル環境名、個別アカウント設定を書きません。
- 作業前に読んだ docs と担当 Line の責務を PR 本文に書きます。記載がない PR は監査 blocker として扱います。
- review comment が付いた場合は PR 上で返信し、必要な修正 commit を push します。main 追従が必要な場合も作業 Line 側で対応します。

## レーン分担

- 実装レーンは、現在の PBI に割り当てられたファイルだけを編集します。
- 監査レーンは scope、blocker、CI、merge 可否を確認します。
- このファイルは短く保ち、再利用する詳細は上記の docs に寄せます。
