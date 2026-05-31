# Character Asset Bundle Orchestration

Status: Sprint 10-E — operational guide for `run-character-asset-bundle.mjs`

## Overview

`tools/sidekick/run-character-asset-bundle.mjs` is an orchestration script that prepares prompt packs, coordinates handoff to a GEN2 bridge, calls intake tools, and prepares the review pack for a character asset bundle.

It does NOT:
- Generate art or call image APIs
- Use API keys or external services
- Write to `public/art/**`
- Mark assets as ready or promote candidates to production
- Commit generated assets to git

All output goes to `assets/generated/residents/<slug>/` which is gitignored.

## Local Portrait Staging

Browser-based onboarding should not require the user to type a repo-relative portrait path.
The Local AppServer stages a selected PNG into the generated workspace and returns the
path accepted by the existing character job endpoint.

```bash
curl -s -X POST "http://127.0.0.1:8787/api/local/asset-generation/portraits?slug=my-resident" \
  -H "Content-Type: image/png" \
  --data-binary @portrait.png
```

Response:

```json
{
  "slug": "my-resident",
  "portraitPath": "assets/generated/residents/my-resident/reference/portrait.png",
  "bytes": 12345,
  "status": "staged"
}
```

Rules:
- `slug` must match `/^[a-z0-9][a-z0-9_-]{0,59}$/`.
- Uploads must be `image/png` or `application/octet-stream` and pass PNG signature validation.
- Upload size is capped at 10MB.
- The endpoint writes only `assets/generated/residents/<slug>/reference/portrait.png`.
- It never writes to `public/art/**`, updates ready manifests, or calls external image APIs.

## Quick Start

```bash
# Dry-run (see what would happen)
npm run assetgen:run-bundle -- --slug ryo --portrait public/art/apostle/apostle-standing-alpha.png --bridge fake --dry-run

# Start a real bundle (fake bridge for pipeline validation)
npm run assetgen:run-bundle -- --slug ryo --portrait public/art/apostle/apostle-standing-alpha.png --bridge fake

# Full pipeline with all lanes
npm run assetgen:run-bundle -- \
  --slug ryo \
  --portrait public/art/apostle/apostle-standing-alpha.png \
  --mode po-combined \
  --bridge manual-drop \
  --lanes resident-sprite-sheet,portrait-expressions,event-standing-expressions,derived-icon,review-pack
```

## CLI Options

| Option | Default | Description |
|---|---|---|
| `--slug` | (required) | Character slug, e.g. `ryo` |
| `--portrait` | (required) | Repo-relative path to reference portrait PNG |
| `--profile` | — | Path to character-profile.json (optional) |
| `--mode` | `po-combined` | Sprite sheet preview mode: `po-combined` or `canonical-two-sheet` |
| `--bridge` | `fake` | GEN2 bridge mode (see Bridge Modes below) |
| `--lanes` | all | Comma-separated list of lanes to process |
| `--dry-run` | false | Describe what would happen; do not create files |
| `--force-unlock` | false | Delete the active-resident lock before proceeding |
| `--help` | — | Show help |

## Bundle Lifecycle States

The bundle state is written to `assets/generated/residents/<slug>/bundle-state.json`:

```
planned
  → prompt-pack-ready       (prompt files built for GEN2 bridge)
  → generation-handoff-ready (bridge receives the job)
  → outputs-waiting         (waiting for bridge to produce files)
  → intake-ready            (bridge output files are present)
  → contract-validation-ready (intake tools have validated the files)
  → review-pack-ready       (HTML review pack has been built)
  → po-review               (PO is reviewing the pack)
  | blocked-retry-needed    (contract validation failed; needs retry)
```

## One-Resident Lock

Only one resident can be actively processed at a time. The lock file is:

```
.godsandbox/jobs/assetgen-active-resident.lock
```

Lock file content:
```json
{
  "slug": "<slug>",
  "jobId": "<id>",
  "lockedAt": "<iso>"
}
```

Behavior:
- If lock exists for a **different slug**: exit 1 with message `"Active resident lock: <existing-slug>. Use --force-unlock to override."`
- If lock exists for the **same slug**: log `"Resuming existing bundle for <slug>"` and continue
- `--force-unlock`: delete the lock file before proceeding
- `--dry-run`: describe what would happen, do NOT acquire the lock

Release the lock manually with `--force-unlock` when the bundle is complete or abandoned.

## Bridge Modes

| Bridge | Description |
|---|---|
| `fake` | Produces placeholder files for pipeline validation. **Output is validation-only; NOT PO-reviewable.** |
| `manual-drop` | You manually place PNG files in `incoming/` directories. Then run intake tools. |
| `hot-folder` | Watches a hot folder for new files from GEN2. Requires `GODSANDBOX_GEN2_HOT_FOLDER` env var. |
| `local-cli` | Spawns a local GEN2 CLI process. Requires the CLI to be installed and configured. |

## Lanes

| Lane | Prompt files generated | Description |
|---|---|---|
| `resident-sprite-sheet` | `sprites/combined.prompt.md` (po-combined) or `sprites/sheet1.prompt.md` + `sprites/sheet2.prompt.md` (canonical) | Sprite sheet for the resident character |
| `portrait-expressions` | `expressions/neutral.prompt.md` … `expressions/surprised.prompt.md` (5 files) | 5 portrait expression PNGs (neutral, happy, angry, sad, surprised) |
| `event-standing-expressions` | `event-expressions/neutral.prompt.md` … `event-expressions/shocked.prompt.md` (8 files) | 8 event standing expression PNGs (see below) |
| `derived-icon` | — (no prompt file; depends on `resident-sprite-sheet`) | Icon derived from sprite sheet |
| `review-pack` | — (no prompt file) | HTML review pack for PO inspection |

## Event Standing Expressions Lane

When `event-standing-expressions` is included in `--lanes`, `character-asset-prompt-pack.mjs` generates 8 prompt files:

```
assets/generated/residents/<slug>/prompt-pack/event-expressions/
  neutral.prompt.md
  happy.prompt.md
  angry.prompt.md
  sad.prompt.md
  surprised.prompt.md
  worried.prompt.md
  determined.prompt.md
  shocked.prompt.md
```

Each prompt requires: same character identity, same costume, same pose, same camera angle, same crop, transparent background, only facial expression changes.

After bridge-generated PNGs are placed, the orchestrator expects 8 expression PNG files in:

```
assets/generated/residents/<slug>/incoming/event-expressions/
```

Required expressions:
- `neutral.png`
- `happy.png`
- `angry.png`
- `sad.png`
- `surprised.png`
- `worried.png`
- `determined.png`
- `shocked.png`

All files must:
- Have a valid PNG signature
- Have an alpha channel (PNG colorType 4 = grayscale+alpha, or 6 = RGBA)
- Have identical dimensions to each other

After the bridge places files, run the intake tool:
```bash
npm run assetgen:event-intake -- --slug <slug> --source-dir <bridge-output-dir>
```

## Dry-Run Usage

The `--dry-run` flag is always safe to use. It:
1. Prints the configuration (slug, portrait, mode, bridge, lanes)
2. Prints what lanes would be processed
3. Prints what files would be created
4. Prints the bundle lifecycle state machine
5. Notes if bridge is `fake` → warns output is NOT PO-reviewable
6. Exits 0 without creating any files or acquiring the lock

Example output:
```
[dry-run] Character Asset Bundle — ryo

  [dry-run] This is a dry-run. No files will be created. No lock acquired.

  Configuration:
    slug:     ryo
    portrait: public/art/apostle/apostle-standing-alpha.png
    mode:     po-combined
    bridge:   fake
    lanes:    resident-sprite-sheet, portrait-expressions, event-standing-expressions, derived-icon, review-pack

  NOTE: fake bridge output is validation-only; not PO-reviewable
  WARNING: FAKE BRIDGE OUTPUT — NOT PO-REVIEWABLE
  ...
[dry-run] planned — no files written, no lock acquired.
```

## How It Fits the Pipeline

```
AppServer (asset-generation-server.mjs)
    ↓ writes .godsandbox/jobs/<jobId>-request.json
Sidekick Job Watcher (job-watcher.mjs)
    ↓ routes to character-asset-bundle-intake.mjs
Bundle Orchestrator (run-character-asset-bundle.mjs)   ← THIS TOOL
    ↓ writes prompt-pack/, bundle-state.json
GEN2 Bridge (fake | manual-drop | hot-folder | local-cli)
    ↓ produces PNG files in incoming/
Intake Tools:
    portrait-expression-intake.mjs     → incoming/expressions/
    event-standing-expression-intake.mjs → incoming/event-expressions/
    derive-icon-from-sprite.mjs        → incoming/icons/
    ↓
Review Pack Builder (build-asset-review-pack.mjs)
    ↓ writes review-pack/index.html, review-summary.json
PO Review → approval → separate PBI for ready promotion
```

## What This Tool Does NOT Do

- Generate art, call image APIs, or use API keys
- Write to `public/art/**` (security guard enforced)
- Mark assets as ready or promote candidates
- Commit generated assets to git
- Approve or merge PRs
- Modify source code or game state

All generated files go to `assets/generated/` which is gitignored.
