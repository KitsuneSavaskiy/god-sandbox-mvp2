# Doc-driven task safety checklist

## Before creating the task document

- [ ] Confirm current branch.
- [ ] Confirm git status.
- [ ] Identify untracked files.
- [ ] Identify files that must not be touched.
- [ ] Confirm whether this is docs-only, implementation, asset, or mixed.
- [ ] If mixed, split into docs PR first and implementation PR second.

## Docs PR safety

- [ ] Task document only, unless explicitly allowed.
- [ ] No generated assets.
- [ ] No dist / build output.
- [ ] No personal paths.
- [ ] No API keys, tokens, secrets, auth cache.
- [ ] `git diff --check` passes.
- [ ] PR body states what is not changed.

## Implementation PR safety

- [ ] Reads committed task document.
- [ ] Does not rely on chat-only requirements.
- [ ] Runs all required tests.
- [ ] Does not leave broken generated output as ready.
- [ ] Includes safe fallback outcome if needed.
- [ ] Reports PO visual / UX checks.

## Blockers

Treat as blocker:

- Generated asset is visually broken but marked ready.
- Ready promotion happens without required review.
- Generated files are committed from `incoming`, `tmp`, `rejected`, or `user-uploads`.
- API key UI is added.
- GodSandbox calls image generation API directly.
- Passport schema changes without PO approval.
- Sandbox character name / place / status labels return.
- Death / lifespan / medals return.
