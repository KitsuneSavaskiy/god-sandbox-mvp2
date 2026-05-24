# New character Sidekick tutorial spec

Status: Sprint9 UI implementation spec

## Purpose

初見のユーザーが、新しい住民を追加したあとに Codex サイドキックが何を助けるのかを理解できるようにする。

このチュートリアルは、箱庭アニメや立ち絵の制作候補を作る流れを説明する。GodSandbox 本体が画像生成 API を直接呼ぶ導線ではない。

## User problem

新しい住民の追加画面では、ユーザーが次を誤解しやすい。

- 保存した瞬間に箱庭の4人が入れ替わる。
- 保存した瞬間に画像候補が採用済みになる。
- Codex サイドキックがないとゲームが動かない。
- API key や従量課金設定が必要になる。
- どの画面で何をすればよいか分からない。

## Tutorial goal

ユーザーが次を理解できれば完了とする。

- 新しい住民はまず住民一覧に入る。
- 箱庭の4人への入れ替えは、あとで自分で選ぶ。
- 見た目画像、名前、性格、口調、年齢が制作依頼のもとになる。
- Codex サイドキックは、ローカルで箱庭アニメや立ち絵候補の準備を助ける。
- 候補は採用済みではなく、人間が確認してから使う。
- サイドキックがなくても、通常画像と標準文で遊べる。

## UI surfaces

### New character tutorial

場所: `/character-editor/new` の初回表示前。

表示する内容:

1. 入力するもの
   - 名前
   - 見た目画像
   - 性格
   - 口調
   - 年齢
2. 保存後に起きること
   - 住民一覧に追加される。
   - サイドキック設定済みなら、制作依頼がローカル作業フォルダへ渡る。
   - 箱庭アニメや立ち絵候補は確認待ちになる。
3. 起きないこと
   - 箱庭の4人は自動で入れ替わらない。
   - 候補は自動採用されない。
   - サイドキック待ちでゲームは止まらない。

主要ボタン:

- `入力を始める`
- `サイドキック設定を見る`
- `箱庭へ戻る`

### Character editor

場所: 新規作成モードの入力フォーム。

追加する補助表示:

- サイドキック接続済みの場合、保存すると制作依頼が作られることを説明する。
- 未接続の場合、先にサイドキック設定を開けるボタンを出す。
- どちらの場合も、候補は確認してから使うことを明記する。

### Sidekick setup

場所: `/sidekick-setup`

追加する説明:

- サイドキックは GodSandbox 本体とは別に動くローカル補助役である。
- 初回はウォッチャー起動とフォルダ接続が必要である。
- 保存後は、制作依頼と見た目画像がローカル作業フォルダに渡る。
- 候補は確認待ちであり、自動で ready にはならない。

## Copy rules

ユーザー向け UI では、次の内部語を主表示にしない。

- `assetBundleId`
- `characterId`
- `job queue`
- `candidate`
- `ready promotion`
- `manifest`

必要な場合は次のように言い換える。

| Internal word | User-facing copy |
| --- | --- |
| job | 制作依頼 |
| candidate | 候補 |
| ready | 準備済み |
| fallback | 通常画像で遊べます |
| Codex Sidekick | Codex サイドキック |

## Required guardrails

- GodSandbox 本体から画像生成 API を呼ばない。
- API key 入力 UI を作らない。
- Codex 生成待ちで gameplay を止めない。
- 候補を自動で ready にしない。
- 実 job JSON、generated output、local logs、`dist/**` を commit しない。
- Passport schema を変更しない。

## Acceptance criteria

- 初回ユーザーが、作成から候補確認までの流れを1画面で把握できる。
- サイドキック設定画面へ移動できる。
- サイドキック未接続でも、住民作成を続けられると分かる。
- 保存後に箱庭の4人が自動入れ替えされないと分かる。
- 候補が自動採用されないと分かる。
- 390px / 360px 幅でボタンが折り返して読める。

## Out of scope

- #318 の App Server / Gen2 bridge 実装。
- watcher / job processor 実装。
- 画像生成処理。
- 生成候補の review UI。
- ready promotion。
- Passport schema 変更。

## Testing

```bash
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```
