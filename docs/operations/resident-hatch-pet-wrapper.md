# Resident hatch-pet wrapper

Status: required P0 safety gate for resident sprite generation

This wrapper prevents unsafe hatch-pet output from becoming a resident candidate.
It is intentionally fail-closed: if any required condition is missing, it stops
before copying anything into `assets/generated/residents/<slug>/incoming/`.

## Command

```bash
npm run sidekick:resident:hatch-pet -- \
  --slug ryo \
  --sheet motion \
  --portrait assets/generated/residents/ryo/reference/ryo-portrait-reference-*.png \
  --prompt .prompts/resident-sprites/ryo.md
```

```bash
npm run sidekick:resident:hatch-pet -- \
  --slug ryo \
  --sheet extended \
  --portrait assets/generated/residents/ryo/reference/ryo-portrait-reference-*.png \
  --prompt .prompts/resident-sprites/ryo-extended.md
```

Use `--dry-run` before generation work:

```bash
npm run sidekick:resident:hatch-pet -- --slug ryo --sheet motion --portrait public/art/characters/defaults/ryo/portrait.png --prompt .prompts/resident-sprites/_template.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug ryo --sheet extended --portrait public/art/characters/defaults/ryo/portrait.png --prompt .prompts/resident-sprites/_template-extended.md --dry-run
```

## Sheet manifests

Both sheets must be `1536 x 1872`, with `8` columns, `9` rows, and
`192 x 208` frames.

Sheet 1, `motion`, writes to `resident-sprite-sheet.png`:

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

Sheet 2, `extended`, writes to `resident-sprite-sheet-extended.png`:

```txt
row 0: walk-up
row 1: walk-down
row 2: walk-forward
row 3: walk-back
row 4: emote-happy
row 5: emote-angry
row 6: emote-sad
row 7: emote-surprised
row 8: spare
```

## Preflight checks

The wrapper checks these before any candidate placement:

- `--sheet` is only `motion` or `extended`.
- The portrait path exists.
- The prompt path exists.
- The local hatch-pet skill folder exists.
- The prompt contains the required row manifest for the selected sheet.
- In non-dry-run mode, `pet_request.json` exists in the run folder and contains
  the required row manifest.
- In dry-run mode, missing `pet_request.json` is allowed because no generation
  output is adopted. If the file exists, its row manifest is still checked.
- `extended` fails if the run definition contains standard Sheet 1 rows.

`--dry-run` prints the run definition and row manifest only. It does not write
or copy generated images.

## Final output checks

The wrapper never accepts raw Image Gen output as a candidate.

For a non-dry run, it checks only hatch-pet final output under:

```txt
.hatch-pet-runs/<slug>-<sheet>/final/spritesheet.png
```

The final PNG must:

- Exist under the run folder's `final/` directory.
- Be exactly `1536 x 1872`.
- Have an inspectable alpha channel with transparent pixels, or contain a
  `#ff00ff` chroma-key background.

If any check fails, the wrapper copies nothing to `incoming/`.
If alpha channel pixels cannot be inspected, the wrapper fails closed.
When the final PNG uses `#ff00ff`, the wrapper converts that exact color to
transparent alpha before writing the `incoming/` file. Raw chroma-key output is
not copied as-is.

## Incoming placement

Only validated final output is copied:

```txt
motion:
assets/generated/residents/<slug>/incoming/resident-sprite-sheet.png

extended:
assets/generated/residents/<slug>/incoming/resident-sprite-sheet-extended.png
```

When both sheets exist, the wrapper runs:

```bash
npm run sprite:check -- <slug>
```

Sheet 1 alone is not enough to prove readiness. `sprite:check` must pass for
both sheets, and PO visual review is still required before adoption.

## Explicitly not implemented

This wrapper does not add CLI fallback generation.
If built-in image generation cannot produce `1536 x 1872`, this wrapper fails.
Any alternate generation route must be handled by a separate approved PBI.

The wrapper also does not write to `public/art/**`, mark any manifest ready, or
commit generated output.
