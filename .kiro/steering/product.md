# Product Steering

## Product Vision

GodSandbox is a cozy sandbox game where the player acts as a god-like observer and intervener.
The player watches over a small world of 4 characters, witnesses events, and chooses how to intervene.
The game rewards emotional connection with characters and the satisfaction of shaping a living world.

## Core Design Principles

- The player is a god, not a character.
- The world runs on its own; the player influences it, not controls it.
- Events are the center of gameplay. Characters are participants in events.
- Visuals and music deepen the player's emotional investment.
- `focusedEvent` is the primary UI state. `selectedCharacter` is secondary.

## Current MVP Value

- Event occurs in a small world with a fixed cast of 4 (Eve, Garan, Ryo, Suzu).
- Player sees which characters are involved.
- Player intervenes with limited godPoints via `watch | help | trial`.
- Event outcome is recorded and shapes the world.
- Visuals help the player understand the event.

## Planned Kiro-managed MVP Extension

- Music Garden will let the player upload MIDI music, play it as sandbox BGM, interact with mystical note visuals, and earn capped godPoints through consecutive successful note clicks.

## Active Slots and Roster

- `activeSlots` is always filled with exactly 4 characters.
- `roster` is the complete set of owned characters. No archive or hidden state in MVP.
- Characters do not age over time. Age is a profile value set at creation.

## PO Decision Required

The following areas require explicit Product Owner decision before an agent may implement or change them:

- Game balance (godPoints economy, faith thresholds, reward caps)
- Character visual quality and approval
- Event art approval
- Music reward economy (streak target, per-file godPoint cap)
- Any change exposing faith, relation score, or five-phase internal values to UI or LLM
- Any new external dependency or API call from the web app runtime
- Scope of MVP: death, lifespan, medals are out of scope until PO re-defines
