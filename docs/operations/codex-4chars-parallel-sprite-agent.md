# Superseded: 4-character parallel sprite agent

Status: do not execute

This old instruction is intentionally replaced.
Do not run 4 resident sprite generations in parallel.

Current source of truth:

```txt
.agents/skills/godsandbox-po-preview-sprite-from-portrait/SKILL.md
docs/operations/resident-sprite-po-preview-quality.md
```

Current safe order:

```txt
1. Finish the current PO-reviewed resident.
2. Start the next resident only after PO preview gates pass.
3. Never generate multiple residents in parallel.
```

Only one character may be active at a time.
If one character hits a blocker, stop and do not continue to the next character.
