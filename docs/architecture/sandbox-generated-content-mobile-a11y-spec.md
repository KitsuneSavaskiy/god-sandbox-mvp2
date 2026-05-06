# Sandbox Generated Content Mobile A11y Spec

Status: Sprint8 docs-first specification

PBI: `PBI-QA-SANDBOX-GENERATED-CONTENT-MOBILE-A11Y-SPEC-001`

Owner: Line 4 / Event Experience / Tutorial / Narrative

## Purpose

390px / 360px のスマホ幅で、generated content、HUD、comment bubble、event window、result card、story log が破綻しないための QA 仕様を定義する。

この文書は mobile / a11y の受け皿仕様であり、EventFirstSandbox実装、CSS、narrative生成、domain、persistence、Passport schema は変更しない。

## Current failure

Generated content は、短いと便利だが、長くなるとスマホ幅で主操作を押し出しやすい。

起きてほしくないこと:

- comment bubble が住民クリックや `!` を隠す。
- event window の生成文が長くなり、`見守る` / `助ける` / `試練` が見えなくなる。
- result card が画面外に押し出され、結果が読めない。
- story log が主画面を奪う。
- HUD、comment bubble、event window が重なり、操作不能になる。
- 色や生成文だけで意味を伝え、読みづらい人に情報が届かない。

## Final vision

Generated content がある場合でも、スマホ幅では event-first flow が最優先になる。

プレイヤーは 390px / 360px で、箱庭を見る、イベントを開く、`見守る` / `助ける` / `試練` を選ぶ、結果を見る、必要ならstory logを確認する流れを続けられる。

生成文が長い、未確認、表示に不安がある場合は、短いfallback文で進行する。

## Source Of Truth

- `docs/architecture/event-and-intervention-spec.md`
- `docs/architecture/ui-state-model.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`
- `docs/architecture/generated-content-status-copy-spec.md`
- `docs/architecture/sandbox-narrative-surface-spec.md` if merged
- `docs/architecture/gm-narrative-event-ui-acceptance-matrix.md` if merged
- `.agents/skills/godsandbox-scrum-orchestrator/references/sprint8-guardrails.md`
- `.agents/skills/godsandbox-scrum-orchestrator/references/blocker-rules.md`

## Mobile Widths

必須確認幅:

- 390px
- 360px

推奨補助確認:

- desktop幅
- 320px相当の極小幅が必要な場合はfollow-upで扱う。

## Surface QA Matrix

| Surface | 390px / 360px ready condition | Safe fallback |
| --- | --- | --- |
| HUD | 左上に収まり、住民クリック、comment bubble、event window buttonを邪魔しない。 | HUDを短縮表示し、内部状態名は出さない。 |
| comment bubble | 住民アニメーションの近くに短く出る。主操作や `!` を隠さない。 | emote icon、`!`、またはbubble非表示。 |
| event window | `見守る` / `助ける` / `試練` が見えて押せる。生成文は短く補助に留まる。 | 標準event summary / situation tagsで進行。 |
| result card | domain resultが読め、closeや次の操作が画面外へ逃げない。 | 標準result文だけにする。 |
| story log | 補助面として開ける。主画面を奪わない。 | 標準event summaryとresultの短い記録にする。 |
| CharacterDetailPanel導線 | 箱庭上ラベルなしでも住民クリック導線を完全に塞がない。 | 詳細導線を別surfaceで補うfollow-upを検討。 |

## Generated Narrative Length Rules

390px / 360px では、短さを優先する。

| Surface | Preferred length |
| --- | --- |
| comment bubble | 1 short phrase |
| event window | 1 short sentence or 2 very short sentences |
| result card | 1 short sentence after deterministic result |
| story log | 1 compact entry |

長さに迷う場合は `revise` ではなく、まずfallbackで進行できるようにする。

## A11y Rules

- 色だけで状態を伝えない。
- `!`、button text、短い説明文の組み合わせで意味が分かるようにする。
- 生成文だけに操作判断を依存しない。
- `watch` / `help` / `trial` の主要button labelを生成文で置き換えない。
- 内部状態名をUIに出さない。
- 長文はstory logへ逃がす前に、表示する必要があるか確認する。
- comment bubble は読み切れなくても event-first flow が進むようにする。

## Candidate Status Handling

| Narrative state | Mobile / a11y handling |
| --- | --- |
| `candidate` | 表示しない。fallbackで進行する。 |
| `needs-review` | 表示しない。fallbackで進行する。 |
| `adopted` | mobile条件を満たす場合だけ表示する。 |
| `fallback` | 標準文で進行する。 |
| `rejected` | 表示しない。fallbackで進行する。 |
| `missing` | fallbackで進行する。 |

## Pause Rules

Pauseする:

- `eventWindowOpen`
- `latestOutcome`

Pauseしない:

- Codex生成待ち
- narrative pending
- asset pending
- needs-review

Generated content の状態を理由に gameplay を止めない。

## Forbidden Mobile Regressions

次が起きた場合は blocker とする。

- 箱庭上にキャラ名、場所、状態ラベルが戻る。
- 死亡、寿命、勲章が表示される。
- `focusedCharacter` / `selectedCharacter` 中心へ戻る。
- `見守る` / `助ける` / `試練` が押せない。
- candidate / needs-review の文が player-facing UI に出る。
- Codex生成待ちで gameplay が止まる。
- Passport schemaに影響する文言や導線が出る。

## Manual QA Checklist

390px / 360px で確認する。

1. `/sandbox` を開く。
2. HUD が左上に収まり、住民やevent entryを大きく隠していない。
3. comment bubble と `!` が重なりすぎない。
4. event window を開き、`見守る` / `助ける` / `試練` が押せる。
5. generated narrative がある想定でも、event windowの主操作が押し出されない。
6. result card で deterministic result が読める。
7. story log が補助面に留まる。
8. CharacterDetailPanel導線が完全に塞がっていない。
9. candidate / needs-review を表示しない方針が守られている。
10. 迷った場合は fallback で進められる。

## Ready Conditions

- 390px / 360px の generated content QA観点がある。
- HUD、comment bubble、event window、result card、story log の破綻条件が分かる。
- candidate / needs-review を表示しない方針が明確である。
- Codex生成待ちで gameplay を止めない。
- 箱庭上ラベル非表示が維持されている。
- 実装ファイルを触っていない。

## Safe Fallback

- 表示が長い、読みにくい、操作を隠す場合は generated narrative を出さない。
- comment bubble は非表示またはemote fallbackにできる。
- event window は標準summaryとbuttonで進める。
- result card は標準result文で進める。
- story log は短い標準記録で進める。

## Preferred Outcome

Generated content がある場合でも、スマホ幅で操作の安心感が保たれる。

文章は世界観を少し豊かにするが、主操作、結果確認、event-first flow を邪魔しない。

## Out Of Scope

- EventFirstSandbox 実装修正
- CSS修正
- narrative生成実装
- domain / persistence変更
- Passport schema変更
- Codex App Server実装
- 画像生成API呼び出し
- 本格a11y監査自動化
- Playwright導入

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
codex "Read docs/architecture/sandbox-generated-content-mobile-a11y-spec.md, refine the sandbox generated content mobile a11y specification exactly, keep it docs-first, and test until complete."
```
