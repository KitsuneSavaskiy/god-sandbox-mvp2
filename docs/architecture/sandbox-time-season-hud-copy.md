# Sandbox Time / Season HUD Copy

Status: Sprint8 docs-first specification

PBI: `PBI-UX-SANDBOX-TIME-SEASON-HUD-COPY-FINALIZE-001`

Owner: Temporary Line / HUD copy finalization

## Purpose

箱庭左上に表示する時計・季節HUDの表示名、icon候補、短い文言ルールを定義する。

この文書は UI 実装ではない。Line 4 の `EventFirstSandbox` HUD 実装と矛盾しないよう、非技術者にも読みやすく、390px / 360px でも邪魔になりにくい表示へそろえるための文言仕様である。

## Current failure

現状の箱庭は、時間帯が背景の明暗変化としては見えるが、初見ユーザーには「今が朝なのか、夜なのか」「季節が進んでいるのか」が分かりにくい。

また、実装側の状態名をそのまま出すと、`morning`、`noon`、`spring` などの内部語が UI に混ざる可能性がある。

## Final vision

ユーザーは、箱庭左上を見るだけで、現在の時間帯と季節を短く理解できる。

推奨表示:

```txt
[時計] 朝  芽 春
```

表示は短く、説明文ではなく状態の読み取りを助ける補助HUDにする。

## Source of truth

この仕様は次を正本として扱う。

- UI状態モデル: `docs/architecture/ui-state-model.md`
- sandbox generated content fallback: `docs/architecture/sandbox-generated-content-fallback-spec.md`
- sandbox generated content state matrix: `docs/architecture/sandbox-generated-content-state-matrix.md`
- Line 3 の責務: `docs/architecture/line-responsibilities.md`

背景画像の有無とpathは、Line 2 の背景asset catalogを正本にする。

## Alignment with PR #144 implementation

PR #144 の HUD 実装は次の表示構造を使う。

- 時計は文字iconではなく、CSSで描く丸い時計と針で表す。
- 時間帯は `朝 / 昼 / 夕方 / 夜` の日本語ラベルだけを出す。
- 季節は `芽 / 日 / 葉 / 雪` の1文字iconと、`春 / 夏 / 秋 / 冬` の日本語ラベルを出す。
- HUDの読み上げは「箱庭の時間は朝、季節は春です」のように、日本語だけで説明する。
- 背景画像が不足した場合は `world_spring_noon.png` をfallbackにする。

この文書では、絵文字iconを必須にしない。#144 の実装表示である `芽 / 日 / 葉 / 雪` を標準候補として扱い、環境によって絵文字幅や色味が崩れるリスクを避ける。

## Required rules

- UI実装はこのPBIでは行わない。
- domain / persistence を変更しない。
- Passport schema を変更しない。
- Codex App Server に接続しない。
- 画像生成APIを呼ばない。
- API key UIを作らない。
- GodSandbox本体から生成APIを呼ばない。
- generated output / dist をcommitしない。
- 実時間連動、カレンダー、季節効果、季節イベント生成は扱わない。
- 季節ごとのdomain効果を入れない。
- 天候システムを入れない。
- 実asset生成をしない。
- 箱庭上にキャラ名、場所、状態ラベルを戻さない。
- `focusedEvent` 中心を壊さない。
- HUDには内部状態名を出さない。
- 390px / 360pxでも短く読める表示にする。

## Time phase labels

時間帯のユーザー向け表示名は次に統一する。

| Internal phase | User label | Short HUD copy | Notes |
| --- | --- | --- | --- |
| `morning` | 朝 | 朝 | 1文字で短く表示する。 |
| `noon` | 昼 | 昼 | 「正午」ではなく、やさしい表示の「昼」にする。 |
| `evening` | 夕方 | 夕方 | 2文字だが意味が伝わりやすい。 |
| `night` | 夜 | 夜 | 1文字で短く表示する。 |

UIには `morning`、`noon`、`evening`、`night` をそのまま出さない。

## Season labels

季節のユーザー向け表示名は次に統一する。

| Internal season | User label | Short HUD copy | Notes |
| --- | --- | --- | --- |
| `spring` | 春 | 春 | 初期状態の基準季節。 |
| `summer` | 夏 | 夏 | 短く表示する。 |
| `autumn` | 秋 | 秋 | `fall` ではなく `autumn` を内部候補にしても表示は「秋」。 |
| `winter` | 冬 | 冬 | 短く表示する。 |

UIには `spring`、`summer`、`autumn`、`winter` をそのまま出さない。

## Icon candidates

季節iconの推奨候補:

| Season | PR #144 icon | Optional alternate | Text fallback |
| --- | --- | --- | --- |
| 春 | 芽 | 🌱 | 春 |
| 夏 | 日 | ☀️ | 夏 |
| 秋 | 葉 | 🍁 | 秋 |
| 冬 | 雪 | ❄️ | 冬 |

時計iconの推奨候補:

| Phase | PR #144 icon behavior | Optional alternate | Text fallback |
| --- | --- | --- | --- |
| 朝 | CSS時計 | ◷ | 朝 |
| 昼 | CSS時計 | ◑ | 昼 |
| 夕方 | CSS時計 | ◕ | 夕方 |
| 夜 | CSS時計 | ● | 夜 |

絵文字が世界観や環境に合わない場合は、CSSで丸い紙片風iconや時計風の円を使ってよい。ただし、文字の「朝 / 昼 / 夕方 / 夜」「春 / 夏 / 秋 / 冬」は必ず残す。#144 と合わせる場合は、季節iconは `芽 / 日 / 葉 / 雪` を使う。

## Clock face marks and hands

時計HUDは、非技術者が見ても「時間が動いている」と分かる補助表示にする。

時計盤には、次の4つの目印を置く方針にする。

| Mark | User-facing meaning | Notes |
| --- | --- | --- |
| 0時 | 1日の区切りの目安 | 文字が詰まる場合は短い目盛りだけでもよい。 |
| 3時 | 右方向の目印 | 針の向きが読めるようにする。 |
| 6時 | 下方向の目印 | 小さい画面でも時計盤の上下が分かるようにする。 |
| 9時 | 左方向の目印 | 針が回っている感覚を助ける。 |

針は、短針と長針の2本を基本にする。

| Hand | User-facing meaning | Copy / a11y rule |
| --- | --- | --- |
| 短針 | 箱庭の時間帯がゆっくり進むことを表す。 | 読み上げでは角度ではなく、`朝 / 昼 / 夕方 / 夜` を伝える。 |
| 長針 | 現在のphase内で時間が進んでいることを表す。 | 読み上げで常に説明しない。動きが強すぎる場合は弱める。 |

時計の針は、実時間の時計ではなく箱庭内の演出時間を表す。
UI文言では「現在時刻」「実時間」「カレンダー」と誤解させない。

## Clock a11y

読み上げでは、内部状態名や時計角度を読ませない。

推奨読み上げ:

```txt
箱庭の時間は朝、季節は春です
箱庭の時間は昼、季節は夏です
箱庭の時間は夕方、季節は秋です
箱庭の時間は夜、季節は冬です
```

読み上げに含めないもの:

- `morning`
- `season`
- `backgroundCycleStep`
- 針の角度
- debug step
- `eventWindowOpen`
- `latestOutcome`

時計がpauseしている時も、HUDへ「停止中」「paused」などの長い文言を常時出さない。
必要なら、イベント子画面や結果表示側で短く補助する。

## Recommended HUD copy

基本形:

```txt
[時計] 朝  芽 春
```

季節と時間帯の組み合わせ例:

```txt
[時計] 朝  芽 春
[時計] 昼  日 夏
[時計] 夕方  葉 秋
[時計] 夜  雪 冬
```

390px / 360pxでさらに短くしたい場合:

```txt
朝 芽春
昼 日夏
夕方 葉秋
夜 雪冬
```

さらに詰まる場合は、季節iconを省略して次の文字表示に落としてよい。

```txt
朝 春
昼 夏
夕方 秋
夜 冬
```

## Words not shown in HUD

HUDには次の語を出さない。

- `morning`
- `noon`
- `evening`
- `night`
- `spring`
- `summer`
- `autumn`
- `winter`
- `phase`
- `season`
- `backgroundCycleStep`
- `paused`
- `eventWindowOpen`
- `latestOutcome`
- `asset`
- `manifest`
- debug用の数値step
- icon候補を内部状態の代わりに見せる場合でも、`芽 / 日 / 葉 / 雪` は装飾であり、正本状態名として扱わない

必要なら、開発者向けdebug表示は別の開発用surfaceに分ける。通常の箱庭HUDには出さない。

## Pause copy

イベント中に時計と背景時間がpauseしても、HUD上で「停止中」「paused」などを常時表示しない。

理由:

- イベント中はプレイヤーが判断に集中する場面である。
- HUDが説明を増やすと、イベント子画面や介入導線の邪魔になる。
- pauseは時計の針アニメーションが止まることで自然に伝える。
- #144 では `eventWindowOpen` / `latestOutcome` 中に背景進行と時計アニメーションが止まる想定である。

必要な場合だけ、イベント子画面側で次のような短い説明を使う。

```txt
出来事を見ている間、箱庭の時間はゆっくり止まります。
```

## Mobile readability

390px / 360pxでは、HUDは短く、1行に収まることを優先する。

推奨:

- 時間帯は `朝 / 昼 / 夕方 / 夜`
- 季節は `春 / 夏 / 秋 / 冬`
- iconは時計1つ、季節1つまで
- 季節iconは `芽 / 日 / 葉 / 雪` の1文字を優先する
- 長い説明文をHUD内に入れない
- 横幅が狭い場合は、iconを省略して文字だけにしてよい
- 0時 / 3時 / 6時 / 9時の目印は、文字が読めない場合でも短いtick markとして残す
- 短針 / 長針は太さや長さで区別し、色だけに頼らない
- HUDは住民クリック、`!` バブル、イベント子画面を開く操作を隠さない
- `pointer-events: none` 前提を維持し、HUD自体が操作対象にならないようにする

避ける表示:

```txt
現在の時間帯: morning / 現在の季節: spring
```

理由:

- 内部語が見える。
- 横幅を使いすぎる。
- 初見ユーザーに意味が伝わりにくい。

## Ready / Done conditions

- 朝 / 昼 / 夕方 / 夜 の表示名が定義されている。
- 春 / 夏 / 秋 / 冬 の表示名が定義されている。
- #144 と矛盾しない icon候補が定義されている。
- 時計の 0時 / 3時 / 6時 / 9時 の目印方針が定義されている。
- 短針 / 長針の意味が非技術者にも分かる。
- 読み上げ例が内部状態名を出さずに定義されている。
- HUDに内部状態名を出さない方針が明記されている。
- 390px / 360pxで短く読める文言になっている。
- UI実装をしていない。
- domain / persistence を触っていない。
- API key UI、生成API、実asset生成に踏み込んでいない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Preferred outcome

Line 4 は、この文書を参照して、箱庭左上HUDに短い日本語表示とiconを安全に実装・確認できる。

ユーザーは、背景画像や時計アニメーションと合わせて、朝 / 昼 / 夕方 / 夜 と 春 / 夏 / 秋 / 冬 の進行を直感的に読める。

## Safe fallback outcome

時計アニメーションや季節iconが環境によって見えにくい場合でも、HUDには文字の `朝 / 昼 / 夕方 / 夜` と `春 / 夏 / 秋 / 冬` を残す。

背景画像が不足している場合でも、HUD文言は内部状態名を出さず、fallback背景と一緒に表示できる。

## Out of scope

- UI実装
- EventFirstSandbox変更
- background catalog作成
- domain / persistence変更
- Passport schema変更
- 実時間連動
- カレンダー機能
- 季節ごとのdomain効果
- 季節イベント生成
- 天候システム
- 本格生活AI
- Codex App Server連携

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/sandbox-time-season-hud-copy.md and PR #144, keep the HUD copy spec docs-only, align labels and icons with the implementation, and test until complete."
```
