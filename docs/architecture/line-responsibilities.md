# Line Responsibilities For god-sandbox-mvp2

Source of truth:

- `docs/product/godsandbox-user-flow.md`
- `docs/product/godsandbox-user-flow.drawio`

This document defines the initial implementation boundaries for the new repository.
The goal is to reduce overlap while keeping each line responsible for a vertical slice of the completed product flow.

## Line 1: App Platform / Shell / Auth

Owns:

- Login and logout flow
- App bootstrap
- Routing
- Global layout
- Top menu and shell navigation
- Modal, drawer, and panel infrastructure
- Responsive viewport behavior
- Shared UI primitives
- Sandbox page frame that hosts the feature slices

Primary directories:

- `src/app/**`
- `src/routes/**`
- `src/ui/**`
- `src/platform/**`

Does not define:

- Event generation rules
- Character creation semantics
- Passport issuance semantics

## Line 2: Core Runtime / Domain / Persistence

Owns:

- Canonical models for `Character`, `SandboxSession`, `WorldEvent`, `Intervention`, `CharacterSnapshot`, and `CharacterPassport`
- `roster` and `active four` separation
- Event state and intervention application
- Character change calculation
- Save and load behavior
- Seed data and default session bootstrap
- Short architecture decision records tied to the canonical flow

Primary directories:

- `src/domain/**`
- `src/state/**`
- `src/persistence/**`
- `docs/adr/**`

Does not define:

- Screen layout
- Tutorial staging
- Character creator UI experience

## Line 3: Character Lifecycle / Roster / Passport

Owns:

- Initial character setup after the first tutorial
- Default four template selection and editing
- Character creation and editing UI
- Active four selection
- One-for-one replacement flow after new character addition
- Snapshot recording UI
- Character Passport issuance UI
- External game handoff UI

Primary directories:

- `src/features/character-creator/**`
- `src/features/roster/**`
- `src/features/snapshot/**`
- `src/features/passport/**`
- `src/features/external-handoff/**`

Does not define:

- Main event loop semantics
- App shell behavior
- Intro tutorial orchestration

## Line 4: Event Experience / Tutorial / Narrative

Owns:

- Introduction tutorial
- Event occurrence presentation
- Event focus UI
- Intervention UI for `Watch`, `Help`, and `Trial`
- Result presentation after intervention
- Story log presentation
- Multi-character event wording and display
- Second tutorial for first-time new character addition
- Highlight, scroll lock, and guidance behavior

Primary directories:

- `src/features/events/**`
- `src/features/tutorial/**`
- `src/features/story/**`

Does not define:

- Canonical stored state
- Character creator form semantics
- App-wide platform setup

## Boundary rules

- Line 1 owns the host frame, not the gameplay meaning.
- Line 2 defines the canonical product state and data contracts.
- Line 3 owns the character lifecycle from setup to export.
- Line 4 owns the event loop experience from onboarding through repeated intervention.
- If a line must touch another line's area for integration, keep the change minimal and do not redefine ownership in that PR.

## Recommended implementation order

1. Line 2 establishes canonical runtime models and session state.
2. Line 1 establishes shell structure and integration points.
3. Line 4 establishes event-first onboarding and repeated event interaction.
4. Line 3 establishes initial setup, roster replacement, snapshot, and passport flows.

## Review focus

- `active four` stays distinct from the owned roster.
- Event focus remains first-class across UI and state.
- Snapshot and passport remain separate steps.
- The new character route always returns to a four-character active sandbox.
- Line ownership stays clear enough to avoid mixed PRs with unrelated scope.
