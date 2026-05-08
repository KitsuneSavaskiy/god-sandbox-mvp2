# Superseded: all-character resident sprite sprint

Status: do not execute

This old sprint note is intentionally replaced.
Do not treat the 4 resident sprite jobs as parallel work.

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

Generated output remains gitignored and must not be committed.
PO visual review is required before any adoption PR.
