# Sandbox Time / Season HUD Copy

Status: Sprint8 docs-first specification

PBI: `PBI-UX-SANDBOX-TIME-SEASON-HUD-COPY-001`

Owner: Line 3 / Character Lifecycle / Roster / Passport

## Purpose

箱庭左上に表示する時計・季節HUDの表示名、icon候補、短い文言ルールを定義する。

この文書は UI 実装ではない。Line 4 が `EventFirstSandbox` に HUD を実装するとき、非技術者にも読みやすく、390px / 360px でも邪魔になりにくい表示へそろえるための文言仕様である。

## Current failure

現状の箱庭は、時間帯が背景の明暗変化としては見えるが、初見ユーザーには「今が朝なのか、夜なのか」「季節が進んでいるのか」が分かりにくい。

また、実装側の状態名をそのまま出すと、`morning`、`noon`、`spring` などの内部語が UI に混ざる可能性がある。

## Final vision

ユーザーは、箱庭左上を見るだけで、現在の時間帯と季節を短く理解できる。

推奨表示:

```txt
◷ 朝  🌱 春
```

表示は短く、説明文ではなく状態の読み取りを助ける補助HUDにする。

## Source of truth

この仕様は次を正本として扱う。

- UI状態モデル: `docs/architecture/ui-state-model.md`
- sandbox generated content fallback: `docs/architecture/sandbox-generated-content-fallback-spec.md`
- sandbox generated content state matrix: `docs/architecture/sandbox-generated-content-state-matrix.md`
- Line 3 の責務: `docs/architecture/line-responsibilities.md`

背景画像の有無とpathは、Line 2 の背景asset catalogを正本にする。

## Required rules

- UI実装はこのPBIでは行わない。
- domain / persistence を変更しない。
- Passport schema を変更しない。
- Codex App Server に接続しない。
- 画像生成APIを呼ばない。
- API key UIを作らない。
- 実時間連動、カレンダー、季節効果、季節イベント生成は扱わない。
- 箱庭上にキャラ名、場所、状態ラベルを戻さない。
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

| Season | Primary icon | Alternate icon | Text fallback |
| --- | --- | --- | --- |
| 春 | 🌱 | 🌸 | 春 |
| 夏 | ☀️ | 🟡 | 夏 |
| 秋 | 🍁 | 🍂 | 秋 |
| 冬 | ❄️ | ◯ | 冬 |

時計iconの推奨候補:

| Phase | Primary icon | Alternate icon | Text fallback |
| --- | --- | --- | --- |
| 朝 | ◷ | 🕘 | 朝 |
| 昼 | ◑ | 🕛 | 昼 |
| 夕方 | ◕ | 🕕 | 夕方 |
| 夜 | ● | 🕘 | 夜 |

絵文字が世界観や環境に合わない場合は、CSSで丸い紙片風iconや時計風の円を使ってよい。ただし、文字の「朝 / 昼 / 夕方 / 夜」「春 / 夏 / 秋 / 冬」は必ず残す。

## Recommended HUD copy

基本形:

```txt
◷ 朝  🌱 春
```

季節と時間帯の組み合わせ例:

```txt
◷ 朝  🌱 春
◑ 昼  ☀️ 夏
◕ 夕方  🍁 秋
● 夜  ❄️ 冬
```

390px / 360pxでさらに短くしたい場合:

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

必要なら、開発者向けdebug表示は別の開発用surfaceに分ける。通常の箱庭HUDには出さない。

## Pause copy

イベント中に時計と背景時間がpauseしても、HUD上で「停止中」「paused」などを常時表示しない。

理由:

- イベント中はプレイヤーが判断に集中する場面である。
- HUDが説明を増やすと、イベント子画面や介入導線の邪魔になる。
- pauseは時計アニメーションが止まることで自然に伝える。

必要な場合だけ、イベント子画面側で次のような短い説明を使う。

```txt
出来事を見ている間、箱庭の時間はゆっくり止まります。
```

## Mobile readability

390px / 360pxでは、HUDは短く、1行に収まることを優先する。

推奨:

- 時間帯は `朝 / 昼 / 夕方 / 夜`
- 季節は `春 / 夏 / 秋 / 冬`
- iconは1つずつまで
- 長い説明文をHUD内に入れない
- 横幅が狭い場合は、iconを省略して文字だけにしてよい

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
- icon候補が定義されている。
- HUDに内部状態名を出さない方針が明記されている。
- 390px / 360pxで短く読める文言になっている。
- UI実装をしていない。
- domain / persistence を触っていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Preferred outcome

Line 4 は、この文書を参照して、箱庭左上HUDに短い日本語表示とiconを安全に実装できる。

ユーザーは、背景画像や時計アニメーションと合わせて、朝 / 昼 / 夕方 / 夜 と 春 / 夏 / 秋 / 冬 の進行を直感的に読める。

## Safe fallback outcome

絵文字や時計アニメーションが環境によって見えにくい場合でも、HUDには文字の `朝 / 昼 / 夕方 / 夜` と `春 / 夏 / 秋 / 冬` を残す。

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
codex "Read docs/architecture/sandbox-time-season-hud-copy.md, refine the sandbox time and season HUD copy specification exactly, keep it docs-first, and test until complete."
```
