# Implementation resume template

Use this after the task document is committed to main.

## One-line command

```bash
codex "Read <task-doc-path>, implement the task exactly, achieve the final vision, and test until complete."
```

## Safer long form

```txt
Read <task-doc-path>.
Treat it as the source of truth.
Do not rely on previous chat history.
Implement only the task described there.
Run all Testing requirements.
If the Preferred outcome cannot be achieved, apply the Safe fallback outcome.
Do not leave a broken ready state.
Report changed files, tests, browser checks, and remaining risks.
```

## Required report

```md
- Task document:
- Branch:
- Changed files:
- Preferred outcome achieved:
- Safe fallback used:
- Commands run:
- Browser / visual checks:
- Scope boundaries:
- Remaining risks:
- PO check needed:
```
