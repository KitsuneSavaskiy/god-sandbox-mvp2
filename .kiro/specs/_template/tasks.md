# Tasks

## Implementation Tasks

- [ ] 1. [Task name]
  - Scope: [What this task covers]
  - Files:
    - `src/…`
  - Verification:
    - [How to confirm the task is done]

- [ ] 2. [Task name]
  - Scope:
  - Files:
  - Verification:

## Out of Scope

- [What is explicitly not part of implementation]

## PR Checklist

- [ ] `git diff --name-only origin/main...HEAD` shows only declared files
- [ ] `git diff --check origin/main...HEAD` is clean
- [ ] `npm run typecheck` passes
- [ ] `npm run test:domain` passes (if domain files changed)
- [ ] `npm run build` passes
- [ ] No secrets, tokens, or local absolute paths committed
- [ ] No raw faith/internal values exposed in UI or LLM context
- [ ] PR body includes: target PBI, changed files, out of scope, verification results, manual QA notes
