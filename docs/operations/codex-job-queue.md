# Codex job queue 仕様

Status: Sprint8 docs-first specification

## Purpose

GodSandbox が将来の Codex Sidekick / Codex automation / Codex CLI へ、素材制作や物語候補作成の依頼を渡すためのローカル契約を定義する。

このPBIでは実装しない。
ここで決めるのは、job queue の意味、生成物の置き場、Git管理境界、将来の実装再開条件である。

## Current failure

現在は、Codexへ渡す制作依頼、生成候補、採用済み素材、ローカル作業ファイルの境界が文書上で十分に分かれていない。

そのまま実装へ進むと、次の事故が起きやすい。

- 個人PCの絶対パスがjob JSONへ入り、そのままGit管理される。
- `incoming` や `tmp` の生成途中ファイルが、採用済みassetのように扱われる。
- Codex App Server 本体の実装と、フォルダ契約の仕様化が同じPRに混ざる。
- 未生成assetや未生成narrativeがあると、ゲーム本体が止まる前提になってしまう。

## Final vision

GodSandbox は、制作依頼をローカルjobとして表現できる。
Codex Sidekick は将来、そのjobを読んで生成候補や結果を返せる。

ただし、Sprint8では次を守る。

- Codex App Server本体は実装しない。
- watcherやjob runnerは実装しない。
- GodSandbox本体から画像生成APIを呼ばない。
- 実jobや生成途中ファイルをGit管理しない。
- 生成物が未生成でも、ゲーム本体はfallbackで進む。

## Source of truth

この文書は、Codex job queue とローカル生成物置き場の仕様正本である。

関連する境界は次の文書と合わせて読む。

- `docs/operations/asset-pipeline-git-rules.md`
- `docs/operations/local-asset-pipeline-folders.md`
- `docs/operations/resident-sprite-pipeline.md`
- `.agents/skills/godsandbox-scrum-orchestrator/references/asset-pipeline-guardrails.md`
- `.agents/skills/godsandbox-scrum-orchestrator/references/sprint8-guardrails.md`

## Required rules

### job queue lifecycle

将来のローカルjob queueは、次のフォルダで状態を表す。

```txt
.godsandbox/jobs/pending/
.godsandbox/jobs/running/
.godsandbox/jobs/done/
.godsandbox/jobs/failed/
```

各状態の意味は次の通り。

| 状態 | 意味 |
| --- | --- |
| `pending` | GodSandboxまたはユーザーが作った制作依頼が置かれる。まだ処理されていない。 |
| `running` | Codex Sidekickが処理中のjobを置く。処理中の一時状態であり、Git管理しない。 |
| `done` | Codex Sidekickが生成候補、result、確認メモを返したjobを置く。完了済みでも正本採用済みとは限らない。 |
| `failed` | Codex Sidekickが失敗理由を返したjobを置く。失敗理由にsecretや個人パスを含めない。 |

`done` に入ったjobは、採用済みassetではない。
人間確認、validator、visual audit、PO確認などを通ってから、別PBIで採用判断する。

### job実体のGit管理ルール

`.godsandbox/jobs/**` の実jobはGit管理しない。

理由:

- source image path が入りうる。
- ローカル生成物pathが入りうる。
- ユーザーの作業メモが入りうる。
- 失敗ログや一時状態が入りうる。

Git管理してよいのは、docs配下のsampleだけである。

```txt
docs/operations/examples/codex-jobs/*.json
```

sample JSONには、個人PCの絶対パス、secret、API key、token、実ユーザー画像の場所を書かない。

### characterId と assetBundleId の区別

job JSONでは、実行時の住民IDとasset用のキーを混ぜない。

| Field | 意味 | 例 |
| --- | --- | --- |
| `characterId` | domain / runtime / roster / activeSlots で使う正本の住民ID。 | `chr_eve` |
| `assetBundleId` | asset bundle を識別する安全なキー。MVP では `slug` と同じ値を使う。 | `eve` |

`characterId` は表示名やfolder keyの代わりに使わない。
`assetBundleId` はdomain上の住民IDではないため、runtime read modelやevent participant idとして使わない。

### generated outputの置き場

ローカル作業では、次の置き場を使う。

```txt
assets/generated/residents/<slug>/reference/
assets/generated/residents/<slug>/incoming/resident-sprite-sheet.png
assets/generated/residents/<slug>/incoming/resident-sprite-sheet-extended.png
assets/generated/residents/<slug>/tmp/
assets/generated/residents/<slug>/rejected/

assets/residents/<slug>/sprites/

narrative/generated/residents/<characterId>/
narrative/generated/events/
narrative/generated/story-packs/

manifests/drafts/
```

これらはローカル作業用であり、原則Git管理しない。

採用済みassetだけが、別PBIで明示された保存先とmanifest / read modelへ昇格できる。
例として、デフォルト同梱素材や公式採用assetは `public/art/**` と `src/persistence/**` の正本参照で扱う。

### source / incoming / draft / adopted の区別

| 区分 | 意味 | Git管理 |
| --- | --- | --- |
| `source` | ユーザー入力の立ち絵や外部生成画像。Codex petやGM生成の元になる。 | 管理しない |
| `incoming` | Codexが作った候補。まだ採用前。 | 管理しない |
| `draft` | processorやGMが作ったmanifest / narrative候補。まだ正本ではない。 | 管理しない |
| `adopted` | 人間確認、PO確認、validatorなどを通して正本採用されたもの。 | 採用先と理由が明確な場合だけ管理してよい |

`incoming` や `draft` は、見た目が良くても採用済みではない。
`adopted` にするには、別PBIの受け入れ条件で明示された確認を通す。

### Codex App Serverとの境界

このPBIでは Codex App Server 本体を実装しない。

このjob queueは、将来の Codex App Server / Codex automation / Codex CLI が読むためのローカル契約である。
Sprint8では、契約をdocs-firstで固定するだけに留める。

## Ready / Done conditions

- `.godsandbox/jobs/**` のlifecycleがdocsで説明されている。
- 実jobはGit管理外であることが明記されている。
- sample JSONだけdocs配下で管理してよいことが分かる。
- source / incoming / draft / adopted の違いが分かる。
- generated output置き場がローカル作業用として整理されている。
- Codex App Server本体実装に踏み込んでいない。
- `src/**` を触っていない。

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
- sample JSONに個人PCの絶対パス、secret、API key、tokenがない。

## Preferred outcome

Line 1は、Codex job queue、生成物置き場、Git管理境界をdocs-firstで詳細化する。
Line 3 / Line 4 は、この用語を使って後続仕様を作れる。
Line 2 の Eve sprite visual regen には触れない。

## Safe fallback outcome

仕様が広がりすぎる場合は、`.godsandbox/jobs/**` のlifecycleとGit管理境界だけを採用する。
Codex App Server、job schema詳細、narrative pack詳細、UI連携はfollow-up PBIへ送る。

安全なfallbackでは、実jobや生成物をGit管理せず、ゲーム本体の起動やfallback表示にも影響させない。

## Out of scope

- App Server実装
- watcher実装
- job runner実装
- real job JSONのcommit
- `src/**` 変更
- `public/art/**` 変更
- `assets/generated/**` のcommit
- `assets/residents/**` のcommit
- `manifests/residents.json` または `manifests/drafts/**` のcommit
- OpenAI Images API呼び出し
- API key入力UI
- Passport schema変更
- 死亡、寿命、勲章の復活
- 箱庭上のキャラ名、場所、状態ラベルの復活

## One-line Codex resume instruction

```bash
codex "Read docs/operations/codex-job-queue.md, refine the GodSandbox Codex job queue specification exactly, keep it docs-first, and test until complete."
```
