# UI State Model

Status: canonical managed document

This document defines the primary UI state, routes, panel behavior, and tutorial integration rules.

## Core UI rules

- The sandbox is the main screen.
- `focusedEvent` is the primary gameplay state.
- `selectedCharacter` is removed as a primary concept.
- Side panels may be open simultaneously on larger layouts.
- Mobile uses bottom sheets instead of desktop-style side panels.
- Logs, relations, passports, and roster are route-based surfaces.
- Tutorial anchors are tied to the screen state machine, not to loose DOM-only conventions.

## Canonical routes

Recommended route model:

```text
/sandbox
/roster
/relations
/logs
/passports
/passports/:passportId
/character-editor/:characterId
/character-editor/new
```

Rules:

- `/sandbox` hosts the main loop.
- Route surfaces can still use panels or sheets internally.
- Route identity is used for deep links, restore-after-reload behavior, and tutorial state coordination.

## Sandbox UI composition

Desktop baseline:

- top shell for player info, global actions, and navigation
- central sandbox viewport
- event focus area
- intervention controls
- multi-panel support for roster, logs, relations, and passport surfaces

Mobile baseline:

- sandbox viewport remains visually dominant
- event focus and intervention controls remain primary
- supplemental surfaces open as bottom sheets

## UI state shape

```ts
interface SandboxUiState {
  focusedEventId: string | null;
  openPanels: Array<"roster" | "relations" | "logs" | "passport">;
  mobileSheet?: "roster" | "relations" | "logs" | "passport" | null;
  tutorialStateId?: string | null;
  routePath: string;
}
```

Rules:

- `focusedEventId` mirrors the canonical current event from the application layer.
- After application hydration finishes, `focusedEventId` should resolve to the same current event as `SandboxSession.currentEventId`.
- Panels are additive on desktop.
- Mobile sheet state is singular even if desktop panels are plural.

## Character lifecycle UI rules

- Initial four setup and later character creation use the same editor UI and the same draft model.
- A new character can be saved into `roster` without immediately replacing an active character.
- Replacement is a separate interaction that reassigns `activeSlots`.
- Existing characters remain re-editable.
- Image selection is mandatory before save.
- Personality vector, speech style, and age are optional.

## Tutorial state machine rules

- The tutorial is state-machine driven.
- Anchor eligibility must depend on both route and expected screen state.
- DOM presence alone is not enough to advance or resolve a tutorial step.

Recommended step binding shape:

```ts
interface TutorialAnchorBinding {
  stepId: string;
  route: string;
  requiredUiState: Record<string, unknown>;
  anchorId: string;
}
```

Rules:

- Step advancement should check route, state, and anchor presence.
- Scroll, lock, and highlight logic should be independently testable.
- The second tutorial for new-character addition is mandatory only the first time that route is used.

## Event-first presentation rules

- The event panel must lead the player into `Watch`, `Help`, or `Trial`.
- Primary and supporting characters must be distinguishable in multi-character events.
- Story logs and relation views are secondary surfaces, not the main sandbox focus.
- The player should always understand what the current event is before being asked to intervene.
