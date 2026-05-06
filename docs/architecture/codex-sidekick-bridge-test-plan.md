# Codex Sidekick Bridge Test Plan

Status: Sprint9 Phase 1 docs-first gate

PBI: `PBI-QA-CODEX-SIDEKICK-BRIDGE-TEST-PLAN-001`

Owner: Line 4 / Event Experience / Tutorial / Narrative

## Purpose

Codex Sidekick bridge と runner を Phase 2 / Phase 3 で実装する前に、何をテストすべきかを定義する。

この文書はテスト計画であり、App Server、runner、watcher、job processor、API接続、UI、生成処理は実装しない。

## Final Vision

Phase 2 / Phase 3 の実装PRは、この文書を読めば次を確認できる。

- Codex Sidekick / App Server が無くても GodSandbox 本体が起動し、fallbackで進む。
- `.godsandbox/jobs/**` の `pending -> running -> done / failed` が安全に扱われる。
- 同じjobが二重実行されない。
- `done` は採用済みではなく、asset `ready` / narrative `adopted` へ自動昇格しない。
- 実job JSON、generated output、manifest draft、local logs がGit管理に混入しない。
- gameplay は Codex生成待ちで止まらない。

## Source Of Truth

このテスト計画は次のdocsを前提にする。

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/product/sprint9-planning.md`
- `docs/operations/codex-job-queue.md`
- `docs/operations/sprint8-closeout-git-hygiene.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`
- `docs/architecture/sprint8-sandbox-final-acceptance.md`

Phase 1の他Line docsがmainに入った後は、次も合わせて正本として読む。

- `docs/architecture/codex-app-server-bridge-spec.md`
- `docs/operations/codex-sidekick-runner-lifecycle.md`
- `docs/architecture/codex-sidekick-subagent-personas.md`
- `docs/security/codex-sidekick-local-security.md`
- `docs/operations/codex-sidekick-local-setup-nontechnical.md`

## Scope

この文書で定義するのは、Sidekick bridge / runner のテスト観点だけである。

対象:

- App Serverなしfallback
- dry-run bridge
- job lock / 二重実行防止
- `done` / `failed` 保存
- retry
- cleanup
- Git混入防止
- asset代表ケース dry-run
- narrative代表ケース dry-run
- gameplay非同期ルール

対象外:

- 自動テスト実装
- UI実装
- App Server実装
- runner実装
- watcher実装
- job processor実装
- API接続
- 生成処理
- ready / adopted promotion 自動化

## Test Levels

| Level | 目的 | 実装phase |
| --- | --- | --- |
| docs gate | Phase 2開始前にテスト観点を固定する | Phase 1 |
| dry-run check | 実生成なしでjob lifecycleを確認する | Phase 2 |
| local runner check | ローカルjob処理とlockを確認する | Phase 2 |
| representative case check | asset / narrative 代表ケースをcandidateとして処理する | Phase 3 |
| sandbox fallback check | generated contentが無くてもgameplayが止まらないことを確認する | Phase 2 / 3 |

## App Server Absent Fallback

App ServerはGodSandbox本体の必須起動条件ではない。

テスト観点:

| Case | Expected |
| --- | --- |
| App Server未起動 | GodSandbox本体は起動する |
| Sidekick bridge接続なし | `/sandbox` はfallbackで進む |
| job queueが空 | gameplayは停止しない |
| bridge dry-runのみ | 実生成せず、dry-run resultだけ確認できる |
| bridge error | gameplayではなくSidekick側に失敗として残る |

合格条件:

- App Serverが無くても、GodSandbox本体の起動と `/sandbox` 表示が失敗しない。
- generated asset / narrative が未生成でも、既存表示と標準文で進行する。
- Codex生成待ちを `eventWindowOpen` や `latestOutcome` のpause理由にしない。

## Runner Lifecycle Tests

runner視点の状態は `.godsandbox/jobs/**` のローカル作業状態である。

| State | Test | Expected |
| --- | --- | --- |
| `pending` | jobが処理待ちとして見つかる | runnerが処理候補として読める |
| `running` | lock取得後に移動する | 同じjobを別runnerが処理しない |
| `done` | result JSONを保存する | 採用済みではない。ready/adoptedにしない |
| `failed` | failed JSONを保存する | 失敗理由が人間に読める。secretを含まない |

重要ルール:

- `done` は採用済みではない。
- `done` から asset `ready` へ自動昇格しない。
- `done` から narrative `adopted` へ自動昇格しない。
- `failed` はgameplay停止理由にしない。

## Job Lock And Double-Run Prevention

二重実行防止は、Phase 2実装の必須テストである。

テスト観点:

- 1つのjobに対してlockを1つだけ作れる。
- lock済みjobを2つ目のrunnerが処理しない。
- runnerが落ちた場合、stale lockを検出できる。
- stale lockの扱いは自動破壊ではなく、runner lifecycle spec のルールに従う。
- lockに個人PCの絶対パスやtokenを書かない。

合格条件:

- 同一jobから複数のresultが作られない。
- 競合時は片方が安全にskipまたはfailed扱いになる。
- lock情報がGit管理に入らない。

## Result And Failed JSON

result / failed JSON はローカルjob処理の成果であり、正本採用ではない。

result JSONに必要な観点:

- `jobId`
- `jobType`
- `status`
- `summary`
- `outputRefs`
- `reviewRequired`
- `poReviewRequired`
- `createdAt`
- `warnings`

failed JSONに必要な観点:

- `jobId`
- `jobType`
- `status`
- `failureReason`
- `safeNextAction`
- `retryAllowed`
- `createdAt`

禁止:

- secret
- API key
- token
- 個人PCの絶対パス
- user-upload素材の実path
- generated outputのGit採用を示す文言

## Retry Tests

retryは、失敗jobを安全に再試行するための操作であり、ready/adopted promotionではない。

テスト観点:

| Case | Expected |
| --- | --- |
| failed jobをretryする | 新しいattemptとして扱う |
| retry回数上限 | 無限retryしない |
| retry不可の失敗 | `safeNextAction` で人間確認へ回す |
| retry後にdone | candidateとして保存し、review待ちにする |

合格条件:

- retryしても古いfailed resultを上書きしない。
- retryしてもGit管理対象へ勝手に昇格しない。
- retry失敗がgameplayを止めない。

## Cleanup Tests

cleanupはローカル作業物の整理であり、採用判断ではない。

確認するもの:

- `.godsandbox/jobs/**`
- `assets/generated/**`
- `assets/residents/**`
- `narrative/generated/**`
- `manifests/drafts/**`
- local logs
- `dist/`

期待:

- cleanup対象をGit管理しない。
- cleanup scriptがある場合でも、採用済み `public/art/**` や正本docsを消さない。
- 個人パス入りログを残さない。
- cleanupはPhase 2 / 3の実装PRで明示されるまで自動化しない。

## Git Hygiene Tests

各実装PRは、次を確認する。

```bash
git status --short --branch
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

Git管理に入れてはいけないもの:

- `dist/`
- `.godsandbox/jobs/**` の実job
- `assets/generated/**`
- `assets/residents/**`
- `narrative/generated/**`
- `manifests/drafts/**`
- `incoming/**`
- `tmp/**`
- `rejected/**`
- `user-uploads/**`
- real job JSON
- generated output
- local logs with private paths

合格条件:

- PR diffに実job JSONや生成物が含まれない。
- `src/**` に触る場合は、Phase 2 / 3の実装PBIで明示されている。
- docs-first gateでは `src/**` に触らない。

## Asset Representative Case Dry-Run

Phase 3のasset代表ケースは、1 character の `character-asset-bundle` jobをdry-runまたはcandidateとして扱う。

確認すること:

- job type がasset代表ケースとして読める。
- `characterId` と `assetBundleId` が分離されている。
- outputはcandidateであり、asset `ready` ではない。
- generated outputはGit管理しない。
- review reportが人間確認へ回せる。
- sandboxはcandidateを直接表示しない。

合格条件:

- candidateがあっても `/sandbox` は既存ready / fallback表示で進む。
- candidateから `ready` へ自動昇格しない。
- PO visual OKがないassetを箱庭に出さない。

## Narrative Representative Case Dry-Run

Phase 3のnarrative代表ケースは、1 character + 1 event の `character-narrative-pack` jobをdry-runまたはcandidateとして扱う。

確認すること:

- job type がnarrative代表ケースとして読める。
- generated narrativeはcandidateであり、narrative `adopted` ではない。
- generated narrativeがdomain event / intervention resultの正本を上書きしない。
- generated narrativeが `見守る` / `助ける` / `試練` の意味を上書きしない。
- review前の候補をplayer-facing UIに出さない。

合格条件:

- candidateがあってもイベントは既存summary / 標準result fallbackで進む。
- candidateから `adopted` へ自動昇格しない。
- rejected / failed / missing narrative でgameplayが止まらない。

## Gameplay Async Tests

GodSandbox本体はCodex生成を同期的に待たない。

pauseする理由:

- `eventWindowOpen`
- `latestOutcome`

pauseしない理由:

- App Server未起動
- Sidekick未起動
- job queue empty
- job `pending`
- job `running`
- asset candidate
- narrative candidate
- `needs-review`
- `failed`

合格条件:

- `/sandbox` はSidekick状態に依存せず動く。
- event flowは `!`、event window、`見守る` / `助ける` / `試練`、result card を維持する。
- generated content未生成時はsafe fallbackで進む。

## Sandbox Regression Checks

Phase 2 / 3 の実装PRでsandboxに影響がある場合だけ、後続UI確認PBIで確認する。

最低観点:

- `/sandbox` desktop
- `/sandbox` 390px
- `/sandbox` 360px
- `!` bubble
- comment bubble
- event window
- `見守る` / `助ける` / `試練`
- CharacterDetailPanel導線
- time-season HUD

箱庭上に戻してはいけないもの:

- キャラ名
- 場所名
- `主役`
- `脇役`
- `見守り中`
- 活力 / 調和などの数値
- 内部状態名

## Ready Conditions

このテスト計画は、次を満たすとreadyである。

- App Serverなしfallbackのテスト観点がある。
- job二重実行防止のテスト観点がある。
- `done` / `failed` 保存のテスト観点がある。
- retry / cleanupのテスト観点がある。
- gameplayがCodex生成待ちで止まらないことを確認できる。
- real job JSONやgenerated outputがGit混入しないことを確認できる。
- asset代表ケース / narrative代表ケースのdry-run観点がある。
- UI実装や自動テスト追加に入っていない。
- 390px / 360pxなどUI確認が必要な場合は後続PBI扱いになっている。

## Safe Fallback Outcome

Phase 2 / 3実装でSidekick bridgeやrunnerが失敗した場合:

- GodSandbox本体は起動を続ける。
- `/sandbox` は既存表示と標準文で進む。
- failed jobはSidekick側に保存する。
- candidateをplayer-facing UIへ出さない。
- assetはfallback表示へ戻す。
- narrativeは標準summary / 標準resultへ戻す。
- ready/adoptedへ自動昇格しない。

## Out Of Scope

- App Server実装
- runner実装
- watcher実装
- job processor実装
- API接続
- UI実装
- 生成処理
- 自動テスト追加
- `src/**` 変更
- `public/**` 変更
- `assets/**` 変更
- `manifests/**` 変更
- `package*` 変更
- `.github/**` 変更
- Passport schema変更
- ready / adopted promotion自動化

## Testing Requirements

このdocs-first PRでは次を実行する。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Follow-Up

Phase 2 / Phase 3の実装PRでは、次をこの文書に照らして確認する。

- runner lifecycle implementation tests
- bridge dry-run tests
- local security checks
- nontechnical setup validation
- sandbox mobile UI confirmation if any UI-facing state is introduced

## One-Line Codex Resume Instruction

```bash
codex "docs/architecture/codex-sidekick-bridge-test-plan.md を読み、Phase 1 gate docs がmainに入った後にだけCodex Sidekick bridgeまたはrunnerの検証計画を使ってください。bridgeやrunnerの実装は別PBIで行い、安全なfallbackまたはpreferred outcomeまで検証してください。"
```
