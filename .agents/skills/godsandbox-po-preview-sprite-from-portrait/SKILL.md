---
name: godsandbox-po-preview-sprite-from-portrait
description: Create and wire a GodSandbox PO-preview resident animation from one portrait as one Codex pet pixel-art combined sprite sheet when two canonical sheets are unstable; covers hatch-pet/Codex pet execution, source-canonical sizing, PO iteration, sprite:fit evaluation, low-effort subagent review, variable-width failed rows, and sandbox runtime playback.
---

# GodSandbox PO Preview Sprite From Portrait

Use this skill when a resident needs an animation preview from one portrait and
the canonical two-sheet generation path is unstable. The goal is a PO-reviewable
Codex pet pixel-art animation in the sandbox, not canonical ready adoption.

If older pipeline docs or task recipes still describe an automated two-sheet
fullrun, do not use them for PO preview work. Eve and Ryo's interactive PO
repair loop is the source of truth until PO approves a replacement pipeline.

## Hard Rules

- Keep source and work files under `assets/generated/residents/<slug>/po-preview/`.
- Generate only one resident at a time. Do not run Ryo, Garan, Suzu, or any
  other resident sprite generation in parallel.
- Start the next resident only after the current resident has: hatch-pet final
  output, `sprite:fit` pass, low-effort subagent accept, lead double-check
  accept, and PO preview wiring ready for review.
- The visual source must be generated through the `hatch-pet` / Codex pet flow.
- The resulting character must be pixel-art or pixel-art-adjacent Codex pet
  style. Painterly, vector, smooth chibi, procedural, or local-script-drawn art
  is not acceptable.
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
- Do not create, draw, tile, warp, mirror, or synthesize resident visuals with
  Python/Pillow, SVG, canvas, HTML/CSS, or other code-native art as a substitute
  for Codex pet generation. Deterministic scripts may only repack, inspect, or
  validate already-generated Codex pet outputs.

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

## Eve PO-Approved Procedure As Canonical

Use the Eve iteration as the canonical operating procedure for later residents
such as Ryo, Garan, and Suzu.

Canonical preview contract unless PO changes it:

```txt
one combined preview PNG
rows: 14
columns: 7
frame: 118x136
canvas: 826x1904
runtime display scale: 1.5
motion rows: 0-7
extended rows: 8-13
failed row logical frames: 1,1,1,2,2
```

Eve PO review rules to preserve:

- Row count matters more than keeping the old two-sheet shape.
- Every row must keep the exact same cell height, including sitting/fallen rows.
- If a row is visually wrong, repair that row/cell group only.
- `failed` uses three single-cell transition frames, then two 2-cell fallen
  frames.
- The sandbox must use a dedicated failed animation instead of normal
  equal-width `steps(columns)` playback.
- Sandbox display should scale the resident to about `1.5`, without changing the
  PNG contract.
- After changing PNGs, clear cache or use a new versioned filename and restart
  the dev server before PO review.

Common PO checks:

- `jumping` must show enough airborne motion without top crop.
- `waiting` must read differently from `idle`.
- `walk-forward` must read as front-facing walking.
- `emote-surprised` must not look angry.
- No row may let animation pick up neighboring cells or another row.

## Workflow

1. Run the Codex pet / `hatch-pet` procedure below from the portrait.
2. Let PO choose the best Codex pet pixel-art candidate if sizes drift.
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

## One Resident At A Time

Resident-level generation must be sequential. Quality is more important than
throughput.

Use this gate:

```txt
current resident only:
  prepare hatch-pet run
  generate/record Codex pet base
  generate/record required rows
  finalize hatch-pet
  repack to one combined preview sheet
  sprite:fit pass
  reasoning_effort=low subagent accept
  lead double-check accept
  wire PO preview

next resident:
  start only after all current resident gates pass
```

Do not let multiple residents generate at the same time. Subagents may help with
row-level Codex pet jobs inside the one active resident only, but never use
subagents to generate different residents in parallel.

## Codex Pet Execution Procedure

Use the installed `hatch-pet` skill as the visual generation path. This is the
only acceptable normal path for creating resident visuals from a portrait.

Prepare one run folder per resident:

```bash
$env:SKILL_DIR = "$env:USERPROFILE\.codex\skills\hatch-pet"
$env:RUN_DIR = "$PWD\.hatch-pet-runs\<slug>-po-preview"
python "$env:SKILL_DIR\scripts\prepare_pet_run.py" `
  --pet-name "<ResidentName>" `
  --description "<ResidentName> as a GodSandbox resident Codex pet" `
  --reference "$PWD\public\art\characters\defaults\<slug>\portrait.png" `
  --output-dir "$env:RUN_DIR" `
  --pet-notes "small pixel-art Codex pet resident, compact chibi proportions, thick dark outline, limited palette, full body, readable at sandbox size" `
  --style-notes "pixel-art-adjacent Codex pet sprite, not painterly, not smooth vector, not anime key art, no soft gradients, no realistic texture" `
  --force
```

Inspect the ready jobs:

```bash
python "$env:SKILL_DIR\scripts\pet_job_status.py" --run-dir "$env:RUN_DIR"
```

Generate each ready visual job with `$imagegen` using the exact prompt file and
all input images listed in `.hatch-pet-runs/<slug>-po-preview/imagegen-jobs.json`.
Do not replace this with local drawing. The base job must be recorded before row
jobs, because row jobs must use `references/canonical-base.png`.

After selecting a generated `$CODEX_HOME/generated_images/.../ig_*.png`, record
it through hatch-pet:

```bash
python "$env:SKILL_DIR\scripts\record_imagegen_result.py" `
  --run-dir "$env:RUN_DIR" `
  --job-id <job-id> `
  --source "<absolute path to selected generated_images ig_*.png>"
```

Repeat `pet_job_status.py` -> `$imagegen` -> `record_imagegen_result.py` until
all required rows are complete. Row-strip generation should use subagents when
available; the parent agent alone records results and finalizes the run.

Finalize only after all Codex pet visual jobs are recorded:

```bash
python "$env:SKILL_DIR\scripts\finalize_pet_run.py" --run-dir "$env:RUN_DIR"
```

Expected evidence:

- `.hatch-pet-runs/<slug>-po-preview/pet_request.json`
- `.hatch-pet-runs/<slug>-po-preview/imagegen-jobs.json`
- `.hatch-pet-runs/<slug>-po-preview/decoded/*.png`
- `.hatch-pet-runs/<slug>-po-preview/final/spritesheet.png`
- `.hatch-pet-runs/<slug>-po-preview/qa/contact-sheet.png`
- `.hatch-pet-runs/<slug>-po-preview/qa/review.json`

Only after this evidence exists may the preview sheet be repacked into:

- `assets/generated/residents/<slug>/po-preview/resident-sprite-sheet-combined.png`
- `assets/generated/residents/<slug>/po-preview/resident-sprite-sheet-combined.preview-manifest.json`
- `public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet-combined-preview-<version>.png`
- `public/po-preview/<slug>-sprite-preview.html`

The preview manifest must include:

- hatch-pet run directory
- `pet_request.json` path
- `imagegen-jobs.json` path
- selected `$CODEX_HOME/generated_images/.../ig_*.png` sources
- final hatch-pet output path
- contact sheet path
- `sprite:fit` report path
- low-effort subagent review
- `PO preview only; not canonical ready`

Reject immediately if the evidence chain is missing, if the source is not Codex
pet / hatch-pet generated, or if the image is not pixel-art-adjacent.

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
