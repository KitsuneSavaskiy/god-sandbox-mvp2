# Resident sprite sheet specification

Status: canonical spec — authoritative for all resident sprites

This document defines the sprite sheet standard for every character in the sandbox.
Character-specific task docs must not redefine these constraints; they inherit from here.

## Sandbox display contract

```txt
frame width:  96px
frame height: 96px
sheet columns: 6
sheet rows:   11
sheet size:   576 × 1056 px
```

A PNG of the correct sheet size is not automatically game-ready.
Every individual 96 × 96 frame must be a usable character image at the sandbox display size.

## Motion row order

```txt
row 0:  idle
row 1:  walk-up
row 2:  walk-down
row 3:  walk-left
row 4:  walk-right
row 5:  walk-forward
row 6:  walk-back
row 7:  emote-happy
row 8:  emote-angry
row 9:  emote-sad
row 10: emote-surprised
```

## Frame composition requirements

### Character body

- Head, torso, and feet must be in the same 96 × 96 cell.
- The body may not be split into separate large parts.
- The feet may not be cropped.
- The head may not appear in a different row from the body.
- The character may not span across row boundaries.
- The character may not span across column boundaries.

### Safe area

Target safe area inside each 96 × 96 frame:

```txt
left margin:   at least 6px
right margin:  at least 6px
top margin:    at least 4px
bottom margin: at least 4px
```

Body parts must not touch or cross the top or bottom edge of the frame.
If the character would exceed the frame, scale the character down — do not crop.

### Emote effects

Small separate effect particles are allowed for emote rows, but must not be mistaken for body parts.

Allowed: small sparkle, anger mark, tear mark, motion accent.

Not allowed:
- head separated from body,
- feet separated from torso,
- body parts placed above or below the frame,
- large effect that makes the frame look like two characters.

### Background

- The background must be transparent (real alpha channel).
- No solid color, checkerboard, or square background may remain.
- No label text, frame number, row marker, guide line, or grid line may be baked into the final asset.
- If the generation tool cannot produce real alpha, use a flat `#ff00ff` chroma-key background. The local alpha normalizer will remove it.

## Generation source contract

### Non-technical user flow

The non-technical user provides only two inputs:

```txt
character name (display name)
portrait image (one PNG)
```

The user is not expected to know or provide any of the following:

```txt
characterId / assetBundleId / jobId
prompt path or prompt text
incoming folder path
sprite:check command
external generation UI operation
```

Everything else is handled by the intake pipeline (Layer 1–2) and an authorized operator:

1. `npm run sidekick:intake -- --slug <slug> --portrait <path>` auto-generates the job and sets up folders.
2. The operator takes the generated prompt and portrait reference to Codex pet or an approved external subscription UI.
3. The operator places the resulting PNG in `assets/generated/residents/<slug>/incoming/`.
4. The operator runs `npm run sprite:check -- <slug>` to validate the candidate.

### Generation rules

Resident sprite sheet candidates must be generated from the character portrait through the approved external image generation flow, such as Codex pet or an external subscription image generation UI.

Do not replace a resident candidate with a local handmade placeholder, synthetic test image, simple colored shape sheet, resized portrait sheet, or manually drawn proxy created only to satisfy validation.

If Codex pet or the external generation UI cannot be operated in the current environment, stop the generation proof and report:

```txt
generation step unavailable
```

Do not create a substitute sprite sheet.

A local synthetic image may be created only for validation-tool development or validator smoke testing. Such an image must be explicitly labeled:

```txt
validation-only test image
not a resident candidate
not a generation proof
not eligible for PO visual review
not eligible for ready promotion
```

Passing `npm run sprite:check` means the PNG satisfies technical sprite-sheet checks. It does not prove:

- the image was generated from the character portrait,
- the image used Codex pet or an approved external generation UI,
- the character is visually recognizable,
- the candidate is eligible for ready promotion.

Generation proof requires all of the following:

1. Source portrait path is recorded.
2. Prompt path is recorded.
3. Codex pet or approved external generation UI usage is confirmed.
4. Generated PNG is placed in `assets/generated/residents/<characterId>/incoming/`.
5. `npm run sprite:check -- <characterId>` passes.
6. Contact sheet is reviewed.
7. Human and PO visual review confirm character identity and sandbox fit.

Resident sprite proof reports must include:

```md
## Generation source
- source portrait:
- prompt:
- generation method:
- Codex pet / external generation UI used: yes / no
- if no: proof result must be fail / not executed

## Candidate classification
- generated character candidate / validation-only test image
- eligible for PO visual review: yes / no
- ready promotion allowed: no
```

End-to-end proof must be treated as fail when:

- Codex pet or approved external generation UI was not used,
- a local-only handmade or synthetic image substituted for the generation step,
- a validation-only image was treated as a resident candidate,
- `sprite:check` pass was treated as generation proof by itself.

## Pipeline path conventions

```txt
Incoming (staging, gitignored):  assets/generated/residents/<characterId>/incoming/
Output (processed, gitignored):  assets/residents/<characterId>/sprites/
Adopted (public):                public/art/characters/defaults/<characterId>/sprites/resident-sprite-sheet.png
```

Do not write generated candidates directly to `public/art/**` or `src/persistence/**`.

## Ready promotion rules

A sprite sheet may be marked `ready` only when all of the following are true:

1. PNG size is 576 × 1056.
2. Grid is 6 columns × 11 rows.
3. Frame size is 96 × 96.
4. Alpha check passes.
5. Validator passes.
6. Visual frame audit produces a contact sheet.
7. Human reviewer confirms the contact sheet.
8. PO confirms the sandbox display.

## Renderer requirements

- Use 96 × 96 as the source frame.
- Use `rowIndex * 96px` for Y position.
- Use `columnIndex * 96px` for X position.
- Use wrapper scale for display size adjustments.
- Do not offset walk rows by half a frame.
- Do not crop the character to hide invalid pixels.

## Validation

Run the full validation suite against any character with:

```bash
npm run sprite:check -- <characterId>
```

Or against an already-adopted file:

```bash
npm run sprite:check -- public/art/characters/defaults/<characterId>/sprites/resident-sprite-sheet.png
```

The suite runs in order:
1. `check-resident-sprite-alpha`   — PNG size and alpha channel
2. `validate-resident-sprite-sheet` — grid structure
3. `audit-resident-sprite-visuals`  — visual frame audit, produces contact sheet

Exit code 0 = all checks pass. Exit code 1 = one or more checks failed.

## Generation prompt

Use `.prompts/resident-sprites/_template.md` as the base when creating a prompt for a new character.
Do not write one-off ad-hoc prompts. Derive from the template and commit to `.prompts/resident-sprites/<characterId>.md`.
