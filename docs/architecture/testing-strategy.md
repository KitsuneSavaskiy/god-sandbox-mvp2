# Testing Strategy

Status: canonical managed document

This document fixes the minimum test focus for `god-sandbox-mvp2`.

## Domain unit priorities

The highest-priority domain unit tests are:

- event generation
- intervention apply
- roster replacement
- snapshot issuance

Rules:

- Domain tests must run without React.
- Weighted event generation should be testable with deterministic seeded inputs.
- Relation recomputation from event history should be testable independently from UI.
- ChangeSet application should verify both deltas and post-apply snapshots.

## UI verification priorities

The highest-priority UI checks are:

- `390px` event-first flow
- `360px` event-first flow
- focused-event visibility
- multi-panel desktop behavior
- mobile bottom-sheet behavior

Rules:

- Sandbox readability must be checked at both widths.
- Event focus and intervention buttons must remain first-class at mobile sizes.

## Tutorial tests

Tutorial testing must isolate:

- anchor resolution
- automatic scroll behavior
- interaction lock behavior
- step transition logic

Rules:

- Tutorial tests should not rely on one giant integration script only.
- State-machine transitions should be testable without visual animation timing.

## Passport tests

- Passport exports must have schema snapshot tests.
- Snapshot input changes should produce predictable export differences.
- Export filenames must include the stable token required for downstream matching.

## Persistence tests

- save-version migration tests are mandatory
- chunk rollover behavior should be tested
- asset ID to relative path resolution should be tested
- current-state projection rebuild should be tested
