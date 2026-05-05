# 生成workspace retention / cleanup / Git hygiene 仕様

状態: Sprint8 docs-first specification

## Purpose

Codex Sidekick、asset pipeline、narrative GM が作るローカル作業物について、保存期間、掃除方法、Git混入防止、handoff時の扱いを定義する。

この文書は実装手順ではなく、後続のtool、processor、job queue、narrative生成を安全に進めるための運用仕様である。

## Current failure

生成物の置き場所と残し方が曖昧なままだと、次の事故が起きやすい。

- 実job JSONや生成途中素材がPRに混ざる。
- `dist/` や一時ログが未追跡ファイルとして残り、監査時にノイズになる。
- 別Codexへhandoffするとき、何を残せばよいか分からない。
- 個人PCのパス、source画像の場所、ローカル生成物pathをdocsやPR本文に書いてしまう。

今回のPBIでは、これらを実装ではなくdocs-firstで整理する。

## Final vision

Line作業者と監査役が、生成workspace内のファイルを見たときに、次を判断できる状態にする。

- Git管理してよいものか。
- 削除してよい一時物か。
- PO確認やhandoffのために短期間だけ残す候補か。
- 採用済み正本として扱えるものか。
- PR前に要約だけ `.logs/` やdocsへ残せばよいものか。

## Source of truth

この文書は、生成workspaceの保存・掃除・handoff・Git hygieneの正本である。

関連する既存ルールは次を参照する。

- `docs/operations/asset-pipeline-git-rules.md`
- `docs/operations/local-asset-pipeline-folders.md`
- `docs/operations/resident-sprite-pipeline.md`
- `.agents/skills/godsandbox-doc-driven-task-runner/references/safety-checklist.md`

## Required rules

### 生成workspace分類

| 分類 | 意味 | 例 | Git管理 |
| --- | --- | --- | --- |
| `temporary` | 一時処理ファイル。いつでも再生成できる。 | 切り出し途中、変換途中、検査用中間ファイル | しない |
| `candidate` | Codexや外部補助が作った候補。まだ正本ではない。 | incoming画像、narrative候補、sprite候補 | しない |
| `draft` | processorやGMが作ったmanifest / narrative候補。まだ正本ではない。 | manifest draft、story pack draft | しない |
| `adopted` | 人間確認とPO確認後に採用されたもの。 | 公式採用asset、正本manifest / read model | 管理してよい |
| `rejected` | 不採用。再利用しないが、短期間だけ調査用に残せる。 | 失敗sprite、背景残り画像、壊れたnarrative案 | しない |

`adopted` 以外は、原則としてGit管理しない。

### フォルダごとの扱い

| フォルダ | 入るもの | retention | cleanup | Git管理 |
| --- | --- | --- | --- | --- |
| `.godsandbox/jobs/**` | Codex Sidekickや将来のApp Serverが読む実job | 作業中だけ残す | PR前に実jobは消す。必要ならsampleだけdocsへ写す | しない |
| `assets/generated/**` | source画像、incoming画像、tmp画像、rejected画像 | 確認完了まで短期保存 | 採用・不採用判断後に整理する | しない |
| `assets/residents/**` | processor出力、ローカル確認用sprite、manifest draft | visual auditとPO確認まで短期保存 | 採用後も正本へ昇格しない限り削除可 | しない |
| `narrative/generated/**` | local generated narrative、story pack候補、event候補 | review完了まで短期保存 | 採用しない候補は削除する | しない |
| `manifests/drafts/**` | manifest draft、processor result、候補metadata | 採用判断まで短期保存 | 正本manifestへ反映後に削除可 | しない |
| `.logs/**` | 確認結果の短い要約、QAメモ | 必要な範囲だけ残す | 個人パスやsecretを含むログは残さない | 要約のみ可 |
| `dist/` | build出力 | 再生成できる | PR前に削除してよい | しない |

`.logs/**` は例外的に短い確認要約を残してよい。ただし、個人PCの絶対パス、source画像のローカルpath、secret、API key、token、認証情報は書かない。

### Git管理しないもの

次はGit管理しない。

- real job JSON
- source画像
- incoming画像
- tmp画像
- rejected画像
- user-upload素材
- local generated narrative
- manifest draft
- 個人パス入りログ
- `dist/`
- 認証cache
- secret / API key / token を含むファイル

### Git管理してよいもの

次はGit管理してよい。

- 採用済みdefault asset
- 採用済みofficial asset
- 正本docs
- 正本manifest / read model
- prompt
- script
- 個人情報を含まないsample JSON
- 個人情報を含まない確認結果Markdown

採用済みassetとは、人間確認、必要なvalidator、visual audit、PO確認を通り、保存先と参照先が決まった素材である。

## Cleanup rules

### PR前に消すもの

- `.godsandbox/jobs/**` の実job
- `assets/generated/**`
- `assets/residents/**`
- `narrative/generated/**`
- `manifests/drafts/**`
- `dist/`
- 個人パス入りログ
- source画像やuser-upload素材

### 残してよいもの

- 正本docs
- prompt
- script
- 採用済みdefault / official asset
- 正本manifest / read model
- 個人情報を含まないsample JSON
- 個人情報を含まない短いQA要約

### `.logs/` へ要約するもの

`.logs/` には、次のような短い結果だけを残す。

- 対象PBI
- 対象キャラ
- 実行した検査名
- 成功 / 失敗
- PO確認が必要か
- safe fallbackを使ったか

`.logs/` に、source画像の絶対パスやローカル生成物の個人pathを書かない。

### PO確認用に残すもの

PO確認が必要な場合でも、Gitには候補ファイルを入れない。

残す場合は、ローカルのGit管理外フォルダに置き、PR本文には次のように抽象的に書く。

```text
PO確認用の候補はローカル作業フォルダにあります。
Git差分には含めていません。
```

### 別Codexへhandoffする時に必要なもの

別Codexへhandoffする場合は、実ファイルではなく、次を残す。

- 正本docsのpath
- Issue / PR番号
- branch名
- PBI名
- 最新の確認結果
- preferred outcome
- safe fallback outcome
- 未解決の判断点
- 生成物がある場合は、Git管理外であること

必要な場合だけ、個人パスを含まないsample JSONを `docs/operations/examples/**` に置く。

## Untracked file handling

`git status --short` で `dist/` やローカル生成物が未追跡に出た場合は、次の順に扱う。

1. PBI成果物か確認する。
2. PBI成果物でなければcommitしない。
3. 再生成できるものなら削除してよい。
4. PO確認やhandoffに必要なら、Git管理外のまま残し、`.logs/` へ要約だけ書く。
5. 個人パスやsecretを含むものは、要約にも実値を書かない。

未追跡ファイルを削除する前に、そのファイルがユーザーの成果物ではないか確認する。

## Ready / Done conditions

- 生成workspace分類が定義されている。
- フォルダごとのGit管理方針が分かる。
- PR前に消すものと残してよいものが分かる。
- handoffに必要な情報が分かる。
- 個人パス、secret、API key、tokenを書かない方針が明確。
- 実装ファイル、asset、manifest、package、CIを変更していない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

docs-onlyのPBIでも、repoの基本確認としてtypecheckとbuildを実行する。

## Preferred outcome

`docs/operations/generated-workspace-retention-policy.md` が正本として追加され、後続Lineが生成物を扱うときに、Git管理する / しない、消す / 残す、handoffする / しないを判断できる。

## Safe fallback outcome

既存docsとの衝突や未merge PRとの用語差分がある場合は、この文書を新規docsに閉じる。

既存docsを書き換えず、後続PRで参照追記する。

## Out of scope

- cleanup script実装
- Codex App Server実装
- watcher実装
- job runner実装
- real job JSONのcommit
- asset生成
- asset ready promotion
- `assets/generated/**` のcommit
- `assets/residents/**` のcommit
- `dist/` のcommit
- `src/**` の変更
- `public/**` の変更
- `manifests/**` の変更
- `package*` の変更
- `.github/**` の変更

## One-line Codex resume instruction

```bash
codex "Read docs/operations/generated-workspace-retention-policy.md, refine the generated workspace retention and Git hygiene specification exactly, keep it docs-first, and test until complete."
```
