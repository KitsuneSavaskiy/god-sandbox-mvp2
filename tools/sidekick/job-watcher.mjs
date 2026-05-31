#!/usr/bin/env node
/**
 * Sidekick Job Watcher
 *
 * Polls .godsandbox/jobs/ every 2 seconds for new *-request.json files.
 * Routes assetgen requests (with jobId/lanes/previewMode/gen2Bridge fields) to
 * character-asset-bundle-intake.mjs (assetgen:intake), and legacy requests to
 * sidekick-intake.mjs (sidekick:intake).
 *
 * File lifecycle:
 *   .godsandbox/jobs/<id>-request.json
 *     → processing: .godsandbox/jobs/processing/<id>-request.json
 *     → done:       .godsandbox/jobs/done/<id>-request.json
 *     → failed:     .godsandbox/jobs/failed/<id>-request.json
 *                   .godsandbox/jobs/failed/<id>-error.json  (reason)
 *
 * Usage:
 *   npm run sidekick:watch
 *   node tools/sidekick/job-watcher.mjs [--dry-run] [--once]
 *
 * Flags:
 *   --dry-run   Scan jobs/ once, classify each file, log what would be done, then exit.
 *               Does not move files or spawn any process.
 *   --once      Process all pending jobs once and exit (no continuous polling).
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const jobsDir = path.join(repoRoot, ".godsandbox", "jobs");
const processingDir = path.join(jobsDir, "processing");
const doneDir = path.join(jobsDir, "done");
const failedDir = path.join(jobsDir, "failed");
const appServerDir = path.join(jobsDir, "local-app-server");

const legacyIntakeScript = path.join(repoRoot, "tools", "sidekick", "sidekick-intake.mjs");
const assetgenIntakeScript = path.join(repoRoot, "tools", "sidekick", "character-asset-bundle-intake.mjs");

const ASSETGEN_DISCRIMINATOR_FIELDS = ["jobId", "lanes", "previewMode", "gen2Bridge"];

const DEFAULT_JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const SIGKILL_GRACE_MS = 5_000;
const rawTimeout = Number(process.env.SIDEKICK_JOB_TIMEOUT_MS);
const JOB_TIMEOUT_MS =
  Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_JOB_TIMEOUT_MS;

// ---------------------------------------------------------------------------
// Classification — pure function, exported for tests
// ---------------------------------------------------------------------------

/**
 * Classify a parsed watcher request.
 *
 * Returns:
 *   - "assetgen"  if any of ASSETGEN_DISCRIMINATOR_FIELDS is present
 *   - "legacy"    if none of those fields are present
 *   - "malformed" if the input is not an object or missing required `slug` field
 *
 * @param {unknown} parsed
 * @returns {{ type: "assetgen" | "legacy" | "malformed", reason?: string }}
 */
export function classifyWatcherRequest(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { type: "malformed", reason: "request is not a JSON object" };
  }

  if (!parsed.slug || typeof parsed.slug !== "string" || parsed.slug.trim().length === 0) {
    return { type: "malformed", reason: "missing required field: slug" };
  }

  for (const field of ASSETGEN_DISCRIMINATOR_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(parsed, field)) {
      return { type: "assetgen" };
    }
  }

  return { type: "legacy" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Write a failure reason file to the failed/ directory.
 * Only records sanitized reason — no absolute paths, no secrets.
 *
 * @param {string} baseId  base filename without extension (e.g. "myjob-20260524-abcd1234")
 * @param {string} reason
 */
function writeFailureReason(baseId, reason) {
  ensureDir(failedDir);
  const errorFilePath = path.join(failedDir, `${baseId}-error.json`);
  writeFileSync(
    errorFilePath,
    JSON.stringify(
      {
        baseId,
        reason,
        recordedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
}

/**
 * Move a request file to failed/ and write the error reason file.
 *
 * @param {string} filePath  absolute path of the request file
 * @param {string} filename  base filename
 * @param {string} reason
 */
function moveToFailed(filePath, filename, reason) {
  ensureDir(failedDir);
  const baseId = filename.replace(/-request\.json$/, "");
  try {
    if (existsSync(filePath)) {
      renameSync(filePath, path.join(failedDir, filename));
    }
  } catch {
    // file may have been moved already
  }
  writeFailureReason(baseId, reason);
}

/**
 * Update the local-app-server status file if it exists.
 * Does nothing if the file doesn't exist (legacy requests have no status file).
 *
 * @param {string} jobId
 * @param {string} status  e.g. "watcher-intake-done" | "watcher-intake-failed"
 * @param {object} [extra]  extra fields to merge
 */
function updateAppServerStatus(jobId, status, extra = {}) {
  if (!jobId) return;
  const statusFilePath = path.join(appServerDir, `${jobId}.json`);
  if (!existsSync(statusFilePath)) return;
  try {
    const existing = JSON.parse(readFileSync(statusFilePath, "utf8"));
    const updated = {
      ...existing,
      ...extra,
      status,
      watcherUpdatedAt: new Date().toISOString(),
    };
    writeFileSync(statusFilePath, JSON.stringify(updated, null, 2) + "\n");
  } catch (err) {
    console.error(`[watcher] Failed to update app-server status for ${jobId}: ${err.message}`);
  }
}

/**
 * Verify that lane-state.json exists after assetgen:intake.
 * If absent, write a minimal fallback.
 *
 * @param {string} slug
 * @param {string[]} lanes
 * @param {string} previewMode
 */
function ensureLaneState(slug, lanes, previewMode) {
  const residentDir = path.join(repoRoot, "assets", "generated", "residents", slug);
  const laneStatePath = path.join(residentDir, "lane-state.json");

  if (existsSync(laneStatePath)) return;

  ensureDir(residentDir);

  const laneEntries = {};
  for (const lane of lanes) {
    if (lane === "derived-icon") {
      laneEntries[lane] = {
        status: "planned",
        dependsOn: { "resident-sprite-sheet": "candidate-ready" },
        updatedAt: new Date().toISOString(),
      };
    } else {
      laneEntries[lane] = {
        status: "planned",
        updatedAt: new Date().toISOString(),
      };
    }
  }

  writeFileSync(
    laneStatePath,
    JSON.stringify(
      {
        slug,
        lanes: laneEntries,
        previewMode: previewMode ?? "po-combined",
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`[watcher] Created fallback lane-state.json for ${slug}`);
}

// ---------------------------------------------------------------------------
// Subprocess runner (with timeout)
// ---------------------------------------------------------------------------

function spawnWithTimeout(args, logPrefix) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", args, { cwd: repoRoot, stdio: "inherit" });
    let settled = false;

    const killTimer = setTimeout(() => {
      if (settled) return;
      console.error(`${logPrefix} Timeout (${JOB_TIMEOUT_MS}ms): sending SIGTERM`);
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (settled) return;
        console.error(`${logPrefix} Grace period elapsed: sending SIGKILL`);
        proc.kill("SIGKILL");
      }, SIGKILL_GRACE_MS);
    }, JOB_TIMEOUT_MS);

    proc.on("close", (code) => {
      settled = true;
      clearTimeout(killTimer);
      if (code === 0) resolve();
      else reject(new Error(`process exited with code ${code}`));
    });
    proc.on("error", (err) => {
      settled = true;
      clearTimeout(killTimer);
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// In-flight tracking (prevent double-processing)
// ---------------------------------------------------------------------------

const inFlight = new Set();

// ---------------------------------------------------------------------------
// Request processors
// ---------------------------------------------------------------------------

/**
 * Process an assetgen request (routes to character-asset-bundle-intake.mjs).
 *
 * @param {string} processingPath  absolute path of request in processing/
 * @param {string} filename
 * @param {object} request  parsed request JSON
 */
async function processAssetgenRequest(processingPath, filename, request) {
  const jobId = request.jobId;
  const slug = request.slug;
  const logPrefix = `[watcher] [${jobId}]`;

  console.log(`${logPrefix} Routing to assetgen:intake — slug=${slug}`);

  const lanes = Array.isArray(request.lanes)
    ? request.lanes
    : ["resident-sprite-sheet", "portrait-expressions", "derived-icon"];
  const previewMode = request.previewMode ?? "po-combined";

  const args = [
    assetgenIntakeScript,
    "--slug", slug,
    "--name", request.displayName,
    "--personality", request.personality ?? "",
    "--tone", request.tone ?? "",
    "--age", String(request.age ?? 0),
    "--portrait", request.portraitPath,
    "--lanes", lanes.join(","),
    "--preview-mode", previewMode,
  ];

  await spawnWithTimeout(args, logPrefix);

  // Verify lane-state.json was created (fallback if missing)
  ensureLaneState(slug, lanes, previewMode);

  // Move to done
  ensureDir(doneDir);
  renameSync(processingPath, path.join(doneDir, filename));

  // Update app-server status if available
  updateAppServerStatus(jobId, "watcher-intake-done");

  console.log(`${logPrefix} Done: ${filename}`);
}

/**
 * Process a legacy request (routes to sidekick-intake.mjs).
 *
 * @param {string} processingPath  absolute path of request in processing/
 * @param {string} filename
 * @param {object} request  parsed request JSON
 */
async function processLegacyRequest(processingPath, filename, request) {
  const slug = request.slug;
  console.log(`[watcher] [legacy] Processing: ${request.displayName} (${slug})`);

  const args = [
    legacyIntakeScript,
    "--slug", slug,
    "--name", request.displayName,
    "--personality", request.personality ?? "",
    "--tone", request.tone ?? "",
    "--age", String(request.age ?? 0),
    "--portrait", request.portraitPath,
  ];

  await spawnWithTimeout(args, `[watcher] [legacy]`);

  // Move to done
  ensureDir(doneDir);
  renameSync(processingPath, path.join(doneDir, filename));

  console.log(`[watcher] [legacy] Done: ${filename}`);
}

// ---------------------------------------------------------------------------
// Main per-file dispatcher
// ---------------------------------------------------------------------------

async function processRequest(filename) {
  if (!filename.endsWith("-request.json")) return;
  if (inFlight.has(filename)) return;

  const filePath = path.join(jobsDir, filename);
  if (!existsSync(filePath)) return;

  // Check if already in done/ or failed/ (double-run prevention)
  if (existsSync(path.join(doneDir, filename))) return;
  if (existsSync(path.join(failedDir, filename))) return;

  inFlight.add(filename);

  // Move to processing/ to prevent double-run across restarts
  ensureDir(processingDir);
  const processingPath = path.join(processingDir, filename);
  try {
    renameSync(filePath, processingPath);
  } catch (err) {
    // Another watcher instance may have picked it up
    inFlight.delete(filename);
    return;
  }

  try {
    // Parse the request
    let request;
    try {
      request = JSON.parse(readFileSync(processingPath, "utf8"));
    } catch (e) {
      console.error(`[watcher] Failed to parse ${filename}: ${e.message}`);
      moveToFailed(processingPath, filename, `JSON parse error: ${e.message}`);
      return;
    }

    // Classify
    const classification = classifyWatcherRequest(request);

    if (classification.type === "malformed") {
      console.error(`[watcher] Malformed request ${filename}: ${classification.reason}`);
      moveToFailed(processingPath, filename, classification.reason);
      return;
    }

    if (classification.type === "assetgen") {
      await processAssetgenRequest(processingPath, filename, request);
    } else {
      await processLegacyRequest(processingPath, filename, request);
    }
  } catch (error) {
    const jobId = (() => {
      try {
        return JSON.parse(readFileSync(processingPath, "utf8")).jobId;
      } catch {
        return null;
      }
    })();
    const logId = jobId ? `[${jobId}]` : "[unknown]";
    console.error(`[watcher] ${logId} Failed: ${error.message}`);

    // Move from processing/ to failed/
    moveToFailed(processingPath, filename, error.message);

    // Update app-server status if we have a jobId
    if (jobId) {
      updateAppServerStatus(jobId, "watcher-intake-failed", { failureReason: error.message });
    }
  } finally {
    inFlight.delete(filename);
  }
}

// ---------------------------------------------------------------------------
// Dry-run scanner
// ---------------------------------------------------------------------------

function runDryRun() {
  console.log(`[watcher] --dry-run mode: scanning ${path.relative(repoRoot, jobsDir)}/`);

  if (!existsSync(jobsDir)) {
    console.log(`[watcher] No jobs directory found at ${path.relative(repoRoot, jobsDir)}`);
    return;
  }

  let files;
  try {
    files = readdirSync(jobsDir);
  } catch (err) {
    console.error(`[watcher] Cannot read jobs directory: ${err.message}`);
    return;
  }

  const requestFiles = files.filter((f) => f.endsWith("-request.json"));

  if (requestFiles.length === 0) {
    console.log(`[watcher] No pending *-request.json files found.`);
    return;
  }

  for (const filename of requestFiles) {
    const filePath = path.join(jobsDir, filename);
    const inDone = existsSync(path.join(doneDir, filename));
    const inFailed = existsSync(path.join(failedDir, filename));
    const inProcessing = existsSync(path.join(processingDir, filename));

    if (inDone) {
      console.log(`[dry-run] SKIP (done):       ${filename}`);
      continue;
    }
    if (inFailed) {
      console.log(`[dry-run] SKIP (failed):     ${filename}`);
      continue;
    }
    if (inProcessing) {
      console.log(`[dry-run] SKIP (processing): ${filename}`);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      console.log(`[dry-run] WOULD FAIL (parse error): ${filename}`);
      continue;
    }

    const classification = classifyWatcherRequest(parsed);

    if (classification.type === "malformed") {
      console.log(`[dry-run] WOULD FAIL (malformed, ${classification.reason}): ${filename}`);
    } else if (classification.type === "assetgen") {
      console.log(
        `[dry-run] WOULD RUN assetgen:intake — jobId=${parsed.jobId ?? "(none)"} slug=${parsed.slug}: ${filename}`,
      );
    } else {
      console.log(`[dry-run] WOULD RUN sidekick:intake — slug=${parsed.slug}: ${filename}`);
    }
  }

  console.log(`[watcher] --dry-run complete. No files were moved or processed.`);
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

function pollJobsDir() {
  if (!existsSync(jobsDir)) return;

  let files;
  try {
    files = readdirSync(jobsDir);
  } catch {
    return;
  }

  for (const filename of files) {
    if (!filename.endsWith("-request.json")) continue;
    processRequest(filename);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function parseCliArgs(argv) {
  const args = { dryRun: false, once: false };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--once") args.once = true;
  }
  return args;
}

async function mainOnce() {
  ensureDir(jobsDir);
  if (!existsSync(jobsDir)) return;

  let files;
  try {
    files = readdirSync(jobsDir);
  } catch {
    return;
  }

  const pending = files.filter((f) => f.endsWith("-request.json"));
  for (const filename of pending) {
    await processRequest(filename);
  }
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.dryRun) {
    runDryRun();
    process.exit(0);
  }

  if (args.once) {
    console.log(`[watcher] --once mode: processing pending jobs then exiting`);
    mainOnce().then(() => {
      console.log(`[watcher] --once run complete.`);
      process.exit(0);
    });
    return;
  }

  ensureDir(jobsDir);
  console.log(`[watcher] Watching ${path.relative(repoRoot, jobsDir)}/`);
  console.log(`[watcher] Polling every 2 seconds for *-request.json files`);
  console.log(`[watcher] Routes: assetgen (jobId/lanes/previewMode/gen2Bridge) → assetgen:intake`);
  console.log(`[watcher]         legacy   (no discriminator fields)            → sidekick:intake`);

  pollJobsDir();
  setInterval(pollJobsDir, 2000);
}

const isCliEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntrypoint) {
  main();
}
