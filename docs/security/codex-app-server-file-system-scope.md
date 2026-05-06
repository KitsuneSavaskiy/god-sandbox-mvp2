# Codex App Server file system scope

PBI: `PBI-SEC-CODEX-APP-SERVER-FILE-SYSTEM-SCOPE-SPEC-001`

Status: Sprint9 Phase 1 docs-first gate

This document responds to FIN-004. It defines the file system boundary for the future Codex App Server / Sidekick bridge and the validation rule for `worldDirectoryName`.

This is not an implementation plan for file access. App Server bridge MVP must not start until this specification is merged to `main`.

---

## 1. Scope

Codex App Server and Sidekick may only access local workspace directories that are explicitly allowed by GodSandbox operating rules.

GodSandbox app behavior must not depend on Codex App Server availability.

- The app must not directly read or write Sidekick generated outputs.
- The app must not call generation APIs directly.
- Generated jobs and generated outputs are local working files and are not Git-tracked.
- App Server is optional support infrastructure, not a required gameplay dependency.
- If App Server is missing, unavailable, or misconfigured, gameplay continues with built-in fallback behavior.

---

## 2. Allowed roots

Future file access implementation may only operate inside allowed roots.

Allowed roots are logical workspace roots, not arbitrary user paths:

| Root | Purpose | Git tracked |
|---|---|---|
| `.godsandbox/jobs/pending` | jobs waiting for a Sidekick processor | No |
| `.godsandbox/jobs/running` | jobs locked by a processor | No |
| `.godsandbox/jobs/done` | completed job results awaiting review | No |
| `.godsandbox/jobs/failed` | failed job diagnostics | No |
| local generated asset workspace | generated asset candidates | No |
| local generated narrative workspace | generated narrative candidates | No |
| local logs workspace | local diagnostic logs | No |

All file access must stay inside one of these allowed roots after path resolution.

Rules:

- Do not allow arbitrary absolute paths from app input.
- Do not allow generated metadata to choose a new root.
- Do not treat `docs/**`, `src/**`, `public/**`, `.github/**`, `.agents/**`, or package files as generated output roots.
- Do not use fallback behavior that broadens file access when validation fails.

---

## 3. `worldDirectoryName` validation

`worldDirectoryName` is a safe identifier, not a raw path.

Allowed pattern:

```txt
^[a-z0-9_-]{1,64}$
```

Allowed characters:

- lowercase letters
- numbers
- hyphen
- underscore

The following are explicitly forbidden:

- `/`
- `\`
- `.`
- `..`
- empty string
- names longer than 64 characters
- absolute paths
- drive letters such as `C:`
- URL-encoded path separators such as `%2f`, `%2F`, `%5c`, `%5C`
- URL-like input such as `file://`, `http://`, or `https://`
- symlinks that escape the allowed root after resolution

Examples:

| Input | Result | Reason |
|---|---|---|
| `spring-village` | accept | safe identifier |
| `world_001` | accept | safe identifier |
| `../secrets` | reject | path traversal |
| `C:\Users\name` | reject | absolute local path |
| `world%2fsecret` | reject | encoded separator |
| `world.name` | reject | dot is not allowed |

---

## 4. Path resolution rule

Future implementation must follow this order:

1. Validate the identifier first.
2. Join the identifier to an allowed root.
3. Resolve the final path.
4. Verify that the resolved path is still inside the allowed root.
5. Reject the operation if any step fails.

Do not resolve first and then try to sanitize. Invalid input must fail closed before it is treated as a path.

Pseudo-flow:

```txt
input worldDirectoryName
-> validate as safe identifier
-> join with allowed root
-> resolve final path
-> assert final path starts inside allowed root
-> read/write only if all checks pass
```

Symlink handling:

- A symlink inside an allowed root is not automatically safe.
- The final resolved path must still be inside the same allowed root.
- If the symlink points outside the allowed root, reject.

---

## 5. Failure behavior

Invalid `worldDirectoryName` must fail closed.

Required behavior:

- Reject the file operation.
- Do not fallback to a wider directory.
- Do not fallback to repository root.
- Do not pause gameplay.
- Use built-in app fallback behavior.
- Log a local diagnostic message for the operator.
- Do not show host absolute paths, secrets, tokens, or local usernames in player-facing UI.

Player-facing text should stay generic, for example:

```txt
ローカル生成ワークスペースを確認できませんでした。ゲームは標準表示で続行します。
```

---

## 6. App boundary

GodSandbox app and Codex App Server have separate responsibilities.

| Area | GodSandbox app | Codex App Server / Sidekick |
|---|---|---|
| Gameplay loop | Required | Not required |
| Domain events | Source of truth | Must not overwrite |
| Intervention results | Source of truth | Must not overwrite |
| Passport source data | Source of truth | Must not overwrite |
| Job queue files | Does not directly mutate generated output | May process allowed queue files |
| Generated candidates | Does not trust by default | Produces candidates for review |
| Adoption / ready decision | Human review gate | Must not auto-promote |

The app may eventually display reviewed, adopted, or ready content through an explicit consumer gate, but it must not directly consume unreviewed local generated output.

---

## 7. Phase gate

This specification is a blocker for App Server bridge MVP.

Rules:

- Do not implement App Server bridge MVP until this document is merged to `main`.
- Future file access implementation PRs must link this document in their PR body.
- Future implementation PRs must include tests for valid identifiers, invalid identifiers, path traversal, encoded separators, absolute paths, and symlink escape.
- Future implementation PRs must prove that gameplay is not blocked when App Server is unavailable.

---

## 8. Out of scope

This document does not add:

- App Server implementation
- runner / watcher / job processor
- API connection
- UI
- generated job JSON
- generated asset output
- generated narrative output
- new package dependencies
- CI or workflow changes

---

## 9. Acceptance checklist

- `worldDirectoryName` is defined as an identifier, not a path.
- The validation pattern is explicit.
- Path traversal, encoded separators, absolute paths, drive letters, and symlink escape are forbidden.
- Allowed roots are listed.
- Final resolved paths must stay inside allowed roots.
- Invalid input fails closed.
- Gameplay does not pause when local file access fails.
- Player-facing UI does not expose host absolute paths or secrets.
- App Server bridge MVP is blocked until this spec is merged.
