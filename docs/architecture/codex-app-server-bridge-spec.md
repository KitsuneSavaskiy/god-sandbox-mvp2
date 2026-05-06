# Codex App Server bridge spec

状態: Sprint9 Phase 1 docs-first gate

PBI: `PBI-ARCH-CODEX-APP-SERVER-BRIDGE-SPEC-001`

## Purpose

Codex App Server、Codex CLI、Codex automation と `.godsandbox/jobs/**` の接続境界を定義する。

この文書は、GodSandbox本体とSidekick側bridgeの責務を分けるための正本である。
今回はdocs-first gateであり、App Server、runner、watcher、job processor、API接続、UI、生成処理は実装しない。

## Current failure

Sprint8までに、job queue、asset pipeline、narrative workspace、generated content fallback の仕様は整理された。
一方で、GodSandbox本体、Codex App Server、Codex CLI、Codex automation がどこで接続されるかはまだ明確ではない。

このまま実装へ進むと、次の事故が起きやすい。

- GodSandbox本体の起動にApp Serverが必須だと誤解する。
- GodSandbox本体から画像生成APIや外部AI APIを直接呼んでしまう。
- `.godsandbox/jobs/**` の `done` を、asset `ready` や narrative `adopted` と誤解する。
- bridgeが生成候補を勝手に公式採用してしまう。
- App Serverがない環境でgameplayが止まる。
- 実job JSONや生成候補がGit管理に混ざる。

## Final vision

GodSandbox本体は、App ServerやCodex生成の有無に関係なく起動し、遊べる。

Codex Sidekick側のbridgeは、将来 `.godsandbox/jobs/**` のjobを読み、外部のCodex CLIやCodex automationへ渡し、候補結果をローカル作業領域へ返す。
ただし、bridgeは生成候補をasset `ready` や narrative `adopted` にしない。

App Serverが使えない場合でも、GodSandbox本体はfallbackで進む。
Phase 2実装では、dry-runでjobの流れだけを確認できる状態を先に作る。

## Source of truth

この文書は、Codex App Server bridge境界の正本である。

関連する正本は次の通り。

- `docs/product/sprint9-planning.md`
  - Sprint9のPhase分割、Implementation Start Gate、代表ケースの正本。
- `docs/operations/codex-job-queue.md`
  - `.godsandbox/jobs/**` のlifecycle、Git管理境界、`done` と採用済みの違い。
- `docs/operations/sprint8-closeout-git-hygiene.md`
  - `dist/`、実job、generated output、manifest draftをcommitしないルール。
- `docs/operations/generated-workspace-retention-policy.md`
  - generated workspaceの保存、cleanup、handoff方針。
- `docs/architecture/sandbox-generated-content-state-matrix.md`
  - generated contentが未生成でもgameplayを止めない方針。
- `docs/architecture/narrative-pack-schema.md`
  - narrative候補、`adopted`、runtime / display fallbackの境界。

この文書はPassport schemaを変更しない。
この文書はGodSandbox本体から生成APIを呼ぶ仕様を追加しない。

## Required rules

### 責務境界

| 領域 | 責務 | してはいけないこと |
| --- | --- | --- |
| GodSandbox本体 | gameplay、focusedEvent、fallback表示、将来のjob作成UIの入口 | App Server必須化、画像生成API呼び出し、API key UI追加、Codex生成待ちでgameplay停止 |
| `.godsandbox/jobs/**` | ローカルjob queueの実体置き場 | Git管理、ready/adopted扱い、個人パスやsecret入りjobのcommit |
| Codex App Server bridge | job queueと外部Codex実行手段をつなぐ境界 | 生成候補の公式採用、自動ready化、自動adopted化、Git commit |
| Codex CLI / automation | 外部補助として候補を作る | GodSandbox本体の正本データを直接変更、review gate省略 |
| review gate | asset / narrative候補を人間確認へ回す | 生成担当が自分でready/adopted判断すること |

### App Serverは必須起動条件ではない

GodSandbox本体は、App Serverなしでも起動する。
App Serverがない場合、次の方針で進む。

- gameplayは既存asset、標準文、fallback表示で継続する。
- job作成や実行導線が未実装なら、ユーザーに必須操作として出さない。
- 将来のUIでは、App Server未接続を理由に箱庭体験を止めない。
- Phase 2では、まずdry-runでbridgeの入出力だけを確認する。

### Bridgeの読み書き境界

Bridgeが読んでよいもの:

```txt
.godsandbox/jobs/pending/*.json
.godsandbox/jobs/running/*.json
docs/operations/examples/**/*.json
```

Bridgeが書いてよい将来のローカル作業先:

```txt
.godsandbox/jobs/running/
.godsandbox/jobs/done/
.godsandbox/jobs/failed/
assets/generated/**
assets/residents/**
narrative/generated/**
manifests/drafts/**
```

これらの実ファイルはGit管理しない。
docsに置くsample JSONだけは、個人パス、secret、API key、tokenを含まない場合に限ってGit管理してよい。

Bridgeが直接書いてはいけないもの:

```txt
src/**
public/art/**
manifests/residents.json
package*
.github/**
Passport schema
```

採用済みassetや正本manifestへの反映は、別PBIのreview gate後に行う。

### job lifecycleとの関係

Bridgeはrunner lifecycleを尊重する。
Phase 1ではrunner lifecycleの実装はしない。

将来の最小流れ:

```txt
pending
-> running
-> done | failed
```

`done` は、候補が返っただけである。

| job状態 | Bridge上の意味 | ready/adoptedとの関係 |
| --- | --- | --- |
| `pending` | 実行待ち | 採用済みではない |
| `running` | 実行中 | 採用済みではない |
| `done` | 候補結果が返った | asset `ready` でも narrative `adopted` でもない |
| `failed` | 実行に失敗した | fallbackで進む |

### result / failed の境界

Bridgeが将来返すresultには、少なくとも次のような抽象情報だけを含める。

```txt
jobId
jobType
targetCharacterId
assetBundleId
candidateCount
outputWorkspace
auditStatus
nextReviewGate
safeFallback
```

failedには、非技術者にも分かる短い失敗理由を書く。
ただし、次は書かない。

```txt
個人PCの絶対パス
source local path
secret
token
API key
認証情報
長い生ログ
```

### ready / adoptedにしない境界

Bridgeは生成候補を受け取るだけで、公式採用しない。

- asset候補は `ready` にしない。
- narrative候補は `adopted` にしない。
- `done` jobを「準備済み」と表示しない。
- review gate前の候補をplayer-facing UIに公式文として出さない。

asset `ready` には、validator、visual audit、人間確認、必要なPO確認が必要である。
narrative `adopted` には、canon audit、tone audit、safety audit、product audit、必要なPO確認が必要である。

### dry-run / fallback

Phase 2のbridge MVPでは、App Serverなしでもdry-runできることを優先する。

dry-runで確認するもの:

- jobを読み取れる。
- lockや二重実行防止の前提を壊さない。
- result / failed相当の形を作れる。
- 実生成をしなくてもfallbackへ戻れる。
- Git管理外の作業先にだけ出力する。

dry-runでしてはいけないこと:

- APIを呼ぶ。
- `public/art/**` へ採用済みassetを書く。
- `src/**` やpersistenceを更新する。
- `ready` / `adopted` にする。
- gameplayを停止させる。

## Ready / Done conditions

- GodSandbox本体とSidekick側bridgeの責務境界が分かる。
- App Serverがゲーム本体の必須起動条件ではないと分かる。
- App Serverなし時のfallback / dry-run方針が分かる。
- job queueを読む / 書く責務が分かる。
- `done` と `ready` / `adopted` の違いが分かる。
- Bridgeが生成候補を自動採用しないことが分かる。
- 実装、API接続、UI、生成処理に入っていない。
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` を触っていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

追加確認:

- `.godsandbox/jobs/**` の実jobを追加していない。
- `assets/generated/**`、`assets/residents/**`、`narrative/generated/**`、`manifests/drafts/**` を追加していない。
- 個人パス、secret、API key、tokenを書いていない。

## Preferred outcome

この文書がmainへ入り、Phase 2の実装者が次を迷わず判断できる。

- どこまでがGodSandbox本体の責務か。
- どこからがSidekick bridgeの責務か。
- App Serverがない時にどう安全に戻るか。
- `.godsandbox/jobs/**` の実jobをどう扱うか。
- `done` を `ready` / `adopted` と混同しない方法。

## Safe fallback outcome

Bridge仕様が広がりすぎる場合は、次だけを正本として残す。

- App ServerはGodSandbox本体の必須起動条件ではない。
- GodSandbox本体から生成APIを呼ばない。
- `.godsandbox/jobs/**` はGit管理しない。
- `done` は候補返却であり、`ready` / `adopted` ではない。
- App Serverなしではfallback / dry-runで進む。

Phase 2実装は、Implementation Start Gateを満たすまで開始しない。

## Out of scope

- App Server実装
- runner実装
- watcher実装
- job processor実装
- API接続
- UI実装
- 画像生成処理
- narrative生成処理
- real job JSONのcommit
- generated asset / narrativeのcommit
- manifest draftのcommit
- `src/**` 変更
- `public/**` 変更
- `assets/**` 変更
- `manifests/**` 変更
- `package*` 変更
- `.github/**` 変更
- `.agents/skills/**` 変更
- Passport schema変更
- ready / adopted promotion自動化
- 死亡、寿命、勲章復活
- 箱庭上のキャラ名、場所、状態ラベル復活

## One-line Codex resume instruction

```bash
codex "docs/architecture/codex-app-server-bridge-spec.md を読み、Sprint9 Phase 1 docs-first の範囲だけでCodex App Server bridge境界仕様を整えてください。App Serverやrunnerは実装せず、検証まで完了してください。"
```
