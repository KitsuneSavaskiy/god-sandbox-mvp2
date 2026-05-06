# Garan resident sprite sheet prompt

You are creating a resident sprite sheet for GodSandbox.

Workflow note:
- This prompt is for an external subscription UI such as ChatGPT.
- GodSandbox must not call an image generation API from inside the app.
- Do not include API keys, account details, personal paths, or billing details in the output.
- Follow the visual correctness rules from `docs/operations/resident-sprite-spec.md`.

Generation source requirement:
- Use Codex pet / approved external image generation UI to generate the sprite sheet from the source portrait.
- If Codex pet / external generation UI is unavailable, stop and report `generation step unavailable`.
- Do not create a local handmade, synthetic, placeholder, simple-shape, or validation-only sprite sheet as a substitute.
- Do not treat a validation-only image as a character candidate.
- Passing `sprite:check` alone does not prove character identity or Codex pet generation.

Reference:
- Use `public/art/characters/defaults/garan/portrait.png` only as the identity reference.
- Do not crop, resize, or paste the portrait into the sprite sheet.
- Reinterpret Garan as a small pixel-art resident who can move inside a 2.5D papercraft sandbox.

Character handling:
- Preserve the recognizable hair, outfit colors, silhouette, and overall mood from the reference portrait.
- Do not infer official lore, age, job, origin, or relationships from the image.
- Do not add unrelated accessories.

Style:
- cute small pixel art resident
- chibi / SD game character
- readable at 96x96
- transparent background
- clean outline
- consistent scale and baseline
- suitable for a 2.5D papercraft background

Visual correctness:
- Each 96x96 frame must contain one complete character.
- Keep head, torso, and feet inside the same frame.
- Do not let the body cross into a neighboring row or column.
- Keep at least about 6px left/right margin and 4px top/bottom margin when possible.
- If the character would exceed the frame, scale the character down instead of cropping.
- Emote particles may be small and separate, but they must not look like detached body parts.
- Do not include labels, frame numbers, guide lines, or any square background.

Sprite sheet:
- Downloaded PNG must go through: `assets/generated/residents/garan/incoming/`
- Adopted output after visual audit and human approval: `public/art/characters/defaults/garan/sprites/resident-sprite-sheet.png`
- PNG with real alpha channel
- frame size: 96x96
- columns: 6
- rows: 11
- each row is one motion
- each column is one frame
- no labels, numbers, UI frames, or background inside the image
- if true alpha is not available in the generation UI, use a perfectly flat solid `#ff00ff` chroma-key background so the local alpha normalizer can remove it

Motion rows:
1. `idle`
2. `walk-up`
3. `walk-down`
4. `walk-left`
5. `walk-right`
6. `walk-forward`
7. `walk-back`
8. `emote-happy`
9. `emote-angry`
10. `emote-sad`
11. `emote-surprised`

Important:
- This must be a real sprite sheet.
- Do not use a resized portrait as the sprite.
- Keep every frame recognizable as Garan.
- Every frame must stand on its own without borrowing pixels from neighboring cells.
- For this sprint, generate only Garan. Do not expand to Eve, Ryo, or Suzu.
- If Codex pet / external generation UI cannot be used, do not create a substitute local sprite sheet. Stop and report `generation step unavailable`.
