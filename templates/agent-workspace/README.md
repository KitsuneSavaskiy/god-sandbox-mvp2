# GodSandbox プレイヤー向け Agent Workspace テンプレート

このフォルダは、GodSandbox のプレイヤーが自分用にコピーして使う agent workspace テンプレートです。

GodSandbox 本体の開発フォルダではありません。

## 何に使うか

- 箱庭世界の設定を整理する。
- キャラクター情報をまとめる。
- 外部 ChatGPT や Claude へ渡す説明文の下書きを作る。
- Character Passport や soul file の下書きを `exports/` に作る。

## 使い方

1. この `templates/agent-workspace/` フォルダを、自分用の分かりやすい場所へコピーします。
2. Codex / Claude Code CLI などを、GodSandbox とは別アプリとして起動します。
3. その別アプリで、コピーしたフォルダを開きます。
4. 最初に `AGENTS.md` を読ませます。
5. 必要に応じて `world.md`、`characters/**`、`save/current-session.json` を更新します。

## フォルダ構成

```text
AGENTS.md
world.md
save/
characters/
events/
apostle-notes/
imports/
exports/
```
