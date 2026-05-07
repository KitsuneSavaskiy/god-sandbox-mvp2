# Superseded: 4-character parallel sprite agent

Status: do not execute

This old instruction is intentionally replaced.
Do not run 4 resident sprite generations in parallel.

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

Only one character may be active at a time.
If one character hits a blocker, stop and do not continue to the next character.
