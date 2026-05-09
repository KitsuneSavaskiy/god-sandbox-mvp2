# Codex Operating Bootstrap

## Purpose

This note defines a low-token, low-noise Codex operating setup for GodSandbox.
It is for local Codex sessions only. Do not commit local Codex config files,
personal paths, account names, tokens, API keys, or secrets.

## Recommended Local Config

Put this in the user's local Codex config, not in this repository.

```toml
model_reasoning_effort = "medium"
model_reasoning_summary = "none"
model_verbosity = "low"
plan_mode_reasoning_effort = "low"
```

Rules:

- Do not add `config.toml` to this repo.
- Do not write personal paths, account data, tokens, API keys, or secrets.
- Prefer concise outputs: facts, diffs, test results, blockers.

## Session Bootstrap Prompt

Paste this at the beginning of a Codex session when starting GodSandbox work.

```md
You are Codex working on GodSandbox.

Follow these rules strictly:

- Do not reveal internal reasoning or chain-of-thought.
- Give only concise progress notes, concrete findings, diffs, test results, and blockers.
- Work in one PBI only.
- Do not modify files outside the declared scope.
- Do not approve or merge PRs.
- Do not touch workflow, dependency, billing, secret, policy, or permission files unless explicitly instructed.
- Read `AGENTS.md`, `docs/agent-operating-rules.md`, and `docs/agent-pr-checklists.md` before making changes.
- If another agent has an open PR touching overlapping files, stop and report the conflict.
- Before editing, output:
  1. planned branch name
  2. files you expect to touch
  3. files you will not touch
  4. commands you will run
- After editing, output only:
  - changed files
  - summary
  - test commands and results
  - blockers
  - PR body draft
```

## Low-Token Operating Rules

- Prefer one PBI per branch and one branch per PBI.
- Keep reports short and structured.
- Do not narrate hidden reasoning.
- Do not paste long command output unless it contains a blocker.
- Report only changed files, summary, tests, blockers, and PR body draft.
- For docs-only work, do not run UI checks unless the PBI explicitly asks.

## Required Output Format

Before editing, use this format only:

```md
### Plan
- Branch:
- Expected files:
- Files not touched:
- Commands:
```

After editing, use this format only:

```md
### Result
- Changed files:
- Summary:
- Tests:
- Blockers:
- PR body draft:
```

## Scope Checklist

Before editing:

- Confirm the current branch.
- Confirm `git status --short` is clean or that unrelated changes are not included.
- Confirm the declared allowed files.
- Confirm forbidden paths.
- Confirm the PBI does not overlap with open PRs.

Stop if:

- The requested file scope conflicts with another open PR.
- The PBI requires workflow, dependency, billing, secret, policy, or permission changes without explicit instruction.
- Required docs are missing and no replacement source is available.

## Open PR Overlap Checklist

Use GitHub PR files or `gh pr diff --name-only` as the source of truth.

- Check open PRs for overlapping paths.
- Check whether another agent is touching the same feature surface.
- If overlap exists, stop and report the PR number and overlapping files.
- Do not resolve another agent's conflicts unless explicitly assigned.

Common high-conflict areas:

- Dialogue handoff work:
  - `src/domain/dialogue.ts`
  - `src/features/dialogue-preview/**`
  - `src/features/events/EventFirstSandbox.tsx`
  - `src/domain/runtime.test.ts`
- Passport UI work:
  - `src/features/passport/**`
  - `src/domain/passport.ts`
  - `src/domain/snapshots.ts`

## Short PR Body Template

```md
## Target PBI
PBI-...

## Issue
Closes #...

## Branch
`...`

## Changed files
- ...

## Referenced docs
- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- ...

## Line responsibility
...

## Summary
- ...

## Out of scope
- ...

## Scope check
- No changes to forbidden paths.
- No package / workflow / secret / policy changes.

## Verification
- `git diff --name-only origin/main...HEAD`: ...
- `git diff --check origin/main...HEAD`: ...
- `npm run typecheck`: ...
- `npm run build`: ...

## Review focus
- ...
```

## Output Policy

Codex should not output internal reasoning logs.

Preferred output:

- Facts
- Diff summary
- Test results
- Blockers
- Follow-up candidates

Avoid:

- Chain-of-thought
- Long speculative analysis
- Unrequested design expansion
- Local personal environment details
