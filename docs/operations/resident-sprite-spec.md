# Resident sprite sheet specification

Status: canonical spec — authoritative for all resident sprites

This document defines the sprite sheet standard for every character in the sandbox.
Character-specific task docs must not redefine these constraints; they inherit from here.

## Current PO preview exception

The canonical ready target is still the 2-sheet `1536 x 1872` contract below.
However, PO review for Eve and Ryo showed that the automated 2-sheet pipeline
does not yet meet the animation-quality requirement reliably.

Until PO explicitly approves a new automated generation pipeline, resident
animation previews must follow the Eve/Ryo procedure:

- Generate and repair only one resident at a time.
- Use Codex pet / hatch-pet as the visual source.
- Use one combined preview PNG when separate motion and extended sheets drift in
  scale or quality.
- Keep the PNG's real frame size, row count, column count, and variable-width
  rows in the runtime metadata.
- Run `sprite:fit`, low-effort subagent review, and lead double-check before
  showing the preview.
- Treat the result as PO preview only, not canonical ready.

The current operating guide for this exception is:

```txt
.agents/skills/godsandbox-po-preview-sprite-from-portrait/SKILL.md
docs/operations/resident-sprite-po-preview-quality.md
```

## 2-sheet architecture

Each resident uses two sprite sheets:

| Sheet | File | Purpose |
|---|---|---|
| Sheet 1 (motion-sheet) | `resident-sprite-sheet.png` | Core motion: idle, run, wave, jump, fail, wait, review |
| Sheet 2 (extended-sheet) | `resident-sprite-sheet-extended.png` | 2.5D directions + emotes |

Both sheets use the same canvas and frame dimensions.

## Sandbox display contract

```txt
frame width:   192 px
frame height:  208 px
sheet columns: 8
sheet rows:    9
sheet size:    1536 × 1872 px
```

A PNG of the correct sheet size is not automatically game-ready.
Every individual 192 × 208 frame must be a usable character image at the sandbox display size.

### Runtime display size

Sprites are rendered in the sandbox at a reduced display size.
The CSS zoom is applied automatically: `zoom = portrait-figure-width / 192px`.

At typical viewport widths:
- 760 px wide  → zoom ≈ 0.41 → displayed at ≈ 79 × 85 px
- 1200 px wide → zoom ≈ 0.50 → displayed at ≈ 96 × 104 px

Generation targets the full 192 × 208 px frame regardless of display zoom.
The zoom is a display-only concern; the asset pipeline validates the full-size frame.

### Runtime animation behaviour

When a sprite sheet is marked `ready` in the manifest, the sandbox animates the resident:

- Residents patrol randomly in 6 directions (left, right, up, down, forward, back)
  every 5–7 seconds using `walk-*` motion rows from Sheet 1 or Sheet 2.
- Emote bubbles drive motion:
  - `anger` → `emote-angry` (Sheet 2 row 5)
  - `sadness` → `emote-sad` (Sheet 2 row 6)
  - `surprise` → `emote-surprised` (Sheet 2 row 7)
  - `talk-request` / `event-alert` → `walk-forward` (Sheet 2 row 2)
  - `joy` → `emote-happy` (Sheet 2 row 4)
- Opening the event window freezes the resident at the current visible position.
- While the event window is open, resident sprite animation and background time
  are paused.
- After an intervention result appears, resident positions stay frozen but result
  emote animations may play.
- Residents use perspective scaling in the sandbox: farther back on the stage
  renders smaller, and closer to the front renders larger.

### Manifest activation

Default activation must stay placeholder until both sheets pass review.
Do not mark a resident ready from `defaultResidentSpriteManifest.ts`.

The source of truth for the 2-sheet contract is `src/persistence/defaultCharacterAssetManifest.ts`.
`defaultResidentSpriteManifest.ts` is a legacy motion-sheet bridge and must not be used to bypass Sheet 2 review.

The sprite files must be present at:
```txt
public/art/characters/defaults/<bundleId>/sprites/resident-sprite-sheet.png
public/art/characters/defaults/<bundleId>/sprites/resident-sprite-sheet-extended.png
```

Do not commit manifest changes or sprite files until PO visual review is complete.

## Motion row order

### Sheet 1 — motion-sheet

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

### Sheet 2 — extended-sheet

```txt
row 0: walk-up
row 1: walk-down
row 2: walk-forward
row 3: walk-back
row 4: emote-happy
row 5: emote-angry
row 6: emote-sad
row 7: emote-surprised
row 8: (spare — leave transparent or duplicate row 7)
```

The game engine routes Sheet 2 motions to the extended sheet when it is present,
and falls back to Sheet 1 approximations when Sheet 2 is absent.

## Frame composition requirements

### Character body

- Head, torso, and feet must be in the same 192 × 208 cell.
- The body may not be split into separate large parts.
- The feet may not be cropped.
- The head may not appear in a different row from the body.
- The character may not span across row boundaries.
- The character may not span across column boundaries.

### Safe area

Target safe area inside each 192 × 208 frame:

```txt
left margin:   at least 10px
right margin:  at least 10px
top margin:    at least 8px
bottom margin: at least 8px
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
- If the generation tool cannot produce real alpha, use a flat `#ff00ff` chroma-key background. The resident hatch-pet wrapper converts exact `#ff00ff` to alpha before `incoming/`.

## Generation source contract

### Non-technical user flow

The non-technical user provides only five inputs via the game's character creation screen:

```txt
キャラ名（display name）
性格（personality）
口調（tone）
年齢（age）
１枚絵（portrait PNG）
```

The user is not expected to know or provide any of the following:

```txt
characterId / assetBundleId / jobId / slug
prompt file or prompt text
incoming folder path
sprite:check command
Codex pet operation
any file system operation
```

Everything else is handled autonomously by the Codex sidekick (a separate process from the game app):

1. The game writes a job file to `.godsandbox/jobs/` when the user submits the character creation screen.
2. The automation layer (configured once via game tutorial) detects the new job and triggers the Codex sidekick.
3. `npm run sidekick:intake` auto-generates characterId, assetBundleId, jobId, sets up folders, copies the portrait reference, and generates **both** prompt files from `_template.md` and `_template-extended.md` if absent.
4. The Codex sidekick runs `npm run sidekick:resident:hatch-pet` for **Sheet 1**, then **Sheet 2**.
5. The wrapper verifies the sheet-specific row manifest from `pet_request.json`, hatch-pet final output, exact size, and alpha/chroma-key background. If final output uses exact `#ff00ff`, the wrapper converts it to transparent alpha before `incoming/`.
6. Only after the wrapper passes does it copy Sheet 1 to `assets/generated/residents/<slug>/incoming/resident-sprite-sheet.png` and Sheet 2 to `…/resident-sprite-sheet-extended.png`.
7. The wrapper runs `npm run sprite:check -- <slug>` only after both candidates exist.

The non-technical user never operates Codex, opens any file, or interacts with any command line.

### Generation rules

Resident sprite sheet candidates must be generated by the Codex agent using Codex pet, from the character portrait and the auto-generated prompt.

Resident sprite sheet candidates must enter `incoming/` only through:

```bash
npm run sidekick:resident:hatch-pet -- --slug <slug> --sheet motion --portrait <portrait-ref> --prompt .prompts/resident-sprites/<slug>.md
npm run sidekick:resident:hatch-pet -- --slug <slug> --sheet extended --portrait <portrait-ref> --prompt .prompts/resident-sprites/<slug>-extended.md
```

Raw Image Gen output is evidence only. It must not be copied to `incoming/`,
used for PO visual review, or treated as a ready candidate.

Wrong-size output, including `1136x1385`, `1137x1383`, or other arbitrary Image
Gen dimensions, must fail closed. CSS zoom is display-only and must not be used
to absorb asset-size mismatch.

The GodSandbox web application must not call an image generation API directly. Image generation is performed by the Codex agent as an external pipeline step, not from inside the app.

Do not replace a resident candidate with a local handmade placeholder, synthetic test image, simple colored shape sheet, resized portrait sheet, or manually drawn proxy created only to satisfy validation.

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
- the image was generated by the Codex agent using Codex pet,
- the character is visually recognizable,
- the candidate is eligible for ready promotion.

Generation proof requires all of the following:

1. Source portrait path is recorded.
2. Prompt paths are recorded (auto-generated by `sidekick:intake` from `_template.md` and `_template-extended.md`).
3. Codex agent used Codex pet with the portrait and prompt to generate Sheet 1 and Sheet 2.
4. `npm run sidekick:resident:hatch-pet` accepted hatch-pet final output for both sheets.
5. Generated PNGs are placed in `assets/generated/residents/<slug>/incoming/` by the wrapper only.
6. `npm run sprite:check -- <slug>` passes for both sheets.
7. Contact sheets are reviewed.
8. Human and PO visual review confirm character identity and sandbox fit.

Resident sprite proof reports must include:

```md
## Generation source
- source portrait:
- prompt (Sheet 1): (auto-generated by sidekick:intake / pre-existing)
- prompt (Sheet 2): (auto-generated by sidekick:intake / pre-existing)
- generation method: Codex pet
- Codex pet used by Codex agent: yes / no
- if no: proof result must be fail

## Candidate classification
- generated character candidate / validation-only test image
- eligible for PO visual review: yes / no
- ready promotion allowed: no
```

End-to-end proof must be treated as fail when:

- Codex pet was not used by the Codex agent,
- a local-only handmade or synthetic image substituted for the generation step,
- a validation-only image was treated as a resident candidate,
- `sprite:check` pass was treated as generation proof by itself.

## Pipeline path conventions

```txt
Incoming (staging, gitignored):
  assets/generated/residents/<slug>/incoming/resident-sprite-sheet.png
  assets/generated/residents/<slug>/incoming/resident-sprite-sheet-extended.png

Output (processed, gitignored):
  assets/residents/<slug>/sprites/

Adopted (public):
  public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet.png
  public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet-extended.png
```

Do not write generated candidates directly to `public/art/**` or `src/persistence/**`.

## Ready promotion rules

A sprite sheet may be marked `ready` only when all of the following are true:

1. PNG size is 1536 × 1872.
2. Grid is 8 columns × 9 rows.
3. Frame size is 192 × 208.
4. Alpha check passes.
5. Validator passes.
6. Visual frame audit produces a contact sheet.
7. Human reviewer confirms the contact sheet.
8. PO confirms the sandbox display.

Both Sheet 1 and Sheet 2 must pass before either is promoted.

## Renderer requirements

- Use 192 × 208 as the source frame.
- Use `rowIndex * 208px` for Y position.
- Use `columnIndex * 192px` for X position.
- Use wrapper scale for display size adjustments.
- Do not crop the character to hide invalid pixels.
- Route Sheet 2 motions (walk-up, walk-down, walk-forward, walk-back, emote-*) to the extended sheet when available.

## Validation

Run the full validation suite against any character with:

```bash
npm run sprite:check -- <slug>
npm run sprite:check -- <slug> motion
npm run sprite:check -- <slug> extended
```

Dry-run the wrapper row manifests before generation:

```bash
npm run sidekick:resident:hatch-pet -- --slug <slug> --sheet motion --portrait <portrait-ref> --prompt .prompts/resident-sprites/<slug>.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug <slug> --sheet extended --portrait <portrait-ref> --prompt .prompts/resident-sprites/<slug>-extended.md --dry-run
```

Or against an already-adopted file:

```bash
npm run sprite:check -- public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet.png --kind motion
npm run sprite:check -- public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet-extended.png --kind extended
```

The suite runs in order:
1. `check-resident-sprite-alpha`    — PNG size and alpha channel
2. `validate-resident-sprite-sheet` — grid structure
3. `audit-resident-sprite-visuals`  — visual frame audit, produces contact sheet

Exit code 0 = all checks pass. Exit code 1 = one or more checks failed.

## Generation prompts

Use `.prompts/resident-sprites/_template.md` as the base for Sheet 1.
Use `.prompts/resident-sprites/_template-extended.md` as the base for Sheet 2.

`sidekick:intake` auto-generates both prompt files on first run. Do not write one-off ad-hoc prompts.
Committed prompt files live at `.prompts/resident-sprites/<characterId>.md` and `.prompts/resident-sprites/<characterId>-extended.md`.
