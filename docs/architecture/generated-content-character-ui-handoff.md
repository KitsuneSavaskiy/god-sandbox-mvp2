# Generated content character UI handoff

Status: Sprint8 closeout docs-first handoff

PBI: `PBI-UX-GENERATED-CONTENT-IMPLEMENTATION-HANDOFF-001`

Owner: Line 3 / Character Lifecycle / Roster / Passport

## Purpose

次Sprintで Character Creator、Roster、CharacterDetailPanel が generated asset / narrative を扱う時の実装引き継ぎを整理する。

この文書は UI 実装ではない。後続の Line 3 実装者が、main 上の正本文書だけを読んで「仕様どおりに実装してテストして」と言われた時に、画面ごとの責務、表示語、禁止事項を判断できる状態にする。

## Current failure

Sprint8で asset pipeline、narrative pack、Narrative GM、generated content fallback の仕様が増えた。

一方で、Line 3 の画面に落とす時の境界が曖昧なままだと、次の事故が起きやすい。

- Character Creator が実 job queue 書き込みや App Server 接続まで踏み込む。
- Roster に `assetBundleId`、`candidate`、`needs-review` などの内部語が出る。
- CharacterDetailPanel で asset と narrative の状態表示が混ざる。
- narrative candidate が公式文のように表示される。
- `ready`、`adopted`、`準備済み`、`fallback` の意味が画面ごとにぶれる。

## Final vision

Line 3 の各画面は次の役割に分かれる。

- Character Creator: 制作依頼に必要な情報を確認する場所。
- Roster: 住民ごとの素材や発話の状態を短く見る場所。
- CharacterDetailPanel: 表情差分、箱庭アニメ、icon、発話、イベント案の状態を詳しく見る場所。

Asset の採用済み状態は `ready`、narrative の公式採用状態は `adopted` として扱う。ユーザー向けには、どちらも必要に応じて「準備済み」と表示してよい。

Fallback は lifecycle ではなく、採用済み asset / narrative が無い時に通常画像や標準文へ戻す runtime / display 解決として扱う。

## Source of truth

この handoff は、次の正本文書を参照する。

- Line 3 責務: `docs/architecture/line-responsibilities.md`
- asset bundle と CharacterDetail 表示: `docs/architecture/character-detail-asset-spec.md`
- generated content status copy: `docs/architecture/generated-content-status-copy-spec.md`
- narrative pack schema: `docs/architecture/narrative-pack-schema.md`
- Narrative GM personas: `docs/architecture/narrative-gm-personas.md`
- narrative surface consistency: `docs/architecture/narrative-generated-content-consistency-map.md`
- event / intervention: `docs/architecture/event-and-intervention-spec.md`
- UI state: `docs/architecture/ui-state-model.md`
- Snapshot / Passport: `docs/architecture/snapshot-passport-spec.md`

用語の最終整理は Line 2 の generated content terminology sync を正本として参照する。この文書では定義自体を変更せず、Line 3 の画面でどう表示するかだけを扱う。

## Required rules

- UI 実装はこのPBIでは行わない。
- `src/**` を触らない。
- domain / persistence を触らない。
- Passport schema を変更しない。
- job queue へ実 job を書き込まない。
- Codex App Server へ接続しない。
- 画像生成 API を呼ばない。
- API key 入力 UI を追加しない。
- `candidate` / `needs-review` を公式文として表示しない。
- `assetBundleId` や `characterId` をユーザー向け主表示に出さない。
- `focusedEvent` 中心を壊さない。
- 死亡、寿命、勲章を復活させない。

## Character Creator handoff

Character Creator は、制作依頼に使う情報を確認する場所である。

後続実装で job draft を作る場合は、次の情報を集める。

| Field | Source | User-facing note |
| --- | --- | --- |
| `characterId` | runtime / roster | 画面には原則出さない |
| `assetBundleId` | asset / prompt / folder key | 画面には原則出さない |
| display name | user input | ゲーム内の名前として表示してよい |
| source portrait image | user selected image or default reference | 見た目の元画像として表示する |
| source image kind | `user-handmade` / `external-chatgpt` / `default-reference` | やさしい説明へ言い換える |
| personality | optional user input | ユーザー入力として扱う |
| role | optional user input | 未入力なら未設定 |
| speech style | optional user input | 発話の参考情報 |
| short setting memo | optional user input | 公式設定として扱えるのはユーザー入力だけ |
| optional visual notes | generated-recognition or user memo | AI認識メモは未確認として扱う |

### Character Creator copy

推奨表示:

```txt
この情報をもとに、表情差分・箱庭アニメ・発話案を作れるようになります。
まだ制作依頼は送信されません。
素材や発話が未生成でも、通常画像と標準文で遊べます。
```

### Character Creator must not

- `.godsandbox/jobs/**` へ実 job を書き込まない。
- App Server 接続をしない。
- 画像生成 API を呼ばない。
- API key や従量課金の UI を出さない。
- `assetBundleId` を保存先入力欄としてユーザーに書かせない。

## Roster handoff

Roster は、住民ごとの状態を短く見る場所である。

表示は短い badge と補足文に留め、詳しい理由は CharacterDetailPanel へ渡す。

### Roster status examples

| Content | Internal condition | User-facing badge |
| --- | --- | --- |
| asset | `ready` | 準備済み |
| asset | missing / placeholder / rejected | 通常画像で代用中 |
| asset | future review layer candidate | 確認が必要 |
| narrative | `adopted` | 準備済み |
| narrative | missing / rejected / no adopted pack | 標準文で進行中 |
| narrative | `candidate` / `needs-review` | 確認が必要 |

### Roster copy

推奨表示:

```txt
箱庭アニメ: 通常画像で代用中
発話: 標準文で進行中
```

確認待ちがある場合:

```txt
確認が必要な候補があります。詳しくは住民詳細で確認できます。
```

### Roster must not

- `assetBundleId` をそのまま表示しない。
- `characterId` をユーザー向け主表示にしない。
- `candidate` / `needs-review` / `manifest` / `ready promotion` をそのまま出さない。
- narrative candidate を公式文として出さない。
- 介入ボタンを置かない。

## CharacterDetailPanel handoff

CharacterDetailPanel は、asset と narrative の状態を詳しく確認する場所である。

ただし、詳細画面は event-first 主画面の補助子画面であり、介入操作の主導線ではない。

### Asset display targets

| Target | Display purpose | Fallback |
| --- | --- | --- |
| sprite sheet | 箱庭アニメ素材の状態を見る | portrait / icon / placeholder |
| portrait expressions | 表情差分を見る | `neutral` fallback |
| derived icon | 一覧や短い表示のiconを見る | portrait fallback |

### Narrative display targets

| Target | Display purpose | Fallback |
| --- | --- | --- |
| voice profile | 口調、一人称、避ける表現を見る | 未生成表示 |
| dialogue lines | 短い発話候補の状態を見る | 標準文 |
| comment bubbles | 箱庭コメント候補の状態を見る | 非表示または標準短文 |
| event seeds | イベント案の状態を見る | deterministic event summary |
| intervention responses | `watch` / `help` / `trial` 結果文候補を見る | 標準 result 文 |

### Detail status mapping

| Internal meaning | User-facing label | Detail explanation |
| --- | --- | --- |
| asset `ready` | 準備済み | 検査済み素材を表示できます。 |
| narrative `adopted` | 準備済み | 採用済みの発話や文を表示できます。 |
| `candidate` / `needs-review` | 確認が必要 | 使う前に内容確認が必要です。 |
| missing asset | 通常画像で代用中 | 専用素材がなくても通常画像で遊べます。 |
| rejected asset | 通常画像で代用中 | この候補は使わず通常画像で表示します。 |
| missing narrative | 標準文で進行中 | 専用発話がなくても標準文で進みます。 |
| rejected narrative | 標準文で進行中 | この候補は使わず標準文で進みます。 |

### CharacterDetailPanel must not

- `candidate` / `needs-review` の本文を公式文として表示しない。
- 画像や生成メモだけから、性格、出自、年齢、職業、関係性を断定しない。
- `watch` / `help` / `trial` の介入ボタンを置かない。
- Passport schema の内部情報を表示しない。
- generated narrative を domain event 正本として見せない。

## Words not shown to users

次の語はユーザー向け UI にそのまま出さない。

```txt
assetBundleId
characterId
incoming
tmp
manifest
ready promotion
adopted
candidate
needs-review
job queue
Codex App Server
API key
従量課金
```

開発者向け docs では使ってよい。ただし、ユーザーに見える画面では次のように言い換える。

| Internal word | User-facing wording |
| --- | --- |
| `assetBundleId` | 表示しない |
| `characterId` | 表示しない |
| `candidate` | 候補 |
| `needs-review` | 確認が必要 |
| `adopted` | 準備済み |
| `ready` | 準備済み |
| `fallback` | 通常画像で代用中 / 標準文で進行中 |
| `manifest` | 素材リスト |
| `ready promotion` | ゲームで使える状態にする |
| `job queue` | 制作依頼 |
| `Codex App Server` | 表示しない |
| `API key` | 表示しない |
| 従量課金 | 表示しない |

## Line 2 terminology alignment

Line 3実装では、用語定義をこの文書内で再定義しない。

次の整理に従う。

```txt
asset lifecycle:
ready

narrative lifecycle:
adopted

UI label:
準備済み

fallback:
lifecycleではなくruntime/display解決
```

Line 2の用語整理が更新された場合、Line 3はその文書を正本として参照し、この handoff は画面別の使い方だけを維持する。

## Ready / Done conditions

- Character Creator / Roster / CharacterDetailPanel の画面別 handoff が分かる。
- asset / narrative の状態表示が混ざっていない。
- `assetBundleId` をユーザーにそのまま出さない方針がある。
- `candidate` / `needs-review` を公式文として見せない方針がある。
- UI 実装をしていない。
- job queue 書き込みをしていない。
- App Server 接続をしていない。
- Passport schema を触っていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Preferred outcome

次SprintのLine 3実装者は、この文書を読めば Character Creator、Roster、CharacterDetailPanel の generated asset / narrative 表示を実装できる。

画面はユーザーに怖くない言葉を使い、内部状態語を出さず、未生成や確認待ちでも通常画像・標準文で進められることを伝える。

## Safe fallback outcome

Line 2の用語整理や App Server 仕様がまだ完全でない場合でも、Line 3 UI は次の安全表示で進める。

- asset が使えない場合: 通常画像で代用中。
- narrative が使えない場合: 標準文で進行中。
- candidate / needs-review がある場合: 確認が必要。

この場合も、生成候補本文を公式文として表示しない。

## Out of scope

- UI 実装
- `src/**` 変更
- domain / persistence 変更
- Passport schema 変更
- job queue 書き込み
- Codex App Server 接続
- 画像生成 API 呼び出し
- API key 入力 UI
- generated narrative の公式採用
- asset ready 化
- public art 変更
- generated artifacts の commit

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/generated-content-character-ui-handoff.md, refine the generated content character UI implementation handoff exactly, keep it docs-first, and test until complete."
```
