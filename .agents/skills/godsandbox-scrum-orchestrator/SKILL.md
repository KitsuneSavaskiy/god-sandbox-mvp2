---
name: godsandbox-scrum-orchestrator
description: Use for GodSandbox Sprint orchestration, PBI decomposition, Line 1 Line 2 Line 3 Line 4 parallel work instructions, PR audit, blocker triage, PO report, retro preparation, and Scrum Master coordination from PO and ChatGPT advisor requests.
---

# GodSandbox Scrum Orchestrator

Use this skill when coordinating GodSandbox development as Codex auditor, orchestrator, or Scrum Master.

## First Load

Before producing PBI, Line instructions, PR audit, merge judgment, or retro:

1. Read `AGENTS.md`.
2. Read `docs/agent-operating-rules.md`.
3. Read `docs/agent-pr-checklists.md`.
4. Read `docs/architecture/line-responsibilities.md`.
5. Read only the architecture/product docs that match the current PBI.

If the work is Sprint8 motion or asset pipeline related, also read:

- `references/sprint8-guardrails.md`
- `references/asset-pipeline-guardrails.md`
- `references/blocker-rules.md`

## Core Workflow

1. Convert PO and ChatGPT advisor input into PBIs.
2. Decide priority, dependency, and merge order.
3. Split work across Line 1 to Line 4 without overlapping ownership.
4. Produce copy-pasteable Line instructions using `references/line-instruction-template.md`.
5. Audit PRs from GitHub PR diff, changed files, PR body, Issue, CI, labels, and review comments.
6. Report findings as `blocker / non-blocker / follow-up`.
7. If PO-authorized and no blocker remains, approve and merge according to repo rules.
8. Prepare PO-facing report using `references/po-report-template.md`.
9. Prepare Sprint retro using `references/retro-template.md`.

## Responsibility Split

- Line 1: app shell, route, shared UI, ops, Git hygiene.
- Line 2: domain, runtime, persistence, asset contract, docs/spec.
- Line 3: character lifecycle, roster, CharacterDetailPanel, Snapshot, Passport.
- Line 4: event-first sandbox, tutorial, narrative, motion display, event UI.

If a request crosses Lines, split it into separate PBIs and name likely conflict files.

## Output Rules

For Line instructions, always include:

- 対象Line
- 対象PBI
- 目的
- 変更してよいファイル
- やること
- 受け入れ条件
- 禁止
- 確認コマンド
- 報告フォーマット
- 他Lineへの影響
- conflictしそうなファイル

For PR audit, use `references/pr-audit-checklist.md`.

For blocker rules, use `references/blocker-rules.md`.

## Keep Out Of This Skill

Do not store personal paths, account names, tokens, API keys, or local one-off state here. Read current repo and GitHub state instead.
