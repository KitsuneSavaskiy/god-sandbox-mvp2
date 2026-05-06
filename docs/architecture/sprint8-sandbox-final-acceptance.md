# Sprint8 Sandbox Final Acceptance

Status: Sprint8 closeout QA document

PBI: `PBI-QA-SPRINT8-SANDBOX-FINAL-ACCEPTANCE-001`

Owner: Line 4 / Event Experience / Tutorial / Narrative

## Purpose

Sprint8でmain入りした箱庭体験が、次Sprintへ進める完了品質に達しているかを最終確認する。

この文書はQA結果の記録であり、`EventFirstSandbox`、CSS、domain、persistence、Passport schema、public asset は変更しない。

## Final Vision

プレイヤーは `/sandbox` で、4名の住民がいる箱庭を見て、時間・季節HUDを読み、`!` からイベント子画面を開き、`見守る` / `助ける` / `試練` を選び、結果を受け取れる。

generated narrative が未生成でも、既存のevent summary、標準result、story log fallbackで進行できる。

## Source Of Truth

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/architecture/ui-state-model.md`
- `docs/architecture/event-and-intervention-spec.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`
- `docs/architecture/sandbox-generated-content-mobile-a11y-spec.md`
- `docs/architecture/sandbox-time-season-narrative-hook-spec.md`
- `docs/architecture/generated-content-status-copy-spec.md`

## QA Target

- branch base: `origin/main`
- checked commit: `4f50bbe docs: define asset sidekick personas`
- route: `/sandbox`
- viewport checks:
  - desktop: 1440px class
  - mobile: 390px
  - mobile: 360px

## QA Method

Manual/browser-style acceptance was checked with a local dev server and browser automation.

The QA verified:

- DOM state for interaction targets.
- visible sandbox screenshots.
- viewport horizontal overflow by comparing `scrollWidth` and `clientWidth`.
- eventWindowOpen pause by checking the HUD label remained stable after waiting.
- latestOutcome pause by checking the HUD label remained stable after intervention result.
- code/static asset consistency for all time/season background paths.

No screenshots or generated local outputs are committed by this PBI.

## Acceptance Result Summary

| Area | Result |
| --- | --- |
| desktop | Pass |
| 390px | Pass |
| 360px | Pass |
| Eve sprite | Pass |
| Garan / Ryo / Suzu fallback | Pass |
| activeSlots[4] display | Pass |
| resident click detail | Pass |
| time-season HUD | Pass |
| event flow | Pass |
| eventWindowOpen pause | Pass |
| latestOutcome pause | Pass |
| generated narrative fallback | Pass |
| sandbox label ban | Pass |
| death / lifespan / medals ban | Pass |

## Viewport Results

| Viewport | Horizontal overflow | Event window | Result card | Notes |
| --- | --- | --- | --- | --- |
| desktop | `scrollWidth == clientWidth` | opened by `!` bubble | result shown after `助ける` | sandbox remains event-first |
| 390px | `scrollWidth == clientWidth` | opened by `!` bubble | result shown after `助ける` | no horizontal overflow |
| 360px | `scrollWidth == clientWidth` | opened by `!` bubble | result shown after `助ける` | no horizontal overflow |

## Resident Display

Confirmed:

- Eve uses the ready sprite path in the sandbox display.
- Garan, Ryo, and Suzu use portrait / fallback display.
- Four active residents are visible in the sandbox.
- Resident body click opens CharacterDetailPanel.
- CharacterDetailPanel can open without losing the event-first sandbox context.

Observed resident display classes include:

- Eve: `sprite-ready`
- Garan: `sprite-fallback`
- Ryo: `sprite-fallback`
- Suzu: `sprite-fallback`

## Time-Season HUD

Confirmed:

- HUD is visible in the sandbox upper-left area.
- HUD exposes the current time and season with accessible text.
- Observed label: `箱庭の時間は昼、季節は春です`
- UI supports the following time labels:
  - 朝
  - 昼
  - 夕方
  - 夜
- UI supports the following season labels:
  - 春
  - 夏
  - 秋
  - 冬

Static check confirmed all 16 background image paths exist:

- spring morning / noon / evening / night
- summer morning / noon / evening / night
- autumn morning / noon / evening / night
- winter morning / noon / evening / night

Fallback path remains defined for missing background cases.

## Event Flow

Confirmed:

- `!` bubble opens the event window.
- Event window includes `見守る` / `助ける` / `試練`.
- `助ける` can produce a result card.
- latest outcome includes result text, remaining power, and next event summary.
- generated narrative is not required for event flow.
- Current event can proceed with deterministic summary and standard result text.

## Pause Verification

Confirmed:

- During eventWindowOpen, HUD label remained stable after waiting.
- During latestOutcome, HUD label remained stable after waiting.
- Codex generation or generated narrative availability was not required for gameplay progress.

Pause reasons remain:

- `eventWindowOpen`
- `latestOutcome`

Not pause reasons:

- Codex生成待ち
- generated narrative未生成
- generated asset未生成
- needs-review

## Forbidden Regression Check

Confirmed for the sandbox viewport:

- No character name labels are displayed on the sandbox surface.
- No place labels are displayed on the sandbox surface.
- No `主役` / `脇役` / `見守り中` status labels are displayed on the sandbox surface.
- No vitality / harmony numeric labels are displayed on the sandbox surface.
- No death, lifespan, or medals are displayed.
- No Passport schema behavior is involved.
- `focusedCharacter` / `selectedCharacter` is not restored as the main sandbox state.

Allowed sandbox surface text remains limited to:

- HUD labels
- comment bubbles / emotion markers
- event `!`

## Blocker

None.

## Non-Blocker

None for Sprint8 closeout.

## Follow-Up

Recommended nextSprint candidates:

- generated narrative reader implementation from adopted narrative packs.
- generated content mobile QA automation, if the team wants repeatable screenshot checks.
- CharacterDetailPanel copy/layout cleanup can continue in Line 3 if desired, but it is not a Sprint8 sandbox blocker.
- Claude SPECA audit should run after this closeout group is merged to main.

## Ready Conditions

This PBI is ready when:

- final QA result is documented.
- blocker / non-blocker / follow-up are separated.
- desktop / 390px / 360px results are recorded.
- `EventFirstSandbox` implementation is not changed.
- generated narrative missing/fallback behavior is documented.
- sandbox label ban is confirmed.

## Safe Fallback

If generated narrative is missing, pending, needs-review, or rejected, the sandbox continues with:

- deterministic event summary.
- standard intervention result text.
- existing story log fallback.

Gameplay must not wait for generated content.

## Out Of Scope

- EventFirstSandbox implementation changes.
- CSS changes.
- domain / persistence changes.
- Passport schema changes.
- public art changes.
- asset or manifest changes.
- QA automation implementation.
- Playwright installation.
- Codex App Server implementation.
- image generation API calls.

## Testing Requirements

Before PR:

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## One-Line Codex Resume Instruction

```bash
codex "Read docs/architecture/sprint8-sandbox-final-acceptance.md, complete the Sprint8 sandbox final acceptance QA documentation exactly, keep it QA-first, and test until complete."
```
