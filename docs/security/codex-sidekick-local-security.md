# Codex Sidekick local security spec

Status: Sprint9 Phase 1 docs-first security gate

PBI: `PBI-SEC-CODEX-SIDEKICK-LOCAL-SECURITY-SPEC-001`

## Purpose

Codex Sidekick をローカル個人利用で安全に動かすための境界を定義する。

この文書は、Phase 2 の App Server bridge / runner 実装へ入る前の security gate である。
このPRでは、App Server、runner、watcher、job processor、API接続、UI、生成処理を作らない。

## Current failure

Sprint9では、Codex Sidekick、Codex App Server、runner、job queue、generated output を扱う予定がある。
この境界を先に決めないと、次の事故が起きやすい。

- API key、token、PAT、secret をdocsやPRに書いてしまう。
- 個人PCの絶対パスやローカルログを実job JSONへ入れ、そのままcommitしてしまう。
- Codex用repo、Claude監査用repo、SPECA run directory の役割を混同する。
- `.godsandbox/jobs/**` や generated output を、採用済み成果物のように扱ってしまう。
- ChatGPT / Codex サブスク範囲の個人利用を超えて、商用利用、再配布、第三者提供を前提にしてしまう。

## Final vision

Phase 2 実装前に、各Lineが次を判断できる。

- GodSandbox本体はAPI keyを要求しない。
- GodSandbox本体から生成APIを直接呼ばない。
- Sidekick運用に必要なtoken / secret / PAT / 個人パスをGit管理しない。
- Codex repo、Claude repo、SPECA run directory を混ぜない。
- 実job、generated output、local logs はGit管理外で扱う。
- 商用利用、再配布、第三者提供を前提にしない。

## Source of truth

この文書は、Codex Sidekick のlocal security境界の正本である。

合わせて読むdocs:

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/product/sprint9-planning.md`
- `docs/operations/codex-job-queue.md`
- `docs/operations/sprint8-closeout-git-hygiene.md`
- `docs/security/github-secret-scanning-setup.md`
- `docs/security/gitleaks-ci-precommit.md`
- `docs/security/trufflehog-scheduled-sweep.md`

## Required rules

### API key不要方針

GodSandbox本体は、API key入力UIを持たない。
GodSandbox本体は、画像生成API、文章生成API、外部AI APIを直接呼ばない。

Codex Sidekick は、ChatGPT / Codex サブスク範囲の個人利用を前提にした補助作業者として扱う。
従量課金API、外部API key、共有credentialを前提にしない。

Phase 2以降にbridgeやrunnerを実装する場合も、App ServerはGodSandbox本体の必須起動条件にしない。
App ServerやSidekickが使えない場合、GodSandbox本体はfallbackまたはdry-run方針で進む。

### token / secret / PAT をcommitしない

次はGit管理しない。

```txt
API key
access token
refresh token
PAT
OAuth credential
session cookie
private key
password
local auth state
personal path
secret入りlog
```

PR本文、Issue、review comment、docs、sample JSON、handoff文にも実値を書かない。
検出結果を共有する場合は、実値ではなく、検出種別、影響範囲、対応状況だけを書く。

誤検知か分からない場合は、まず「本物のsecretかもしれない」として扱う。
実値の可能性があるものは、placeholderへ置き換える。

### repo境界

Codex repo、Claude repo、SPECA run directory は混ぜない。

| 場所 | 役割 | Git管理 |
| --- | --- | --- |
| Codex repo | GodSandboxのPBI作業、docs、実装、PRを作る場所 | PBI scope内だけ管理 |
| Claude repo | 非同期監査、SPECA型レビュー、小修正PRの作業場所 | Codex repoへ直接混ぜない |
| SPECA run directory | 監査出力、run log、一次メモを置くローカル場所 | 実出力は管理しない |
| Sidekick local workspace | 実job、generated output、tmp、rejectedを扱う場所 | 実jobと生成物は管理しない |

Claude監査の出力をPRへ使う場合は、個人パス、secret、token、実job、生成物を含まない要約だけを書く。
SPECA出力の実ファイルを、確認なしにCodex repoへコピーしない。

### Git管理禁止のローカルSidekickデータ

次はGit管理しない。

```txt
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
failed job JSON with local details
result JSON with local details
```

これらは、実job、生成候補、一時出力、不採用候補、ユーザー入力、または個人環境に依存する情報を含みうる。
PRへ混ざった場合は、security / scope blockerとして扱う。

docs配下にsampleを書く場合は、実値を使わない。
sampleには個人PCの絶対パス、secret、API key、token、実ユーザー画像の場所を書かない。

### job result / failed の安全な扱い

`done` job は採用済みではない。
`failed` job は失敗理由であり、secretや個人パスを含めない。

runnerやbridgeが将来作るresult JSON / failed JSON は、次を守る。

- credential実値を書かない。
- 個人PCの絶対パスを書かない。
- API responseの生ログをそのまま残さない。
- source画像の実ローカルpathをPR本文やdocsへ写さない。
- `done` を asset `ready` や narrative `adopted` と同じ意味にしない。

生成物を `ready` / `adopted` にする判断は、別のreview gateとPO判断の後で扱う。
生成担当は、自分の生成物を `ready` / `adopted` にしない。

### local logs の扱い

local logs は原則Git管理しない。
必要な場合だけ、個人情報を含まない短い確認要約としてdocsやPR本文に書く。

書いてよいもの:

- 実行した確認コマンド名
- pass / fail
- secretを含まないエラー分類
- follow-upが必要な観点

書かないもの:

- 個人PCの絶対パス
- secret / token / API key / PAT
- auth cache
- user-uploadの場所
- source画像の実ローカルpath
- API responseの生ログ

### 個人利用前提

Sprint9 Phase 1のCodex Sidekick運用は、ChatGPT / Codex サブスク範囲の個人利用を前提にする。

この文書では、次を前提にしない。

- 商用利用
- 再配布
- 第三者提供
- 共有credential運用
- 有償API keyの投入
- 生成物の権利判断代行

商用利用、再配布、第三者提供が必要になった場合は、各サービス規約、素材権利、プロジェクト方針を別PBIで確認する。

## Ready / Done conditions

- Phase 2実装前のsecurity gateとして使える。
- API key不要方針が明確である。
- token / secret / PAT / 個人パスをcommitしない方針が明確である。
- Codex repo / Claude repo / SPECA run directory の境界が分かる。
- `.godsandbox/jobs/**`、generated output、local logs のGit管理禁止が再確認されている。
- ChatGPT / Codex サブスク範囲の個人利用前提が明記されている。
- 商用利用、再配布、第三者提供を前提にしていない。
- workflow、package、CI、credentials実装に入っていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

追加確認:

- changed filesが `docs/security/codex-sidekick-local-security.md` のみに閉じている。
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` を触っていない。
- `.agents/skills/**` を触っていない。
- 実job JSON、generated asset、generated narrative、manifest draftを追加していない。
- `dist/` をcommitしていない。
- 個人パス、secret、API key、tokenを書いていない。

## Preferred outcome

`docs/security/codex-sidekick-local-security.md` がmainへ入り、Phase 2のrunner / bridge実装者がsecurity境界を読んでから実装へ入れる。

Line 1 runner lifecycle、Line 2 bridge spec、Line 3 nontechnical setupは、この文書を安全境界として参照できる。

## Safe fallback outcome

security境界が広がりすぎる場合は、次だけを必須gateにする。

```txt
API key不要
secret / token / PAT / 個人パスをcommitしない
.godsandbox/jobs/** と generated output をcommitしない
Codex repo / Claude repo / SPECA run directory を混ぜない
個人利用前提
```

このfallbackでも、App Server、runner、watcher、job processor、API接続、UI、生成処理は作らない。

## Out of scope

- App Server実装
- runner実装
- watcher実装
- job processor実装
- API接続
- UI実装
- 生成処理
- APIキー入力UI
- credentials保存実装
- GitHub workflow変更
- package変更
- CI変更
- `.agents/skills/**` 変更
- `src/**` 変更
- `public/**` 変更
- `assets/**` 変更
- `manifests/**` 変更
- Passport schema変更
- ready promotion自動化
- adopted promotion自動化
- 商用利用や再配布の許諾判断

## One-line Codex resume instruction

```bash
codex "docs/security/codex-sidekick-local-security.md を読み、Sprint9 Phase 2 gateとしてCodex Sidekick local security仕様を整えてください。App Serverやrunnerは実装せず、検証まで完了してください。"
```
