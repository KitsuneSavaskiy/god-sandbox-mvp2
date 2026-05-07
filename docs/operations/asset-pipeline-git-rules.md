# 生成素材のGit管理ルール

状態: Sprint8 運用ルール

## 目的

ChatGPT / Codex などの外部補助で作った画像素材を、未採用のまま Git に混ぜないためのルールです。

この文書では、GodSandbox が最初から同梱するデフォルト素材と、プレイヤーがアップロードするユーザー固有素材を分けます。

GodSandbox は、アプリ内から画像生成 API を直接呼びません。
生成した素材は人間が確認し、採用したものだけを決められた場所へ置きます。

## 呼称

この運用は、**APIキー不要・従量課金なしのサブスク前提ローカルasset pipeline** と呼びます。

ここでの意味は、ChatGPT などの外部サービスを人間が別画面で使い、生成物をローカル作業フォルダで確認してから、採用済み素材だけを Git 管理へ入れる流れです。
GodSandbox 本体から画像生成 API を呼ぶ設計ではありません。

## 素材の区分

| 区分 | 例 | Git管理 |
| --- | --- | --- |
| デフォルト同梱素材 | 初期住民、使徒、公式背景、公式採用 sprite | 管理してよい |
| 公式採用 asset | manifest / read model から参照される標準素材 | 管理してよい |
| ユーザーアップロード素材 | プレイヤーが追加した新キャラ画像、個別 portrait、個別 sprite | 管理しない |
| 生成途中素材 | `incoming` / `tmp` / `rejected` | 管理しない |

デフォルト同梱素材は、repository に含めて配布する公式素材です。
ユーザーアップロード素材は、各ユーザーのローカル保存領域だけに置きます。
ユーザー固有の portrait / sprite / expression を Git に入れません。

## Git管理するもの

Git 管理してよいものは、次に限定します。

- `.prompts/**` の生成用 prompt
- デフォルト同梱素材の manifest
- デフォルト同梱素材の sprite sheet
- デフォルト同梱素材の portrait / expression 画像
- 公式採用 asset としてレビュー済みの sprite / portrait / expression
- 採用理由や確認結果を書いた短い Markdown

ここでの採用済み画像とは、GodSandbox が最初から同梱する素材、または公式 asset としてレビューされ、ゲーム内の manifest / read model から参照される前提になった画像です。
見た目を試しただけの画像は採用済みではありません。
プレイヤーが自分の箱庭へ追加した画像は、見た目が確定していても Git 管理対象にはしません。

## Git管理しないもの

次は Git 管理しません。

- プレイヤーがアップロードした新キャラ画像
- ユーザー固有の portrait / sprite / expression
- ユーザーが自分用に生成した画像
- `incoming`: 生成直後で、まだ採用判断していない素材
- `tmp`: 切り出し、確認、変換の途中で使う一時素材
- `rejected`: 不採用にした素材
- `user-uploads`: プレイヤーが自分の箱庭へ追加した素材
- `assets/generated/**`: ローカル生成作業用の素材置き場
- `assets/residents/**`: ローカル確認用の住民素材置き場
- `.hatch-pet-runs/**`: hatch-pet のローカル実行出力
- `manifests/residents.json`: ローカル作業用 placeholder manifest
- `.godsandbox/jobs/**`: ローカル制作依頼の実job
- `narrative/generated/**`: ローカル生成作業用の物語候補置き場
- white matte、背景残り、別人化などで使わない素材
- 個人PCの絶対パスを書いたメモ
- secret / API key / token を含むファイル

`.gitignore` では、次の作業置き場を Git 管理外にします。

```text
.asset-pipeline/
asset-pipeline/incoming/
asset-pipeline/tmp/
asset-pipeline/rejected/
asset-pipeline/user-uploads/
assets/generated/
assets/residents/
.hatch-pet-runs/
manifests/residents.json
.godsandbox/jobs/
narrative/generated/
public/art/**/incoming/
public/art/**/tmp/
public/art/**/rejected/
public/art/**/_incoming/
public/art/**/_tmp/
public/art/**/_rejected/
public/art/**/user-uploads/
public/art/**/_user-uploads/
```

## 推奨フォルダ

未採用素材とユーザーアップロード素材は、repository の外か、Git 管理外の作業フォルダに置きます。

例:

```text
asset-pipeline/
  incoming/
  tmp/
  rejected/
  user-uploads/
```

または:

```text
.asset-pipeline/
  incoming/
  tmp/
  rejected/
  user-uploads/
```

このフォルダはローカル作業用です。
PR に含めません。

## 正本manifestとローカルplaceholder

`manifests/residents.json` は、ローカル作業で住民素材の候補を整理するための placeholder です。
正本manifestとして commit しません。

採用済みのデフォルト住民素材は、次のように分けて扱います。

- 画像本体: `public/art/characters/defaults/...`
- 既定素材の参照: `src/persistence/**` の default manifest / read model

つまり、`manifests/residents.json` は採用済みassetの正本ではありません。
採用済みassetへ昇格する場合は、別PBIで画像保存先と `src/persistence/**` の参照を明示します。

## Codex job queueとsample JSON

`.godsandbox/jobs/**` は、将来の Codex Sidekick / Codex automation / Codex CLI が読むローカルjob queueです。
実jobにはsource画像の場所、ローカル生成物の場所、作業メモが入りうるため、Git管理しません。

Git管理してよいのは、個人情報を含まないsample JSONだけです。

```text
docs/operations/examples/codex-jobs/*.json
```

job queueのlifecycle、生成物置き場、`source` / `incoming` / `draft` / `adopted` の違いは `docs/operations/codex-job-queue.md` を正本とします。

## 採用までの流れ

デフォルト同梱素材または公式採用 asset の場合:

1. `.prompts/**` の prompt を使って、外部の ChatGPT / Codex で素材を生成する。
2. 生成直後の素材を `incoming` に置く。Windowsでは `tools/asset-pipeline/import-resident-sprite-source.bat <id>` を使うと、保存先を覚えなくてもPNGを取り込める。
3. 切り出しや確認が必要なら `tmp` で作業する。
4. 不採用素材は `rejected` に移す。
5. 採用する素材だけを `public/art/**` の正規保存先へ移す。
6. 採用済み manifest または read model の参照と一致しているか確認する。
7. PR 前に `git diff --name-only origin/main...HEAD` で未採用素材が入っていないか確認する。

取り込みhelperは、選んだPNGを `assets/generated/residents/<id>/incoming/` へコピーするだけです。
validator、processor、manifest更新、採用済みassetへの昇格は行いません。
コピー後のPNGもGit管理外です。

プレイヤーがアップロードした新キャラ画像の場合:

1. ユーザーのローカル保存領域に置く。
2. Git 管理対象の `public/art/**` へ直接入れない。
3. PR に含めない。
4. 将来、公式同梱素材へ昇格する場合は、別PBIでレビューし、採用理由と保存先を明記する。

## 採用済み素材の条件

デフォルト同梱素材または公式採用 asset として Git に入れる前に、少なくとも次を確認します。

- manifest または read model から参照される保存先にある。
- ファイル名が命名規則に合っている。
- 未生成 placeholder と本物素材が混ざっていない。
- 個人パス、secret、API key、token が含まれていない。
- 画像生成の途中ファイルではない。
- ユーザー固有のアップロード素材ではない。

## PR前チェック

PR 前に次を確認します。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
```

見ること:

- `incoming` / `tmp` / `rejected` が changed files に入っていない。
- `assets/generated/**` / `assets/residents/**` / `manifests/residents.json` が changed files に入っていない。
- `.godsandbox/jobs/**` の実jobが changed files に入っていない。
- `narrative/generated/**` の生成候補が changed files に入っていない。
- `.prompts/**` は prompt として必要なものだけ入っている。
- `public/art/**` に入る画像はデフォルト同梱素材または公式採用 asset だけである。
- プレイヤーがアップロードした新キャラ画像が入っていない。
- 個人PCの絶対パス、secret、API key、token が入っていない。

## Codex Enablement skillとの境界

`.agents/skills/**` は、Codex Enablement 用の別PBIで管理します。
この文書は、asset pipeline の Git 管理ルールだけを扱います。

## 判断

生成素材は、作った時点では Git 管理しません。

Git 管理するのは、prompt と、デフォルト同梱素材または公式採用 asset として参照先が決まった素材だけです。
プレイヤー固有の画像は、採用済みのように見えても Git 管理しません。
