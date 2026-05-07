# Superseded: 4-character sprite full pipeline

Status: do not execute

This old instruction is intentionally replaced.
Do not start Agent 1-4 at the same time.
Do not call hatch-pet helper scripts directly.

Current source of truth:

```txt
docs/operations/codex-4chars-animation-fullrun.md
docs/operations/resident-hatch-pet-wrapper.md
```

Current safe order:

```txt
1. Ryo proof
2. Eve
3. Garan
4. Suzu
```

Each character must complete intake, motion wrapper, extended wrapper,
`sprite:check`, and review evidence before the next character starts.
