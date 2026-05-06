# Sprint8 closeout Git hygiene

状態: Sprint8 docs-first closeout procedure

## Purpose

Sprint8完了前に、Git管理境界、open PRの有無、ローカル生成物混入の有無を確認する手順を定義する。

この文書は実装ではない。
次Sprintへ進む前に、Codex / Claude / Sidekick / ローカル生成物の境界をそろえ、不要な差分や生成物がmainへ混入しない状態を確認するためのcloseout手順である。

## Current failure

Sprint8では、asset pipeline、narrative Sidekick、time-season HUD、generated content fallback など、docs-firstの仕様とローカル生成物を扱う作業が増えた。

このままcloseout手順が曖昧だと、次の事故が起きやすい。

- `dist/` やローカル生成物が、成果物のようにPRへ混ざる。
- `.godsandbox/jobs/**` や `assets/generated/**` などの実作業ファイルがGit管理される。
- open PRが残ったまま、Sprint8完了扱いにしてしまう。
- Claude SPECA監査の出力やCodex作業repoの境界が曖昧になる。
- review comment対応やmain追従を監査役へ丸投げしてしまう。

## Final vision

Sprint8 closeout時に、各Lineと監査役が次を短時間で判断できる。

- open PRが残っていないか。
- tracked差分が残っていないか。
- `dist/` や生成物をcommitしていないか。
- Git管理してよいもの / してはいけないものが分かるか。
- Codex / Claude / Sidekick の作業境界が分かるか。
- 次Sprintで `@godsandbox-doc-driven-task-runner` を使い、「仕様どおりに実装してテストして」と渡せる状態か。

## Source of truth

この文書は、Sprint8 closeout時のGit hygiene手順の正本である。

関連docs:

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/operations/asset-pipeline-git-rules.md`
- `docs/operations/generated-workspace-retention-policy.md`
- `docs/operations/sprint8-generated-content-merge-runbook.md`

GitHub上のPR diff / changed files は、監査時の正本である。
ローカルworking treeの汚れは、監査対象に混ぜない。

## Required rules

### 作業開始前チェック

Sprint8 closeout作業を始める前に、各Lineは必ず次を実行する。

```bash
gh pr list --repo KitsuneSavaskiy/god-sandbox-mvp2 --state open
git fetch origin main
git status --short --branch
git log --oneline -10 origin/main
```

期待状態:

- open PRなし。
- tracked差分なし。
- `dist/` があってもローカル生成物なので触らない。
- `.godsandbox/jobs/**` をcommitしない。
- `assets/generated/**` をcommitしない。
- `assets/residents/**` をcommitしない。
- `narrative/generated/**` をcommitしない。
- `manifests/drafts/**` をcommitしない。

異常があれば、作業を止めて報告する。
open PRが残っている場合は、そのPRのmerge / close / carry-over判断が先である。
このgateを通るまでは、新しいcloseout差分を作らない。

### Closeout時の期待状態

Sprint8完了判断の直前は、次を満たす。

| 項目 | 期待状態 |
| --- | --- |
| open PR | なし |
| tracked差分 | なし |
| `dist/` | 未追跡でもcommitしない |
| real job JSON | commitしない |
| generated assets | commitしない |
| generated narrative | commitしない |
| manifest draft | commitしない |
| local logs | 個人パスやsecretを含むものはcommitしない |

### Git管理外にするもの

次はGit管理しない。

```txt
dist/
.godsandbox/jobs/**
assets/generated/**
assets/residents/**
narrative/generated/**
manifests/drafts/**
incoming/**
tmp/**
rejected/**
user-uploads/**
local logs
real job JSON
個人パス入りログ
```

これらは、作業中のローカル素材、生成候補、実job、一時出力、または個人環境に依存するファイルである。
PRに入れる場合は原則blockerとして扱う。

### Sprint8完了時に残してよいもの

次は、scopeとreviewが合っていれば残してよい。

- main入り済みdocs
- 採用済み `public/art/**`
- 正本manifest / read model
- prompt
- tools
- Sprint8 done report
- 個人情報を含まないQA要約
- 個人情報を含まないsample JSON

採用済みassetとは、保存先、参照先、確認結果、PO判断が明確なものだけである。
`incoming` や `tmp` にある候補は採用済みではない。

### Sprint8完了時に消す / commitしないもの

次は、commitしない。

- `dist/`
- local generated files
- real job JSON
- rejected candidate
- tmp output
- local auth state
- 個人PCの絶対パスを含むログ
- secret / API key / token を含むファイル
- PO確認前の候補asset
- review前のnarrative candidate

削除する場合は、ユーザーの成果物でないことを確認する。
迷う場合は削除せず、Git管理外のまま報告する。

## Merge / review operation

Sprint8 closeoutでも、通常のPR運用を崩さない。

- mainへ直接pushしない。
- Issue -> branch -> PR の順に進める。
- PR作成者は自分のPRをapproveしない。
- 同じPRで実装役と監査役を兼任しない。
- POが明示許可した監査役だけがmergeできる。
- `manual-review-required` 対象を明記する。
- review commentが付いたら、PR上で返信する。
- main追従が必要な場合は、作業Line側で対応し、PRコメントに結果を残す。
- GitHub PR diff / changed files を監査の正本にする。

`manual-review-required` を付ける対象:

- docs/architecture の正本仕様変更
- docs/operations の運用ルール変更
- agent instruction / policy / workflow / permission / secret / dependency / protected path に関わる変更
- 判断に迷う変更

## Claude / Codex boundary

### Codex

Codexは主開発を担当する。

- Issue / branch / PR単位で作業する。
- PBI scope内の実装またはdocsを変更する。
- review commentが付いた場合はPR上で返信し、必要な修正commitをpushする。
- main追従が必要な場合は作業Line側で対応する。

### Claude

Claudeは非同期監査、SPECA型レビュー、必要時の小修正PRを担当する。

- ClaudeはCodex用repoを直接触らない。
- SPECA出力はローカルrun directoryへ置く。
- SPECA出力そのものを、個人パスやsecret入りでGit管理しない。
- Claudeが小修正PRを作る場合も、Issue -> branch -> PR、scope、label、checksを守る。

### Sidekick

Sidekickは将来の補助作業者として扱う。

- `.godsandbox/jobs/**` の実jobはGit管理しない。
- generated asset / narrative candidate は採用前にGit管理しない。
- done job は採用済みではない。
- adopted / ready へ進めるには、人間確認、必要なvalidator、visual audit、PO確認などのgateを通す。

## Ready / Done conditions

- Sprint8完了前のGit衛生チェックが1文書で分かる。
- commit禁止対象が明確。
- `dist/` の扱いが明確。
- Claude / Codexのrepo境界が分かる。
- open PRなし、tracked差分なし、ローカル生成物混入なしを確認する手順がある。
- 個人パス、secret、token、API keyを含まない。
- 実装ファイルを触っていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

追加確認:

- changed filesがdocs-onlyである。
- `src/**` を触っていない。
- `public/**`、`assets/**`、`manifests/**` を触っていない。
- `package*`、`.github/**` を触っていない。
- `dist/` をcommitしていない。
- secret / token / API key / 個人パスがない。

## Preferred outcome

この文書がmainへ入り、Sprint8 closeout時に次を確認できる。

```txt
open PRなし
tracked差分なし
dist/ commitなし
generated output commitなし
real job JSON commitなし
Claude / Codex / Sidekick境界明確
```

次Sprintでは、各Lineがmain上の正本文書を読み、`@godsandbox-doc-driven-task-runner` で「仕様どおりに実装してテストして」と再開できる。

## Safe fallback outcome

closeout時に異常がある場合は、Sprint8完了扱いにしない。

安全側の扱い:

- open PRがある場合は、merge / close / carry-over判断を先に行う。
- tracked差分がある場合は、PBI scope内か確認する。
- `dist/` や生成物が差分にある場合は、PRに入れない。
- real job JSONや個人パス入りログがある場合は、Git管理外へ退避し、実値をPR本文に書かない。
- Claude SPECA監査は、closeout群がmainへ入ってから実行する。

## Out of scope

- 実装変更
- cleanup script追加
- `dist/` の削除やcommit
- `src/**` 変更
- `public/**` 変更
- `assets/**` 変更
- `manifests/**` 変更
- `package*` / `.github/**` 変更
- token / secret / API key / 個人パスの記載
- Claude SPECA監査そのものの実行

## One-line Codex resume instruction

```bash
codex "Read docs/operations/sprint8-closeout-git-hygiene.md, refine the Sprint8 closeout Git hygiene procedure exactly, keep it docs-first, and test until complete."
```
