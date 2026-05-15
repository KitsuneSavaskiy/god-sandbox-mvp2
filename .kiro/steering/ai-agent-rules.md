# AI Agent Rules

These rules apply to all AI agents working on GodSandbox: Claude, Codex, Claude Code, and any future agent.
They complement and do not override `AGENTS.md` and `docs/agent-operating-rules.md`.

## Required Before Starting Work

Always:

```bash
git fetch origin
git switch main
git pull --ff-only
```

**For sprint-dispatch-managed PBIs:**

1. Run `npm run sprint9:dispatch -- --status` to check Wave state and dependencies.
2. Read the latest dispatch comment for the assigned Issue.
3. Read all `requiredDocs` listed in the dispatch comment.
4. Create a dedicated branch: `git switch -c <branch-name>`.

Do not begin implementation if the Wave gate is not yet open. Confirm with PO.

**For Kiro-managed PBIs:**

1. Read `.kiro/specs/<feature>/requirements.md`.
2. Read `.kiro/specs/<feature>/design.md`.
3. Read `.kiro/specs/<feature>/tasks.md`.
4. Confirm the spec is merged to `main` and assigned by PO before implementation.
5. Create a dedicated branch: `git switch -c <branch-name>`.

Do not begin implementation until either the sprint dispatch gate is open or the relevant Kiro spec is merged and PO-assigned.

## Required Before Creating a PR

Run the verification commands required by `.kiro/steering/review-policy.md` for the PR type.

**For src changes:**

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run test:domain
npm run test:ai
npm run build
```

UI changes additionally require browser verification or a stated reason why it was not possible.

**For docs-only changes:**

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run build
```

If any command cannot run, state the reason explicitly in the PR body.
Do not omit results. Pass/fail must be recorded honestly.

## Scope Rules

- Edit only the files declared in the PBI scope.
- Do not expand scope without stopping and confirming with PO first.
- Do not mix multiple PBIs in a single PR.
- Do not commit local auxiliary files (`.logs/`, temp notes) unless they are declared PBI deliverables.

## When Spec is Unclear

- Do not guess or invent behavior. Stop and ask PO.
- If the question is design-level, create or update the relevant `.kiro/specs/**` doc before implementing.
- Spec documents in `.kiro/specs/**` are authoritative for their feature. Do not implement details that contradict them without PO re-confirmation.

## PR Body Required Sections

Every PR must include:

```
## Target PBI
## 対応 Issue (Closes #...)
## Branch
## 参照したdocs
## 今回のLine責務
## Summary
## Changed files
## Out of scope
## Verification (commands + results)
## Manual QA (or: N/A — docs-only, reason)
## Merge dependency (if any)
## merge権限
```

A PR missing 「参照したdocs」 or 「今回のLine責務」 is a merge blocker.

## Merge Rule

- AI agents must not approve or merge their own PR.
- The PR author must not approve their own PR.
- The same agent must not act as both implementer and auditor on the same PR.
- PO makes the final merge decision.
- Exception: a PO-authorized auditor may approve/merge only when all of the following hold:
  - No blockers
  - Required CI green
  - Changed files confirmed within declared scope
  - PR body has all required sections
  - Required labels are present
  - All review comments resolved or PO-explicitly-waived

When in doubt: do not merge. Report as a blocker or confirmation request.

## Labels

- `agent-routine`: small, reversible, low-risk changes that do not touch policy, workflow, permissions, secrets, billing, dependencies, or protected paths.
- `manual-review-required`: everything else. When uncertain, use this one.

## Protected Path Changes

Changes to the following always require `manual-review-required` and explicit PO review:

- `src/**`
- `docs/product/**`
- `docs/architecture/**`
- `public/art/**`
- `tools/**`
- `.github/**`
- `AGENTS.md`
- `CLAUDE.md`
- `package.json`
- `.kiro/steering/**`
- `.kiro/specs/**`

## Secrets and Personal Data

Never commit to any Git-tracked file:
- Secrets, tokens, API keys, credentials
- Local absolute paths or environment names
- Individual account settings
- Personal images or information
