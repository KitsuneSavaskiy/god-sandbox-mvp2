# Sandbox Narrative Surface Spec

Status: Sprint8 docs-first specification

PBI: `PBI-ARCH-SANDBOX-NARRATIVE-SURFACE-SPEC-001`

Owner: Line 4 / Event Experience / Tutorial / Narrative

## Purpose

generated narrative を箱庭・イベントUIで安全に受け取るために、どの文章候補をどの表示 surface に出してよいかを定義する。

対象 surface は次の4つである。

- comment bubble
- event window
- result card
- story log

この文書は受け皿仕様であり、narrative生成、EventFirstSandbox実装、domain、persistence、Passport schema は変更しない。

## Current failure

Narrative GM が発話、イベント案、介入反応文、story log 候補を作れるようになると、表示先を誤るリスクがある。

起きてほしくないこと:

- `candidate` や `needs-review` の未確認文が、公式文としてプレイヤーに見える。
- comment bubble がキャラ名、場所、状態ラベルの代わりになる。
- event window の生成文が、`watch` / `help` / `trial` の意味を上書きする。
- result card の生成文が、domain の deterministic result や change result を置き換える。
- story log が main sandbox focus を奪う。
- Codex生成待ちで gameplay が止まる。

## Final vision

generated narrative がある場合は、採用済みの短い補助文として event-first 体験を豊かにする。

generated narrative がない、未確認、失敗、不採用の場合でも、GodSandbox は既存の event summary、situation tags、標準の intervention result 文、story log fallback で進行する。

プレイヤーは、生成文があるかどうかを意識せず、箱庭を見て、イベントを開き、`見守る` / `助ける` / `試練` を選び、結果を見る流れを続けられる。

## Source Of Truth

- `docs/architecture/event-and-intervention-spec.md`
- `docs/architecture/ui-state-model.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`
- `docs/architecture/generated-content-status-copy-spec.md`
- `docs/architecture/line-responsibilities.md`
- `docs/architecture/narrative-pack-schema.md` if merged
- `.agents/skills/godsandbox-scrum-orchestrator/references/sprint8-guardrails.md`
- `.agents/skills/godsandbox-scrum-orchestrator/references/blocker-rules.md`

## Required Rules

- `focusedEvent` 中心を維持する。
- `focusedCharacter` / `selectedCharacter` 中心へ戻さない。
- Generated narrative は補助表示であり、domain event、intervention、ChangeSet の正本を置き換えない。
- `candidate` と `needs-review` はプレイヤー向け gameplay UI に出さない。
- `adopted` だけを generated narrative として表示してよい。
- `fallback` は失敗ではなく、adopted narrative がない時に標準文で進む runtime / display 解決として扱う。
- Codex生成待ちで gameplay を止めない。
- 箱庭上にキャラ名、場所、状態ラベルを戻さない。
- 死亡、寿命、勲章を復活させない。
- Passport schema を変更しない。
- GodSandbox本体から画像生成APIやnarrative生成APIを呼ばない。

## Narrative Status Handling

| Status | Player-facing display | Sandbox / event behavior |
| --- | --- | --- |
| `candidate` | 表示しない | fallbackで進行する |
| `needs-review` | 表示しない | fallbackで進行する |
| `rejected` | 表示しない | fallbackで進行する |
| `adopted` | surface別ルールに従って表示してよい | 補助表示として使う |
| runtime / display fallback | 標準文を表示する | gameplayを止めない |

`candidate` と `needs-review` は、review画面やPR監査資料では扱ってよい。ただし、この文書が対象にするプレイヤー向け event-first UI には出さない。

## Surface Matrix

| Surface | Main role | Allowed pack type | Display rule |
| --- | --- | --- | --- |
| comment bubble | 箱庭上の短い気配 | `comment-bubbles` | `adopted` の超短文だけ |
| event window | いまの出来事を開いて判断する場所 | `event-seeds`, `relationship-event-seeds`, `dialogue-lines` | `adopted` の補助文だけ |
| result card | 介入後の結果を読む場所 | `intervention-responses` | domain結果のあとに補助文として表示 |
| story log | 後から流れを振り返る場所 | `story-log-candidates` | 補助surfaceとして表示 |

## Comment Bubble Surface

comment bubble は、箱庭上の小さな気配を伝えるための surface である。

表示してよいもの:

- `adopted` の `comment-bubbles`
- 1行で読める短文
- 感情や違和感を伝える言葉
- 必要最小限の感情アイコンや `!`

表示してはいけないもの:

- キャラ名
- 場所名
- `主役` / `脇役` / `見守り中`
- 活力や調和などの数値
- `candidate` / `needs-review` / `manifest` などの内部状態名
- 長い会話文
- イベントの結論や介入結果

fallback:

- adopted comment bubble がない場合は、既存の短い emote / `!` / 標準bubbleで進む。
- comment bubble がなくても gameplay は止めない。

## Event Window Surface

event window は、プレイヤーが今の出来事を開き、関わり方を選ぶための surface である。

表示してよいもの:

- `adopted` の event seed 補助文
- `adopted` の relationship event 補助文
- `adopted` の短い dialogue line
- 状況を理解しやすくする短い補助文

表示してはいけないもの:

- `watch` / `help` / `trial` の意味を変える文
- domain event の参加者、primary、status を上書きする文
- 未確認の関係性、年齢、職業、過去設定を断定する文
- 介入ボタンを event window 外へ戻す設計
- `candidate` / `needs-review` の未確認文

fallback:

- adopted narrative がない場合は、既存の event summary、situation tags、観察プリセット文で進む。
- Codex生成待ちは event window のpause理由にしない。
- event window のpause理由は、プレイヤーがイベント判断中であることだけにする。

## Result Card Surface

result card は、プレイヤーの介入後に何が起きたかを読む surface である。

表示してよいもの:

- `adopted` の intervention response
- domain が返した結果を補足する短い文
- 変化を怖くなく伝える一文

表示してはいけないもの:

- `InterventionRecord` や `ChangeSet` の結果を上書きする文
- `watch` を消費ありに見せる文
- `help` / `trial` の有限リソース性を消す文
- 介入結果として未確認 lore を確定する文
- 死亡、寿命、勲章を示す文
- `candidate` / `needs-review` の未確認文

fallback:

- adopted intervention response がない場合は、既存の標準結果文を表示する。
- result card は `latestOutcome` を読むための場所であり、generated narrative の有無で閉じ込めない。

## Story Log Surface

story log は、起きたことを後から振り返る補助 surface である。

表示してよいもの:

- `adopted` の story log candidate
- event summary をもとにした短い記録
- 介入結果の補助記録

表示してはいけないもの:

- main sandbox focus を奪う長文
- 未確認 narrative candidate の全文
- 公式設定のように見える未確認 lore
- Passport schema や domain state の内部語

fallback:

- adopted story log candidate がない場合は、既存の event summary と標準結果文から log を作る。
- story log は補助 surface であり、未生成でも event-first 体験は止まらない。

## Watch / Help / Trial Boundary

Generated narrative は `watch` / `help` / `trial` の意味を上書きしない。

固定する意味:

- `watch`: 今は手を出さず、様子を見る。resource cost は0。
- `help`: 小さな祝福で、良い変化を狙う。
- `trial`: 成長のきっかけになる小さな困難を与える。

生成文でしてよいこと:

- プレイヤーの選択を分かりやすく言い換える。
- 結果を短く補足する。
- キャラクターの反応を、未確認 lore にならない範囲で表現する。

生成文でしてはいけないこと:

- `watch` を報酬稼ぎや消費ありにする。
- `help` を必ず成功する万能介入にする。
- `trial` を罰や死亡、寿命、勲章に結びつける。
- domain の resource cost や result を変更したように見せる。

## Mobile / A11y Considerations

390px / 360px では、generated narrative は短く、操作対象を隠さない。

確認観点:

- comment bubble は住民クリックと event `!` を隠さない。
- event window の本文が長くなりすぎず、`見守る` / `助ける` / `試練` に届く。
- result card は結果確認ボタンを画面外へ押し出しすぎない。
- story log は補助 surface に留まり、main sandbox を奪わない。
- 重要情報を色や絵文字だけに依存しない。
- generated text がなくても同じ操作ができる。

## Ready Conditions

- comment bubble / event window / result card / story log の表示可能範囲が定義されている。
- `candidate` / `needs-review` / `rejected` / `adopted` と runtime / display fallback の扱いが明確である。
- `watch` / `help` / `trial` の意味を上書きしない方針が明記されている。
- Codex生成待ちで gameplay を止めない。
- 箱庭上ラベル、死亡、寿命、勲章、Passport schema 変更が復活していない。
- 実装ファイルを触っていない。

## Testing Requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Preferred Outcome

Line 4 の後続実装者は、この文書だけを読めば、generated narrative をどの surface に出してよいか判断できる。

Narrative GM が候補を返しても、採用済みでなければ event-first UI は fallback で進み、採用済みなら短い補助文として安全に表示できる。

## Safe Fallback Outcome

generated narrative が未生成、候補、確認待ち、不採用、または壊れている場合は、既存の deterministic event summary、situation tags、標準 intervention result 文、標準 story log で進む。

fallback は gameplay failure ではない。fallback 中も箱庭、イベント子画面、介入、結果表示は止めない。

## Out Of Scope

- EventFirstSandbox 実装修正
- CSS修正
- narrative生成実装
- domain / persistence変更
- Passport schema変更
- Codex App Server実装
- 画像生成API呼び出し
- APIキーUI追加
- 箱庭上のキャラ名、場所、状態ラベル復活
- 死亡、寿命、勲章復活
- `focusedCharacter` / `selectedCharacter` 中心への巻き戻し
- `watch` / `help` / `trial` の意味変更
- Codex生成待ちで gameplay を止める設計

## One-line Codex Resume Instruction

```bash
codex "Read docs/architecture/sandbox-narrative-surface-spec.md, refine the sandbox generated narrative surface specification exactly, keep it docs-first, and test until complete."
```
