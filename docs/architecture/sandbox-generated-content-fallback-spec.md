# Sandbox generated content fallback spec

状態: Sprint8 仕様詳細化

## Purpose

この文書は、生成 asset や narrative pack が未生成、失敗、review 待ちでも、`/sandbox` とイベント体験が止まらないための fallback 仕様を定義する。

Line 4 は event-first sandbox、tutorial、narrative、motion display の体験を担当する。ただし、この PBI では実装を増やさず、将来の Codex Sidekick / Codex App Server / Codex automation 連携に備えて、GodSandbox 本体が生成物をどう消費するかだけを固定する。

## Current context

- Eve sprite sheet は visual correctness 不合格のため、Sprint8 時点では fallback / rejected 扱いにする。
- Eve を ready に戻す作業は Line 2 / Issue #121 の `PBI-ASSET-EVE-SPRITE-VISUAL-REGEN-001` に集中させる。
- PR #120 で visual audit gate が追加され、壊れた sprite を ready のまま残さない方針が入った。
- Sprint8 では App Server 本体、watcher、job runner、画像生成 API 呼び出しを実装しない。
- GodSandbox 本体は Codex 生成完了を gameplay に同期させない。

## Source of truth

生成物の採用状態は、manifest / read model が正本である。

UI は次を見て表示を決める。

- resident sprite manifest の `ready | placeholder | rejected | missing`
- character asset bundle の portrait / icon fallback
- event data の deterministic summary
- narrative pack の採用状態

UI は `incoming`、`tmp`、`rejected`、`user-uploads`、ローカル draft manifest を直接読まない。

## Asset fallback

Sandbox での sprite sheet 表示は次の状態で分ける。

| 状態 | Sandbox 表示 | ルール |
| --- | --- | --- |
| `ready` | visual audit、人間確認、PO visual OK 済みの sprite を表示する | ready のみ sprite sheet として扱う |
| `placeholder` | portrait / icon / placeholder fallback を表示する | 未生成でも game は止めない |
| `rejected` | fallback を表示する | 壊れた sprite は表示しない |
| `missing` | fallback を表示する | manifest entry がなくても起動不能にしない |

Eve の現状:

- Eve は PR #120 後、visual correctness 不合格のため ready ではなく fallback / rejected として扱う。
- Issue #121 で再生成し、visual audit と PO visual OK を通るまで ready に戻さない。
- Eve が fallback の間も、Garan / Ryo / Suzu と同じように portrait / icon / placeholder で表示できる。

## Narrative fallback

Narrative pack は、イベント体験を豊かにする補助情報であり、gameplay の同期条件ではない。

| 状態 | Event UI 表示 | ルール |
| --- | --- | --- |
| `narrative-ready` | voice profile、dialogue lines、event seeds、intervention responses を補助表示に使える | deterministic event data を置き換えない |
| `narrative-missing` | 既存の event summary、situation tags、intervention result 文で進行する | narrative がなくてもイベントは進む |
| `narrative-rejected` | 既存テンプレート fallback を使う | 壊れた自由文を表示しない |
| `narrative-pending` | Codex の返答を待たず、既存 fallback で進行する | 生成待ちで UI を止めない |

Narrative fallback の最低要件:

- `いまの出来事` は既存 event summary で読める。
- イベント子画面の `見守る / 助ける / 試練` は narrative pack がなくても押せる。
- 介入後の結果は deterministic result 文で表示できる。
- richer narrative がある場合も、story log や補助 surface に留める。

## Gameplay async rule

Codex 生成完了を gameplay は同期的に待たない。

ルール:

- 生成物が来ていて、採用状態が `ready` なら使う。
- 生成物がない、失敗した、review 待ちなら fallback で進む。
- `waiting-for-codex` は UI の補助状態であり、event pause 理由にしない。
- Codex 側の job が失敗しても、`/sandbox` は起動不能にならない。
- GodSandbox 本体から画像生成 API を呼ばない。
- API key 入力 UI を作らない。

## Event pause rule

Pause は gameplay と UI の明確な状態にだけ紐づける。

Pause する状態:

- `eventWindowOpen`
- `latestOutcome`

Pause するもの:

- 住民 motion
- 背景時間進行
- 必要に応じた使徒追従演出

Pause しない理由:

- Codex 生成待ち
- narrative pack pending
- sprite sheet pending
- job queue pending

Codex 生成待ちの間も、既存 fallback で箱庭とイベントは進行できる。

## Sandbox label visibility

箱庭上では没入感を優先する。

表示してよいもの:

- 住民アニメーション本体
- portrait / icon / placeholder fallback
- コメントバブル
- イベント発生時の `!`
- 必要最小限の感情アイコン

表示しないもの:

- キャラ名
- 場所名
- `泉のほとり` などの地点ラベル
- `主役`
- `脇役`
- `見守り中`
- 活力、調和などの数値ラベル

具体情報は CharacterDetailPanel、住民画面、Passport 側で確認する。

## UI confirmation points

Line 4 の sandbox / event UI では、次を確認する。

- `/sandbox` desktop
- `/sandbox` 390px
- `/sandbox` 360px
- sprite fallback が表示できる
- narrative fallback でもイベントが読める
- `eventWindowOpen` / `latestOutcome` の pause が維持される
- `見守る / 助ける / 試練` が維持される
- CharacterDetailPanel 導線が維持される
- 箱庭上にキャラ名、場所、状態ラベルが戻っていない
- 死亡、寿命、勲章が戻っていない

## Preferred outcome

- `ready` な generated asset / narrative pack は自然に補助表示へ使える。
- 未生成、失敗、review 待ちの場合でも `/sandbox` とイベントは止まらない。
- PO visual OK がない sprite は ready として表示されない。
- Codex 生成は外部補助のままで、GodSandbox 本体は manifest / read model だけを見る。

## Safe fallback outcome

- 壊れた generated asset は fallback / rejected として扱う。
- 壊れた narrative pack は deterministic template fallback に戻す。
- 生成物がなくても、portrait / icon / placeholder と既存 event summary で遊べる。
- Sprint8 内では App Server 連携や gameplay 同期生成に進まない。

## Out of scope

- EventFirstSandbox の実装修正
- Codex App Server 本体
- watcher / job runner
- 画像生成 API 呼び出し
- API key UI
- public asset 追加
- `assets/generated/**` の commit
- domain / persistence 変更
- Passport schema 変更
- 本格自由移動 AI
- 3D engine
- 箱庭上のキャラ名、場所、状態ラベル復活
- 死亡、寿命、勲章の復活

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/sandbox-generated-content-fallback-spec.md, refine the sandbox generated-content fallback specification exactly, keep it docs-first, and test until complete."
```
