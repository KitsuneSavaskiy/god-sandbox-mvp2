# Narrative Sidekick workspace 仕様

Status: Sprint8 docs-first specification

## Purpose

Codex Sidekick / Narrative GM が作る発話、イベント案、intervention反応文、story pack候補について、置き場、Git管理境界、lifecycle、cleanup / handoff方針を定義する。

この文書は実装ではない。後続で narrative pack schema や Narrative GM persona を作るときに、生成候補をどこに置き、何を採用前として扱うかを混同しないための運用仕様である。

## Current failure

asset側は、incoming、tmp、rejected、visual audit、PO確認の考え方が整ってきた。
一方で、narrative側は生成テキスト、story pack候補、イベント案、発話候補の置き場と採用条件がまだ曖昧である。

このまま生成へ進むと、次の事故が起きやすい。

- Codexが返した文章を、そのまま公式設定として扱ってしまう。
- `done` jobを採用済みと誤解する。
- 未監査の発話候補やイベント案がPRに大量に貼られる。
- 個人PCのパス、source local path、secret、token、API keyがhandoff文に混ざる。
- assetのvisual auditとnarrativeのcanon audit / tone audit / safety auditが混ざる。

## Final vision

Line作業者と監査役が、narrative生成物を見たときに次を判断できる状態にする。

- どこに置くべき候補か。
- Git管理してよいものか。
- `done` と `adopted` のどちらか。
- canon audit / tone audit / safety audit / PO確認が必要か。
- fallbackでゲームを進めてよいか。
- 別Codexへhandoffするとき、全文ではなくどの要約を残せばよいか。

## Source of truth

この文書は、Narrative Sidekick workspace、narrative generated output、narrative job lifecycle、cleanup / handoff方針の正本である。

関連する既存仕様は次を参照する。

- `docs/operations/codex-job-queue.md`
- `docs/operations/generated-workspace-retention-policy.md`
- `docs/operations/asset-pipeline-git-rules.md`
- `docs/architecture/generated-content-status-copy-spec.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`

## Required rules

### narrative workspace

Narrative Sidekickのローカル作業場所は次の通り。

```txt
narrative/generated/residents/<characterId>/voice-profile/
narrative/generated/residents/<characterId>/dialogue-lines/
narrative/generated/residents/<characterId>/comment-bubbles/

narrative/generated/events/<eventId>/event-seeds/
narrative/generated/events/<eventId>/intervention-responses/

narrative/generated/story-packs/<characterId>/
narrative/generated/rejected/
narrative/generated/tmp/
```

これらはローカル生成候補置き場であり、原則Git管理しない。

`characterId` は、domain / runtime / roster / activeSlotsで使う住民IDである。
表示名やローカルPCのpathをfolder keyにしない。

### Git管理境界

Git管理しないもの:

```txt
narrative/generated/**
real narrative job JSON
ローカル生成された発話候補
ローカル生成されたイベント案
review前のstory pack
個人パス入りログ
source local path
secret
token
API key
未採用全文を大量にPRへ貼ること
```

Git管理してよいもの:

```txt
docs/**
sample JSON
採用済み公式narrative pack
採用理由Markdown
schema docs
```

採用済み公式narrative packをGit管理する場合は、別PBIで採用条件、保存先、参照方法を明示する。
このPBIでは採用済みpackを作らない。

### narrative job lifecycle

Narrative jobは、既存のjob queueと同じ基本状態を使う。

```txt
pending
running
done
failed
```

各状態の意味:

| 状態 | 意味 |
| --- | --- |
| `pending` | Narrative GMへ渡す制作依頼が置かれている。まだ処理されていない。 |
| `running` | Codex Sidekick / Narrative GMが処理中。 |
| `done` | Codexが候補を返した。まだ採用済みではない。 |
| `failed` | Codexが失敗理由を返した。失敗理由にsecretや個人パスを含めない。 |

`done` は採用済みではない。

```txt
done = Codexが候補を返しただけ
adopted = 人間確認・世界観監査・PO確認を通ったもの
```

`done` jobの候補は、canon audit、tone audit、safety audit、必要に応じたPO確認を通るまで、ゲーム内の正本文として扱わない。

### narrative generated output分類

| 分類 | 意味 | Git管理 |
| --- | --- | --- |
| `temporary` | 一時生成文。試行や整形の途中。 | しない |
| `candidate` | Codexが作った候補文。まだ使わない。 | しない |
| `draft` | story pack / event seed pack の候補。まだ正本ではない。 | しない |
| `adopted` | ゲーム内で使うことを承認済みの公式文。 | 採用条件が明確な場合だけ管理してよい |
| `rejected` | 不採用の候補。 | しない |

`candidate` と `draft` は、文面が自然でも正本ではない。

### cleanup / handoff方針

handoff時に残すもの:

```txt
jobId
characterId
eventId
narrative type
generated candidate count
rejected reason summary
audit status
PO decision needed
preferred outcome
safe fallback outcome
```

残さないもの:

```txt
個人PC絶対パス
source local path
secret
token
API key
未採用全文を大量にPRへ貼ること
```

handoffでは、生成候補の全文ではなく、件数、種類、監査状態、判断待ち内容を短く残す。
未採用全文が必要な場合は、Git管理外のローカルworkspaceに置き、PR本文には実値を貼らない。

### asset workspaceとの違い

asset workspace:

```txt
画像候補を扱う。
visual audit / alpha check / validator / processor / PO visual check が必要。
```

narrative workspace:

```txt
テキスト候補を扱う。
canon audit / tone audit / safety audit / PO narrative check が必要。
```

assetは「見た目として壊れていないか」を確認する。
narrativeは「世界観、口調、安全性、公式設定化してよいか」を確認する。

### fallback方針

narrative候補が未生成、review待ち、不採用の場合でも、gameplayは止めない。

```txt
narrative missing:
既存summary / situationTags / deterministic result文で進む。

narrative pending:
Codex生成待ちでpauseしない。既存fallbackで進む。

narrative rejected:
採用せず、既存文言fallbackを使う。
```

Narrative Sidekickの生成完了を、focusedEventやintervention flowの同期条件にしない。

## Ready / Done conditions

- narrative生成物の置き場が分かる。
- Git管理外にするものが明確。
- `done` と `adopted` の違いが明確。
- temporary / candidate / draft / adopted / rejected の分類が分かる。
- cleanup / handoffで残すものと残さないものが分かる。
- asset workspaceとnarrative workspaceの違いが分かる。
- App Server / watcher / job runner実装に踏み込んでいない。
- `src/**` を触っていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

追加確認:

- `narrative/generated/**` を追加していない。
- real narrative job JSONを追加していない。
- 個人PCの絶対パス、secret、API key、tokenを書いていない。

## Preferred outcome

`docs/operations/narrative-sidekick-workspace.md` が正本として追加され、Line 2 / Line 3 が narrative pack schema や Narrative GM personaを設計するときに、置き場、Git管理境界、lifecycle、handoff方針を迷わず参照できる。

## Safe fallback outcome

既存docsとの用語差分や後続Lineとの衝突がある場合は、この文書を新規docsに閉じる。

既存docsへの参照追記はfollow-upへ送り、narrative workspace、Git管理境界、`done` / `adopted` の分離だけを正本として残す。

## Out of scope

- narrative生成実装
- Codex App Server実装
- watcher実装
- job runner実装
- real narrative job JSONのcommit
- `narrative/generated/**` のcommit
- domain / persistence変更
- Passport schema変更
- APIキーUI追加
- 死亡・寿命・勲章復活
- 箱庭上ラベル復活
- gameplay中の同期生成

## One-line Codex resume instruction

```bash
codex "Read docs/operations/narrative-sidekick-workspace.md, refine the narrative Sidekick workspace specification exactly, keep it docs-first, and test until complete."
```
