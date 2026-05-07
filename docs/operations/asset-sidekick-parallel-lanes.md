# Asset Sidekick parallel lanes 仕様

Status: Sprint8 docs-first specification

## Purpose

Asset Sidekick が複数キャラクターの素材候補を扱うときの、parallel lane、item queue、concurrency cap、folder boundary を定義する。

この文書は実装ではない。Line 2 が後続でasset pipelineを太くするときに、4名batch、3種類のasset lane、Git管理境界を混同しないための運用仕様である。

## Current failure

Eve 1名のsprite pipelineが進んだあと、他キャラクターへ広げる時に次の混線が起きやすい。

- 箱庭に同時表示できる4名を超えて、asset生成対象が広がる。
- sprite sheet、立ち絵表情差分、iconの依存関係が混ざる。
- iconを別AI生成してしまい、sprite sheetとの同一性が崩れる。
- `characterId` と `assetBundleId` が混ざり、runtime IDとfolder keyが曖昧になる。
- incoming / tmp / local outputを採用済みassetのように扱ってしまう。

今回のPBIでは、これをdocs-firstで整理する。

## Final vision

Asset Sidekick は、1 batch 最大4名を対象に、3つのasset laneを分けて扱える。

- `resident-sprite-sheet` lane: 最大4 item
- `portrait-expressions` lane: 最大4 item
- `derived-icon` lane: 最大4 item

全体の論理上限は `3 lane x 4 item = 最大12 item` とする。

ただし、iconはsprite sheet候補から派生するため、sprite sheet候補がない状態では開始しない。

## Source of truth

この文書は、Asset Sidekickのparallel lane、batch、item schema、item status、folder boundaryの正本である。

関連する既存仕様は次を参照する。

- `docs/operations/codex-job-queue.md`
- `docs/operations/generated-workspace-retention-policy.md`
- `docs/operations/asset-pipeline-git-rules.md`
- `docs/operations/local-asset-pipeline-folders.md`
- `docs/operations/resident-sprite-pipeline.md`

## Required rules

### asset lane

Asset Sidekickは、次の3 laneを持つ。

| lane | 目的 | 入力 | 出力候補 |
| --- | --- | --- | --- |
| `resident-sprite-sheet` | 箱庭で動かす住民sprite sheet候補を作る | source portrait、character settings、prompt | 192x208 frame / 8列 / 9行のsprite sheet候補 |
| `portrait-expressions` | 立ち絵の表情差分候補を作る | source portrait、character settings、prompt | neutral / happy / angry / sad / surprised など |
| `derived-icon` | sprite sheetの正面frameからicon候補を切り出す | sprite sheet候補、front-facing frame情報 | icon候補 |

`derived-icon` は、別AI生成ではなくsprite sheetから派生する。

### concurrency cap

各laneの論理上限は次の通り。

| lane | 最大item数 |
| --- | --- |
| `resident-sprite-sheet` | 4 item |
| `portrait-expressions` | 4 item |
| `derived-icon` | 4 item |

全体の論理上限は次の通り。

```txt
3 lane x 4 item = 最大12 item
```

これは論理上限であり、実runner側の同時実行数ではない。

ローカルPCの負荷、Codex実行環境、手動確認負荷が高い場合、実runnerは同時実行数を1〜2 itemまで下げてよい。

### 4名batch

1 batchは最大4 characterである。

箱庭の表示定員は `activeSlots[4]` であり、asset生成batchも4名を基本単位にする。

例:

```txt
batchId: batch-active-001

items:
- characterId: chr_garan
  assetBundleId: garan
- characterId: chr_ryo
  assetBundleId: ryo
- characterId: chr_suzu
  assetBundleId: suzu
- characterId: chr_new_a
  assetBundleId: new_a
```

4名を超えるroster全体は、複数batchに分ける。

### characterId / assetBundleId

`characterId` と `assetBundleId` は別の役割を持つ。

| key | 使う場所 | 例 |
| --- | --- | --- |
| `characterId` | runtime / domain / roster / activeSlots 用 | `chr_ryo` |
| `assetBundleId` | asset / prompt / folder / asset id prefix 用 | `ryo` |

`characterId` をfolder keyにしない。

`assetBundleId` をruntime IDとして使わない。

### item schema

各asset itemは、最低限次の情報を持つ。

```json
{
  "itemId": "item-batch-active-001-ryo-sprite",
  "batchId": "batch-active-001",
  "lane": "resident-sprite-sheet",
  "characterId": "chr_ryo",
  "assetBundleId": "ryo",
  "displayName": "Ryo",
  "sourceRef": "assets/generated/residents/ryo/source/",
  "promptRef": ".prompts/resident-sprites/ryo.md",
  "status": "planned",
  "assignedSubagent": "Sprite Sheet Producer",
  "dependsOn": [],
  "outputPaths": [],
  "reviewRequired": true,
  "poVisualCheckRequired": true
}
```

`sourceRef` や `outputPaths` は、PR本文やdocsへ個人PCの絶対パスとして書かない。

### item status

Asset Sidekick itemは、次の状態を使う。

| status | 意味 |
| --- | --- |
| `planned` | itemとして計画済み。まだqueueに入っていない。 |
| `queued` | 実行待ち。 |
| `running` | 生成または処理中。 |
| `candidate-ready` | 候補ができた。まだ検査前。 |
| `alpha-checked` | alpha channel確認が済んだ。 |
| `validated` | validator確認が済んだ。 |
| `processed` | processor処理が済んだ。 |
| `visual-audit-ready` | visual audit用のcontact sheet / reportがある。 |
| `needs-review` | 人間確認が必要。 |
| `needs-regeneration` | 再生成が必要。 |
| `po-review` | PO確認待ち。 |
| `ready-promotion-candidate` | ready化候補。ただしまだ正本ではない。 |
| `ready-promoted` | 別PBIで採用済み正本へ昇格した。 |
| `fallback` | 代替表示を使う。 |
| `rejected` | 不採用。 |
| `failed` | 処理失敗。 |

`ready-promotion-candidate` は `ready-promoted` ではない。

PO visual OKや必要な確認なしに `ready-promoted` にしない。

### lane dependency

laneごとの依存は次の通り。

| lane | 依存 |
| --- | --- |
| `resident-sprite-sheet` | source portrait / character settings / prompt から作れる。 |
| `portrait-expressions` | source portrait / character settings / prompt から作れる。 |
| `derived-icon` | sprite sheet候補が必要。正面frameを特定してから切り出す。 |

`derived-icon` laneは、対象キャラのsprite sheet itemが少なくとも `candidate-ready` 以上になり、正面frame候補が選べるまで開始しない。

### iconの正面frameルール

iconはsprite sheetから派生する。

別AI生成しない。

既定の正面frame候補:

```txt
walk-down row frame 0
```

fallback候補:

```txt
idle row frame 0
```

`idle row frame 0` は、正面として自然に見える場合だけ使う。

icon item reportには、必ず次を残す。

```txt
iconSourceMotionKey
iconSourceFrameIndex
iconSourceReason
```

例:

```json
{
  "iconSourceMotionKey": "walk-down",
  "iconSourceFrameIndex": 0,
  "iconSourceReason": "front-facing standing frame is readable at small size"
}
```

### folder boundary

Asset Sidekickのローカル作業フォルダは、`assetBundleId` をfolder keyに使う。

```txt
assets/generated/residents/<assetBundleId>/incoming/sprites/
assets/generated/residents/<assetBundleId>/incoming/expressions/
assets/generated/residents/<assetBundleId>/tmp/
assets/generated/residents/<assetBundleId>/rejected/

assets/residents/<assetBundleId>/sprites/
assets/residents/<assetBundleId>/expressions/
assets/residents/<assetBundleId>/icons/
```

例:

```txt
assets/generated/residents/ryo/incoming/sprites/
assets/residents/ryo/icons/
```

これらはローカル作業用であり、原則Git管理しない。

採用済みdefault / official assetへ昇格する場合だけ、別PBIで `public/art/**` と正本manifest / read modelへ反映する。

### Git管理境界

Git管理しない:

```txt
assets/generated/**
assets/residents/**
.godsandbox/jobs/**
narrative/generated/**
manifests/drafts/**
実job JSON
local generated output
```

Git管理してよい:

```txt
採用済みpublic/art/**
src/persistence/** の正本manifest / read model
.prompts/**
docs/**
tools/**
```

ただし、`public/art/**` と `src/persistence/**` の変更は、このPBIでは行わない。

## Ready / Done conditions

- 3 lane x 4 item = 最大12 itemの論理上限が明記されている。
- 1 batch = 最大4 character の定義がある。
- 各laneの責務と依存関係が分かる。
- icon laneがsprite sheet依存であることが明記されている。
- iconはsprite sheet正面frameから派生し、別AI生成しないことが明記されている。
- `characterId` / `assetBundleId` の混同がない。
- 実装やasset生成に踏み込んでいない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

docs-onlyのPBIでも、repoの基本確認としてtypecheckとbuildを実行する。

## Preferred outcome

Line 2が後続で複数キャラクターのasset生成を行うとき、4名batch、3 lane、最大12 item、icon依存、folder boundary、Git管理境界をこの文書から判断できる。

## Safe fallback outcome

仕様が広がりすぎる場合は、次だけを正本として残す。

- 1 batch = 最大4 character
- laneは `resident-sprite-sheet` / `portrait-expressions` / `derived-icon`
- 各lane最大4 item
- iconはsprite sheet正面frameから派生
- ローカル生成物はGit管理外

App Server、job runner、ready promotion、実asset生成はfollow-upへ送る。

## Out of scope

- 実asset生成
- public/art変更
- src/persistence変更
- tools実装
- `.agents/skills/**` 変更
- Codex App Server実装
- watcher実装
- job runner実装
- 画像生成API呼び出し
- APIキーUI
- 個人パス記載
- Passport schema変更
- 箱庭上ラベル復活

## One-line Codex resume instruction

```bash
codex "Read docs/operations/asset-sidekick-parallel-lanes.md, refine the asset Sidekick parallel lanes specification exactly, keep it docs-first, and test until complete."
```
