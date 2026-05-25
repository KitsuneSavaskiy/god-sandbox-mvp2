# Asset Generation Contract Registry

Sprint10-A — authoritative machine-readable spec for all generated asset lanes.

## What is it and why

The Asset Contract Registry is a single source of truth for the dimensional and structural
requirements of every generated asset lane in the GodSandbox project. Before this registry,
canvas sizes, frame dimensions, row counts, and row manifests were duplicated across:

- Prompt builder functions in `tools/app-server/character-asset-prompt-pack.mjs`
- Validation scripts in `tools/asset-pipeline/`
- Documentation in `docs/operations/resident-sprite-spec.md`
- Review pack tools in `tools/sidekick/build-asset-review-pack.mjs`

Duplicated constants drift over time. The registry eliminates that drift by making the spec
machine-readable and importable. Any tool that needs to know "what size is a canonical sheet?"
imports from the registry instead of hard-coding the answer.

Source of truth document: `docs/operations/resident-sprite-spec.md`

Registry file: `tools/asset-contracts/asset-contract-registry.mjs`

## Registered contracts

### `resident-canonical-two-sheet-v1`

The production 2-sheet sprite sheet contract for all residents.

| Field | Value |
|---|---|
| `lane` | `resident-sprite-sheet` |
| `variant` | `canonical` |
| `sheetCount` | 2 |
| `alphaRequired` | `true` |
| `transparentBackgroundRequired` | `true` |

**Sheet 0 — motion-sheet** (`resident-sprite-sheet.png`):

| Field | Value |
|---|---|
| `canvasWidth` | 1536 |
| `canvasHeight` | 1872 |
| `columns` | 8 |
| `rows` | 9 |
| `frameWidth` | 192 |
| `frameHeight` | 208 |
| `rowManifest` | `["idle","walk-right","walk-left","waving","jumping","failed","waiting","running","review"]` |

**Sheet 1 — extended-sheet** (`resident-sprite-sheet-extended.png`):

| Field | Value |
|---|---|
| `canvasWidth` | 1536 |
| `canvasHeight` | 1872 |
| `columns` | 8 |
| `rows` | 9 |
| `frameWidth` | 192 |
| `frameHeight` | 208 |
| `rowManifest` | `["walk-up","walk-down","walk-forward","walk-back","emote-happy","emote-angry","emote-sad","emote-surprised","spare"]` |

---

### `resident-po-combined-preview-v1`

PO preview exception — a single combined sheet for human inspection only. Not used in
production game rendering. See `docs/operations/resident-sprite-spec.md` for the exception
procedure.

| Field | Value |
|---|---|
| `lane` | `resident-sprite-sheet` |
| `variant` | `po-combined` |
| `canvasWidth` | 826 |
| `canvasHeight` | 1904 |
| `columns` | 7 |
| `rows` | 14 |
| `frameWidth` | 118 |
| `frameHeight` | 136 |
| `alphaRequired` | `true` |
| `transparentBackgroundRequired` | `true` |

`rowManifest` (14 entries):
```
0: idle
1: walk-right
2: walk-left
3: waving
4: jumping
5: failed
6: waiting
7: review
8: walk-up/walk-back
9: walk-down/walk-forward
10: emote-happy
11: emote-angry
12: emote-sad
13: emote-surprised
```

---

### `portrait-expression-set-v1`

Five-expression portrait set used in the game's portrait lane.

| Field | Value |
|---|---|
| `lane` | `portrait-expressions` |
| `requiredExpressions` | `["neutral","happy","angry","sad","surprised"]` |
| `alphaRequired` | `true` |
| `transparentBackgroundRequired` | `true` |
| `canvasSizeConsistencyRequired` | `true` |
| `safeMargins` | `{ top: 8, bottom: 8, left: 8, right: 8 }` |

Identity consistency rules: same character, same pose, same costume, same camera angle.
Only facial expression is allowed to change between variants.

---

### `event-standing-expression-set-v1`

Eight-expression standing set for event UI overlays.

| Field | Value |
|---|---|
| `lane` | `event-standing-expressions` |
| `requiredExpressions` | `["neutral","happy","angry","sad","surprised","worried","determined","shocked"]` |
| `alphaRequired` | `true` |
| `transparentBackgroundRequired` | `true` |
| `canvasSizeConsistencyRequired` | `true` |
| `safeMargins` | `{ top: 16, bottom: 16, left: 16, right: 16 }` |

Consistent framing required for event UI overlay. Same crop and camera angle across all
expressions. Transparent background required.

---

## CLI usage

The `print-contracts.mjs` CLI is the primary human-facing interface to the registry.

```bash
# List all registered contracts
npm run assetgen:contracts -- --list

# Print full JSON for a specific contract
npm run assetgen:contracts -- --contract resident-po-combined-preview-v1
npm run assetgen:contracts -- --contract resident-canonical-two-sheet-v1
npm run assetgen:contracts -- --contract portrait-expression-set-v1
npm run assetgen:contracts -- --contract event-standing-expression-set-v1

# Show help
npm run assetgen:contracts -- --help
```

Direct invocation:
```bash
node tools/asset-contracts/print-contracts.mjs --list
node tools/asset-contracts/print-contracts.mjs --contract resident-canonical-two-sheet-v1
```

Exit code 0 on success, 1 on error (unknown contractId, missing argument).

---

## How prompt builders import from the registry

`tools/app-server/character-asset-prompt-pack.mjs` imports the registry at the top of the
module and uses contract values to build prompts:

```javascript
import { getContract } from "../asset-contracts/asset-contract-registry.mjs";

const poContract = getContract("resident-po-combined-preview-v1");
const canonContract = getContract("resident-canonical-two-sheet-v1");
```

In the combined-sheet prompt builder:
```javascript
const { canvasWidth, canvasHeight, columns, rows, frameWidth, frameHeight, rowManifest } = poContract;
// Produces: "826×1904 px (7 columns × 14 rows, each frame 118×136 px)"
```

In the two-sheet prompt builders:
```javascript
const sheet1 = canonContract.sheets[0];
// sheet1.canvasWidth = 1536, sheet1.rowManifest[0] = "idle", etc.
```

The generated prompt text remains semantically identical to before — only the values now
come from the registry rather than being hard-coded in the function bodies.

---

## How validators will use the registry

Future validator scripts should import `getContract` and compare observed PNG dimensions
against the contract's `canvasWidth`, `canvasHeight`, `frameWidth`, and `frameHeight`. Row
manifest validation should compare the number of non-empty rows against `contract.rows`.

Example pattern for a future validator:

```javascript
import { getContract } from "../../tools/asset-contracts/asset-contract-registry.mjs";

const contract = getContract("resident-canonical-two-sheet-v1");
const sheet = contract.sheets[0]; // motion-sheet

// Check PNG dimensions
if (pngWidth !== sheet.canvasWidth || pngHeight !== sheet.canvasHeight) {
  errors.push(`Expected ${sheet.canvasWidth}x${sheet.canvasHeight}, got ${pngWidth}x${pngHeight}`);
}

// Check alpha
if (contract.alphaRequired && !pngHasAlpha) {
  errors.push("Alpha channel required but not found");
}
```

`validateContractId(id)` can be used to check whether an ID is known before attempting
`getContract()`:

```javascript
import { validateContractId, getContract } from "...";

if (!validateContractId(userInput)) {
  throw new Error(`Unknown contract: ${userInput}`);
}
const contract = getContract(userInput);
```

---

## Adding a new contract

1. Add a new key to the `CONTRACTS` object in `tools/asset-contracts/asset-contract-registry.mjs`.
2. Choose a `contractId` following the pattern `<lane-slug>-<variant>-v<N>`.
3. Run `npm run assetgen:contracts -- --list` to verify it appears.
4. Add tests in `tools/app-server/test-dry-run.mjs` verifying the key fields.
5. Update this document.

Do not reuse or rename existing `contractId` values — add a new versioned entry (`v2`, etc.)
and keep the old one for backward compatibility.
