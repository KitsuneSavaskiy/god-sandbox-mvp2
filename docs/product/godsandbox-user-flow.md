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
- The maximum visible character count is four.
- Characters live, move, and talk inside the sandbox.
- Events, not a single focused character, are the main gameplay focus.
- An event can involve one or more characters.
- The player intervenes with `Watch`, `Help`, or `Trial`.
- Character change is a core payoff of the loop.
- Character age is configurable profile data and does not advance over time.
- Adding a new character always leads to replacing one of the current four active characters.
- The main route should reach Character Passport issuance within roughly 30 minutes.

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
   - The flow diagram currently names status distribution, personality, relationships, appearance, and medals as example change outputs.
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
13. Repeat the setup flow four times for the initial four-character roster.

### 3. Main loop

14. Watch the sandbox.
15. An event occurs.
16. Focus the event.
17. Intervene.
   - Watch
   - Help
   - Trial
18. Characters change.
19. Repeat this loop as the core play cycle.

### 4. Optional snapshot and passport route

20. Record a character snapshot at any chosen point in the main loop.
21. Issue a Character Passport from that snapshot.
22. Use the passport in an external game.
23. Return to the main loop after external play.

### 5. Optional new character route

24. Start new character addition from the main loop when the player wants to expand the cast.
25. Start new character creation.
26. Choose or edit a template.
27. Decide the new character settings.
   - Appearance image
   - Gender
   - Personality
   - Age
   - Speech style
28. Start the second tutorial only on the first use of this route.
29. Choose the four characters to place in the sandbox.
30. Replace one of the currently active four characters.
31. Return to the main loop.

### 6. Session exit

32. Log out.

## State implications

- The product needs a distinction between all owned characters and the active four shown in the sandbox.
- Event focus is a first-class state.
- Snapshot recording is distinct from passport issuance.
- The new character route is optional and separate from the default onboarding route.

## Line planning note

For implementation ownership based on this flow, use `docs/architecture/line-responsibilities.md`.
