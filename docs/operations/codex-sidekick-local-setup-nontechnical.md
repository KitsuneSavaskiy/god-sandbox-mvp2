# Codex Sidekick local setup for nontechnical users

Status: Sprint9 Phase 1 docs-first gate

PBI: `PBI-UX-CODEX-SIDEKICK-NONTECH-SETUP-FLOW-001`

## Purpose

非技術者のPOや制作メンバーが、Codex Sidekick を使う前に何を準備し、何をしてはいけないかを理解できるようにする。

ここでいう Codex Sidekick は、GodSandbox本体の中に入る機能ではなく、ローカル作業フォルダに置かれた制作依頼を読んで、住民のスプライトシート準備を進める補助役である。

この文書は説明用のsetup flowであり、Sprint9 Phase 1では App Server、runner、watcher、job processor、API接続、UI、生成処理を作らない。

## Current failure

Codex Sidekick まわりの言葉は、開発者には自然でも、非技術者には次のように見えやすい。

- 何をインストールすればよいのか分からない。
- API key や従量課金APIが必要に見える。
- Git、repo、branch、PR、local folder の違いが分かりにくい。
- エラーが出ても、続けてよいのか止めるべきか判断しにくい。
- 生成候補ができた時点で、ゲーム内採用済みだと誤解しやすい。

このままPhase 2へ進むと、生成物や実jobを誤ってGit管理したり、GodSandbox本体がSidekickなしでは動かない前提になったりする。

## Final vision

非技術者でも、次を理解した上でSprint9 Phase 2以降の作業に進める。

- Codex Sidekick は、GodSandbox本体とは別のローカル補助役である。
- GodSandbox本体は、SidekickやApp Serverがなくても起動できる。
- ChatGPT / Codex サブスク範囲の個人利用を前提にし、API key入力UIや従量課金API連携を前提にしない。
- 実job、生成候補、manifest draft、local log はGit管理しない。
- 生成候補ができても、review gateを通るまでは採用済みではない。
- エラーが出た時に、続行せず止める条件が分かる。

## Source of truth

この文書は、非技術者向けのCodex Sidekick local setup説明の正本である。

実装者向けの詳細は、次の文書を正本として扱う。

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/product/sprint9-planning.md`
- `docs/operations/codex-job-queue.md`
- `docs/operations/sprint8-closeout-git-hygiene.md`

Phase 1でそろえる詳細docsは次である。

- `docs/architecture/codex-sidekick-subagent-personas.md`
- `docs/architecture/codex-app-server-bridge-spec.md`
- `docs/operations/codex-sidekick-runner-lifecycle.md`
- `docs/security/codex-sidekick-local-security.md`
- `docs/architecture/codex-sidekick-bridge-test-plan.md`

mainに入った詳細docsを正本とし、この文書のやさしい説明が各詳細specの意味と矛盾しないか確認する。

## Required rules

### Codex Sidekickとは

Codex Sidekick は、GodSandboxの制作を手伝うローカル補助役である。

今回の導線では、次の依頼だけを扱う。

- キャラクター1名分の箱庭アニメ素材候補を作る。
- できた候補を人間確認に回す。

ただし、Sidekickはゲーム本体ではない。
Sidekickが止まっていても、GodSandbox本体はfallbackで動く必要がある。

### App Serverとは

App Server は、将来のローカル橋渡し役である。

やさしく言うと、GodSandboxの作業フォルダとCodex Sidekickの間で、制作依頼や結果を受け渡す係である。

Sprint9 Phase 1では、App Serverを作らない。
App Serverがない場合も、GodSandbox本体は通常画像や標準文のfallbackで進む。

### CLIとは

CLI は、文字で操作する道具である。

開発者はCLIで `git` や `npm` などのコマンドを実行する。
非技術者は、手順に書かれていないCLI操作を自己判断で増やさない。

エラーが出たら、画面に出た内容を要約して作業Lineへ渡し、無理に続けない。

### repo / branch / PRとは

| 言葉 | やさしい説明 |
| --- | --- |
| repo | GodSandboxの作業フォルダ全体。Gitで管理される。 |
| branch | 1つの作業を安全に分けるための作業線。 |
| PR | mainへ入れる前に、変更を見てもらうための提出物。 |
| main | 監査を通った正本の作業線。 |

mainへ直接変更を入れない。
作業は Issue -> branch -> PR の順で進める。

### local folderとは

local folder は、手元PCだけで使う作業置き場である。

次はGit管理しない。

```txt
dist/
.godsandbox/jobs/**
.godsandbox/portraits/**
.hatch-pet-runs/**
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
```

これらには、生成途中の候補、個人環境に依存する情報、まだ採用されていない内容が入る可能性がある。

### 個人利用の前提

Sprint9 Phase 1の説明は、ChatGPT / Codex サブスク範囲の個人利用を前提にする。

この文書は、商用利用、再配布、第三者提供を前提にしない。
その範囲へ進む場合は、別途PO判断と利用条件確認を行う。

### API keyを前提にしない

GodSandbox本体は、画像生成APIや外部AI APIへ直接つながない。

このsetup flowでは、次をしない。

- API key入力UIを作る。
- 従量課金APIの利用を必須にする。
- GodSandbox本体から画像生成APIを呼ぶ。
- Codex生成待ちでgameplayを止める。

### 生成候補と採用済みの違い

Sidekickが候補を作っても、それは採用済みではない。

| 種類 | 意味 |
| --- | --- |
| asset candidate | 画像やspriteなどの候補。まだ採用済みではない。 |
| `done` job | Sidekickが候補を返した状態。採用済みではない。 |
| `ready` asset | review gate後に使ってよいasset。 |

生成担当は、自分の生成物を単独で `ready` にしない。

## Setup flow

### 1. 目的を確認する

最初に、今回の作業が次のどれかを確認する。

- docs-first gateとして説明文書を作る。
- Phase 2以降でrunnerやbridgeの最小実装をする。
- Phase 3以降で代表ケースを実行する。

Sprint9 Phase 1では、docs-first gateだけを行う。

### 2. 正本docsを読む

最低限、次を読む。

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/product/sprint9-planning.md`
- `docs/operations/codex-job-queue.md`
- `docs/operations/sprint8-closeout-git-hygiene.md`

PR本文には、読んだdocsを書く。

### 3. mainから作業branchを切る

作業はmainから新しいbranchを切って行う。

mainへ直接pushしない。

### 4. local folderをGitに入れない

`.godsandbox/jobs/**` や `assets/generated/**` などは、手元作業用として扱う。

PRに入れるのは、今回PBIで許可されたdocsだけにする。

### 5. 実装しない範囲を確認する

Sprint9 Phase 1では、次をしない。

- App Server実装
- runner実装
- watcher実装
- job processor実装
- API接続
- UI実装
- 画像生成
- ready / adopted promotion自動化

### 6. PR前に確認する

PR前に次を実行する。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

docs-onlyでも、typecheckとbuildで既存アプリを壊していないことを確認する。

## Stop conditions

次のどれかが起きたら、作業を止めて報告する。

- API key、token、secret、PATの入力や保存を求められた。
- 個人PCの絶対パスをdocs、PR本文、sample JSONへ書く必要が出た。
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` を触る必要が出た。
- `.agents/skills/**` を触る必要が出た。
- 実job JSONやgenerated outputをcommitする流れになった。
- App Serverやrunnerの実装が必要になった。
- GodSandbox本体がApp Serverなしでは起動できない前提になった。
- Codex生成待ちでgameplayを止める設計になった。
- 生成候補を人間確認なしで `ready` にする流れになった。
- 商用利用、再配布、第三者提供を前提にする必要が出た。
- 作業scope外のファイル変更が必要になった。

止めた場合は、実値を貼りすぎず、何が起きたかを短く報告する。

## Ready / Done conditions

- 非技術者が、Codex Sidekickの役割を理解できる。
- App ServerがGodSandbox本体の必須起動条件ではないと分かる。
- ChatGPT / Codex サブスク範囲の個人利用前提が明記されている。
- API key入力UIや従量課金API連携を前提にしていない。
- CLI、repo、branch、PR、local folderがやさしく説明されている。
- エラー時に止める条件が分かる。
- 実装やApp Server接続に入っていない。
- 実job JSON、generated asset、generated narrative、manifest draftを追加していない。
- 個人パス、secret、API key、tokenを書いていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

追加確認:

- changed filesが `docs/operations/codex-sidekick-local-setup-nontechnical.md` のみに閉じている。
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` を触っていない。
- `.agents/skills/**` を触っていない。
- `dist/` をcommitしていない。
- 実job JSON、generated output、manifest draftを追加していない。

## Preferred outcome

この文書がmainへ入り、非技術者向けに次を説明できる。

```txt
Codex Sidekickはローカル補助役
GodSandbox本体はSidekickなしでも動く
API key入力UIは作らない
生成候補は採用済みではない
local folderはGitに入れない
エラー時は止める
```

Phase 2では、Phase 1でmainへ入った詳細specと合わせて、実装者が安全にrunner / bridge / test planへ進める。

## Safe fallback outcome

詳細specがまだmainにない場合は、この文書はSprint9 planningとCodex job queueの用語だけを使う。

App Server bridge、runner lifecycle、security specがmainへ入った後、必要なら文言の追従だけを行う。

安全なfallbackでは、実装、job書き込み、API接続、生成処理を行わず、GodSandbox本体の起動条件も変えない。

## Out of scope

- App Server実装
- runner実装
- watcher実装
- job processor実装
- API接続
- UI実装
- asset生成
- real job JSONのcommit
- generated outputのcommit
- manifest draftのcommit
- ready promotion自動化
- Passport schema変更
- 商用利用、再配布、第三者提供前提の運用設計
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` 変更
- `.agents/skills/**` 変更

## One-line Codex resume instruction

```bash
codex "docs/operations/codex-sidekick-local-setup-nontechnical.md を読み、Sprint9 Phase 1 docs-first の範囲だけでCodex Sidekickの非技術者向けsetup flowを整えてください。App Serverやrunnerは実装せず、検証まで完了してください。"
```
