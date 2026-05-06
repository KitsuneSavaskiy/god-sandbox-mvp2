# Routine PR Guardian security rationale

PBI: `PBI-SEC-ROUTINE-GUARDIAN-P3-HARDENING-001`

Status: Sprint9 Phase 2 P3 hardening note

## Purpose

Routine PR Guardian helps low-risk `agent-routine` pull requests move without turning protected changes into routine changes.
This document records why the workflow uses `pull_request_target`, which paths require manual review, and which safety limits must not be loosened.

This is a security rationale document.
It does not implement App Server, runner, watcher, job processor, API connection, UI, gameplay, or generation logic.

## Source of truth

Read this document together with:

- `.github/workflows/routine-pr-guardian.yml`
- `docs/security/codex-sidekick-local-security.md`
- `docs/security/codex-app-server-file-system-scope.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`

## P3 hardening addressed

The P3 hardening items are:

| ID | Hardening | Resolution |
| --- | --- | --- |
| R-001 | Protect local hook policy changes. | `.pre-commit-config.yaml` is protected. |
| R-002 | Protect agent instruction changes. | `CLAUDE.md` is protected. |
| R-003 | Protect app shell UI boundary changes. | `src/ui/`, `src/routes/`, and `src/platform/` are protected. |
| R-004 | Document `pull_request_target` safety rationale. | This document records the design constraints. |

Protected path matches must route a PR to `manual-review-required`.
`agent-routine` cannot bypass protected path review.

## Protected path principle

Routine automation is allowed only when a PR is small, low risk, and outside protected paths.
The guardian treats these areas as protected because they can affect security, review policy, generated content boundaries, app routing, or gameplay surface:

- workflow and policy files
- agent instructions
- package and dependency files
- product, architecture, operations, and security docs
- domain, state, persistence, app feature, platform, route, and UI boundary code
- tools and scripts

This P3 hardening adds these missing protected areas:

```txt
.pre-commit-config.yaml
CLAUDE.md
src/ui/
src/routes/
src/platform/
```

Existing protected paths must not be removed to make an `agent-routine` PR pass.

## `pull_request_target` rationale

The workflow uses `pull_request_target` because it needs repository-level permission to:

- inspect the pull request file list
- add `manual-review-required` when a protected path is touched
- comment on the PR with matched protected paths
- approve or enable auto-merge only for routine PRs that do not touch protected paths

`pull_request_target` is safe only under strict constraints.
The guardian must not checkout, build, import, or execute code from the PR head.

Allowed actions:

- Use GitHub API metadata such as labels and changed file names.
- Add labels to the PR.
- Create PR comments.
- Approve or enable auto-merge only when `agent-routine` is present, `manual-review-required` is absent, and no protected path is touched.

Forbidden actions:

- Checkout PR head code.
- Run package scripts from the PR head.
- Execute shell scripts from the PR head.
- Load configuration from the PR head.
- Expand workflow permissions as part of routine hardening.
- Expand auto-approve or auto-merge scope.

## Current workflow safety conditions

The guardian decision step uses `github.rest.pulls.listFiles` through `actions/github-script`.
It reads changed file names from GitHub API metadata.
It does not use `actions/checkout`.
It does not run PR head scripts.
It does not execute generated output.

The approve and auto-merge steps run GitHub CLI commands against the pull request number.
Those steps are gated by the `routine` output.
`routine` is true only when:

```txt
agent-routine label is present
manual-review-required label is absent
no protected path is matched
```

If both `agent-routine` and `manual-review-required` are present, the workflow comments that the PR stays blocked until labels are corrected.
If protected paths are touched, the workflow adds `manual-review-required` and does not mark the PR as routine.

## Security boundaries

The guardian does not weaken these Sprint9 boundaries:

- GodSandbox runtime must not call generation APIs.
- API key input UI must not be added.
- Gameplay must not wait for Codex, Sidekick, or App Server availability.
- `done` jobs are not asset `ready` or narrative `adopted`.
- ready / adopted promotion is not automated.
- Real job JSON, generated output, manifest drafts, local logs, and `dist/**` are not committed.
- Passport schema is not changed.
- Death, lifespan, medals, sandbox character labels, place labels, and status labels are not restored.
- `focusedEvent` remains the event-first UI center.

## Manual review requirement

Any PR that touches protected paths must be reviewed by a human-approved reviewer.
The guardian may help label and route the PR, but it must not make protected path changes routine.

Examples that require manual review:

- `.github/workflows/**`
- `.pre-commit-config.yaml`
- `AGENTS.md`
- `CLAUDE.md`
- `.agents/**`
- `docs/security/**`
- `docs/operations/**`
- `docs/architecture/**`
- `src/ui/**`
- `src/routes/**`
- `src/platform/**`
- `src/features/**`
- `src/domain/**`
- `src/state/**`
- package and lock files

## Acceptance checklist

- `.pre-commit-config.yaml` is protected.
- `CLAUDE.md` is protected.
- `src/ui/`, `src/routes/`, and `src/platform/` are protected.
- `pull_request_target` rationale is documented.
- Workflow permissions are not expanded.
- Auto-approve and auto-merge scope are not expanded.
- PR head code is not checked out or executed.
- App and gameplay code are unchanged.

## Follow-up

If future hardening adds more protected paths, update both `.github/workflows/routine-pr-guardian.yml` and this rationale document in the same PR.
If future workflow logic needs to execute tests, keep that in a separate workflow that runs without `pull_request_target` write privileges.
