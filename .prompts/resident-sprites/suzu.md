# Suzu resident sprite sheet prompt

You are creating a resident sprite sheet for GodSandbox.

Workflow note:
- This prompt is for an external subscription UI such as ChatGPT.
- GodSandbox must not call an image generation API from inside the app.
- Do not include API keys, account details, personal paths, or billing details in the output.

Reference:
- Use `public/art/characters/defaults/suzu/portrait.png` only as the identity reference.
- Do not crop, resize, or paste the portrait into the sprite sheet.
- Reinterpret Suzu as a small pixel-art resident who can move inside a 2.5D papercraft sandbox.

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

Sprite sheet:
- Output file: `public/art/characters/defaults/suzu/sprites/resident-sprite-sheet.png`
- PNG with real alpha channel
- frame size: 96x96
- columns: 6
- rows: 11
- each row is one motion
- each column is one frame
- no labels, numbers, UI frames, or background inside the image

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
- Keep every frame recognizable as Suzu.
