---
name: godsandbox-doc-driven-task-runner
description: Use for GodSandbox doc-first reproducible tasks, Sprint work, PBI task documents, Line 1, Line 2, Line 3, Line 4 handoffs, PR audit blockers, PO report preparation, retro follow-ups, safe fallback outcomes, implementation resume instructions, generated asset review, browser or visual acceptance, and test-until-complete workflows.
---

# GodSandbox Doc-driven Task Runner

Use this skill when a GodSandbox task should be made reproducible before implementation.

This skill keeps Codex from relying on chat history alone. First create or read a committed task document, then implement from that document until the preferred outcome passes or the safe fallback outcome is applied.

## Core workflow

1. Inspect branch, status, open Issue / PR state, and declared scope.
2. If the task is ambiguous, create a source-of-truth task document first.
3. Put the task document under `docs/operations/` or the appropriate docs folder.
4. Commit the task document alone in a docs PR.
5. Do not mix generated outputs, implementation changes, dist output, or unrelated files into the docs PR.
6. After the task document is merged, start implementation from that committed document.
7. Run the testing requirements from the task document.
8. Continue until either the preferred outcome passes or the safe fallback outcome is applied.
9. Report changed files, tests, visual / browser checks, PO checks, fallback use, and remaining risks.

## Required task document sections

Use `references/task-document-template.md`.

At minimum, include:

- Purpose
- Current failure
- Final vision
- Source of truth
- Required rules
- Ready / Done conditions
- Testing requirements
- Preferred outcome
- Safe fallback outcome
- Out of scope
- One-line Codex resume instruction

## Implementation resume

Use `references/implementation-resume-template.md` after the task document is merged.

The implementation agent must treat the task document as the source of truth and must not rely on previous chat history.

## Safety checks

Use `references/safety-checklist.md` before docs PRs and implementation PRs.

Block implementation when:

- generated output is visually broken but marked ready
- ready promotion happens without required human review
- generated files from `incoming`, `tmp`, `rejected`, or `user-uploads` are committed
- API key UI is added
- GodSandbox calls image generation APIs from the app
- Passport schema changes without explicit approval
- death, lifespan, or medals return
- sandbox character name / place / status labels return

## PR split rules

Use `references/pr-split-rules.md`.

Default split:

- PR 1: source-of-truth task document only
- PR 2: implementation based on the committed task document

Do not combine these unless the Product Owner explicitly requests it.

## If blocked

If Codex CLI, permissions, generated asset creation, browser QA, or environment access fails:

1. Stop.
2. Do not mark incomplete output ready.
3. Produce a handoff instruction that starts from the committed task document.
4. If needed, apply the safe fallback outcome.
