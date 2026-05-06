# Sprint9 Line Dispatch Generator

状態: Sprint9 Phase 2 orchestration docs

## 目的

Sprint9の各PBIをCodex Lineへ割り当て、各Lineへの指示をmanifestとtemplateから生成する。
手書き長文指示は作らない。Wave移行時に `npm run sprint9:dispatch` で出力する。

## なぜ手書き指示をやめるか

- 同じ禁止事項・必読docsを毎回書くとミスが起きる。
- Wave移行判断をClaude / POが毎回手動でやると詰まる。
- manifestを正本にすることで、指示の抜け・ズレをvalidationで検出できる。

## Thread構成

| Thread | 担当PBI (順) | 担当Wave |
|---|---|---|
| Thread-L1 | #201 runner | Wave 1 |
| Thread-L2 | #197 validator → #202 bridge | Wave 0 → 1 |
| Thread-L3 | #199 nontechnical → #204 asset | Wave 0 → 2 |
| Thread-L4 | #203 test harness → #205 narrative | Wave 1 → 2 |
| Thread-SEC | #198 guard → #200 guardian (sequential) | Wave 0 |
| Thread-ORCH | #206 gate + Wave gate管理 | 常時 |

Thread-ORCHは実装Lineではない。dispatch生成・Wave移行確認・PR競合確認を担う。

## ファイル構成

```txt
tools/sprint9-dispatch/
├── sprint9-phase2-dispatch.json   ← 正本manifest
├── templates/
│   ├── line-start.md              ← 実装開始指示テンプレート
│   ├── line-prep.md               ← 準備期間指示テンプレート
│   └── line-blocked.md            ← ブロック通知テンプレート
└── dispatch.mjs                   ← generator本体
```

## コマンド例

```bash
# Wave 0のすべてのPBIにstart指示を生成 (dry-run)
npm run sprint9:dispatch -- --wave 0 --dry-run

# Issue #197のstart指示を生成 (dry-run)
npm run sprint9:dispatch -- --issue 197 --dry-run

# Wave 1のprep指示を生成 (dry-run)
npm run sprint9:dispatch -- --wave 1 --mode prep --dry-run

# 現在のWave状態を確認
npm run sprint9:dispatch -- --status

# Issue #201のstart指示をGitHub issueへ投稿 (post)
npm run sprint9:dispatch -- --issue 201 --post
```

`--post` はidempotencyマーカーで重複投稿を防ぐ。
`--dry-run` と `--post` を同時に指定した場合は投稿内容を標準出力だけに出す。

## Wave制御

- Wave移行条件は `dependencies` のmain入りで判断する。Ready / PR作成済みでは開始しない。
- `--status` でWave状態をまとめて確認できる。
- Wave移行時はPOがClaude (orchestrator)に声をかける。

## Validation方針

生成テキストに以下が含まれた場合はfailしてexitCode 1を返す。

```txt
Readyまたはmain入り
レビュー後すぐ承認・merge可能
Line 3と臨時Line Cは、作業開始時にIssueを新規作成
Line 3と臨時Line Cは作業開始時にIssueを新規作成
```

制御文字（通常のタブ・改行を除く）もfailとする。

## 禁止事項

このgeneratorは以下をしない。

- runner / App Server bridge / watcher / job processorを実装しない
- API接続・UI実装・生成処理をしない
- GitHub Actionsのworkflowを追加しない
- pull_request_target workflowを追加しない
- workflow権限を変更しない
- GitHub PAT / API keyをrepoに保存しない
- 実job JSON / generated output / local logs / dist をcommitしない
- ready / adopted promotionをしない

## Orchestrator運用手順

```bash
# 1. Wave 0開始時
npm run sprint9:dispatch -- --wave 0 --mode start --dry-run
# 内容確認後、issueへ投稿
npm run sprint9:dispatch -- --wave 0 --mode start --post

# 2. Wave移行前確認
npm run sprint9:dispatch -- --status

# 3. Wave 1解放時
npm run sprint9:dispatch -- --wave 1 --mode start --dry-run
npm run sprint9:dispatch -- --wave 1 --mode start --post

# 4. ブロック通知が必要な場合
npm run sprint9:dispatch -- --issue 203 --mode blocked --post
```

## 正本manifest

`tools/sprint9-dispatch/sprint9-phase2-dispatch.json`
