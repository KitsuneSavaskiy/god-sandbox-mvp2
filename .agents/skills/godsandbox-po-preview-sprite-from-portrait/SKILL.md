---
name: godsandbox-po-preview-sprite-from-portrait
description: Create and wire a GodSandbox PO-preview resident animation from one portrait as one combined sprite sheet when two canonical sheets are unstable; covers source-canonical sizing, PO iteration, sprite:fit evaluation, low-effort subagent review, variable-width failed rows, and sandbox runtime playback.
---

# GodSandbox PO Preview Sprite From Portrait

Use this skill when a resident needs an animation preview from one portrait and
the canonical two-sheet generation path is unstable. The goal is a PO-reviewable
animation in the sandbox, not canonical ready adoption.

## Hard Rules

- Keep source and work files under `assets/generated/residents/<slug>/po-preview/`.
- Use one combined preview PNG by default, not separate motion and extended PNGs.
- Do not copy to `incoming/` or mark canonical ready.
- Do not commit generated preview images unless the PO explicitly asks.
- `public/art/**` may be used only as a versioned PO preview asset when wiring a
  local app preview, for example `resident-sprite-sheet-combined-preview-v14.png`.
- Runtime metadata must match the real PNG: `frameWidth`, `frameHeight`,
  `columns`, `rows`, and per-motion `frames`.
- If PO selects a generated source image as the size reference, preserve that
  source-canonical size instead of forcing `192x208`.
- Every row box must have the exact same `frameHeight`, including sitting,
  fallen, or empty-looking rows.

## Default Combined Row Manifest

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

The row count may change only when the PO approves a new preview contract. Record
the chosen contract in the preview manifest.

## Workflow

1. Generate candidate art from the portrait with `imagegen` or `hatch-pet`.
2. Let PO choose the best size/readability candidate if sizes drift.
3. Define the preview contract: `columns`, `rows`, `frameWidth`, `frameHeight`,
   canvas size, row manifest, and any variable-width row rules.
4. Repack the selected source into a uniform row grid. Keep all rows exactly
   `frameHeight` tall.
5. Repair only the failing row/cells when PO points out a concrete issue.
6. Run `sprite:fit` with the exact preview contract.
7. Ask a subagent with `reasoning_effort=low` to review the selected result.
8. Wire the preview into the manifest and sandbox only after the gate passes.
9. Have PO review in the local browser, then iterate from the specific PO
   finding. Do not restart the full pipeline unless the source is unusable.

## Evaluation

For a source-canonical `7 x 14`, `118 x 136` sheet:

```bash
npm run sprite:fit -- assets/generated/residents/<slug>/po-preview/resident-sprite-sheet-combined.png --kind combined --columns 7 --rows 14 --frame-width 118 --frame-height 136 --min-margin-x 3 --min-margin-top 3 --min-margin-bottom 3 --edge-band 3 --row-seam-band 3 --out assets/generated/residents/<slug>/po-preview/resident-sprite-sheet-combined.fit.json
```

For other layouts, pass the actual selected values:

```bash
npm run sprite:fit -- assets/generated/residents/<slug>/po-preview/resident-sprite-sheet-combined.png --kind combined --columns <columns> --rows <rows> --frame-width <frameWidth> --frame-height <frameHeight> --out assets/generated/residents/<slug>/po-preview/resident-sprite-sheet-combined.fit.json
```

Pass means:

- canvas equals `columns * frameWidth` by `rows * frameHeight`,
- every used frame is nonempty,
- visible pixels respect safe margins,
- top/bottom edge bands and row seams are empty,
- each row keeps the exact selected `frameHeight`,
- no large detached body parts are detected,
- metadata matches the PNG and runtime playback.

Small detached emote effects can be warnings. Detached body parts in normal
motion rows are not acceptable unless the row has an explicit variable-width
playback rule.

## Variable-Width Failed Row

Use this when a failed/fallen pose needs more horizontal space than one cell.

Example from Eve:

```txt
row 5 failed:
  cells 1, 2, 3: single-cell transition frames
  cells 4-5: one fallen body frame
  cells 6-7: one fallen body frame
  mixed-row spans: 1,1,1,2,2
```

Evaluate it with:

```bash
npm run sprite:fit -- assets/generated/residents/<slug>/po-preview/resident-sprite-sheet-combined.png --kind combined --columns 7 --rows 14 --frame-width 118 --frame-height 136 --min-margin-x 3 --min-margin-top 3 --min-margin-bottom 3 --edge-band 3 --row-seam-band 3 --mixed-row 5:1,1,1,2,2 --out assets/generated/residents/<slug>/po-preview/resident-sprite-sheet-combined.fit.json
```

Runtime must not play this row with normal equal-width `steps(columns)`.
Implement a dedicated animation for the variable row:

- set the motion metadata frame count to the number of logical frames,
- enlarge the viewport to the maximum span only for that motion,
- keyframe each logical frame to its real x-offset and width,
- trigger the motion from gameplay state, for example trial result -> `failed`.

## Runtime Wiring

When wiring a combined preview into the sandbox:

- Register motion and extended manifest entries pointing to the same PNG.
- Motion metadata maps rows 0-7; extended metadata maps rows 8-13.
- Set `frameWidth`, `frameHeight`, `columns`, `rows`, and `frames` from the PNG.
- Use CSS display scaling for sandbox readability, for example
  `--resident-display-scale: 1.5`; do not change the PNG to fake scale.
- If a motion is variable-width, add motion-specific CSS and state selection.
- Confirm the browser URL returns the latest asset with a cache-busting query.

## Mandatory Low-Effort Subagent Check

After every selected generation or repaired preview, spawn or reuse a subagent
with `reasoning_effort=low`. The subagent must not edit files.

Give it:

- PNG path,
- contact sheet path if available,
- intended `columns`, `rows`, `frameWidth`, `frameHeight`,
- row manifest,
- variable-width row rules such as `mixed-row 5:1,1,1,2,2`,
- `sprite:fit` report path,
- concrete PO concern being checked.

It reports `accept` or `reject` and any residual PO visual risk. The lead agent
then double-checks before accepting.

## Prompt And Repair Loop

If quality fails:

- Identify the exact row, cell, and failure code.
- Prefer repairing or regenerating only that row/cell group.
- Tighten the prompt with exact columns, rows, full-body cells, attached feet,
  safe margins, no labels, and one combined sheet.
- If repeated crop failure happens, reduce columns only after recording the new
  preview contract.
- Never hide a broken sheet with CSS offsets, crop tricks, or mismatched metadata.

## Output Manifest

Write a manifest beside the preview PNGs with:

- source portrait path,
- generated source image path,
- selected preview contract,
- row manifest,
- runtime motion mapping,
- variable-width row rules,
- manual repairs,
- `sprite:fit` report paths,
- low-effort subagent result,
- `PO preview only; not canonical ready`.
