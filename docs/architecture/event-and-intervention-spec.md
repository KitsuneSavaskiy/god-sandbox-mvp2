# Event And Intervention Spec

Status: canonical managed document

This document fixes the event-loop, intervention, and change-application rules for `god-sandbox-mvp2`.

## Event generation policy

- Event generation is hybrid, not purely random and not purely free-form.
- The generator starts from curated templates and structured rules.
- Template selection is weighted by:
  - relation scores
  - personality vectors
  - world or situation tags
  - ongoing effects
  - recent event history
- The generator must be deterministic when given the same seed, world state, and weighted inputs.

Recommended pipeline:

1. Read the current session projection.
2. Collect candidate characters from `activeSlots`.
3. Expand candidate relations and world-context tags.
4. Score eligible event templates.
5. Build one current event with one `primaryCharacterId` and one or more `participantCharacterIds`.
6. Persist the new event and point `currentEventId` to it.

## Current event rule

- `SandboxSession.currentEventId` always points to exactly one current event record.
- The current event may be in `pending`, `active`, `resolved`, `expired`, or `chained` status.
- When one event completes its role as the current focus, the application must assign the next current event before finalizing the post-event autosave.

## Participant model

- Every event has one `primaryCharacterId`.
- Every event has one or more `participantCharacterIds`.
- The primary character must also appear in `participantCharacterIds`.
- UI wording uses:
  - primary character as the lead
  - all other participants as supporting characters

## Event rendering policy

Two rendering paths are allowed:

- deterministic template rendering for stable, testable event text
- structured-data rendering for richer UI composition and downstream prompt generation

Rules:

- Event storage must keep enough structured data to regenerate deterministic wording.
- Free-form external AI output is not the canonical event record.
- If richer narrative text is generated outside the app, it is supplemental text only.

## Intervention rules

- The canonical intervention enum is `watch | help | trial`.
- A player may intervene multiple times on the same event.
- `watch` costs `0` god points.
- `help` and `trial` consume finite god-point resources.
- Resource validation must happen in the application layer before persistence commits.
- Intervention history is stored in independent `InterventionRecord` entries.

Recommended `InterventionRecord` expansion:

```ts
interface InterventionRecord {
  id: string;
  eventId: string;
  type: "watch" | "help" | "trial";
  resourceCost: number;
  godPointsBeforeApply: number;
  godPointsAfterApply: number;
  playerReason?: string;
  playerMemo?: string;
  changeSetIds: string[];
  createdAt: string;
}
```

## Player steering signals

- `playerReason` and `playerMemo` are canonical player-authored signals.
- These fields are stored because the player may use them to steer future story generation or external prompt generation.
- The app may consume these fields in deterministic weighting rules.
- External AI prompt builders may include these fields, but the game must remain playable without any external AI step.

## Change application model

- Character changes are stored as append-only `ChangeSet` records.
- `ChangeSet` is type-safe and kind-classified.
- Each `ChangeSet` stores:
  - the delta patch
  - the target character
  - the source event
  - the optional source intervention
  - the post-apply snapshot
  - optional origin metadata

Recommended `ChangeSet.patch` expectations by kind:

- `status-delta`: changed numeric status keys and amounts
- `personality-delta`: changed personality axes and amounts
- `relation-delta`: relation score delta inputs
- `appearance-update`: asset changes, sprite regeneration hints, source linkage
- `speech-style-update`: next speech style template ID
- `narrative-role-update`: free-text role change
- `ongoing-effect-created`: newly materialized effect payload

## Immediate and ongoing effects

- Some interventions only emit immediate `ChangeSet` records.
- Some interventions also create `OngoingEffectInstance` records.
- Ongoing effects are resolved by future event completions, event counts, or explicit trigger exhaustion.
- Ongoing effects are canonical gameplay state, not UI-only decorations.

## Relation recomputation rule

- Relation scores are stored as current materialized values for fast reads.
- The canonical derivation path is still historical:
  - event history
  - intervention history
  - relation-oriented `ChangeSet` entries
- Recompute jobs must be possible from recorded history when repair or migration is needed.

## External narrative policy

- The app does not call external AI APIs directly.
- External Codex or similar tooling may generate parallel narrative text outside the app.
- Canonical app responsibilities stop at:
  - deterministic event data generation
  - deterministic render text
  - prompt/export packet generation
