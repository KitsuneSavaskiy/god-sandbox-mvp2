# Sprint8 Retro

状態: Sprint8 retrospective note

## Purpose

Sprint8の振り返りとして、過去repoから現在repoへ取り込む教訓と、次Sprintで重点を置くべき非技術者向けhandoffを記録する。

## Past Repo Lesson

過去repoでは、初回UIやチュートリアルの分かりにくさが大きな課題だった。

現在repoでは、event-first UIと箱庭画面の見直しにより、初回体験は改善されている。

次に重点を置くべき課題は、新キャラクター追加後の体験である。

## Next Focus

非技術者のプレイヤーが、次を理解できるようにする必要がある。

- 何のファイルを準備するのか。
- どのUIを操作するのか。
- Codex Sidekickが何を作るのか。
- assetやnarrativeが未生成の時はどうfallbackするのか。
- Character Passportを外部ゲームやChatGPTプロジェクトでどう使うのか。
- 後続ゲーム開発者がPassportとassetをどう利用するのか。
- APIキー連携や従量課金APIを前提にせず、ChatGPT / Codex のサブスク範囲内での個人利用としてどう進めるのか。
- 商用利用、再配布、第三者提供をこの導線の前提にしないこと。

次Sprintでは、これをdocs-firstで整備する。

## Decision

Sprint8 closeoutでは大きな新規docs作成には入らない。

次Sprint最初のdocs-first候補として、次のPBIを扱う。

```txt
PBI-DOC-NONTECH-CHARACTER-CREATION-SIDEKICK-HANDOFF-001
```

このPBIは、GodSandboxのコア体験を非技術者に伝えるためのdocs-first作業であり、実装PBIではない。

次Sprintの非技術者向けhandoffでは、APIキー連携や従量課金APIを前提にせず、ChatGPT / Codex のサブスク範囲内での個人利用として説明する。

商用利用、再配布、第三者提供はこの導線の前提にしない。必要な場合は、各サービス規約、素材権利、プロジェクト方針を別途確認する。

## Keep Out

- 初回チュートリアルの大改修
- UI実装
- domain変更
- Passport schema変更
- Codex App Server本体実装
- APIキー入力UI
- 画像生成API呼び出し
- 商用利用や再配布の許諾判断
- 実asset生成
- 実narrative生成
