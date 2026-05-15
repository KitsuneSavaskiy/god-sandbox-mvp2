# Architecture Steering

## Layer Rules

| Layer | Path | Responsibility |
|-------|------|----------------|
| domain | `src/domain/**` | Pure domain logic, types, and invariants. No React, no I/O, no LLM calls. |
| application | `src/application/**` | Runtime services: event generation, intervention application, snapshot/passport issuance, migration control. Orchestrates domain without owning UI. |
| features (UI) | `src/features/**` | React components and view models. Reads domain/application state; does not mutate domain directly. |
| persistence | `src/persistence/**` | Default manifests and persistence contracts. React UI must not call persistence directly. |
| tools | `tools/**` | Local automation only. Never called from web app runtime. |
| assets | `public/art/**` | PO-approved or PO-preview art assets. No generated output committed here without PO sign-off. |

## Strict Do-Nots

- **LLM output must not mutate game state directly.** `src/ai/` receives `RuntimeWorldState` read-only and returns text. State updates are applied by `runtimeCommands.ts` in the application layer.
- **UI must not mutate domain.** `src/features/**` components dispatch commands or call application-layer services; they do not reach into `src/domain/**` to write data.
- **Do not expose raw faith/internal values in UI or LLM context.** Convert to `faithBand` (string) before passing to any prompt or display.
- **Do not call image generation APIs from the web app runtime.**
- **Do not commit `.asset-pipeline/**` or `.godsandbox/**` generated output to Git.**
- **Do not add npm dependencies without PO approval.**

## AI Boundary

```
What LLM may generate:
  - Character dialogue and emotional expression
  - Event description / world narration
  - Short reaction text to player intervention

What deterministic game logic decides:
  - HP, faith, fear, affinity changes
  - Item acquisition, quest completion
  - NPC state transitions
  - Save data updates
  - Billing, rewards, achievements
```

`state_change_request` is always `null` and is enforced by schema validation.

## Music Garden Architecture Placement

When Music Garden is implemented:

- Parser (`musicGardenMidi.ts`) lives in `src/features/music-garden/`. It is a pure function: ArrayBuffer → NormalizedNote[].
- Reward logic (`musicGardenReward.ts`) is a pure function in `src/features/music-garden/` that calls a helper in `src/application/growthBalanceService.ts` for godPoint grants.
- Visualizer (`MusicGardenVisualizer.tsx`) renders above the world backdrop and below the event UI layer. z-index must be defined in a shared CSS layer map.
- No MIDI data leaves the browser. No LLM calls are made by Music Garden.

## Asset Pipeline

- `public/art/` contains approved sprites, overlays, and backgrounds.
- Sprite validation uses `tools/asset-pipeline/check-sprite-suite.mjs`.
- New characters use `docs/operations/resident-sprite-spec.md` and the `_template.md` intake flow. Per-character ad-hoc docs are not created.
- Generated asset jobs are described in machine-readable JSON (task recipe), not prose documents.
