# Garan resident sprite visual correctness task

Status: Sprint9 asset task document

## Purpose

This task defines the requirements for generating a correct Garan resident sprite sheet.

The sprite sheet must pass visual correctness — not just technical structure checks — before it can be marked `ready` and used in the sandbox.

## Final vision

When a Garan resident sprite sheet is marked `ready`, the player sees a single, coherent, small sandbox character in the world.

The character must:

- fit inside one `96x96` frame,
- keep head, body, and feet inside the same frame,
- keep transparent background,
- remain readable at the actual sandbox display size,
- animate without mixing neighboring rows or columns,
- work in idle, walk, and emote rows,
- not require CSS hacks to hide a broken asset.

For Garan specifically, the final result is:

- Garan is shown as a complete small resident sprite in `/sandbox`.
- Eve / Ryo / Suzu continue unaffected.
- The player never sees split body parts, cropped feet, square backgrounds, row mixing, or label text on the sandbox character.

## Source of truth: sandbox display

The sandbox renderer treats a ready resident sprite as one frame with this display contract:

```txt
frame width: 96px
frame height: 96px
sheet columns: 6
sheet rows: 11
sheet size: 576x1056
```

The asset pipeline must generate and validate assets for this display contract.

Do not assume that a technically valid `576x1056` PNG is game-ready. It is only game-ready if every frame works at the sandbox display size.

## Required sprite sheet layout

The sprite sheet must use this row order:

```txt
row 0: idle
row 1: walk-up
row 2: walk-down
row 3: walk-left
row 4: walk-right
row 5: walk-forward
row 6: walk-back
row 7: emote-happy
row 8: emote-angry
row 9: emote-sad
row 10: emote-surprised
```

Each row has 6 frames.

Each frame is an independent `96x96` character image. A frame may not depend on pixels from the frame above, below, left, or right.

## Frame composition requirements

Every frame must satisfy the following visual rules.

### Character body

- Head, torso, and feet must be in the same `96x96` cell.
- The body may not be split into separate large parts.
- The feet may not be cropped.
- The head may not appear in a different row from the body.
- The character may not span across row boundaries.
- The character may not span across column boundaries.

### Safe area

Target safe area inside each `96x96` frame:

```txt
left margin: at least 6px
right margin: at least 6px
top margin: at least 4px
bottom margin: at least 4px
```

The exact silhouette can be smaller, but the visible body should not touch frame edges unless the motion intentionally extends a small effect. Body parts must not touch or cross the top or bottom edge.

### Emote effects

Small separate effect particles are allowed for emote rows, but they must not be confused with body parts.

Allowed:

- small sparkle,
- small anger mark,
- small tear / surprise mark,
- small motion accent.

Not allowed:

- head separated from body,
- feet separated from torso,
- body parts placed above or below the frame,
- large effect that makes the frame look like two characters.

### Background

- The background must be transparent.
- No solid green, white, checkerboard, or square background may remain.
- No label text, frame number, row marker, guide line, or grid line may be baked into the final asset.

## Generation requirements

The generation prompt must be based on `.prompts/resident-sprites/garan.md`, not ad-hoc chat instructions.

Do not start by prompting multiple agents. First use the prompt document as the single source of truth.

Generation must aim for:

- small pixel-art-like sandbox resident,
- same visual identity as `public/art/characters/defaults/garan/portrait.png`,
- 2.5D papercraft sandbox readability,
- complete body within each `96x96` frame,
- consistent scale across all rows,
- no row-spanning body parts,
- no cropped feet,
- transparent PNG output.

The generated file must be placed through the normal local pipeline:

```txt
assets/generated/residents/garan/incoming/
```

Do not write generated candidates directly into:

```txt
public/art/**
src/persistence/**
```

## Pipeline steps

Run in order:

1. alpha check
2. validator
3. processor
4. visual frame audit

```bash
node tools/asset-pipeline/check-resident-sprite-alpha.mjs garan
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs garan
node tools/asset-pipeline/process-resident-sprite-sheet.mjs garan
node tools/asset-pipeline/audit-resident-sprite-visuals.mjs garan
```

The visual frame audit must produce a human-readable contact sheet with row labels, frame boundaries, motion names, source file name, and notes for suspected split or cropped frames.

## Ready promotion rules

A resident sprite sheet may become `ready` only after all of these are true:

- PNG size is `576x1056`.
- Grid is `6 columns x 11 rows`.
- Frame size is `96x96`.
- Alpha check passes with transparent pixels.
- Validator passes.
- Processor passes.
- Visual frame audit produces a contact sheet.
- Human reviewer confirms the contact sheet.
- PO confirms the sandbox display.

If visual correctness fails, do one of the following:

1. regenerate the asset and repeat the pipeline, or
2. demote the resident sprite sheet back to placeholder / fallback.

Do not leave a visually broken sprite sheet as `ready`.

## Renderer requirements

The renderer must not compensate for a broken asset by reading half rows or mixing rows.

Renderer rules:

- Use `96x96` as the source frame.
- Use `rowIndex * 96px` for Y position.
- Use `columnIndex * 96px` for X position.
- Use wrapper scale for display size adjustments.
- Do not offset walk rows by half a frame.
- Do not crop the character to hide invalid pixels.

## Testing requirements

```bash
node tools/asset-pipeline/check-resident-sprite-alpha.mjs garan
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs garan
node tools/asset-pipeline/process-resident-sprite-sheet.mjs garan
npm run typecheck
npm run test:domain
npm run build
```

Also perform browser checks:

```txt
/sandbox desktop
/sandbox 390px
/sandbox 360px
```

Browser acceptance:

- Garan appears as one complete character.
- Head, body, and feet stay together.
- Feet are not cropped.
- No split body parts are visible.
- No square background is visible.
- Eve / Ryo / Suzu fallback remains intact.
- Event window pause still works.
- Watch / help / trial still work.

## Out of scope

Do not implement:

- Codex App Server,
- image generation API calls from GodSandbox,
- API key UI,
- automatic ready promotion,
- collision detection,
- Passport schema changes,
- death, lifespan, medals,
- sandbox character name / place / status labels.

## One-line Codex CLI launch

Use this single instruction after this document is committed or available in the working tree:

```bash
codex "Read docs/operations/garan-sprite-visual-correctness-task.md, implement the task exactly, achieve the final vision, and test until complete."
```
