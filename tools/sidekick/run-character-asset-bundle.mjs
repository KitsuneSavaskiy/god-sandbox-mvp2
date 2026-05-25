#!/usr/bin/env node
/**
 * Character Asset Bundle Initializer and Runbook Generator
 *
 * Acquires the one-resident lock, writes a bundle-state.json with lifecycle
 * state "planned", and prints the manual next-step commands for each lane.
 * Does NOT invoke downstream tools (validator, intake, review pack) automatically.
 * Those are separate commands run after GEN2 output is available.
 *
 * Does NOT generate art, call image APIs, use API keys, or write to public/art/**.
 * Does NOT mark assets as ready or promote candidates.
 * Does NOT commit generated assets.
 *
 * Bundle lifecycle states (written to assets/generated/residents/<slug>/bundle-state.json):
 *   planned
 *   → prompt-pack-ready
 *   → generation-handoff-ready
 *   → outputs-waiting
 *   → intake-ready
 *   → contract-validation-ready
 *   → review-pack-ready
 *   → po-review | blocked-retry-needed
 *
 * One-resident lock:
 *   Lock file: .godsandbox/jobs/assetgen-active-resident.lock
 *   Content: { "slug": "<slug>", "jobId": "<id>", "lockedAt": "<iso>" }
 *   If lock exists for a DIFFERENT slug: exit 1 with message about active resident.
 *   If lock exists for the SAME slug: log "Resuming existing bundle" and continue.
 *   --force-unlock: delete lock file before proceeding.
 *   On --dry-run: describe what would happen, do NOT acquire lock.
 *
 * Usage:
 *   node tools/sidekick/run-character-asset-bundle.mjs \
 *     --slug <slug> \
 *     --portrait <repo-relative-png> \
 *     [--profile <path-to-character-profile.json>] \
 *     [--mode po-combined|canonical-two-sheet] \
 *     [--bridge fake|manual-drop|hot-folder|local-cli] \
 *     [--lanes resident-sprite-sheet,portrait-expressions,event-standing-expressions,derived-icon,review-pack] \
 *     [--dry-run] \
 *     [--force-unlock] \
 *     [--help]
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;

const LOCK_FILE = path.join(repoRoot, ".godsandbox", "jobs", "assetgen-active-resident.lock");

const VALID_MODES = ["po-combined", "canonical-two-sheet"];
const VALID_BRIDGES = ["fake", "manual-drop", "hot-folder", "local-cli"];
const ALL_LANES = [
  "resident-sprite-sheet",
  "portrait-expressions",
  "event-standing-expressions",
  "derived-icon",
  "review-pack",
];
const DEFAULT_LANES = [
  "resident-sprite-sheet",
  "portrait-expressions",
  "event-standing-expressions",
  "derived-icon",
  "review-pack",
];

const BUNDLE_LIFECYCLE_STATES = [
  "planned",
  "prompt-pack-ready",
  "generation-handoff-ready",
  "outputs-waiting",
  "intake-ready",
  "contract-validation-ready",
  "review-pack-ready",
  "po-review",
  "blocked-retry-needed",
];

// ---------------------------------------------------------------------------
// Security guard
// ---------------------------------------------------------------------------

/**
 * SECURITY: Refuse to write to public/art/**
 * @param {string} outputPath
 */
function assertOutputBoundary(outputPath) {
  const rel = path.relative(repoRoot, path.resolve(outputPath)).replace(/\\/g, "/");
  if (rel.startsWith("public/art/")) {
    throw new Error(`SECURITY: Refusing to write to public/art/: ${rel}`);
  }
}

// ---------------------------------------------------------------------------
// CLI help and arg parsing
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`Character Asset Bundle Initializer and Runbook Generator

Acquires the one-resident lock, writes bundle-state.json, and prints the
manual next-step commands for each lane. Downstream tools (validator, intake,
review pack) must be run separately after GEN2 output is available.

Does NOT generate art, call image APIs, use API keys, or write to public/art/**.

Usage:
  node tools/sidekick/run-character-asset-bundle.mjs \\
    --slug <slug> \\
    --portrait <repo-relative-png> \\
    [--profile <path-to-character-profile.json>] \\
    [--mode po-combined|canonical-two-sheet] \\
    [--bridge fake|manual-drop|hot-folder|local-cli] \\
    [--lanes resident-sprite-sheet,portrait-expressions,event-standing-expressions,derived-icon,review-pack] \\
    [--dry-run] \\
    [--force-unlock] \\
    [--help]

Arguments:
  --slug          Character slug (e.g. "ryo")
  --portrait      Repo-relative path to the reference portrait PNG
  --profile       Path to a character-profile.json (optional)
  --mode          Sprite sheet preview mode (default: po-combined)
  --bridge        GEN2 bridge mode (default: fake)
                    fake        — validation-only, NOT PO-reviewable
                    manual-drop — manually place files in incoming/
                    hot-folder  — watch a hot folder for new files
                    local-cli   — spawn a local CLI for generation
  --lanes         Comma-separated list of lanes to process (default: all)
  --dry-run       Describe what would happen without creating any files
  --force-unlock  Delete the active-resident lock before proceeding
  --help          Show this help

Bundle lifecycle states:
  ${BUNDLE_LIFECYCLE_STATES.join(" → ")}

Lock file:
  .godsandbox/jobs/assetgen-active-resident.lock
  One active resident at a time. Different slug: exit 1. Same slug: resume.

Security:
  Never writes to public/art/** (SECURITY error).
  Never marks assets as ready. Never promotes candidates.
`);
}

function parseArgs(argv) {
  const args = {
    mode: "po-combined",
    bridge: "fake",
    lanes: [...DEFAULT_LANES],
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === "--slug" && val) { args.slug = val; i++; }
    else if (flag === "--portrait" && val) { args.portrait = val; i++; }
    else if (flag === "--profile" && val) { args.profile = val; i++; }
    else if (flag === "--mode" && val) { args.mode = val; i++; }
    else if (flag === "--bridge" && val) { args.bridge = val; i++; }
    else if (flag === "--lanes" && val) { args.lanes = val.split(",").map((s) => s.trim()).filter(Boolean); i++; }
    else if (flag === "--dry-run") { args.dryRun = true; }
    else if (flag === "--force-unlock") { args.forceUnlock = true; }
    else if (flag === "--help" || flag === "-h") { args.help = true; }
  }
  return args;
}

function ensureDir(dirPath) {
  assertOutputBoundary(dirPath);
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

function safeWriteJson(filePath, data) {
  assertOutputBoundary(filePath);
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Lock file management
// ---------------------------------------------------------------------------

function readLock() {
  if (!existsSync(LOCK_FILE)) return null;
  try {
    return JSON.parse(readFileSync(LOCK_FILE, "utf8"));
  } catch {
    return null;
  }
}

function acquireLock(slug, jobId) {
  assertOutputBoundary(LOCK_FILE);
  ensureDir(path.dirname(LOCK_FILE));
  const lockData = {
    slug,
    jobId,
    lockedAt: new Date().toISOString(),
  };
  writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2) + "\n");
  return lockData;
}

function releaseLock() {
  if (existsSync(LOCK_FILE)) {
    rmSync(LOCK_FILE);
  }
}

function generateJobId(slug) {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = randomBytes(4).toString("hex");
  return `${slug}-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Dry-run output
// ---------------------------------------------------------------------------

function printDryRunPlan(args) {
  const slug = args.slug;
  const lanes = args.lanes;
  const bridge = args.bridge;
  const mode = args.mode;

  console.log(`\n[dry-run] Character Asset Bundle — ${slug}`);
  console.log(`\n  [dry-run] This is a dry-run. No files will be created. No lock acquired.`);
  console.log(`\n  Configuration:`);
  console.log(`    slug:     ${slug}`);
  console.log(`    portrait: ${args.portrait}`);
  if (args.profile) console.log(`    profile:  ${args.profile}`);
  console.log(`    mode:     ${mode}`);
  console.log(`    bridge:   ${bridge}`);
  console.log(`    lanes:    ${lanes.join(", ")}`);

  if (bridge === "fake") {
    console.log(`\n  NOTE: fake bridge output is validation-only; not PO-reviewable`);
    console.log(`  WARNING: FAKE BRIDGE OUTPUT — NOT PO-REVIEWABLE`);
  }

  console.log(`\n  Planned lanes to process:`);
  for (const lane of lanes) {
    let note = "";
    if (lane === "event-standing-expressions") {
      note = " (expects 8 alpha PNGs in incoming/event-expressions/)";
    } else if (lane === "derived-icon") {
      note = " (depends on resident-sprite-sheet: candidate-ready)";
    } else if (lane === "review-pack") {
      note = " (HTML review pack for PO inspection)";
    }
    console.log(`    - ${lane}${note}`);
  }

  console.log(`\n  Files that would be created:`);
  const residentDir = `assets/generated/residents/${slug}`;
  console.log(`    ${residentDir}/bundle-state.json`);
  console.log(`    ${residentDir}/prompt-pack/   (prompt files for GEN2 bridge)`);
  if (lanes.includes("resident-sprite-sheet")) {
    if (mode === "po-combined") {
      console.log(`    ${residentDir}/prompt-pack/sprites/combined.prompt.md`);
    } else {
      console.log(`    ${residentDir}/prompt-pack/sprites/sheet1.prompt.md`);
      console.log(`    ${residentDir}/prompt-pack/sprites/sheet2.prompt.md`);
    }
  }
  if (lanes.includes("portrait-expressions")) {
    console.log(`    ${residentDir}/prompt-pack/expressions/  (5 expression prompts)`);
  }
  if (lanes.includes("event-standing-expressions")) {
    console.log(`    ${residentDir}/incoming/event-expressions/  (awaiting 8 alpha PNGs from bridge)`);
  }
  if (lanes.includes("review-pack")) {
    console.log(`    ${residentDir}/review-pack/index.html`);
    console.log(`    ${residentDir}/review-pack/review-summary.json`);
  }

  console.log(`\n  Bundle lifecycle state machine:`);
  for (let i = 0; i < BUNDLE_LIFECYCLE_STATES.length; i++) {
    const state = BUNDLE_LIFECYCLE_STATES[i];
    const arrow = i < BUNDLE_LIFECYCLE_STATES.length - 1 ? " →" : "";
    console.log(`    ${state}${arrow}`);
  }

  console.log(`\n  Bridge mode: ${bridge}`);
  switch (bridge) {
    case "fake":
      console.log(`    Fake bridge: produces placeholder files for pipeline validation.`);
      console.log(`    Output is validation-only. Not eligible for PO review.`);
      break;
    case "manual-drop":
      console.log(`    Manual drop: you manually place PNG files in incoming/ directories.`);
      console.log(`    Then run the intake tools to validate and organize them.`);
      break;
    case "hot-folder":
      console.log(`    Hot folder: watches a folder for new files from GEN2.`);
      console.log(`    Requires GODSANDBOX_GEN2_HOT_FOLDER env var to be set.`);
      break;
    case "local-cli":
      console.log(`    Local CLI: spawns a local GEN2 CLI process for generation.`);
      console.log(`    Requires CLI to be installed and configured.`);
      break;
  }

  if (lanes.includes("event-standing-expressions")) {
    console.log(`\n  Event standing expressions lane:`);
    console.log(`    Expected source: ${residentDir}/incoming/event-expressions/`);
    console.log(`    Required files (must have alpha channel, colorType 4 or 6):`);
    const exprs = ["neutral", "happy", "angry", "sad", "surprised", "worried", "determined", "shocked"];
    for (const e of exprs) {
      console.log(`      ${e}.png`);
    }
    console.log(`    After bridge places files, run:`);
    console.log(`      npm run assetgen:event-intake -- --slug ${slug} --source-dir <bridge-output-dir>`);
  }

  console.log(`\n[dry-run] planned — no files written, no lock acquired.`);
}

// ---------------------------------------------------------------------------
// Non-dry-run execution
// ---------------------------------------------------------------------------

function runBundle(args) {
  const slug = args.slug;
  const lanes = args.lanes;
  const bridge = args.bridge;
  const mode = args.mode;
  const jobId = generateJobId(slug);

  // Check and manage lock
  const existingLock = readLock();
  if (existingLock) {
    if (existingLock.slug !== slug) {
      console.error(
        `Active resident lock: ${existingLock.slug}. Use --force-unlock to override.`,
      );
      console.error(`  Lock acquired at: ${existingLock.lockedAt}`);
      console.error(`  Job ID: ${existingLock.jobId}`);
      process.exit(1);
    } else {
      // Same slug — resume
      console.log(`Resuming existing bundle for ${slug} (jobId: ${existingLock.jobId})`);
    }
  } else {
    // Acquire lock
    acquireLock(slug, jobId);
    console.log(`\nCharacter Asset Bundle — ${slug}`);
    console.log(`  jobId:    ${jobId}`);
    console.log(`  mode:     ${mode}`);
    console.log(`  bridge:   ${bridge}`);
    console.log(`  lanes:    ${lanes.join(", ")}`);
    console.log(`  Lock acquired: ${LOCK_FILE}`);
  }

  if (bridge === "fake") {
    console.log(`\n  WARNING: FAKE BRIDGE — output is validation-only, NOT PO-reviewable`);
  }

  // Write bundle-state.json (planned)
  const residentDir = path.join(repoRoot, "assets", "generated", "residents", slug);
  const bundleStatePath = path.join(residentDir, "bundle-state.json");
  safeWriteJson(bundleStatePath, {
    slug,
    jobId,
    state: "planned",
    mode,
    bridge,
    lanes,
    portrait: args.portrait,
    profile: args.profile ?? null,
    lifecycle: BUNDLE_LIFECYCLE_STATES,
    updatedAt: new Date().toISOString(),
  });

  console.log(`\n  Bundle state: planned`);
  console.log(`  State file: assets/generated/residents/${slug}/bundle-state.json`);

  console.log(`\n  Planned stages:`);
  console.log(`    1. [planned]                → Write bundle-state.json (done)`);
  console.log(`    2. [prompt-pack-ready]      → Build prompt pack for GEN2 bridge`);
  console.log(`    3. [generation-handoff-ready] → Handoff to GEN2 bridge (bridge: ${bridge})`);
  console.log(`    4. [outputs-waiting]        → Wait for bridge to produce files`);
  console.log(`    5. [intake-ready]           → Run intake tools to validate/organize files`);
  console.log(`    6. [contract-validation-ready] → Validate asset contracts`);
  console.log(`    7. [review-pack-ready]      → Build HTML review pack for PO`);
  console.log(`    8. [po-review]              → PO reviews the pack`);

  console.log(`\n  Next manual steps for bridge mode "${bridge}":`);
  switch (bridge) {
    case "fake":
      console.log(`    The fake bridge produces placeholder files for pipeline validation.`);
      console.log(`    To prepare the prompt pack:`);
      console.log(`      npm run assetgen:intake -- --slug ${slug} --portrait ${args.portrait} --preview-mode ${mode}`);
      console.log(`    The fake bridge does not produce real art. Review pack will show validation-only warning.`);
      break;
    case "manual-drop":
      console.log(`    1. Build the prompt pack:`);
      console.log(`       npm run assetgen:intake -- --slug ${slug} --portrait ${args.portrait}`);
      console.log(`    2. Share prompt files from assets/generated/residents/${slug}/prompt-pack/ with the artist.`);
      console.log(`    3. Artist drops PNGs into assets/generated/residents/${slug}/incoming/`);
      console.log(`    4. Run intake tools to validate:`);
      console.log(`       npm run assetgen:expressions -- --slug ${slug} --source-dir <expr-dir>`);
      if (lanes.includes("event-standing-expressions")) {
        console.log(`       npm run assetgen:event-intake -- --slug ${slug} --source-dir <event-expr-dir>`);
      }
      console.log(`    5. Build review pack:`);
      console.log(`       npm run assetgen:review-pack -- --slug ${slug}`);
      break;
    case "hot-folder":
      console.log(`    1. Set GODSANDBOX_GEN2_HOT_FOLDER env var to the bridge output folder.`);
      console.log(`    2. Build the prompt pack and start the watcher:`);
      console.log(`       npm run assetgen:intake -- --slug ${slug} --portrait ${args.portrait}`);
      console.log(`       npm run sidekick:watch`);
      console.log(`    3. Watcher will pick up output files and route to intake tools automatically.`);
      break;
    case "local-cli":
      console.log(`    1. Ensure the local CLI is installed and configured.`);
      console.log(`    2. Build the prompt pack:`);
      console.log(`       npm run assetgen:intake -- --slug ${slug} --portrait ${args.portrait}`);
      console.log(`    3. The local CLI bridge will be invoked automatically by the watcher.`);
      console.log(`       npm run sidekick:watch`);
      break;
  }

  if (lanes.includes("event-standing-expressions")) {
    console.log(`\n  Event standing expressions lane:`);
    console.log(`    After bridge output is available, place 8 alpha PNG files in:`);
    console.log(`    assets/generated/residents/${slug}/incoming/event-expressions/`);
    console.log(`    Required: neutral, happy, angry, sad, surprised, worried, determined, shocked`);
    console.log(`    Then run:`);
    console.log(`      npm run assetgen:event-intake -- --slug ${slug} --source-dir <bridge-output-dir>`);
  }

  console.log(`\n  Bundle orchestration initialized. State: planned`);
  console.log(`  Lock: ${LOCK_FILE}`);
  console.log(`\n  Note: No art was generated. No public/art writes. No API calls.`);
  console.log(`  Note: Use --force-unlock to clear the lock when this bundle is complete.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  // --- Validate inputs ---
  if (!args.slug || !SLUG_PATTERN.test(args.slug)) {
    console.error(
      `Error: --slug "${args.slug ?? ""}" is invalid. Use lowercase letters, numbers, hyphen, or underscore.`,
    );
    process.exit(1);
  }

  if (!args.portrait) {
    console.error("Error: --portrait is required.");
    process.exit(1);
  }

  if (!VALID_MODES.includes(args.mode)) {
    console.error(`Error: --mode "${args.mode}" is invalid. Must be one of: ${VALID_MODES.join(", ")}`);
    process.exit(1);
  }

  if (!VALID_BRIDGES.includes(args.bridge)) {
    console.error(`Error: --bridge "${args.bridge}" is invalid. Must be one of: ${VALID_BRIDGES.join(", ")}`);
    process.exit(1);
  }

  for (const lane of args.lanes) {
    if (!ALL_LANES.includes(lane)) {
      console.error(`Error: Unknown lane "${lane}". Valid lanes: ${ALL_LANES.join(", ")}`);
      process.exit(1);
    }
  }

  // Handle --force-unlock (not in dry-run)
  if (args.forceUnlock && !args.dryRun) {
    if (existsSync(LOCK_FILE)) {
      const existingLock = readLock();
      console.log(`  Force-unlocking: removing lock for ${existingLock?.slug ?? "unknown"}`);
      releaseLock();
    } else {
      console.log(`  No lock file to remove.`);
    }
  }

  // --- Dry-run mode ---
  if (args.dryRun) {
    printDryRunPlan(args);
    process.exit(0);
  }

  // --- Live run ---
  runBundle(args);
}

main().catch((err) => {
  console.error(`\nFatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
