# GodSandbox Complete User Flow

Status: canonical managed document

Managed files:

- `docs/product/godsandbox-user-flow.md`
- `docs/product/godsandbox-user-flow.drawio`

Change control:

- Treat this flow as the product source of truth for `god-sandbox-mvp2`.
- Update the Markdown and Draw.io files together in the same PR.
- Route changes through `manual-review-required`.

## Purpose

This document defines the completed user flow for GodSandbox.
If implementation, planning docs, or lane instructions diverge from this flow, this document wins unless the Product Owner explicitly redefines the product flow first.

## Core product rules

- The player watches the sandbox from a god viewpoint.
- The sandbox always starts with four default characters.
- `activeSlots` always has exactly four occupied entries.
- The maximum visible character count is four.
- `roster` is the complete owned character set. There is no archive or hidden-character concept.
- Characters live, move, and talk inside the sandbox.
- Events, not a single focused character, are the main gameplay focus.
- The UI uses `focusedEvent` as the canonical gameplay focus. `selectedCharacter` is not a primary UI state.
- An event can involve one or more characters.
- The player intervenes with `Watch`, `Help`, or `Trial`.
- Character change is a core payoff of the loop.
- Character age is configurable profile data and does not advance over time.
- Character creation for the initial four and for newly added characters uses the same editor flow and the same data model.
- Adding a new character inserts that character into `roster` immediately while keeping the current active four unchanged until the player later chooses a replacement.
- The main route should reach Character Passport issuance within roughly 30 minutes.
- MVP persistence is fully local-file based. Login only provides the player display name shown inside the game.

## Flow sections

### 1. Entry and first tutorial

1. Log in.
2. Start the introduction tutorial.
3. Begin the sandbox with the default four characters.
4. Watch the sandbox and observe the four characters living and talking.
5. An event occurs.
6. The UI focuses on the event.
   - One or more characters can be involved.
7. The player intervenes.
   - Watch
   - Help
   - Trial
8. Characters change.
   - Example outputs include status values, personality vector shifts, relationship score changes, appearance updates, and narrative role changes.
9. This completes the first tutorial.

### 2. First-time character setup

10. Start character creation after the first tutorial.
11. Choose or edit templates for the default roster.
12. Decide character settings.
   - Appearance image
   - Gender
   - Personality
   - Age
   - Speech style
13. The player may leave some fields at defaults and still continue.
14. Repeat the setup flow four times for the initial four-character roster.

### 3. Main loop

15. Watch the sandbox.
16. An event occurs.
17. Focus the event.
18. Intervene.
   - Watch
   - Help
   - Trial
19. Characters change.
20. Some intervention results apply immediately and some create ongoing effects.
21. Repeat this loop as the core play cycle.

### 4. Optional snapshot and passport route

22. Record a character snapshot at any chosen point in the main loop.
23. Add tags or notes to that fixed snapshot record later if needed.
24. Issue a Character Passport from that snapshot on explicit user action.
25. Use the passport in an external game.
26. Return to the main loop after external play.

### 5. Optional new character route

27. Start new character addition from the main loop when the player wants to expand the cast.
28. Start new character creation.
29. Choose or edit a template.
30. Decide the new character settings.
   - Appearance image
   - Gender
   - Personality
   - Age
   - Speech style
31. Save the new character into `roster` without breaking the current active four.
32. Start the second tutorial only on the first use of this route.
33. At any later point, choose which four characters should be active.
34. Replace one of the currently active four characters when the player is ready.
35. Return to the main loop.

### 6. Session exit

36. Log out.

## State implications

- The product needs a distinction between all owned characters and the active four shown in the sandbox.
- `activeSlots` is fixed-length and always fully occupied.
- Event focus is a first-class state.
- `currentEventId` points to exactly one focused event at a time.
- Snapshot recording is distinct from passport issuance.
- The new character route is optional and separate from the default onboarding route.
- The same editor flow is reused for initial roster setup and later character creation.
- See `docs/architecture/system-spec.md`, `docs/architecture/event-and-intervention-spec.md`, `docs/architecture/snapshot-passport-spec.md`, `docs/architecture/local-persistence-spec.md`, and `docs/architecture/ui-state-model.md` for the canonical design details.

## Line planning note

For implementation ownership based on this flow, use `docs/architecture/line-responsibilities.md`.
