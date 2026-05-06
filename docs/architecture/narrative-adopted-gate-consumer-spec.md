# Narrative adopted-gate consumer spec

PBI: `PBI-ARCH-NARRATIVE-ADOPTED-GATE-CONSUMER-SPEC-001`

Status: Sprint9 docs-first security follow-up

This document responds to FIN-002. It defines the consumer-side rule for generated narrative packs before any player-facing UI integration.

This PR does not change gameplay behavior.

---

## 1. Core rule

Player-facing generated narrative consumers may display only narrative content with:

```txt
status === "adopted"
```

This rule applies to every runtime or UI surface that could show generated narrative to the player.

Examples:

- sandbox event text
- story log text
- character detail copy
- intervention response text
- comment bubbles
- relationship event text
- time / season flavor text
- Passport-adjacent preview copy

---

## 2. Status rules

| Status | Player-facing UI | Review tools | Notes |
|---|---|---|---|
| `candidate` | Do not display | May read | Generated candidate only. |
| `needs-review` | Do not display | May read | Awaiting canon / safety / PO review. |
| `rejected` | Do not display | May read for audit only | Must not be reused as fallback. |
| `adopted` | May display through consumer guard | May read | Passed review gate. |
| `fallback` | Only if it is safe built-in fallback | N/A | Runtime display fallback, not an adopted generated pack. |

`fallback` does not mean "show any generated fallback text." It means the runtime uses safe built-in text when no adopted generated narrative is available.

---

## 3. Consumer pattern

Future implementation must route player-facing generated narrative through a single guard or reader pattern.

Required rule:

```txt
Player-facing generated narrative consumer must filter by status === "adopted".
```

Recommended shape:

```txt
readAdoptedNarrative(pack)
-> if pack.status === "adopted": return safe display text
-> otherwise: return built-in fallback text
```

Do not let individual components decide status handling ad hoc.

---

## 4. Review tool exception

Review tools may read `candidate` and `needs-review` content.

Allowed review surfaces:

- Canon Auditor workspace
- Safety Auditor workspace
- PO Review Summarizer report
- local review report
- non-player-facing review UI, if one is explicitly built later

Review tools must not be confused with player-facing UI.

If a review surface is visible to players, it is no longer a review tool for this rule and must use the adopted-only guard.

---

## 5. Source-of-truth boundaries

Generated narrative is supplemental display content. It must not overwrite source-of-truth data.

Generated narrative must not overwrite:

- domain events
- event participants
- intervention results
- character stats
- character relationships
- Passport source-of-truth data
- snapshot source-of-truth data
- review status
- ready / adopted promotion state

Generated narrative may describe or enrich an adopted display surface, but it may not change what happened.

---

## 6. Intervention result boundary

Generated narrative must not change the meaning of intervention results.

The following remain domain/application-owned:

- `watch` / `見守る`
- `help` / `助ける`
- `trial` / `試練`
- result success / failure
- stat changes
- relationship changes
- event resolution state

If adopted narrative conflicts with deterministic intervention results, the deterministic result wins and the generated narrative must be ignored or sent back to review.

---

## 7. Leakage prevention tests

Before any generated narrative is connected to player-facing UI, implementation PRs must include candidate leakage prevention tests.

Minimum test cases:

- `candidate` pack is not displayed to player-facing UI.
- `needs-review` pack is not displayed to player-facing UI.
- `rejected` pack is not displayed to player-facing UI.
- `adopted` pack may be displayed through the guard.
- missing pack uses safe built-in fallback.
- malformed status uses safe built-in fallback.
- generated narrative cannot overwrite domain event data.
- generated narrative cannot overwrite intervention result data.

The tests may be unit tests, integration tests, or consumer-level tests depending on where the reader is implemented.

---

## 8. Failure behavior

If generated narrative cannot be trusted, the app must fail closed:

- Do not show unreviewed text.
- Do not block gameplay.
- Use safe built-in fallback text.
- Log local diagnostic information for developers if needed.
- Do not expose local file paths, prompts, or internal review metadata in player-facing UI.

---

## 9. Implementation gate

Generated narrative UI-facing integration must not start until:

1. This spec is merged to `main`.
2. The consumer guard / reader design references this spec.
3. Candidate leakage prevention tests are included in the implementation PR.

---

## 10. Out of scope

This document does not add:

- narrative pack implementation
- narrative reader implementation
- UI integration
- generated narrative files
- schema changes
- package changes
- CI changes
- domain behavior changes

---

## 11. Acceptance checklist

- `adopted` is the only generated narrative status allowed in player-facing UI.
- `candidate`, `needs-review`, and `rejected` are explicitly blocked from player-facing UI.
- Safe built-in fallback remains allowed.
- Review tools may inspect candidates without exposing them to players.
- Generated narrative cannot overwrite domain events, intervention results, or Passport data.
- Future implementation must include adopted-only consumer tests.
