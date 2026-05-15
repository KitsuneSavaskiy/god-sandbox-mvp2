# Kiro Adoption Guide

## Purpose

GodSandbox uses Kiro to make AI-driven development spec-first and reviewable.

Before Kiro, each feature was guided by long per-PBI conversation instructions. Spec, design, and
task breakdown lived in chat history and scattered docs. This caused:
- Spec/implementation drift between Claude, Codex, and Claude Code
- Repeated re-explanation of the same constraints
- No single canonical place to check "what are we building and why"

Kiro fixes this by requiring that every feature starts with a spec that all agents read from the repo.

## How It Works

```
.kiro/
  steering/    ← always-on context for every agent session
  specs/       ← per-feature requirements, design, and tasks
```

### Steering

`.kiro/steering/**` files are loaded automatically by Kiro at the start of every agent session.
They describe GodSandbox's product goals, architecture rules, agent operating rules, security
boundaries, and review policy.

These files are the **Kiro-native complement** to `AGENTS.md` and `CLAUDE.md`. They do not replace
those files; they restate and organize the same constraints in a form Kiro reads natively.

When a steering file and `AGENTS.md` / `CLAUDE.md` / `docs/agent-operating-rules.md` conflict,
the existing docs take precedence until PO explicitly updates the steering file.

### Specs

`.kiro/specs/<feature-name>/` contains three files:

| File | Contents |
|------|----------|
| `requirements.md` | User stories and acceptance criteria (EARS-style: WHEN / IF / THE SYSTEM SHALL) |
| `design.md` | Architecture, data model, components, state flow, UI, error handling, security, test strategy |
| `tasks.md` | Numbered, checkable implementation tasks with declared file scope and verification steps |

All agents (Claude, Codex, Claude Code) read these files before implementing the feature.
They do not rely on conversation memory for spec details.

## Rule

Before implementation of any new feature begins, the following must exist and be merged to `main`:

1. `.kiro/specs/<feature>/requirements.md`
2. `.kiro/specs/<feature>/design.md`
3. `.kiro/specs/<feature>/tasks.md`

Implementation PRs that reference a spec not yet merged are blocked until the spec PR lands.

## Using the Template

New feature specs start from the template:

```
.kiro/specs/_template/
  requirements.md
  design.md
  tasks.md
```

Copy the template directory, rename it to the feature slug, and fill in the sections.
Delete placeholder comments before creating the spec PR.

## First Target

The first Kiro-managed feature is:

```
.kiro/specs/music-garden-midi-interaction/
```

All future features follow the same pattern: spec first, implementation second.

## Relationship to Existing Docs

| Document | Role |
|----------|------|
| `docs/product/godsandbox-user-flow.md` | Product truth. Kiro specs must not contradict it. |
| `docs/architecture/` | System truth. Kiro design docs must not contradict it. |
| `AGENTS.md` | Agent operating rules (canonical). |
| `docs/agent-operating-rules.md` | Full operating rules (canonical). |
| `docs/agent-pr-checklists.md` | PR checklist (canonical). |
| `.kiro/steering/**` | Kiro-native restatement of the above for Kiro sessions. |
| `.kiro/specs/**` | Per-feature spec (Kiro-managed). |

## Updating Steering Docs

Changes to `.kiro/steering/**` require `manual-review-required` and PO approval, just like
`AGENTS.md` or `docs/architecture/**`. Steering docs are not casual notes; they shape how every
agent session begins.

## Merge Order for Kiro Foundation

```
1. docs: add Kiro steering for spec-driven development  (PBI 10z-kiro-foundation-steering)
2. docs: add Kiro spec template and Music Garden spec   (PBI 10z-kiro-spec-template-and-music-garden)
3. Music Garden implementation PRs                      (after specs are merged)
```
