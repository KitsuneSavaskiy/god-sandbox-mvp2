# Garan combined PO preview sprite sheet

Use this prompt only for a fresh Garan PO preview sprite sheet.

Do not use, trace, repack, resize, or repair any previous Garan sprite sheet.
Past Garan candidates are rejected evidence only.

## PO Preview Canonical Grid

The Eve-shaped grid is the PO preview source of truth. This is not canonical
ready; it is the fixed grid for PO animation review:

```txt
canvas: 826 x 1904 px
columns: 7
rows: 14
cell: 118 x 136 px
frames: 98 total
background: transparent
```

Reject the output if it has:

```txt
13 rows
6 columns
larger cells such as 180 x 170
blank right-side canvas
visible grid lines
labels or text
clipped head, horns, hands, feet, or emote marks
```

## Character

Garan is a stocky adult male fantasy villager-warrior in Codex pet
pixel-art-adjacent style:

```txt
black spiky hair
small golden horns
tan skin
short beard
dark navy sleeves
brown leather armor
brown belt and boots
warm gold/brown palette
```

Keep the same body size and visual scale in every cell. The full body must fit
inside each `118 x 136` cell with a small safe margin. If the character is too
tall for the cell, make the character smaller; do not change the grid.

Use this Garan-specific safe area target:

```txt
target full silhouette width: 76-88 px
target full silhouette height: 104-114 px
left/right safe margin: at least 8 px
top safe margin: 10-12 px, including horns and hair
bottom safe margin: 10-12 px, including boots and feet
feet baseline: 10-14 px above the cell bottom
```

Horns count as part of the body. Feet count as part of the body. If either
horns or feet would touch an edge, scale the whole character down. Never crop.

## Row Manifest

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

## Motion Requirements

- `idle`: front-facing subtle breathing, feet fully visible.
- `walk-right`: side-facing right, clear alternating-leg walk cycle.
- `walk-left`: side-facing left, clear alternating-leg walk cycle.
- `waving`: front-facing wave, hand and horns inside the cell.
- `jumping`: takeoff, airborne, landing, enough vertical motion without clipping.
- `failed`: first three frames sit/collapse; later frames show one single fallen
  Garan only, with no duplicate heads or overlapping bodies.
- `waiting`: impatient waiting, clearly different from idle.
- `review`: reading a paper/map, paper inside the cell.
- `walk-up / walk-back`: back-facing walking away.
- `walk-down / walk-forward`: front-facing walking toward viewer.
- `emote-happy`: sparkle effects inside the cell.
- `emote-angry`: small red anger marks inside the cell.
- `emote-sad`: small blue tear effects inside the cell.
- `emote-surprised`: yellow surprise marks, not angry-looking.

## Quality Gate

The generated image is accepted only if:

```txt
size == 826 x 1904
columns == 7
rows == 14
cell == 118 x 136
all 98 frames are present
all visible pixels stay inside their own cell
every row uses the same cell height
sprite:fit passes with the exact contract
low-effort auditor accepts
lead double-check accepts
```

## Retry Rule

Try full-sheet generation first. If three fresh attempts produce the wrong row
count, wrong column count, clipped body parts, or repeated row-boundary errors,
stop full-sheet retries.

After that, use fresh row-by-row or frame-by-frame Codex pet generation, then
deterministically pack only those fresh generated rows/frames into the fixed
`14 x 7 / 118 x 136 / 826 x 1904` grid.

Old Garan sprite sheets are rejected evidence only. Do not use them as packer
input.
