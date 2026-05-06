# GM Narrative Event UI Acceptance Matrix

Status: Sprint8 docs-first specification

PBI: `PBI-QA-GM-NARRATIVE-EVENT-UI-ACCEPTANCE-MATRIX-001`

Owner: Line 4 / Event Experience / Tutorial / Narrative

## Purpose

Narrative GM が作る文章候補を、event UI で `approve` / `revise` / `reject` / `fallback` に分ける基準を定義する。

この文書は、comment bubble、event window、result card、story log に出してよい文章を判断するための QA matrix である。

実装、narrative生成、domain、persistence、Passport schema は変更しない。

## Current failure

Narrative GM の文章候補が増えると、レビュー基準が曖昧なまま UI に出るリスクがある。

特に危ないこと:

- `candidate` や `needs-review` の候補が採用済みの文章として表示される。
- 長すぎる文章が 390px / 360px の event UI を押しつぶす。
- 生成文が `watch` / `help` / `trial` の意味を変える。
- result card で domain result より生成文が強く見える。
- story log が補助面ではなく主画面のように振る舞う。
- 不採用や確認待ちの文章を待つために gameplay が止まる。

## Final vision

Narrative GM の候補は、event UI に出る前に surface ごとの基準で確認される。

採用済みの短い補助文だけが表示される。未生成、確認待ち、修正待ち、不採用の場合は、既存の event summary、situation tags、標準 result 文、story log fallback で進行する。

プレイヤーは、生成候補の有無に関係なく、箱庭を見る、イベントを開く、`見守る` / `助ける` / `試練` を選ぶ、結果を見る流れを止めずに進められる。

## Source Of Truth

- `docs/architecture/event-and-intervention-spec.md`
- `docs/architecture/ui-state-model.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`
- `docs/architecture/generated-content-status-copy-spec.md`
- `docs/architecture/line-responsibilities.md`
- `docs/architecture/sandbox-narrative-surface-spec.md` if merged
- `docs/architecture/narrative-pack-schema.md` if merged
- `docs/architecture/narrative-gm-personas.md` if merged
- `.agents/skills/godsandbox-scrum-orchestrator/references/sprint8-guardrails.md`
- `.agents/skills/godsandbox-scrum-orchestrator/references/blocker-rules.md`

## Required Rules

- `focusedEvent` 中心を維持する。
- `focusedCharacter` / `selectedCharacter` 中心へ戻さない。
- Narrative GM の文章は補助表示であり、event generation、intervention、ChangeSet、resource cost の正本を置き換えない。
- `candidate` と `needs-review` は player-facing gameplay UI に出さない。
- `adopted` だけを generated narrative として表示してよい。
- Codex生成待ち、GM生成待ち、review待ちで gameplay を止めない。
- 箱庭上にキャラ名、場所、状態ラベルを戻さない。
- 死亡、寿命、勲章を narrative 文で復活させない。
- Passport schema に影響する文を event UI から作らない。

## Narrative Status Handling

| Narrative lifecycle / display resolution | Event UI handling |
| --- | --- |
| `candidate` | UIに出さない。review対象として保持し、fallbackで進行する。 |
| `needs-review` | UIに出さない。確認待ちとして扱い、fallbackで進行する。 |
| `adopted` | surfaceごとの基準を満たす場合だけ表示できる。 |
| `rejected` | UIに出さない。不採用理由を残す場合も、プレイヤー向けにはfallbackで進行する。 |
| `missing` | fallbackで進行する。 |
| runtime / display fallback | lifecycleではない。generated narrativeを使わず、既存の標準文で進行する。 |

## Decision Meanings

| Decision | Meaning | UI behavior |
| --- | --- | --- |
| `approve` | そのsurfaceで安全に表示できる。 | `adopted` 後に表示してよい。 |
| `revise` | 方向性は使えるが、長さ、文体、surface、意味境界に修正が必要。 | 修正後に再reviewする。まだUIに出さない。 |
| `reject` | guardrail違反、意味破壊、別人化、禁止要素を含む。 | 使わない。fallbackで進行する。 |
| `fallback` | 使えるgenerated narrativeがない、または使わない判断。 | 既存標準文で進行する。 |

## Surface Acceptance Matrix

| Surface | Approve | Revise | Reject | Fallback |
| --- | --- | --- | --- | --- |
| comment bubble | 1つの短い反応として読める。住民アニメーションや `!` を補助する。操作を隠さない。 | 長すぎる、感情が曖昧、event window向きの説明になっている。 | キャラ名、場所、主役/脇役、状態ラベルの代替になる。内部状態や禁止要素を出す。 | emote icon、`!`、標準bubbleで進行する。 |
| event window | 今の出来事を理解しやすくする短い補助文である。`見守る` / `助ける` / `試練` の選択を邪魔しない。 | 重複が多い、長い、主語が曖昧、button付近で読みにくい。 | 参加者、event meaning、intervention meaning、domain resultを変える。 | event summary、situation tags、標準案内で進行する。 |
| result card | domain result の後に、結果の余韻として短く読める。 | dramatizationが強い、長い、成功/失敗の印象が曖昧。 | ChangeSet、resource cost、成長結果を生成文で上書きする。保証表現をする。 | 標準result文で進行する。 |
| story log | 補助面として短い記録になる。main sandbox focusを奪わない。 | 長すぎる、連続ログで読みにくい、event window向き。 | 公式lore、関係性、死亡、寿命、勲章、Passport情報を勝手に確定する。 | event summaryとresultの標準ログで進行する。 |

## Candidate Type Matrix

| Candidate type | Primary surface | Secondary surface | Notes |
| --- | --- | --- | --- |
| `comment-bubbles` | comment bubble | story log | 極短文に限る。箱庭上ラベルの代替にしない。 |
| `event-seeds` | event window | story log | eventの正本生成ではなく、採用済み文言補助として扱う。 |
| `relationship-event-seeds` | event window | story log | 関係性を勝手に公式化しない。既存正本と矛盾するならreject。 |
| `dialogue-lines` | event window | comment bubble | 未確認の口調はneeds-review。長文会話はevent UIに置かない。 |
| `intervention-responses` | result card | story log | domain resultの後に添える。結果そのものは変えない。 |
| `story-log-candidates` | story log | none | 主画面を奪わない。短い補助記録に限定する。 |

## Watch / Help / Trial Safety

Generated narrative は `watch` / `help` / `trial` の意味を上書きしない。

| Intervention | UI meaning that must remain stable | Reject if generated text says |
| --- | --- | --- |
| `watch` / 見守る | 手を出さず様子を見る。記録や気づきを増やす。 | 必ず報酬が増える、助けた、試練を与えた、costを消費した。 |
| `help` / 助ける | 小さな祝福で良い変化を狙う。 | 完全成功を保証する、別の能力を確定する、domain resultを置換する。 |
| `trial` / 試練 | 成長のきっかけになる小さな困難を与える。 | 罰、死亡、寿命、勲章、取り返しのつかない損失を確定する。 |

## Approve Criteria

Approve できる候補:

- `adopted` に進める前のreviewで、surfaceに合っている。
- 390px / 360px でも主操作を押し出さない短さである。
- `watch` / `help` / `trial` の意味を変えない。
- domain result や ChangeSet を置き換えない。
- 既存の event summary と矛盾しない。
- キャラクターの未確定loreを断定しない。
- 箱庭上ラベルの代替にならない。

## Revise Criteria

Revise にする候補:

- 内容は使えそうだが、長すぎる。
- event window向きの文が comment bubble に入っている。
- result card向きの余韻文が event decision 前に出ている。
- 390px / 360px でボタンやclose導線を押し出しそう。
- 口調や語尾が強すぎるが、禁止要素はない。
- fallbackより良くなる可能性はあるが、まだそのまま表示できない。

Revise の候補は、修正後に再reviewするまで player-facing UI に出さない。

## Reject Criteria

Reject にする候補:

- 死亡、寿命、勲章を復活させる。
- Passport schema や外部持ち出し仕様に影響する内容を勝手に作る。
- `focusedCharacter` / `selectedCharacter` 中心の体験へ戻す。
- 箱庭上にキャラ名、場所、状態ラベルを出す前提になっている。
- `watch` / `help` / `trial` の意味、cost、resultを変える。
- Codex生成待ちで gameplay を止める前提になっている。
- 未確認の関係性、年齢、職業、過去、肩書きを公式化する。
- 文字化け、内部状態名、manifest名、API key、path、tokenを含む。

Reject の候補は使わず、fallbackで進行する。

## Fallback Criteria

Fallback を選ぶ状況:

- usableな `adopted` narrative がない。
- 候補が `candidate` / `needs-review` / `rejected` / `missing` である。
- surface判断に迷う。
- mobile表示で不安がある。
- event-first flow が重くなる。

Fallback は失敗扱いではない。GodSandbox は fallback 前提で進行できる必要がある。

## Mobile / A11y Acceptance

390px / 360px で確認すること:

- comment bubble が住民クリック導線を塞がない。
- event window で `見守る` / `助ける` / `試練` が見えて押せる。
- result card が画面下に押し出されすぎない。
- story log が補助面に留まり、主画面を奪わない。
- 長文候補は approve しない。
- 色だけで approve / reject / fallback を伝えない。
- 内部状態名をそのまま表示しない。

## Review Workflow

1. 候補の lifecycle status が `candidate` / `needs-review` / `rejected` / `adopted` のどれか確認する。
2. intended surface を comment bubble / event window / result card / story log から選ぶ。
3. Surface Acceptance Matrix を使って `approve` / `revise` / `reject` / `fallback` を決める。
4. `approve` でも、必要なreviewを通るまでは player-facing UI に出さない。
5. `revise` は修正後に再reviewする。
6. `reject` は使わずfallbackへ回す。
7. 判定に迷ったらfallbackを選ぶ。

## Ready Conditions

- Narrative GM 候補の `approve` / `revise` / `reject` / `fallback` 基準がある。
- comment bubble / event window / result card / story log 別の判断基準がある。
- candidate / needs-review をUIに出さない方針が明確である。
- `watch` / `help` / `trial` の意味を生成文が上書きしない。
- 390px / 360px のQA観点がある。
- 実装ファイルを触っていない。

## Safe Fallback

- 判断に迷う候補はfallbackにする。
- `candidate` / `needs-review` はfallbackで進行する。
- 壊れたnarrativeは採用せず、標準event summary / result / story logを使う。
- Codex生成待ちで gameplay を止めない。

## Out Of Scope

- EventFirstSandbox 実装修正
- CSS修正
- narrative生成実装
- narrative pack schema変更
- domain / persistence変更
- Passport schema変更
- Codex App Server実装
- 画像生成API呼び出し
- 箱庭上ラベル復活
- 死亡、寿命、勲章の復活

## Testing Requirements

Docs-only でも、PR前に次を確認する。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## One-Line Codex Resume Instruction

```bash
codex "Read docs/architecture/gm-narrative-event-ui-acceptance-matrix.md, refine the GM narrative event UI acceptance matrix exactly, keep it docs-first, and test until complete."
```
