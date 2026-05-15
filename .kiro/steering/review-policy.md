# Review Policy

## Route Selection

| Route | When to use |
|-------|-------------|
| `agent-routine` | Small, reversible, low-risk changes. No policy, workflow, permissions, secrets, billing, dependency, or protected path changes. |
| `manual-review-required` | Everything else. When uncertain, always choose this route. |

`docs/product/**` and `docs/architecture/**` updates always require `manual-review-required`, even if docs-only.
`.kiro/steering/**` and `.kiro/specs/**` updates always require `manual-review-required`.

## Manual Review Required — Always

Changes to the following paths always require `manual-review-required` and explicit PO review before merge:

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

## PR Body Must Include

Every PR must contain all of the following sections. Missing 「参照したdocs」 or 「今回のLine責務」 is a **merge blocker**.

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
## Manual QA (or: N/A — reason)
## Merge dependency (if any)
## merge権限
```

## Verification Requirements by PR Type

### docs-only PR (e.g., `.kiro/**`, `docs/operations/**`)

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run build
```

Manual QA: N/A (state reason).

### src change PR

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run test:domain
npm run test:ai
npm run build
```

UI changes additionally require browser verification or a stated reason why it was not possible.

### public/art PR

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run build
```

Manual QA: PO must visually confirm assets before merge.

### tools PR

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run build
```

Manual QA: describe the tool run result and any visual output checked.

## PO Review Focus Areas

When reviewing a PR, the PO checks:

1. **Scope**: Changed files match the declared PBI scope. No hidden expansion.
2. **Safety**: No secrets, no personal paths, no raw internal values in UI or LLM context.
3. **Consistency**: Does not contradict `docs/product/godsandbox-user-flow.md` or `docs/architecture/` specs.
4. **Quality** (for art and UI): Visual output meets the game's aesthetic direction.
5. **Economy** (for balance changes): godPoints, faith, reward caps remain within intended design.

## Audit Severity

| Level | Judgment |
|-------|----------|
| P0 blocker | Secret leak, PII, unauthorized package/CI change, boot failure, data destruction, major scope violation |
| P1 blocker | Major acceptance criteria unmet, broken primary UI flow, mobile unusability, Passport contract broken, unreviewed protected path |
| P2 non-blocker | Fix before merge if straightforward; otherwise create follow-up PBI |
| P3 follow-up | Out-of-scope improvement suggestion; does not block merge |

## Merge Authority

- AI agents must not approve or merge PRs.
- PR authors must not approve their own PRs.
- The same agent must not act as implementer and auditor on the same PR.
- Merge decision belongs to PO.
- Exception: a PO-authorized auditor may approve/merge only when all blocker conditions are cleared (see `docs/agent-operating-rules.md`).
