# Resident sprite visual correctness task

Status: Sprint8 blocker task document

## Purpose

This task fixes the resident sprite pipeline by treating the sandbox display size as the source of truth.

The current Eve sprite sheet passes the technical checks for PNG size, grid, and alpha, but it fails visual correctness:

- The head and body appear split across different sprite sheet rows.
- Some intervention / emote views show the head correctly but crop the feet.
- Existing validators only confirm file structure, not whether each frame is a usable character frame.

This means the asset generation and validation pipeline is incomplete. The fix must start from the expected sandbox display, not from the generated image dimensions alone.

## Final vision

When a resident sprite sheet is marked `ready`, the player sees a single, coherent, small sandbox character in the world.

The character must:

- fit inside one `192x208` frame,
- keep head, body, and feet inside the same frame,
- keep transparent background,
- remain readable at the actual sandbox display size,
- animate without mixing neighboring rows or columns,
- work in idle, walk, and emote rows,
- not require CSS hacks to hide a broken asset.

For Eve specifically, the final result is:

- Eve is shown as a complete small resident sprite in `/sandbox`.
- Garan / Ryo / Suzu continue to fallback until their sprite sheets are ready.
- The player never sees split body parts, cropped feet, square backgrounds, row mixing, or label text on the sandbox character.

This task is a blocker. Do not continue to Codex Sidekick, GM subagent, or App Server work until this visual correctness issue is fixed or Eve is safely demoted back to fallback.

## Source of truth: sandbox display

The sandbox renderer currently treats a ready resident sprite as one frame with this display contract:

```txt
frame width:   192px
frame height:  208px
sheet columns: 8
sheet rows:    9 (per sheet)
sheet size:    1536x1872
```

Each resident uses two sheets. Both share the same canvas and frame dimensions.

The asset pipeline must generate and validate assets for this display contract.

Do not assume that a technically valid `1536x1872` PNG is game-ready. It is only game-ready if every frame works at the sandbox display size.

## Required sprite sheet layout

### Sheet 1 — motion-sheet (`resident-sprite-sheet.png`)

```txt
row 0: idle
row 1: walk-right
row 2: walk-left
row 3: waving
row 4: jumping
row 5: failed
row 6: waiting
row 7: running
row 8: review
```

### Sheet 2 — extended-sheet (`resident-sprite-sheet-extended.png`)

```txt
row 0: walk-up
row 1: walk-down
row 2: walk-forward
row 3: walk-back
row 4: emote-happy
row 5: emote-angry
row 6: emote-sad
row 7: emote-surprised
row 8: (spare)
```

Each row has 8 frames.

Each frame is an independent `192x208` character image. A frame may not depend on pixels from the frame above, below, left, or right.

## Frame composition requirements

Every frame must satisfy the following visual rules.

### Character body

- Head, torso, and feet must be in the same `192x208` cell.
- The body may not be split into separate large parts.
- The feet may not be cropped.
- The head may not appear in a different row from the body.
- The character may not span across row boundaries.
- The character may not span across column boundaries.

### Safe area

Target safe area inside each `192x208` frame:

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

The generation prompt must be based on this task document, not ad-hoc chat instructions.

Do not start by prompting multiple agents. First use this document as the single source of truth.

Generation must aim for:

- small pixel-art-like sandbox resident,
- same visual identity as the source portrait,
- 2.5D papercraft sandbox readability,
- complete body within each `192x208` frame,
- consistent scale across all rows,
- no row-spanning body parts,
- no cropped feet,
- transparent PNG output.

The generated file must be placed through the normal local pipeline:

```txt
assets/generated/residents/eve/incoming/
```

Do not write generated candidates directly into:

```txt
public/art/**
src/persistence/**
```

## Pipeline changes required

The pipeline must add a visual correctness gate after existing structure checks.

Existing checks are still required:

1. alpha check
2. validator
3. processor

New required gate:

4. visual frame audit
5. two-sheet ready gate

The visual frame audit must produce a human-readable contact sheet with:

- row labels,
- frame boundaries,
- motion names,
- source file name,
- generated timestamp or input hash,
- notes for suspected split or cropped frames.

The audit should warn if it detects:

- large disconnected body parts,
- visible pixels too close to top or bottom edge,
- many separated components inside one cell,
- body silhouette touching frame boundary,
- unexpectedly large empty center with body parts above and below.

The audit does not need to be perfect. Its purpose is to force visual review before ready promotion.

## Ready promotion rules

A resident animation bundle may become `ready` only after all of these are true:

- Sheet 1 exists as `resident-sprite-sheet.png`.
- Sheet 2 exists as `resident-sprite-sheet-extended.png`.
- `npm run sprite:check -- <slug>` passes.
- Both sheets match the `8 columns x 9 rows`, `192x208`, `1536x1872` contract.
- Visual frame audit produces contact sheets for both sheets.
- Human reviewer confirms the contact sheets.
- PO confirms the sandbox display.

If visual correctness fails, do one of the following:

1. regenerate the asset and repeat the pipeline, or
2. demote the resident sprite sheet back to placeholder / fallback.

Do not leave a visually broken sprite sheet as `ready`.

## Renderer requirements

The renderer must not compensate for a broken asset by reading half rows or mixing rows.

Renderer rules:

- Use `192x208` as the source frame.
- Use `rowIndex * 208px` for Y position.
- Use `columnIndex * 192px` for X position.
- Use wrapper scale for display size adjustments.
- Do not offset walk rows by half a frame.
- Do not crop the character to hide invalid pixels.

If a correct asset still looks wrong, investigate:

- CSS `background-size`,
- CSS `background-position`,
- wrapper overflow,
- transform scale,
- animation step count,
- row metadata,
- motion key mapping.

## Testing requirements

Run at minimum:

```bash
npm run sprite:check -- eve motion
npm run sprite:check -- eve extended
npm run sprite:check -- eve
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

- Eve appears as one complete character.
- Head, body, and feet stay together.
- Feet are not cropped.
- No split body parts are visible.
- No square background is visible.
- Garan / Ryo / Suzu fallback remains intact.
- Event window pause still works.
- Watch / help / trial still work.
- Sandbox labels for character name, place, or status do not return.

## Required deliverables

The implementation PR must include one of the following outcomes.

### Preferred outcome

- Corrected Eve sprite sheet.
- Updated visual audit output or script.
- Eve remains ready only if PO visual check passes.

### Safe fallback outcome

- Eve sprite sheet is demoted to placeholder / fallback.
- Broken ready asset is not used in sandbox.
- Visual audit task remains open for regeneration.

## Out of scope

Do not implement:

- Codex App Server,
- image generation API calls from GodSandbox,
- API key UI,
- automatic ready promotion,
- four-character sprite completion,
- full AI movement,
- collision detection,
- Passport schema changes,
- death, lifespan, medals,
- sandbox character name / place / status labels.

## One-line Codex CLI launch

Use this single instruction after this document is committed or available in the working tree:

```bash
codex "Read docs/operations/resident-sprite-visual-correctness-task.md, implement the task exactly, achieve the final vision, and test until complete."
```
