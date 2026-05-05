# 生成素材のGit管理ルール

状態: Sprint8 運用ルール

## 目的

ChatGPT / Codex などの外部補助で作った画像素材を、未採用のまま Git に混ぜないためのルールです。

GodSandbox は、アプリ内から画像生成 API を直接呼びません。
生成した素材は人間が確認し、採用したものだけを決められた場所へ置きます。

## Git管理するもの

Git 管理してよいものは、次に限定します。

- `.prompts/**` の生成用 prompt
- 採用済みの manifest
- 採用済みの sprite sheet
- 採用済みの portrait / expression 画像
- 採用理由や確認結果を書いた短い Markdown

採用済み画像とは、ゲーム内の manifest または read model から参照される前提になった画像です。
見た目を試しただけの画像は採用済みではありません。

## Git管理しないもの

次は Git 管理しません。

- `incoming`: 生成直後で、まだ採用判断していない素材
- `tmp`: 切り出し、確認、変換の途中で使う一時素材
- `rejected`: 不採用にした素材
- white matte、背景残り、別人化などで使わない素材
- 個人PCの絶対パスを書いたメモ
- secret / API key / token を含むファイル

`.gitignore` では、次の作業置き場を Git 管理外にします。

```text
.asset-pipeline/
asset-pipeline/incoming/
asset-pipeline/tmp/
asset-pipeline/rejected/
public/art/**/incoming/
public/art/**/tmp/
public/art/**/rejected/
public/art/**/_incoming/
public/art/**/_tmp/
public/art/**/_rejected/
```

## 推奨フォルダ

未採用素材は、repository の外か、Git 管理外の作業フォルダに置きます。

例:

```text
asset-pipeline/
  incoming/
  tmp/
  rejected/
```

または:

```text
.asset-pipeline/
  incoming/
  tmp/
  rejected/
```

このフォルダはローカル作業用です。
PR に含めません。

## 採用までの流れ

1. `.prompts/**` の prompt を使って、外部の ChatGPT / Codex で素材を生成する。
2. 生成直後の素材を `incoming` に置く。
3. 切り出しや確認が必要なら `tmp` で作業する。
4. 不採用素材は `rejected` に移す。
5. 採用する素材だけを `public/art/**` の正規保存先へ移す。
6. 採用済み manifest または read model の参照と一致しているか確認する。
7. PR 前に `git diff --name-only origin/main...HEAD` で未採用素材が入っていないか確認する。

## 採用済み素材の条件

採用済みとして Git に入れる前に、少なくとも次を確認します。

- manifest または read model から参照される保存先にある。
- ファイル名が命名規則に合っている。
- 未生成 placeholder と本物素材が混ざっていない。
- 個人パス、secret、API key、token が含まれていない。
- 画像生成の途中ファイルではない。

## PR前チェック

PR 前に次を確認します。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
```

見ること:

- `incoming` / `tmp` / `rejected` が changed files に入っていない。
- `.prompts/**` は prompt として必要なものだけ入っている。
- `public/art/**` に入る画像は採用済みだけである。
- 個人PCの絶対パス、secret、API key、token が入っていない。

## 判断

生成素材は、作った時点では Git 管理しません。

Git 管理するのは、prompt と、採用済みとして参照先が決まった素材だけです。
