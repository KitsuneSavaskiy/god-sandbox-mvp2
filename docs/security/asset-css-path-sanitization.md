# CSS asset path sanitization

PBI: `PBI-SEC-ASSET-CSS-PATH-SANITIZATION-SPEC-001`

Status: Sprint9 docs-first security follow-up

This document responds to FIN-005. It defines security requirements for any future UI consumer that places generated asset paths into CSS `url()`.

This document is docs-only. It does not add a CSS consumer implementation.

---

## 1. Core rule

Generated paths must not be injected directly into CSS.

Required flow:

```txt
generated asset candidate
-> review / manifest gate
-> safe asset id or safe relative path
-> UI consumer
-> encoded CSS url()
```

Generated metadata is not trusted input.

---

## 2. Forbidden inputs

Future CSS asset path consumers must reject:

- `javascript:`
- arbitrary `data:`
- `http:`
- `https:`
- protocol-relative URLs such as `//example.com/asset.png`
- absolute local paths
- drive-letter paths such as `C:\...`
- path traversal such as `../`
- URL-encoded path traversal or separators such as `%2e`, `%2f`, `%5c`
- backslash path separators
- empty paths
- paths with control characters
- paths produced directly from unreviewed generated metadata

`data:` may be used only for explicitly approved safe built-in assets. Generated content must not supply `data:` URLs.

Remote assets are not allowed for generated content UI integration.

---

## 3. Allowed input shapes

Future implementation must accept only one of these shapes:

1. Manifest-controlled asset IDs.
2. Known safe relative paths produced by a reviewed manifest gate.

Examples of safe relative path shape:

```txt
/art/residents/aki/sprite-sheet.png
/art/world/backgrounds/world_spring_noon.png
```

Rules:

- Safe paths must start from an approved public asset prefix.
- Safe paths must not contain `..`.
- Safe paths must not contain URL scheme text.
- Safe paths must not be derived directly from a user-provided filename without validation.
- Safe paths must represent reviewed or built-in assets, not raw candidates.

---

## 4. CSS encoding rule

Before a path is used in CSS `url()`, it must be encoded for CSS string context.

Implementation guidance:

- Prefer setting a CSS custom property to a quoted URL value created by a safe helper.
- Escape quotes and backslashes if a string context is used.
- Do not concatenate raw generated metadata into style strings.
- Do not allow user-controlled text to break out of `url("...")`.

Safe helper responsibility:

```txt
safe asset id or safe relative path
-> validate allowed shape
-> encode for CSS url string
-> return CSS-safe url value
```

---

## 5. Fail-closed behavior

If a path is invalid, unavailable, or unreviewed:

- Do not render the generated path.
- Do not try a broader local path.
- Do not fetch a remote URL.
- Use a safe built-in fallback asset.
- Keep gameplay working.
- Log local diagnostics if needed.
- Do not expose host absolute paths or internal generated workspace paths in player-facing UI.

Example player-facing fallback copy:

```txt
標準画像で表示しています。
```

---

## 6. Generated asset metadata rule

Generated asset metadata must not be passed directly to CSS.

Generated metadata may contain:

- proposed filenames
- source image references
- local workspace paths
- rejected candidate paths
- review notes
- unsafe text from external tools

These are not display-ready values.

Only the reviewed manifest gate may convert generated metadata into:

- a safe asset ID
- a known safe relative path
- a safe built-in fallback marker

---

## 7. Consumer requirements

Before generated asset UI integration starts, the implementation must include a consumer guard.

Minimum guard requirements:

- Reject URL schemes.
- Reject absolute local paths.
- Reject traversal.
- Reject encoded traversal.
- Reject remote URLs.
- Reject unreviewed candidate paths.
- Resolve manifest asset IDs through a trusted map.
- Return safe fallback on invalid input.

Minimum test cases:

- valid manifest asset ID
- valid safe relative path
- `javascript:` is rejected
- `data:` generated input is rejected
- `http:` / `https:` are rejected
- absolute local path is rejected
- `../` traversal is rejected
- `%2f` / `%5c` encoded separators are rejected
- invalid input returns fallback

---

## 8. Out of scope

This document does not add:

- CSS helper implementation
- generated asset consumer implementation
- generated asset files
- manifest schema changes
- package changes
- CI changes
- App Server bridge implementation
- asset review automation

---

## 9. Acceptance checklist

- Generated paths are never injected directly into CSS `url()`.
- Generated asset metadata must pass review / manifest gate first.
- Remote URLs and local absolute paths are forbidden.
- Path traversal is forbidden.
- CSS string encoding is required.
- Invalid paths fail closed to a safe fallback.
- Future UI integration must add tests before using generated paths.
