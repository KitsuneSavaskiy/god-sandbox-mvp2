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
balance as the visual reference. The animation metadata follows that image
instead of forcing it back into the old `192x208` preview frame:

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

For PO readability, the character should keep the selected source image's size
balance while leaving a small safety margin:

```txt
standing body target height: follows the selected source image
minimum top/bottom safety margin: 3 px
minimum left/right safety margin: 3 px
row 5 failed may be shorter if it uses a sitting or falling pose
```

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

Run:

```bash
npm run sprite:fit -- assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.png --kind combined --columns 7 --rows 14 --frame-width 118 --frame-height 136 --min-margin-x 3 --min-margin-top 3 --min-margin-bottom 3 --edge-band 3 --row-seam-band 3 --out assets/generated/residents/eve/po-preview/resident-sprite-sheet-combined.fit.json
```

If the generated preview uses a different source-canonical layout, pass that
exact frame and row layout:

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
- whether all 14 row meanings match the combined row manifest,
- whether the spare row, if any, is fully transparent and not used as motion,
- whether the generated result should be accepted, regenerated, or reduced in columns,
- whether the current prompt needs a concrete correction.

The subagent must not edit files. It reports findings only. The lead agent then
updates the prompt, regenerates, or accepts the candidate.

## Pass Criteria

A PO preview candidate can be shown only when:

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
5. If repeated cropping happens, reduce columns only for PO preview and record
   the new `columns` value in the preview manifest.
6. Never hide broken frames with CSS cropping or row offsets.

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
