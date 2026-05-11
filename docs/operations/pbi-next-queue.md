# PBI Next Queue

Status: working queue, not a canonical product specification.

This document tracks short-term implementation order and dependencies.
Canonical specifications remain in:

- `docs/product/mvp-implementation-plan.md`
- `docs/product/faith-system-spec.md`
- `docs/product/observed-dialogue-spec.md`
- `docs/product/passport-outside-world-spec.md`

## Purpose

This queue keeps Codex work out of Claude's active faith UI hiding and
external LLM dialogue handoff repair work. It records the next safe PBIs and
their dependencies.

## 1. Current Coordination Notes

These notes are short-lived and should be refreshed when the related PRs merge.

## Active: PBI 9a — Event Outcome System (2026-05-10)

Two parallel lanes:

- **Claude / PBI 9a-spec**: `docs/product/event-outcome-system-spec.md` + `docs/artifacts/event-outcome-matrix.html`
  — Event outcome spec, 7-event matrix, dice resolution rules.
  PR: `docs: add event outcome system spec`

- **Codex / PBI 9a-core**: `src/domain/` — domain implementation of dice resolver,
  event outcome types, 7 event templates, and minimal connection to applyInterventionService.
  PR: `feat: add event outcome judgement foundation`

Dependency: Codex must not touch `docs/product/**`. Claude must not touch `src/**`.
Merge order: either order is safe (no file overlap).

## Recent Merges

- #281 (Observed Dialogue Runtime) — merged to main.
- #282 (PBI 8a MVP Acceptance Smoke Tests) — merged to main.
  - 28 domain tests + 37 AI tests now in CI.
  - Invariants locked: faith hiding, dialogue handoff, observed dialogue runtime,
    passport boundary, AI observability.
- #286 (PBI 4b-ui Observed Dialogue UX Polish) — merged to main.
  - EventFirstSandbox dialogue bubble visibility improved.

## Queue A: Review Waiting

### Claude: PBI 8b — PO Playtest Kit + MVP Readiness Explainer

Status: PR #285 in review.

Scope:
- `docs/operations/po-mvp-playtest-guide.md`
- `docs/artifacts/po-mvp-readiness-explainer.html`
- `docs/operations/pbi-next-queue.md`

## 2. Stable Next-PBI Definitions

These definitions should remain useful after the current PR numbers become stale.

## Queue B: Codex Work After Claude Task

### PBI 4b-min: Observed Dialogue Runtime Minimal Slice

Purpose:

Create the smallest runtime slice where the sandbox sometimes speaks like
ambient life, without calling an external LLM.

Allowed source modes:

- `authored_fixture`
- deterministic fallback

Required triggers:

- `event_started`
- `intervention_applied`
- `idle_timer`

Behavior:

- Use only dialogue that passes `validateDialogue`.
- Show dialogue as small speech bubbles.
- Hide each bubble after 3 to 5 seconds.
- Show at most 2 bubbles at once.
- Continue gameplay on `null` or no candidate.
- Do not show `faith` in UI.
- `faithBand` may be used internally for selection, but must not be displayed.

Out of scope:

- LLM runtime integration.
- Ryo reaction service integration.
- Passport memory reflection.
- semantic cache.
- RAG.
- autonomous agents.

Expected files for implementation after Claude merge:

- `src/domain/dialogue.ts`
- `src/domain/models.ts`
- `src/features/events/EventFirstSandbox.tsx`
- `src/features/events/EventFirstSandbox.css`
- `src/domain/runtime.test.ts`

Gate:

- Do not implement until Claude's faith/handoff PR is merged.
- Rebase on latest `main` before starting.

Acceptance conditions:

- `event_started`, `intervention_applied`, and `idle_timer` can produce fixture or fallback dialogue.
- Invalid dialogue is rejected.
- No candidate does not pause or break gameplay.
- UI text does not expose `faith` or raw `faithBand`.
- `npm run typecheck`, relevant domain tests, and `npm run build` pass.

### PBI 8a: MVP Acceptance Smoke Tests

Purpose:

Lock the main invariants from PBI 1 through PBI 6, faith hiding, and dialogue
handoff in tests.

Candidate tests:

- Faith numeric values do not appear in sandbox UI text.
- Passport JSON internally contains `currentFaith`.
- `externalAiPromptBlock` does not expose current faith numeric values.
- Dialogue handoff prompt requests JSON array only.
- `parseDialogueCandidatesFromText` can parse `{ name, text }` JSON arrays.
- Passport confirm cancel does not change state.
- `npm run typecheck && npm run test:domain && npm run test:ai && npm run build` passes.

Out of scope:

- New UI behavior.
- New runtime dialogue features.
- Workflow or package changes unless explicitly approved.

### PBI 7: WorldPrinciple Template Tagging

Status: independent.

Purpose:

Tag event templates with world principle metadata and use it for event weighting.

Important constraints:

- Do not expose internal five-phase values in UI, Passport, or event logs.
- Keep generated event display player-safe.
- Keep behavior deterministic.

## 3. Parking Lot

## Queue C: Later

These are intentionally deferred until the MVP loop is stable.

- RAG.
- semantic cache.
- autonomous runtime agents.
- self-correcting agents.

## PR Body Draft for PBI-CX-001

```md
## Target PBI
PBI-CX-001 Codex Operating Bootstrap + Backlog Split

## Issue
Closes #274

## Branch
`docs/codex-operating-bootstrap`

## Changed files
- `docs/operations/codex-operating-bootstrap.md`
- `docs/operations/pbi-next-queue.md`

## Referenced docs
- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/product/mvp-implementation-plan.md`
- `docs/product/faith-system-spec.md`
- `docs/product/observed-dialogue-spec.md`
- `docs/product/passport-outside-world-spec.md`
- `docs/architecture/ai-architecture.md`

## Line responsibility
CodexB / docs-ops lane. This PR adds operating docs and queue planning only.

## Summary
- Added Codex low-token operating bootstrap guidance.
- Added session prompt, scope checklist, open PR overlap checklist, and short PR template.
- Added next PBI queue that avoids Claude's active faith UI hiding / dialogue handoff work.
- Defined PBI 4b-min and PBI 8a at implementation-ready planning granularity.

## Out of scope
- No implementation file changes.
- No workflow changes.
- No package changes.
- No `AGENTS.md` / `CLAUDE.md` changes.
- No PBI 4b-min implementation.
- No PBI 8a implementation.

## Scope check
- `src/**` unchanged.
- `.github/**` unchanged.
- `package.json` unchanged.
- `AGENTS.md` unchanged.
- `CLAUDE.md` unchanged.

## Verification
- `git diff --name-only origin/main...HEAD`: ...
- `git diff --check origin/main...HEAD`: ...
- `npm run build`: ...

## Review focus
- Confirm the bootstrap keeps Codex usage low-token and low-conflict.
- Confirm the next queue avoids Claude's active implementation files.
- Confirm PBI 4b-min and PBI 8a are defined without starting implementation.
```
