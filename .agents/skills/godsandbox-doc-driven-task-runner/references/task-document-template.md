# Task document template

# <Task title>

Status: <Sprint / blocker / follow-up / PoC>

## Purpose

Explain why this task exists.

## Current failure

Describe the observed failure.

Include:

- what fails
- where it fails
- why existing checks did not catch it
- whether this is blocker / non-blocker / follow-up

## Final vision

Describe what the user should see or what the system should guarantee.

Use concrete acceptance language.

## Source of truth

Define what the implementation must treat as authoritative.

Examples:

- sandbox display contract
- schema document
- generated asset dimensions
- UI behavior
- domain rule
- Passport contract

## Required rules

List implementation rules.

## Ready / Done conditions

List all conditions that must be true before the work is considered complete.

## Testing requirements

List exact commands.

```bash
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

Add domain, browser, asset, or visual checks as needed.

## Browser / visual acceptance

If UI or asset work is involved, include:

- desktop
- 390px
- 360px
- PO visual check if needed

## Preferred outcome

Describe the ideal completed state.

## Safe fallback outcome

Describe the safe state if preferred outcome cannot be achieved.

The safe fallback must not leave broken output in ready state.

## Out of scope

List explicit non-goals.

## One-line Codex resume instruction

```bash
codex "Read <this-doc-path>, implement the task exactly, achieve the final vision, and test until complete."
```
