# Codex Sidekick runner lifecycle

状態: Sprint9 Phase 1 docs-first gate

## Purpose

Codex Sidekick runner が `.godsandbox/jobs/**` のjobをどう読み、処理し、結果を返し、失敗や再試行を扱うかをdocs-firstで定義する。

この文書は実装ではない。
App Server、runner、watcher、job processor、API接続、UI、生成処理は作らない。

## Current failure

Sprint8で `.godsandbox/jobs/**` のlifecycleは定義されたが、runner視点でのlock、二重実行防止、result JSON、failed JSON、retry、cleanupはまだ実装者へ渡せる粒度まで固定されていない。

このままPhase 2へ進むと、次の事故が起きやすい。

- 同じjobを複数runnerが同時に処理する。
- `done` を採用済みasset / adopted narrativeと誤解する。
- failed jobにsecretや個人パスが残る。
- retry時に古いoutputと新しいoutputが混ざる。
- cleanupでPO確認前の候補を消す、または実jobをGitへ混ぜる。

## Final vision

Phase 2実装者が、この文書だけで次を判断できる。

- `pending / running / done / failed` のrunner視点の意味。
- job lockの作り方と二重実行防止の基本方針。
- result JSONとfailed JSONに入れる情報、入れない情報。
- retryできる条件、retryしてはいけない条件。
- cleanupで消してよいもの、残すべきhandoff情報。
- `done` は採用済みではないこと。
- Phase 2実装開始はImplementation Start Gate後であること。

## Source of truth

この文書は、Codex Sidekick runner lifecycleの正本である。

関連docs:

- `docs/product/sprint9-planning.md`
- `docs/operations/codex-job-queue.md`
- `docs/operations/sprint8-closeout-git-hygiene.md`
- `docs/operations/generated-workspace-retention-policy.md`
- `docs/operations/asset-pipeline-git-rules.md`

`docs/product/sprint9-planning.md` のImplementation Start Gateを満たすまで、runner / App Server / watcher / job processor / API接続の実装に入らない。

## Required rules

### Runner lifecycle overview

runnerは、将来 `.godsandbox/jobs/**` を読む補助プロセスである。
Sprint9 Phase 1では仕様だけを固定する。

```txt
.godsandbox/jobs/pending/
.godsandbox/jobs/running/
.godsandbox/jobs/done/
.godsandbox/jobs/failed/
```

| 状態 | runner視点の意味 | 採用状態 |
| --- | --- | --- |
| `pending` | 処理前のjob。runnerが取得できる。 | 未採用 |
| `running` | runnerがlockを取り、処理中のjob。 | 未採用 |
| `done` | runnerが候補outputとresultを返したjob。 | 未採用 |
| `failed` | runnerが失敗理由を返したjob。 | 未採用 |

`done` は採用済みではない。
assetなら `ready`、narrativeなら `adopted` へ進むには、別のreview gateとPO判断が必要である。

### Pending

`pending` は、まだ処理されていない制作依頼である。

runnerは、将来次の順で扱う。

1. job JSONを読む。
2. schema、job type、required fieldsを確認する。
3. 処理できるjobか判定する。
4. lockを作れる場合だけ `running` へ移動する。

`pending` の実job JSONはGit管理しない。

### Running

`running` は、runnerが処理中であることを示す。

runnerは、jobを `pending` から `running` へ移す時にlock情報を残す。

最小lock情報:

```json
{
  "lockVersion": "godsandbox-sidekick-lock/v0",
  "jobId": "job-example-001",
  "lockedBy": "sidekick-runner",
  "lockedAt": "ISO-8601 timestamp",
  "runnerSessionId": "local-session-id",
  "sourceState": "pending"
}
```

`runnerSessionId` は個人PC名や絶対パスを含めない。
secret、token、API keyを書かない。

### Job lock and double-run prevention

二重実行防止の基本方針:

- runnerは、lockを取れたjobだけ処理する。
- lock取得前に、同じ `jobId` が `running`、`done`、`failed` にないか確認する。
- 同じjobがすでに `running` にある場合は処理しない。
- stale lockの判断はPhase 2実装で定数化する。
- stale lockを回収する場合も、元のlock情報をfailed reportまたはcleanup reportに残す。

Phase 1ではlock fileやatomic moveの実装方式は固定しない。
ただし、Phase 2ではOS差分を考慮し、Windowsで安全に動く方式を選ぶ。

### Done

`done` は、runnerが候補outputを返した状態である。

`done` は次を意味しない。

- assetが `ready` になった。
- narrativeが `adopted` になった。
- POが承認した。
- GodSandbox本体がそのoutputを使ってよい。

result JSONの最小例:

```json
{
  "resultVersion": "godsandbox-sidekick-result/v0",
  "jobId": "job-example-001",
  "jobType": "character-asset-bundle",
  "status": "done",
  "completedAt": "ISO-8601 timestamp",
  "outputs": [
    {
      "kind": "candidate",
      "pathRef": "local-generated-output-ref",
      "reviewRequired": true
    }
  ],
  "reviewGate": {
    "readyPromotionAllowed": false,
    "adoptedPromotionAllowed": false,
    "poReviewRequired": true
  },
  "notes": [
    "Generated output is candidate only."
  ]
}
```

`pathRef` は、個人PCの絶対パスではなく、ローカル作業領域内の抽象参照にする。
候補全文や大量の生成テキストをPR本文に貼らない。

### Failed

`failed` は、runnerが処理を完了できなかった状態である。

failed JSONの最小例:

```json
{
  "resultVersion": "godsandbox-sidekick-result/v0",
  "jobId": "job-example-001",
  "jobType": "character-asset-bundle",
  "status": "failed",
  "failedAt": "ISO-8601 timestamp",
  "reasonCode": "invalid-job-schema",
  "userSafeMessage": "制作依頼の形式を確認してください。",
  "retryable": false,
  "secretRedacted": true
}
```

failed JSONに書かないもの:

- 個人PCの絶対パス
- secret
- token
- API key
- 認証情報
- 未採用全文の大量貼り付け
- ユーザー画像の実path

### Retry

retryは、failed jobまたは中断されたrunning jobを再処理するための操作である。

retryしてよい可能性があるもの:

- 一時的なファイル読み取り失敗。
- runner中断。
- validator前の軽微な入力不足を修正したjob。
- stale lockを回収したjob。

retryしてはいけないもの:

- schema不一致を直していないjob。
- secretや個人パスを含むjob。
- POがrejectedした候補をそのまま再投入するjob。
- ready / adopted promotionを目的にしたjob。

retry時のルール:

- 元jobを直接上書きしない。
- retry回数を記録する。
- 古いoutputと新しいoutputを混ぜない。
- retry後も `done` は採用済みではない。

retry metadataの最小例:

```json
{
  "retryOf": "job-example-001",
  "retryAttempt": 1,
  "retryReason": "stale-lock-recovered",
  "createdAt": "ISO-8601 timestamp"
}
```

### Cleanup

cleanupは、ローカル作業領域を安全に整理するための操作である。

消してよいもの:

- stale lockの一時ファイル。
- `tmp` の中間出力。
- 再生成できるbuild output。
- PO確認不要になったrejected候補。

消してはいけないもの:

- PO確認待ちcandidate。
- review report。
- failed reason summary。
- handoffに必要なjobId、characterId、eventId、status。
- 採用済み正本docs。

cleanup後に残すhandoff情報:

```txt
jobId
jobType
status
retryAttempt
candidate count
failed reason summary
reviewRequired
poDecisionNeeded
safe fallback
```

cleanup scriptは、このPBIでは作らない。

### Git management boundary

Git管理しない:

```txt
.godsandbox/jobs/**
assets/generated/**
assets/residents/**
narrative/generated/**
manifests/drafts/**
real job JSON
generated output
local logs with personal paths
```

Git管理してよい:

```txt
docs/**
sample JSON without personal data
prompt
tools
ready official assets
adopted official narrative packs
source-of-truth manifest / read model
```

実job JSON、generated asset、generated narrative、manifest draftは、このPBIで追加しない。

### Phase 2 Implementation Start Gate

runner lifecycleの実装は、Phase 2で行う。
Phase 2へ進むには、`docs/product/sprint9-planning.md` のImplementation Start Gateを満たす必要がある。

少なくとも次がmainに入るまで、runner実装へ進まない。

- subagent personas
- App Server bridge spec
- runner lifecycle spec
- local security spec
- bridge test plan

この文書が定義するのは、Phase 2実装の入力仕様である。

## Ready / Done conditions

- `pending / running / done / failed` のrunner視点の意味が分かる。
- job lockと二重実行防止の基本方針が分かる。
- result JSONとfailed JSONの最小形が分かる。
- retryとcleanupの境界が分かる。
- `done` は採用済みではないと明記されている。
- Phase 2実装開始はImplementation Start Gate後と明記されている。
- 実装に入っていない。
- Git管理外境界が守られている。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

追加確認:

- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` を触っていない。
- `.agents/skills/**` を触っていない。
- 実job JSON、generated asset、generated narrative、manifest draftを追加していない。
- `dist/` をcommitしていない。
- 個人パス、secret、API key、tokenを書いていない。

## Preferred outcome

この文書がmainへ入り、Line 2 bridge specとLine 4 test planがrunner lifecycleを前提にできる。

Phase 2実装者は、この文書を読み、runnerの状態遷移、lock、result、failed、retry、cleanupを同じ意味で扱える。

## Safe fallback outcome

runner lifecycleの詳細が広がりすぎる場合は、次だけをPhase 1の正本にする。

- `pending / running / done / failed`
- `done` は採用済みではない
- lockで二重実行を防ぐ
- failed JSONにsecretや個人パスを書かない
- retry / cleanupは生成物をGit管理しない

atomic move、stale lock timeout、runner session id生成、具体的なfilesystem APIはPhase 2 implementation PBIへ送る。

## Out of scope

- App Server実装
- runner実装
- watcher実装
- job processor実装
- API接続
- UI実装
- 生成処理
- ready / adopted promotion自動化
- 実job JSON追加
- generated asset追加
- generated narrative追加
- manifest draft追加
- package / CI変更
- Passport schema変更

## One-line Codex resume instruction

```bash
codex "docs/operations/codex-sidekick-runner-lifecycle.md を読み、Sprint9 Phase 1 docs-first の範囲だけでCodex Sidekick runner lifecycle仕様を整えてください。runnerやApp Serverは実装せず、検証まで完了してください。"
```
