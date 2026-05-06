# Sandbox generated content state matrix

状態: Sprint8 docs-first 仕様

## Purpose

この文書は、generated asset と generated narrative の状態ごとに、`/sandbox` とイベントUIがどう振る舞うべきかを定義する。

目的は、Codex Sidekick や asset pipeline が未完成でも、GodSandbox本体の箱庭とイベント体験を止めないことにある。

このPBIでは `EventFirstSandbox` の実装修正、Eve sprite再生成、sprite ready化は行わない。Line 2 の Issue #121 は Eve sprite visual regen に集中し、Line 4 は fallback とQA観点を仕様として固定する。

## Source of truth

UIは次を正本として見る。

- current resident sprite manifest / read model の asset状態: `missing | placeholder | rejected | ready`
- future generated content / job review layer の補助状態: `pending | needs-review`
- narrative解決状態: narrative pack または将来の narrative job review layer の `missing | pending | needs-review | rejected | adopted`
- gameplay状態: `focusedEvent`、`eventWindowOpen`、`latestOutcome`

UIは次を直接読まない。

- `assets/generated/**`
- `assets/residents/**`
- `manifests/residents.json`
- `incoming`
- `tmp`
- `rejected`
- `.godsandbox/jobs/**` の実job

## Asset state matrix

現行の resident sprite manifest / read model が持つ状態は `missing | placeholder | rejected | ready` である。

`pending` と `needs-review` は、現行manifest状態ではなく、将来の generated content / job review layer が持つ補助状態として扱う。sandbox はそれらの補助状態を見ても gameplay を止めず、manifest上は `placeholder` または `rejected` 相当のfallback表示で進む。

| state | state owner | sandbox behavior | 表示してよいもの | 表示してはいけないもの |
| --- | --- | --- | --- |
| `missing` | current manifest / read model | portrait / icon / placeholder fallbackで表示する | 通常画像、placeholder、コメントバブル、`!` | 壊れたsprite、内部状態名 |
| `placeholder` | current manifest / read model | portrait / icon / placeholder fallbackで表示する | 通常画像、placeholder、コメントバブル、`!` | sprite ready風の表示 |
| `pending` | future job review layer | fallbackで進行する。生成待ちでpauseしない | 通常画像、placeholder、短い補助表示 | 生成待ちロック、進行停止 |
| `needs-review` | future job review layer | fallbackで進行する。候補spriteはまだ表示しない | 通常画像、placeholder、必要なら詳細画面側の確認待ち表示 | 未確認spriteの箱庭表示 |
| `rejected` | current manifest / read model | fallbackで進行する。壊れたspriteは表示しない | 通常画像、placeholder、コメントバブル、`!` | rejected sprite、壊れたframe |
| `ready` | current manifest / read model | visual audit / human review / PO visual OK済みspriteを表示できる | 採用済みsprite、コメントバブル、`!` | 未検査sprite、未採用候補 |

### Eve current rule

Eve sprite sheet は Sprint8 の visual correctness blocker を経て、PO visual OK まで ready に戻さない。

Eveが `ready` でない間は、他の住民と同じように portrait / icon / placeholder fallbackで表示する。

## Narrative state matrix

| narrative state | event behavior | 表示してよいもの | 表示してはいけないもの |
| --- | --- | --- | --- |
| `missing` | 既存event summary / situation tags / deterministic result文を使う | 標準イベント文、標準結果文 | Codex待ちの停止表示 |
| `pending` | 既存文言で進行する。Codex待ちでpauseしない | 標準イベント文、標準結果文 | 未採用narrative候補 |
| `needs-review` | 既存文言で進行する。候補はまだ使わない | 標準イベント文、標準結果文 | review前の自由文 |
| `rejected` | 既存文言で進行する | 標準イベント文、標準結果文 | rejected narrative |
| `adopted` | 採用済みnarrative packを補助表示に使える | 採用済み発話、story log候補、介入反応候補 | gameplay正本を置き換える自由文 |

Narrative pack は補助表示であり、`WorldEvent` の正本や intervention result の正本を置き換えない。
`ready` は asset lifecycle の状態語であり、narrative pack の採用状態には使わない。
UIでは、asset `ready` と narrative `adopted` のどちらも、必要に応じて「準備済み」と表示してよい。
`fallback` は narrative lifecycle ではなく、採用済みpackがない時に標準文へ戻すruntime / display解決である。

## Pause matrix

Pauseする状態:

| 状態 | pause対象 | 理由 |
| --- | --- | --- |
| `eventWindowOpen` | 住民motion、背景時間進行、必要に応じた使徒追従 | プレイヤーがイベント判断中のため |
| `latestOutcome` | 住民motion、背景時間進行、必要に応じた使徒追従 | 介入結果を読ませるため |

Pauseしない状態:

| 状態 | behavior |
| --- | --- |
| Codex生成待ち | fallbackで進行する |
| asset job `pending` | fallbackで進行する |
| narrative `pending` | 既存文言で進行する |
| generated content `needs-review` | 採用前なのでfallbackで進行する |
| job queue `pending` | gameplayとは同期しない |

Codex生成完了をgameplayは同期的に待たない。生成物が来ていて採用済みなら使い、なければfallbackで進む。

## 390px / 360px QA matrix

| 観点 | desktop | 390px | 360px |
| --- | --- | --- | --- |
| fallback表示 | 4名が見える | 横はみ出ししない | 横はみ出ししない |
| asset ready表示 | ready住民だけsprite表示 | frameが潰れない | frameが潰れない |
| `!` bubble | イベント参加者が分かる | 操作を隠さない | 操作を隠さない |
| comment bubble | 感情や気配だけ伝える | 大きすぎない | 大きすぎない |
| event window | `見守る / 助ける / 試練` が押せる | 押せる | 押せる |
| CharacterDetailPanel導線 | 住民クリックで開ける | 住民クリックで開ける | 住民クリックで開ける |
| narrative fallback | 標準文で読める | 標準文で読める | 標準文で読める |

## Sandbox label visibility

箱庭上に表示しないもの:

- キャラ名
- 場所名
- `主役`
- `脇役`
- `見守り中`
- 活力、調和などの数値
- `missing`、`placeholder`、`rejected`、`ready` などのmanifest内部状態名
- `pending`、`needs-review`、`adopted` などのjob review layer / narrative lifecycle内部状態名
- `incoming`、`tmp`、`manifest`、`ready promotion` などの運用語

箱庭上に表示してよいもの:

- 住民アニメーション本体
- portrait / icon / placeholder fallback
- コメントバブル
- イベントの `!`
- 必要最小限の感情アイコン

## Safe fallback rules

壊れたasset:

1. readyから外す。
2. `rejected` または `placeholder` として扱う。
3. `/sandbox` では fallback を表示する。
4. PO visual OK を得るまで ready に戻さない。

壊れたnarrative:

1. 採用しない。
2. `rejected` または `needs-review` として扱う。
3. イベントUIでは既存文言fallbackを使う。
4. 生成待ちやreview待ちを gameplay pause 理由にしない。

## Ready / Done conditions

- asset状態ごとのsandbox挙動が表で分かる。
- narrative状態ごとのevent挙動が表で分かる。
- Codex生成待ちでgameplayを止めない方針が明確である。
- `eventWindowOpen` / `latestOutcome` のpauseは維持されている。
- 箱庭上ラベル非表示が明記されている。
- 実装ファイルを触っていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Out of scope

- `EventFirstSandbox` 実装修正
- Codex App Server接続
- 画像生成API呼び出し
- domain / persistence変更
- Passport schema変更
- 本格自由移動AI
- 3D engine
- 箱庭上ラベル復活
- Eve sprite ready化

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/sandbox-generated-content-state-matrix.md, refine the sandbox generated-content state matrix exactly, keep it docs-first, and test until complete."
```
