# Resident sprite PO preview quality gate

Status: PO preview gate. This does not replace canonical ready rules.

## Purpose

Use this gate before asking PO to judge a generated resident animation preview.

Canonical ready still requires the standard `8 columns x 9 rows`, `192x208`,
`1536x1872`, `sprite:check`, visual audit, human review, and PO approval.

For PO preview only, use one combined preview sheet when two separate generated
sheets keep drifting in scale, layout, or quality. Preview sheets must not be
copied to `incoming/` or canonical ready paths. `public/art/**` may be used only
for a versioned PO preview asset when the local app needs to render it, for
example `resident-sprite-sheet-combined-preview-v14.png`.

## Preview Display Contract

The sandbox renderer slices animation using manifest values:

```txt
frameWidth
frameHeight
columns
rows
motions[motion].row
motions[motion].frames
```

For Eve PO preview, PO selected the generated source image with the best size
balance as the visual reference. This Eve-shaped grid is also the PO preview
source of truth for Garan generation. It is not canonical ready. The animation
metadata follows this image instead of forcing it back into the old `192x208`
preview frame:

```txt
frame: 118 x 136
columns: 7
rows: 14
canvas width: 826
canvas height: 1904
file: resident-sprite-sheet-combined.png
```

The repo animation implementation reads `frameWidth`, `frameHeight`, `columns`,
`rows`, `motions[motion].row`, and `motions[motion].frames` from metadata.
Therefore, the frame size and row index are the hard requirements for slicing.
For this PO preview, `118x136` is the selected frame size. This is not canonical
ready for the old `1536x1872` atlas.

For Garan specifically, reject generated candidates that do not match this
grid. A `13 rows x 6 columns` output, or a larger-cell workaround such as
`180x170`, is not acceptable. If Garan appears clipped inside this grid, the
correct fix is to regenerate the Codex pet source to fit the grid, not to change
the grid.

For PO readability, the character should keep the selected source image's size
balance while leaving a small safety margin:

```txt
standing body target height: follows the selected source image
minimum top/bottom safety margin: 3 px
minimum left/right safety margin: 3 px
row 5 failed may be shorter if it uses a sitting or falling pose
```

For Garan, use a stricter target because horns, hair, and a stockier body make
the `118x136` cell easier to overfill:

```txt
target full silhouette width: 76-88 px
target full silhouette height: 104-114 px
left/right safe margin: 8 px or more
top safe margin: 10-12 px, including horns and hair
bottom safe margin: 10-12 px, including feet and boots
feet baseline: 10-14 px above the cell bottom
```

If Garan exceeds this box, regenerate with a smaller whole-body scale. Do not
crop body parts, and do not change the PO preview grid unless PO explicitly
selects a new grid.

Even when a row contains a sitting or fallen pose, the extraction row itself
must remain exactly the selected `frameHeight` including blank padding. The
visible body may be shorter, but the animation frame box must stay aligned to
the same row grid as every other motion.

This puts both motion groups in one image, so character scale is fixed across
all motions. It is still a PO preview contract, not canonical ready.

Row manifest:

```txt
row 0: idle
row 1: walk-right
row 2: walk-left
row 3: waving
row 4: jumping
row 5: failed
row 6: waiting
row 7: review
row 8: walk-up / walk-back
row 9: walk-down / walk-forward
row 10: emote-happy
row 11: emote-angry
row 12: emote-sad
row 13: emote-surprised
```

If a preview-only spare row is needed later, create a separate preview manifest.
Do not add unused rows to this PO-selected source-canonical sheet.

## Evaluation Function

`sprite:fit` is a preflight gate. It is required, but it is not the complete
quality function. Recent PO reviews showed that a sheet can pass cell-boundary
checks while still being too small in the sandbox, visually clipped, or animated
with an unnatural frame order.

Use this acceptance function:

```txt
accept =
  hardGatesPass
  AND qualityScore >= 90
  AND everyScorePart >= 80
  AND lowEffortSubagent == ACCEPT
  AND leadDoubleCheck == ACCEPT
```

Hard gates:

- The visual source is Codex pet / hatch-pet generated, with evidence recorded.
- For Garan PO preview, the candidate uses the fixed Eve-shaped grid:
  `826x1904`, `14 rows x 7 columns`, `118x136` cells.
- PNG size equals `columns * frameWidth` by `rows * frameHeight`.
- Runtime metadata and preview page use the same `columns`, `rows`,
  `frameWidth`, `frameHeight`, row indexes, frame counts, and PNG version.
- `sprite:fit` passes with the exact selected contract.
- No head, horns, hands, feet, body, or emote effect appears cut off or crosses
  a logical frame boundary.
- The sandbox-rendered resident uses the intended display scale and the same
  sprite version as the PO preview page.

Score parts:

```txt
contractScore      20
containmentScore   20
motionFlowScore    20
rowSemanticScore   15
sandboxScaleScore  15
styleEvidenceScore 10
```

Scoring definitions:

- `contractScore`: canvas, grid, row manifest, manifest metadata, runtime
  metadata, and preview page all agree.
- `containmentScore`: full-body silhouettes are visually complete inside each
  logical frame. Numeric top/bottom margins are necessary but not sufficient:
  reject if the head, horns, feet, or pose appears clipped.
- `motionFlowScore`: frame order follows the intended movement. Use sequential
  `0 -> 1 -> ...` playback unless a row explicitly documents ping-pong,
  variable-width, or held-frame behavior. Reject rows that slide while facing
  the wrong direction or show nearly no motion when motion is expected.
- `rowSemanticScore`: row meanings match the manifest. `waiting` differs from
  `idle`; `jumping` has airborne motion; `walk-forward` reads as approaching
  the viewer; `emote-surprised` does not read as anger.
- `sandboxScaleScore`: render the resident in the sandbox at the same y position
  as an accepted resident. The displayed body height should stay close to the
  PO-approved roster size. If the character is clearly smaller or larger than
  Eve/Ryo/Suzu, adjust display scale or regenerate before PO review.
- `styleEvidenceScore`: the result remains Codex pet pixel-art-adjacent, and the
  manifest records source images, generated paths, deterministic repack steps,
  `sprite:fit`, low-effort review, and lead double-check.

The lead agent must record the score parts in the preview manifest or the PR
summary. A subagent review with `reasoning_effort=low` must check the same
function and cannot override a failed hard gate.

Run:

```bash
npm run sprite:fit -- assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.png --kind combined --columns 7 --rows 14 --frame-width 118 --frame-height 136 --min-margin-x 3 --min-margin-top 3 --min-margin-bottom 3 --edge-band 3 --row-seam-band 3 --out assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.fit.json
```

Only use a different source-canonical layout when PO explicitly selects a new
grid. Otherwise, use the Eve-shaped `7x14 / 118x136` contract above:

```bash
npm run sprite:fit -- assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.png --kind combined --columns <columns> --rows <rows> --frame-width <frameWidth> --frame-height <frameHeight> --out assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.fit.json
```

The evaluator checks:

- the canvas equals `columns * frameWidth` by `rows * frameHeight`,
- nonblank cells contain visible pixels,
- blank rows are fully transparent when `--blank-row` is used,
- visible pixels stay inside the safe area,
- the top and bottom edge bands are empty,
- row seams are empty, so playback never samples pixels from the previous or next row,
- every row reports the same selected `frameHeight`, including low-pose rows,
- large detached components are absent.

If a row intentionally uses variable-width frames, pass its logical frame spans.
For Eve's failed row, the first three logical frames use one cell each and the
last two logical frames use two cells each:

```bash
npm run sprite:fit -- assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.png --kind combined --columns 7 --rows 14 --frame-width 118 --frame-height 136 --min-margin-x 3 --min-margin-top 3 --min-margin-bottom 3 --edge-band 3 --row-seam-band 3 --mixed-row 5:1,1,1,2,2 --out assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.fit.json
```

## Required Subagent Review

Immediately after each generated image is selected, the lead agent must ask a
subagent to review the image against this quality gate.

The subagent must be started with:

```txt
reasoning_effort: low
```

The subagent review is required for:

- every newly generated combined candidate,
- every regenerated row or reduced-column retry,
- every normalized atlas before PO review.

The subagent must check:

- whether the image follows the intended `columns x rows` layout,
- whether every used frame keeps head, torso, and feet inside one selected frame cell,
- whether the apparent head and feet are visually complete, not just numerically inside margins,
- whether all 14 row meanings match the combined row manifest,
- whether the frame order matches the intended motion flow,
- whether sandbox display scale keeps the resident close to the accepted roster size,
- whether the spare row, if any, is fully transparent and not used as motion,
- whether the generated result should be accepted, regenerated, or reduced in columns,
- whether the current prompt needs a concrete correction.

The subagent must not edit files. It reports findings only. The lead agent then
updates the prompt, regenerates, or accepts the candidate.

## Pass Criteria

A PO preview candidate can be shown only when:

- the full `accept` function above is true,
- `sprite:fit` passes for the combined sheet,
- the PNG width equals `columns * frameWidth`,
- the PNG height equals `rows * frameHeight`,
- every used frame has the selected safe left/right margin,
- every used frame has the selected safe top/bottom margin,
- no visible pixels appear in the configured edge band,
- no visible pixels appear across row seams,
- low-pose rows preserve the same selected `frameHeight` as standing rows,
- no large detached body-part components are detected,
- small detached emote effects are warnings only when they appear in emote rows,
- rows match the selected combined row manifest,
- metadata records the same `columns`, `rows`, `frameWidth`, `frameHeight`, and `frames` values used by the PNG,
- any optional spare row is fully transparent,
- contact sheet review confirms head, torso, and feet are inside one logical frame.

For variable-width rows, "one logical frame" can span more than one cell.
Example: failed row `--mixed-row 5:1,1,1,2,2` uses cells 1, 2, and 3 as
single-cell frames, then cells 4-5 and 6-7 as two-cell frames.

## Sandbox Runtime Contract

If the preview is wired into the sandbox:

- register motion and extended manifest entries against the same combined PNG,
- keep metadata equal to the PNG's real `frameWidth`, `frameHeight`, `columns`,
  `rows`, and per-motion `frames`,
- use display-only CSS scaling such as `--resident-display-scale: 1.5`,
- do not resize the PNG to solve display size,
- for variable-width rows, do not use normal equal-width `steps(columns)`;
  instead add motion-specific keyframes that set frame width and x-offset,
- connect gameplay state to the motion, for example `trial` result for the
  primary resident selects `failed`.

## Regeneration Loop

If `sprite:fit` fails:

1. Identify the failing row and failure code.
2. Ask a `reasoning_effort=low` subagent to review the generated image and
   prompt against this document.
3. Tighten the prompt around that failure.
4. Prefer regenerating only the failing row or a small row group.
5. For Garan, after three fresh full-sheet attempts fail because of wrong
   row/column count or clipping, stop full-sheet retries. Switch to fresh
   row-by-row or frame-by-frame Codex pet generation, then deterministically
   pack only those fresh generated rows/frames into the fixed `14x7 / 118x136`
   grid.
6. Do not use old Garan sprite sheets as packer input. They are rejected
   evidence only.
7. Only reduce columns, enlarge cells, or change canvas size if PO explicitly
   selects a new preview contract.
8. Never hide broken frames with CSS cropping or row offsets.

Prompt changes must explicitly mention:

- exact column and row count,
- one combined sheet, not two separate sheets,
- complete full-body sprite in every cell,
- feet attached to the body,
- no head-only or foot-only rows,
- generous empty margin above and below each sprite,
- flat `#ff00ff` background or transparent background.

## Classification

PO preview candidate:

- allowed under `assets/generated/**`,
- allowed for local visual review,
- not eligible for ready promotion,
- not a canonical generation proof,
- not committed as adopted art.
