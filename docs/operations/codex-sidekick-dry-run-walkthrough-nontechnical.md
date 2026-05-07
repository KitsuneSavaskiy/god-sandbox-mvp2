# Codex Sidekick dry-run walkthrough for nontechnical users

Status: Sprint9 Phase 2 docs-first walkthrough

PBI: `PBI-UX-CODEX-SIDEKICK-NONTECH-DRY-RUN-WALKTHROUGH-001`

Issue: `#199`

## Purpose

非技術者のPOや制作メンバーが、実生成なしでCodex Sidekick dry-runの流れを理解できるようにする。

dry-runは「本番の生成をせず、制作依頼の流れだけを安全に確認する練習」である。
この文書は、Sidekickの状態、止める条件、PO確認メモの残し方を説明する。

このPBIでは、runner、bridge、API接続、生成処理、UI実装を行わない。

## Current failure

Codex Sidekickは、asset候補やnarrative候補を将来扱うための補助役である。
ただし、dry-runの説明がないと、非技術者には次の誤解が起きやすい。

- dry-runで `done` になったら、もうゲームで使ってよいと思ってしまう。
- asset `ready` と narrative `adopted` の違いが分からない。
- CLI操作とPO判断が混ざり、誰が何を決めるのか分かりにくい。
- エラーが出ても、続けてよいのか止めるべきか判断しにくい。
- API keyや有料API接続が必要だと誤解する。
- 実job JSONやgenerated outputをPRへ入れてよいと誤解する。

## Final vision

非技術者が、dry-runで次を確認できる。

- GodSandbox本体はSidekickなしでも動く。
- dry-runは実生成ではなく、jobの流れを確認するだけである。
- `pending / running / done / failed` の意味が分かる。
- `done` は採用済みではない。
- asset `ready` はreview gate後の状態である。
- narrative `adopted` はreview gate後の状態である。
- CLIが行うことと、人間が判断することが分かれている。
- エラー時に止める条件が分かる。
- PO確認メモとして何を残すか分かる。

## Source of truth

この文書は、非技術者向けのCodex Sidekick dry-run walkthroughの正本である。

合わせて読むdocs:

- `docs/operations/codex-sidekick-local-setup-nontechnical.md`
- `docs/operations/codex-sidekick-runner-lifecycle.md`
- `docs/architecture/codex-app-server-bridge-spec.md`
- `docs/security/codex-sidekick-local-security.md`
- `docs/architecture/codex-sidekick-bridge-test-plan.md`
- `docs/product/sprint9-planning.md`
- `docs/operations/codex-job-queue.md`
- `docs/operations/sprint8-closeout-git-hygiene.md`

Issue `#199` の補正コメントを用語の正本として扱う。

正しい用語:

- `ready`
- `adopted`
- `done`

境界:

- `done` は採用済みではない。
- asset `ready` はreview gate後である。
- narrative `adopted` はreview gate後である。
- dry-run結果を `ready` / `adopted` と誤解させない。

SPECA follow-up audit result:

- FIN-001〜FIN-005: closed
- Vulnerabilities: 0
- Sprint9 Phase 2: CONDITIONAL GO

CONDITIONAL GOのため、PRでは参照docs、Git boundary、指定test、`done` を `ready` / `adopted` と扱っていないことを必ず記録する。

## Required rules

### dry-runとは

dry-runは、本番の生成をしない確認である。

やさしく言うと、次を確認する練習である。

- jobを見つけられるか。
- jobを処理中として扱えるか。
- 成功した時の結果の形を確認できるか。
- 失敗した時の理由を人間が読めるか。
- Gitに入れてはいけないものが混ざっていないか。
- GodSandbox本体がSidekick待ちで止まらないか。

dry-runでしてはいけないこと:

- 画像や文章を実生成する。
- API keyを要求する。
- 実job JSONをcommitする。
- generated outputをcommitする。
- manifest draftをcommitする。
- assetを `ready` にする。
- narrativeを `adopted` にする。
- GodSandbox本体のgameplayを止める。

### 状態のやさしい説明

| 状態 | 非技術者向け説明 | 採用済みか |
| --- | --- | --- |
| `pending` | まだ順番待ちの制作依頼。 | いいえ |
| `running` | Sidekickが処理中として扱っている制作依頼。 | いいえ |
| `done` | 候補や結果メモが返った状態。 | いいえ |
| `failed` | 失敗理由が返った状態。 | いいえ |

`done` は「候補が返った」だけである。
ゲームで使ってよいという意味ではない。

### `done` / `ready` / `adopted` の違い

| 用語 | 対象 | 意味 |
| --- | --- | --- |
| `done` | job | Sidekickが候補を返した。採用済みではない。 |
| `ready` | asset | 画像やspriteなどがreview gate後に使ってよい状態。 |
| `adopted` | narrative | 発話やイベント文などがreview gate後に使ってよい状態。 |

asset候補が `ready` になるには、人間確認、必要な検査、PO確認などを通す。
narrative候補が `adopted` になるには、世界観、口調、安全性、PO確認などを通す。

dry-runでは `ready` / `adopted` へ進めない。

### CLI操作と人間判断を分ける

CLIは、文字で操作する道具である。
dry-runでCLIが確認するのは、主に「流れ」と「形」である。

CLIが確認してよいこと:

- jobがあるか。
- jobの状態が変わるか。
- result / failed の形が作れるか。
- Git差分に禁止ファイルが混ざっていないか。
- `npm run typecheck` と `npm run build` が通るか。

CLIが判断しないこと:

- assetを `ready` にしてよいか。
- narrativeを `adopted` にしてよいか。
- POが見た目や文章を承認したか。
- 生成物を公式採用してよいか。
- 商用利用や再配布に進んでよいか。

人間が判断すること:

- 候補を確認する必要があるか。
- PO確認に回すか。
- fallbackで進めるか。
- follow-up PBIに分けるか。

### GodSandbox本体は止めない

GodSandbox本体は、SidekickやApp Serverがなくても動く必要がある。

dry-run中でも、次を守る。

- gameplayをCodex生成待ちで止めない。
- App Server未起動をゲーム本体の起動失敗にしない。
- asset候補がない場合は既存assetやfallbackで進む。
- narrative候補がない場合は既存summaryや標準文で進む。

### Gitに入れないもの

dry-runでも、次をGit管理しない。

```txt
.godsandbox/jobs/**
.godsandbox/portraits/**
.hatch-pet-runs/**
assets/generated/**
assets/residents/**
narrative/generated/**
manifests/drafts/**
dist/**
incoming/**
tmp/**
rejected/**
user-uploads/**
real job JSON
generated output
manifest draft
local logs
```

これらは、ローカル作業物、候補、一時出力、個人環境に依存する情報を含む可能性がある。

### API key不要方針

dry-runでは、API keyを要求しない。

このPBIでは、次をしない。

- API key入力UIを作る。
- GodSandbox本体から画像生成APIを呼ぶ。
- 外部生成APIの接続を作る。
- 従量課金APIを必須にする。

ChatGPT / Codex サブスク範囲の個人利用を前提にする。
商用利用、再配布、第三者提供は前提にしない。

## Walkthrough

### Step 1: 目的を確認する

最初に、今回のdry-runが何を見るためのものか確認する。

見るもの:

- jobの流れ
- 状態の表示
- result / failed の形
- stop condition
- Git boundary

見ないもの:

- 実生成の品質
- assetの見た目採用
- narrativeの公式採用
- App Server本体の完成度

### Step 2: 正本docsを読む

最低限、次を読む。

- `docs/operations/codex-sidekick-local-setup-nontechnical.md`
- `docs/operations/codex-sidekick-runner-lifecycle.md`
- `docs/architecture/codex-app-server-bridge-spec.md`
- `docs/security/codex-sidekick-local-security.md`
- `docs/architecture/codex-sidekick-bridge-test-plan.md`
- `docs/product/sprint9-planning.md`

分からない用語が出たら、先に正本docsへ戻る。

### Step 3: dry-runの対象を確認する

dry-run対象は、代表ケースの流れだけでよい。

例:

- asset代表ケースのjobが流れるか。
- narrative代表ケースのjobが流れるか。
- `done` になっても採用済み扱いしないか。
- `failed` になってもgameplayを止めないか。

### Step 4: 状態を読む

非技術者向けには、次のように読む。

```txt
pending: 順番待ち
running: 処理中
done: 候補が返った
failed: 失敗理由が返った
```

ここで一番大事なのは、`done` を採用済みと読まないことである。

### Step 5: result / failed を確認する

dry-runのresultで確認するもの:

- jobId
- jobType
- status
- candidate count
- reviewRequired
- poReviewRequired
- safeFallback

failedで確認するもの:

- jobId
- jobType
- status
- userSafeMessage
- retryable
- safeNextAction

result / failedに書いてはいけないもの:

- 個人PCの絶対パス
- token
- secret
- API key
- source画像の実ローカルpath
- 長い生ログ

### Step 6: PO確認メモを残す

dry-run後、POが見るべきことを短く残す。

メモは、候補を採用するためではなく、次に何を判断するかをそろえるために使う。

### Step 7: PR前に確認する

docs-only PRでは、次を確認する。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Stop conditions

次のどれかが出たら、dry-runを止める。

### Security stop

- API key、token、secret、PATの入力を求められた。
- 個人PCの絶対パスをdocs、PR本文、sample、resultへ書く必要が出た。
- user-upload素材の実pathを共有する必要が出た。
- local auth stateや認証情報を扱う必要が出た。

### Git boundary stop

- 実job JSONをcommitする流れになった。
- generated asset / generated narrativeをcommitする流れになった。
- manifest draftをcommitする流れになった。
- local logsや `dist/**` がPRに混ざった。
- `.godsandbox/jobs/**`、`assets/generated/**`、`narrative/generated/**` をGit管理する必要が出た。

### Scope stop

- runner / bridge / App Server実装が必要になった。
- API接続や生成処理が必要になった。
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` を触る必要が出た。
- Passport schemaを変える必要が出た。

### Product stop

- `done` を asset `ready` や narrative `adopted` と扱う流れになった。
- ready / adopted promotionを自動化する流れになった。
- Codex生成待ちでgameplayを止める流れになった。
- SidekickなしではGodSandbox本体が動かない前提になった。
- 死亡、寿命、勲章を戻す必要が出た。
- 箱庭上にキャラ名、場所、状態ラベルを戻す必要が出た。

### Usage stop

- 商用利用、再配布、第三者提供を前提にする必要が出た。
- ChatGPT / Codex サブスク範囲の個人利用を超える前提が必要になった。

止めた場合は、実値を貼りすぎず、何が起きたか、どのstop conditionに当たったか、次に誰が判断するかだけを書く。

## PO confirmation memo template

```md
## PO Dry-run Confirmation Memo

- Date:
- PBI:
- Target:
- Dry-run type:
  - asset representative
  - narrative representative
  - runner lifecycle
  - bridge fallback
- Observed state:
  - pending:
  - running:
  - done:
  - failed:
- Important boundary:
  - `done` is not asset `ready`.
  - `done` is not narrative `adopted`.
- Candidate output:
  - none
  - local candidate only
  - review memo only
- Git boundary:
  - real job JSON committed: no
  - generated output committed: no
  - manifest draft committed: no
  - local logs committed: no
  - dist committed: no
- Security:
  - API key requested: no
  - token / secret requested: no
  - personal path recorded: no
- Gameplay:
  - GodSandbox works without Sidekick: yes / not checked
  - gameplay blocked by Codex waiting: no
- PO decision needed:
  - approve dry-run flow
  - revise explanation
  - block and investigate
- Notes:
```

## Ready / Done conditions

- 非技術者がdry-runで何を見るか理解できる。
- `pending / running / done / failed` がやさしく説明されている。
- `done` は採用済みではないと明記されている。
- asset `ready` / narrative `adopted` との違いが説明されている。
- エラー時のstop conditionが整理されている。
- PO確認メモtemplateがある。
- CLI操作と人間判断が分けて説明されている。
- API key不要方針が明記されている。
- 実装や生成に入っていない。
- docs-onlyに閉じている。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

追加確認:

- changed filesが `docs/operations/codex-sidekick-dry-run-walkthrough-nontechnical.md` に閉じている。
- 実job JSON、generated output、manifest draft、local logs、`dist/**` を追加していない。
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` を触っていない。
- API key、token、secret、個人パスを書いていない。

## Preferred outcome

この文書がmainへ入り、非技術者がSidekick dry-runを安全に理解できる。

Phase 2 / Phase 3の実装PRでは、この文書を参照し、dry-run結果を採用済みと誤解させず、Git boundaryとstop conditionを守れる。

## Safe fallback outcome

dry-run手順が広がりすぎる場合は、次だけを正本として残す。

```txt
dry-runは実生成しない確認
pending / running / done / failed の意味
done は ready / adopted ではない
API key不要
実job JSON / generated output / manifest draft / local logs / dist はcommitしない
エラー時は止める
```

このfallbackでも、runner / bridge実装、API接続、生成処理、ready / adopted promotion自動化は行わない。

## Out of scope

- runner実装
- bridge実装
- App Server実装
- watcher実装
- job processor実装
- API接続
- UI実装
- 画像生成
- narrative生成
- API key要求
- 実job JSON commit
- generated output commit
- manifest draft commit
- local logs commit
- 商用利用、再配布、第三者提供前提
- ready / adopted promotion自動化
- Passport schema変更
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` 変更

## One-line Codex resume instruction

```bash
codex "docs/operations/codex-sidekick-dry-run-walkthrough-nontechnical.md を読み、非技術者向けのSidekick dry-run walkthroughを正本として扱い、runner / bridge / API / generationは実装せず、docs-onlyで検証まで完了してください。"
```
