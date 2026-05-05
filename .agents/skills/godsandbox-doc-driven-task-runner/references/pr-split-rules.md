# PR split rules

## Use two PRs when

- A task needs a source-of-truth document before implementation.
- A bug fix depends on visual or product interpretation.
- Generated assets are involved.
- The implementation may need regeneration or fallback.
- The task is likely to be resumed by another Codex session.

## PR 1: Task document

Allowed:

- `docs/operations/**`
- `docs/architecture/**`
- `.agents/skills/**` if this is a skill task

Not allowed:

- `src/**`
- `public/art/**`
- `assets/generated/**`
- `manifests/**`
- generated outputs

## PR 2: Implementation

Allowed:

- only files named by the task document
- generated assets only if adopted by project rules
- tests or tools required by the task document

Must include:

- reference to the task document
- tests
- preferred outcome or safe fallback outcome
