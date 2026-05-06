# Sandbox Time Season Narrative Hook Spec

Status: Sprint8 docs-first specification

PBI: `PBI-ARCH-SANDBOX-TIME-SEASON-NARRATIVE-HOOK-SPEC-001`

Owner: Line 4 / Event Experience / Tutorial / Narrative

## Purpose

朝、昼、夕方、夜と、春、夏、秋、冬を generated narrative の context として安全に使うための仕様を定義する。

この文書は narrative 表示の受け皿仕様であり、domain効果、実時間連動、季節イベント生成、EventFirstSandbox実装は扱わない。

## Current failure

時間帯や季節が UI に入ると、generated narrative がそれを gameplay rule のように扱ってしまうリスクがある。

避けたいこと:

- 朝だから必ず特定イベントが起きる、と生成文が断定する。
- 夏だから能力が上がる、冬だから体力が減る、など domain効果を作る。
- 実時間や現実のカレンダーと同期しているように見せる。
- 未確認の季節loreを公式設定として story log に固定する。
- Codex生成待ちで時計、背景、event flow が止まる。

## Final vision

時間帯と季節は、箱庭の雰囲気を補助する narrative context として使う。

生成文は「朝の光」「春の空気」「夜の静けさ」のような短い雰囲気づけに使える。ただし、event generation、intervention result、resource cost、character growth の意味は変えない。

時間帯や季節の narrative が未生成、確認待ち、不採用の場合でも、既存の event summary、situation tags、標準 result 文で進行する。

## Source Of Truth

- `docs/architecture/event-and-intervention-spec.md`
- `docs/architecture/ui-state-model.md`
- `docs/architecture/sandbox-clock-season-cycle-spec.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`
- `docs/architecture/generated-content-status-copy-spec.md`
- `docs/architecture/sandbox-narrative-surface-spec.md` if merged
- `.agents/skills/godsandbox-scrum-orchestrator/references/sprint8-guardrails.md`
- `.agents/skills/godsandbox-scrum-orchestrator/references/blocker-rules.md`

## Time And Season Vocabulary

UI表示では、内部名ではなく短い日本語を使う。

| Internal key | User-facing label | Narrative use |
| --- | --- | --- |
| `morning` | 朝 | やわらかい光、始まり、静かな気配 |
| `noon` | 昼 | 明るさ、広場のにぎわい、見通し |
| `evening` | 夕方 | 影、帰り道、少し落ち着いた空気 |
| `night` | 夜 | 静けさ、灯り、眠る前の気配 |
| `spring` | 春 | 新芽、やわらかい風、始まり |
| `summer` | 夏 | 強い光、熱気、活発さ |
| `autumn` | 秋 | 落ち着き、葉の色、実り |
| `winter` | 冬 | 冷たい空気、静けさ、白さ |

これらは narrative tone の補助語であり、domain rule ではない。

## Allowed Narrative Hooks

Generated narrative が使ってよいもの:

- event window の短い情景文
- story log の短い背景描写
- result card の余韻としての季節感
- comment bubble のごく短い雰囲気語

例:

- 朝の光の中で、小さな変化が見えます。
- 春の風が、出来事の気配を少しだけ運んできます。
- 夜の静けさの中で、選んだ関わり方の結果が残ります。

## Disallowed Narrative Hooks

Generated narrative がしてはいけないこと:

- 時間帯や季節を event発生条件として断定する。
- 時間帯や季節に resource cost、成長補正、成功率を結びつける。
- 実時間、現実の日付、現実の季節と同期しているように書く。
- 季節限定報酬、季節称号、勲章を作る。
- 死亡、寿命、病気、不可逆な損失を季節効果として書く。
- `watch` / `help` / `trial` の意味を季節によって変える。

## Surface Rules

| Surface | Time/season narrative allowed | Limits |
| --- | --- | --- |
| comment bubble | Very short mood words only. | キャラ名、場所、状態ラベルの代替にしない。 |
| event window | Eventの理解を助ける短い情景文。 | event本文や選択肢の意味を上書きしない。 |
| result card | 結果の余韻として短く添える。 | domain resultを変えない。 |
| story log | 補助的な記録として季節感を添える。 | loreや公式設定を勝手に固定しない。 |

## Status Handling

| Narrative state | Time/season handling |
| --- | --- |
| `candidate` | 表示しない。fallbackで進行する。 |
| `needs-review` | 表示しない。fallbackで進行する。 |
| `adopted` | surface rulesを満たす場合だけ表示できる。 |
| `fallback` | 既存event summary / situation tags / result文で進行する。 |
| `rejected` | 表示しない。fallbackで進行する。 |
| `missing` | fallbackで進行する。 |

## Gameplay Async Rule

Codex生成完了を gameplay は同期的に待たない。

時間帯・季節に合う narrative があれば使える。なければ fallback で進む。

`eventWindowOpen` と `latestOutcome` の pause は維持する。ただし、Codex生成待ち、narrative pending、needs-review は pause 理由にしない。

## Watch / Help / Trial Boundary

時間帯・季節の generated narrative は、次の意味を変えない。

- `watch` / 見守る: 今は手を出さず様子を見る。
- `help` / 助ける: 小さな祝福で良い変化を狙う。
- `trial` / 試練: 成長のきっかけになる小さな困難を与える。

例外は作らない。朝だけhelpが強い、冬だけtrialが危険、などの文はrejectする。

## Ready Conditions

- 時間帯と季節を narrative context として扱う範囲が分かる。
- domain効果や実時間連動ではないことが明確である。
- comment bubble / event window / result card / story log での扱いが分かる。
- candidate / needs-review は表示しない。
- Codex生成待ちで gameplay を止めない。
- `watch` / `help` / `trial` の意味を変えない。
- 実装ファイルを触っていない。

## Safe Fallback

- 時間帯・季節 narrative がない場合は、既存event summaryと標準result文で進行する。
- 判断に迷う時間・季節表現は使わない。
- mobile表示で長い場合はfallbackにする。
- 季節や時間が原因で event flow を止めない。

## Preferred Outcome

時間帯と季節は、箱庭を少し豊かに見せる背景文脈として働く。

プレイヤーは、朝昼夕夜や春夏秋冬を感じながらも、event-first flow、介入選択、結果確認を迷わず続けられる。

## Out Of Scope

- EventFirstSandbox 実装修正
- 背景画像実装
- HUD実装
- CSS修正
- domain効果
- 実時間連動
- カレンダー機能
- 天候システム
- 季節イベント生成
- narrative生成実装
- Codex App Server実装
- Passport schema変更

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
codex "Read docs/architecture/sandbox-time-season-narrative-hook-spec.md, refine the sandbox time and season narrative hook specification exactly, keep it docs-first, and test until complete."
```
