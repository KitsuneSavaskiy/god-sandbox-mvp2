# Generated Content Status Copy Spec

Status: Sprint8 docs-first specification

PBI: `PBI-UX-GENERATED-CONTENT-STATUS-COPY-SPEC-001`

Owner: Line 3 / Character Lifecycle / Roster / Passport

## Purpose

キャラクリエイト、住民一覧、CharacterDetailPanel で表示する Codex 生成状態、確認待ち、fallback時の文言を、非技術者にも分かる形で固定する。

この文書は UI 実装ではなく、後続実装が迷わないための文言仕様である。Eve を含む個別 asset の ready / fallback 判定は manifest / read model を正本とし、この文書では変更しない。

## Current failure

生成素材や生成文が増えると、内部状態をそのまま UI に出してしまうリスクがある。

避けたいこと:

- `manifest` や `ready promotion` などの内部語がユーザーに見える。
- 未生成なのに失敗したように見える。
- Codex 生成待ちのためにゲームが止まるように見える。
- asset と narrative の状態が混ざり、何が未生成なのか分かりにくい。
- rejected や needs-review の候補を ready のように見せる。

## Final vision

ユーザーは、素材や発話が未生成でも「今は通常画像や標準文で遊べる」と分かる。

Character Creator は制作依頼に使う情報を確認する場所、Roster は住民ごとの状態を短く見る場所、CharacterDetailPanel は表情差分、箱庭アニメ、発話設定の状態を詳しく見る場所として使い分ける。

## Source of truth

この仕様は次を正本として扱う。

- Line 3 の責務: `docs/architecture/line-responsibilities.md`
- asset bundle と fallback: `docs/architecture/character-detail-asset-spec.md`
- sandbox generated content fallback: `docs/architecture/sandbox-generated-content-fallback-spec.md`
- sandbox generated content state matrix: `docs/architecture/sandbox-generated-content-state-matrix.md`
- Snapshot / Passport の境界: `docs/architecture/snapshot-passport-spec.md`
- generated workspace retention: `docs/operations/generated-workspace-retention-policy.md`
- resident sprite pipeline: `docs/operations/resident-sprite-pipeline.md`
- asset pipeline guardrail: `.agents/skills/godsandbox-scrum-orchestrator/references/asset-pipeline-guardrails.md`
- Sprint8 guardrail: `.agents/skills/godsandbox-scrum-orchestrator/references/sprint8-guardrails.md`

## Required rules

- UI 実装はこの PBI では行わない。
- GodSandbox 本体から画像生成 API を呼ばない。
- API key 入力 UI を作らない。
- Codex App Server に接続しない。
- job queue へ実 job を書き込まない。
- この文言仕様から manifest を ready 化しない。
- asset の `ready` は manifest / read model 側で検査、人間確認、必要な PO 確認を通った状態として扱う。
- narrative の `adopted` は世界観、口調、安全性、product review を通った公式採用文として扱う。
- `fallback` は lifecycle state ではなく、採用済み asset / narrative がない時に通常画像や標準文へ戻す runtime / display 側の解決である。
- Passport schema を変更しない。
- domain / persistence を変更しない。
- 生成候補がなくても、不安を煽らず fallback で遊べることを伝える。
- 画像や生成メモから、性格、出自、年齢、職業、関係性を断定しない。

## User-facing status names

ユーザーに見せる状態名は、次に統一する。

| 表示名 | 使う場面 | 意味 |
| --- | --- | --- |
| 未生成 | まだ素材や文が作られていない | これから作れる。失敗ではない。 |
| 通常画像で代用中 | 箱庭アニメや表情差分が未生成 | 既存の立ち絵や icon で遊べる。 |
| 制作依頼の準備中 | 必要情報を集めている | まだ Codex へ送っていない。 |
| Codex制作中 | 将来、Codex 側が処理中 | Sprint8 では送信しない。 |
| 確認が必要 | 候補があるが人間確認待ち | ゲームで使う前に見た目や文を確認する。 |
| 不採用 | 候補を使わない判断になった | fallback で進める。 |
| 準備済み | 採用済みでゲーム内表示に使える | 検査と確認を通った状態。 |

## Internal state mapping

内部状態とユーザー向け表示は次のように対応させる。

現行 asset manifest / read model が持つ状態は `missing`、`placeholder`、`rejected`、`ready` を基本にする。
Narrative pack の lifecycle は `candidate`、`needs-review`、`rejected`、`adopted` を基本にする。
`draft-ready`、`pending`、`running`、`needs-review` は、将来の job draft / generated content review layer が持つ補助状態として扱う。
UIでは asset `ready` と narrative `adopted` のどちらも「準備済み」と表示してよいが、内部状態語は混ぜない。

| Internal state | User-facing status | UI note |
| --- | --- | --- |
| `missing` | 未生成 | まだ作っていない状態として扱う。 |
| `placeholder` | 通常画像で代用中 | 既存画像や標準文で進められることを伝える。 |
| `candidate` | 確認が必要 | narrative候補。公式文としては表示しない。 |
| `draft-ready` | 制作依頼の準備中 | 必要情報は揃っているが、送信はまだしない。 |
| `pending` | Codex制作中 | 将来用。Sprint8 では実送信しない。 |
| `running` | Codex制作中 | 将来用。進行中でも gameplay を止めない。 |
| `needs-review` | 確認が必要 | 候補を asset `ready` や narrative `adopted` として表示しない。 |
| `rejected` | 不採用 / 通常画像で代用中 | 不採用理由を詳細画面に短く出してよい。 |
| `ready` | 準備済み | asset用。検査、人間確認、必要な PO 確認を通った状態。 |
| `adopted` | 準備済み | narrative用。review gateを通った公式採用文。 |

## Asset copy

asset は、表情差分、箱庭アニメ、icon などの見た目素材を指す。

### Short badge copy

| State | Badge |
| --- | --- |
| `missing` | 未生成 |
| `placeholder` | 通常画像で代用中 |
| `draft-ready` | 制作依頼の準備中 |
| `pending` / `running` | Codex制作中 |
| `needs-review` | 確認が必要 |
| `rejected` | 不採用 |
| `ready` | 準備済み |

### Detail copy examples

未生成:

```txt
箱庭アニメはまだ未生成です。完成までは通常画像で表示します。
```

通常画像で代用中:

```txt
まだ専用アニメはありません。今は通常画像で遊べます。
```

制作依頼の準備中:

```txt
制作依頼に使う情報を確認しています。まだ外部送信は行いません。
```

Codex制作中:

```txt
素材候補を制作中です。完成を待たなくてもゲームは続けられます。
```

確認が必要:

```txt
素材候補があります。ゲームで使う前に見た目を確認してください。
```

不採用:

```txt
この素材候補は使いません。通常画像で代用します。
```

準備済み:

```txt
箱庭アニメ素材を使える状態です。
```

## Narrative copy

narrative は、住民専用の発話、コメント、イベント案、watch / help / trial の反応候補などの文を指す。

### Detail copy examples

未生成:

```txt
この住民専用の発話はまだ未生成です。今は標準のイベント文で進みます。
```

通常文で代用中:

```txt
専用の発話がないため、標準のイベント文で表示します。
```

制作依頼の準備中:

```txt
発話やイベント案を作るための情報を確認しています。まだ送信は行いません。
```

Codex制作中:

```txt
発話候補を制作中です。完成を待たずに箱庭を続けられます。
```

確認が必要:

```txt
発話候補があります。使う前に内容を確認してください。
```

不採用:

```txt
この発話候補は使いません。標準のイベント文で進みます。
```

準備済み:

```txt
この住民用の発話設定を使える状態です。
```

この「準備済み」はユーザー向け表示である。
内部の narrative lifecycle status は `adopted` のまま扱い、`ready` には言い換えない。

## Words not shown to users

次の語は、ユーザー向け UI にはそのまま出さない。

- `incoming`
- `tmp`
- `rejected`
- `manifest`
- `ready promotion`
- `Codex App Server`
- `API key`
- 従量課金
- `publicPath`
- `sourcePath`
- `assetId`
- `missingReason`
- `isPlaceholder`

必要な場合は、次のように言い換える。

| Internal word | UI wording |
| --- | --- |
| `incoming` | 候補 |
| `tmp` | 作業中 |
| `rejected` | 不採用 |
| `manifest` | 素材リスト |
| `ready promotion` | ゲームで使える状態にする |
| `API key` | 表示しない |
| 従量課金 | 表示しない |

## Screen usage

### Character Creator

役割:

```txt
制作依頼に使う情報を確認する場所
```

主な文言:

```txt
この情報をもとに、表情差分・箱庭アニメ・発話案を作れるようになります。
まだ制作依頼は送信されません。
素材が未生成でも、通常画像で遊べます。
```

表示する状態:

- 制作依頼の準備中
- 未生成
- 通常画像で代用中

### Roster

役割:

```txt
住民ごとの素材状態を短く見る場所
```

主な文言:

```txt
箱庭アニメ: 通常画像で代用中
発話: 未生成
```

Roster では詳しい内部理由を出しすぎない。必要なら CharacterDetailPanel へ誘導する。

### CharacterDetailPanel

役割:

```txt
表情差分・箱庭アニメ・発話設定の状態を詳しく見る場所
```

表示するもの:

- 状態名
- 短い説明
- fallback 中でも遊べること
- 確認待ちの場合の次アクション

表示しないもの:

- 介入ボタン
- Passport schema の内部情報
- 個人PCの絶対パス
- API key や外部サービスの接続情報

## Ready / Done conditions

- 非技術者向けの状態文言が定義されている。
- asset と narrative で文言が分かれている。
- 内部用語をそのまま UI に出さない方針が明確である。
- Codex 生成物がなくても不安を煽らない文言になっている。
- UI 実装をしていない。
- Passport schema を触っていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Preferred outcome

後続の Line 3 UI 実装は、この文書だけを読めば Character Creator、Roster、CharacterDetailPanel の生成状態文言をそろえられる。

未生成、確認待ち、不採用、準備済みの違いが、非技術者にも怖くない言葉で表示される。

## Safe fallback outcome

Codex 生成物が無い、壊れている、確認待ち、または不採用でも、GodSandbox は通常画像と標準イベント文で進む。

壊れた asset は `ready` として扱わず、未確認 narrative は `adopted` として扱わない。
ユーザーには「通常画像で代用中」「標準のイベント文で進みます」と伝える。
Narrative の場合は `adopted` でない限り公式文として扱わない。
`fallback` は lifecycle ではなく、runtime / display が通常画像や標準文を選ぶ安全な解決である。

## Out of scope

- UI 実装
- App Server 接続
- job queue 書き込み
- 画像生成 API 呼び出し
- manifest ready 化
- domain / persistence 変更
- Passport schema 変更
- Eve sprite sheet 再生成
- public art 変更

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/generated-content-status-copy-spec.md, refine the generated content status copy specification exactly, keep it docs-first, and test until complete."
```
