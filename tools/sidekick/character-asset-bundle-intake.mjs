#!/usr/bin/env node
/**
 * Character Asset Bundle Intake — Extended Sidekick Wrapper
 *
 * Accepts the same arguments as sidekick-intake.mjs plus --lanes and --preview-mode,
 * then:
 *   1. Runs sidekick-intake.mjs (via spawn) to create folders, job record, portrait ref
 *   2. Builds the expression prompt pack via character-asset-prompt-pack.mjs
 *   3. Writes assets/generated/residents/<slug>/lane-state.json with per-lane status
 *   4. Prints a summary
 *
 * Both .godsandbox/jobs/ and assets/generated/ are gitignored.
 *
 * Usage:
 *   npm run assetgen:intake -- --slug ryo --name "Ryo" --personality "明るい" \
 *     --tone "タメ口" --age 17 --portrait <path> \
 *     [--lanes resident-sprite-sheet,portrait-expressions,derived-icon] \
 *     [--preview-mode po-combined|canonical-two-sheet] \
 *     [--dry-run]
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPromptPack } from "../app-server/character-asset-prompt-pack.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const VALID_LANES = ["resident-sprite-sheet", "portrait-expressions", "derived-icon", "event-standing-expressions"];
const VALID_PREVIEW_MODES = ["po-combined", "canonical-two-sheet"];

const intakeScript = path.join(repoRoot, "tools", "sidekick", "sidekick-intake.mjs");

function printHelp() {
  console.log(`Character Asset Bundle Intake

Extended wrapper over sidekick-intake.mjs that also builds expression prompt packs
and writes per-lane state tracking.

Output directories (both gitignored):
  .godsandbox/jobs/                         — job records
  assets/generated/residents/<slug>/        — prompt packs and lane state

Usage:
  node tools/sidekick/character-asset-bundle-intake.mjs \\
    --slug <slug> \\
    --name <displayName> \\
    --personality <personality> \\
    --tone <tone> \\
    --age <age> \\
    --portrait <path> \\
    [--lanes resident-sprite-sheet,portrait-expressions,event-standing-expressions,derived-icon] \\
    [--preview-mode po-combined|canonical-two-sheet] \\
    [--dry-run]

Flags:
  --lanes         Comma-separated list of lanes to activate (default: resident-sprite-sheet,portrait-expressions,derived-icon)
  --preview-mode  po-combined (default) | canonical-two-sheet
  --dry-run       Validate inputs and print what would be done; do not write files
  --help          Show this help
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === "--slug" && val) { args.slug = val; i++; }
    else if (flag === "--name" && val) { args.name = val; i++; }
    else if (flag === "--personality" && val) { args.personality = val; i++; }
    else if (flag === "--tone" && val) { args.tone = val; i++; }
    else if (flag === "--age" && val) { args.age = val; i++; }
    else if (flag === "--portrait" && val) { args.portrait = val; i++; }
    else if (flag === "--lanes" && val) {
      args.lanes = val.split(",").map((s) => s.trim());
      i++;
    }
    else if (flag === "--preview-mode" && val) { args.previewMode = val; i++; }
    else if (flag === "--dry-run") { args.dryRun = true; }
    else if (flag === "--help" || flag === "-h") { args.help = true; }
  }
  return args;
}

function assertSlug(slug) {
  if (!slug || typeof slug !== "string") throw new Error("--slug is required.");
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Slug "${slug}" is invalid. Use lowercase letters, numbers, hyphen, or underscore.`,
    );
  }
}

function assertNonEmpty(value, flag) {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${flag} is required and must not be empty.`);
  }
}

function assertAge(value) {
  const n = parseInt(value, 10);
  if (!value || isNaN(n) || n < 0 || String(n) !== String(value).trim()) {
    throw new Error(`--age must be a non-negative integer. Got: ${value}`);
  }
  return n;
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

/**
 * Spawns sidekick-intake.mjs and waits for it to complete.
 * @param {object} args - parsed CLI args
 * @returns {Promise<number>} exit code
 */
function runSidekickIntake(args) {
  const intakeArgs = [
    intakeScript,
    "--slug", args.slug,
    "--name", args.name,
    "--personality", args.personality,
    "--tone", args.tone,
    "--age", String(args.age),
    "--portrait", args.portrait,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn("node", intakeArgs, { cwd: repoRoot, stdio: "inherit" });
    proc.on("close", resolve);
    proc.on("error", reject);
  });
}

/**
 * Builds lane-state.json marking all requested lanes as "planned".
 * assets/generated/ is gitignored.
 *
 * @param {string} slug
 * @param {string[]} lanes
 * @returns {string} path to lane-state.json (relative to repoRoot)
 */
function writeLaneState(slug, lanes) {
  const residentDir = path.join(
    repoRoot,
    "assets",
    "generated",
    "residents",
    slug,
  );
  ensureDir(residentDir);

  const laneEntries = {};
  for (const lane of lanes) {
    laneEntries[lane] = {
      status: "planned",
      updatedAt: new Date().toISOString(),
    };
  }

  const laneStatePath = path.join(residentDir, "lane-state.json");
  writeFileSync(
    laneStatePath,
    JSON.stringify(
      {
        slug,
        lanes: laneEntries,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );

  return path.relative(repoRoot, laneStatePath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  try {
    // Validate all inputs eagerly
    assertSlug(args.slug);
    assertNonEmpty(args.name, "--name");
    assertNonEmpty(args.personality, "--personality");
    assertNonEmpty(args.tone, "--tone");
    const age = assertAge(args.age);
    if (!args.portrait || typeof args.portrait !== "string") {
      throw new Error("--portrait is required.");
    }

    const lanes = args.lanes ?? VALID_LANES.slice();
    for (const lane of lanes) {
      if (!VALID_LANES.includes(lane)) {
        throw new Error(`Invalid lane "${lane}". Valid: ${VALID_LANES.join(", ")}`);
      }
    }

    const previewMode = args.previewMode ?? "po-combined";
    if (!VALID_PREVIEW_MODES.includes(previewMode)) {
      throw new Error(`Invalid --preview-mode "${previewMode}". Valid: ${VALID_PREVIEW_MODES.join(", ")}`);
    }

    const slug = args.slug;

    if (args.dryRun) {
      console.log(`\n[dry-run] Character Asset Bundle Intake`);
      console.log(`  slug:         ${slug}`);
      console.log(`  displayName:  ${args.name}`);
      console.log(`  personality:  ${args.personality}`);
      console.log(`  tone:         ${args.tone}`);
      console.log(`  age:          ${age}`);
      console.log(`  portrait:     ${args.portrait}`);
      console.log(`  lanes:        ${lanes.join(", ")}`);
      console.log(`  previewMode:  ${previewMode}`);
      console.log(`\n  Would run: sidekick-intake.mjs`);
      console.log(`  Would build prompt pack in: assets/generated/residents/${slug}/prompt-pack/`);
      console.log(`  Would write: assets/generated/residents/${slug}/lane-state.json`);
      console.log(`\n[dry-run] No files written.`);
      process.exit(0);
    }

    // --- Step 1: Run sidekick-intake.mjs ---
    console.log(`\n[bundle-intake] Step 1: Running sidekick-intake...`);
    const intakeExitCode = await runSidekickIntake({
      slug,
      name: args.name,
      personality: args.personality,
      tone: args.tone,
      age: String(age),
      portrait: args.portrait,
    });

    if (intakeExitCode !== 0) {
      throw new Error(`sidekick-intake.mjs exited with code ${intakeExitCode}`);
    }

    // --- Step 2: Build expression prompt pack ---
    console.log(`\n[bundle-intake] Step 2: Building expression prompt pack...`);
    const portraitResolved = path.resolve(repoRoot, args.portrait);
    const portraitRelPath = path.relative(repoRoot, portraitResolved);

    const pack = await buildPromptPack({
      assetBundleId: slug,
      displayName: args.name.trim(),
      personality: args.personality.trim(),
      tone: args.tone.trim(),
      age,
      portraitPath: portraitRelPath,
      lanes,
      previewMode,
    });

    // --- Step 3: Write lane-state.json ---
    console.log(`\n[bundle-intake] Step 3: Writing lane-state.json...`);
    const laneStateRelPath = writeLaneState(slug, lanes);

    // --- Step 4: Summary ---
    console.log(`\n[bundle-intake] Complete.`);
    console.log(`  slug:           ${slug}`);
    console.log(`  displayName:    ${args.name.trim()}`);
    console.log(`  lanes:          ${lanes.join(", ")}`);
    console.log(`  previewMode:    ${previewMode}`);
    console.log(`  promptPackDir:  ${pack.packDir}`);
    console.log(`  laneState:      ${laneStateRelPath}`);
    console.log(`\n  Prompt pack files:`);
    for (const f of pack.files) {
      console.log(`    ${f}`);
    }
    console.log(``);
  } catch (err) {
    console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
