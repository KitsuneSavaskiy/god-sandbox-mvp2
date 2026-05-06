# Sprint8 Done Report

状態: Sprint8 closeout summary

## Purpose

Sprint8でmainに入った成果と、次Sprintの最初に着手するdocs-first候補をPO向けに整理する。

この文書は実装指示ではない。次Sprint開始時に、どの正本文書を先に整えるべきかを迷わないためのcloseout記録である。

## Sprint8 Done Summary

Sprint8では、event-first sandbox、Eve sprite ready化、time-season HUD、asset Sidekick、narrative Sidekick、generated content fallback、Git hygiene closeoutを整備した。

次Sprintでは、これらの正本文書を前提に、非技術者のプレイヤーやPOが新キャラクター追加後の流れを理解できるようにする。

## Next Sprint First Docs-First Candidate

PBI:

```txt
PBI-DOC-NONTECH-CHARACTER-CREATION-SIDEKICK-HANDOFF-001
```

目的:

非技術者のプレイヤーやPOが、新しいキャラクターをGodSandboxに追加し、asset生成候補、Character Passport、外部ゲーム連携、ChatGPTプロジェクトでのロールプレイ利用まで、何を準備して、どのUIを操作し、どのファイルをどこへ渡すのかを理解できるようにする。

## Scope For Next Sprint

変更候補:

- `docs/product/new-character-addition-guide.md`
- `docs/operations/codex-sidekick-local-setup-nontechnical.md`
- `docs/product/character-passport-external-use-guide.md`
- `docs/developer/character-passport-and-asset-integration-guide.md`
- `docs/product/generated-content-nontechnical-glossary.md`

優先順:

1. `docs/product/new-character-addition-guide.md`
2. `docs/operations/codex-sidekick-local-setup-nontechnical.md`
3. `docs/product/character-passport-external-use-guide.md`
4. `docs/developer/character-passport-and-asset-integration-guide.md`
5. `docs/product/generated-content-nontechnical-glossary.md`

## Required Emphasis

- ユーザーは何を準備するのか。
- どの画面で何を入力するのか。
- 入力後に何が起きるのか。
- assetやnarrativeが未生成の時はどうなるのか。
- Codex Sidekickは何を助けるのか。
- APIキーや従量課金なしでどこまでできるのか。
- Codex Sidekickは、APIキー連携や従量課金APIを前提にせず、ChatGPT / Codex のサブスク範囲内での個人利用を前提に説明する。
- 商用利用、再配布、第三者提供はこの導線の前提にしない。必要な場合は、各サービス規約、素材権利、プロジェクト方針を別途確認する。
- Character Passportを外部でどう使うのか。
- 後続ゲーム開発者は何を見ればよいのか。
- 非技術者がCLIやCodexで詰まらないようにするには何を説明すべきか。

## Out Of Scope For Sprint8 Closeout

- 初回チュートリアルの大改修
- UI実装
- tutorial実装
- domain変更
- Passport schema変更
- Codex App Server本体実装
- APIキー入力UI
- 画像生成API呼び出し
- 商用利用や再配布の許諾判断
- 実asset生成
- 実narrative生成

## One-Line Next Sprint Resume Instruction

```bash
codex "Create the docs-first PBI PBI-DOC-NONTECH-CHARACTER-CREATION-SIDEKICK-HANDOFF-001, explain new character creation, Codex Sidekick local setup, Character Passport external use, developer handoff, and generated content glossary for non-technical users, and test until complete."
```
