#!/usr/bin/env node
/**
 * GodSandbox Local Asset Generation Server
 *
 * Local-only HTTP server for character asset generation requests.
 * Binds to loopback only (127.0.0.1 by default).
 * No external URLs are contacted — all work is dispatched via gen2-bridge.mjs.
 *
 * Job status files:   .godsandbox/jobs/local-app-server/<jobId>.json  (gitignored)
 * Watcher handoff:    .godsandbox/jobs/<jobId>-request.json           (gitignored, picked up by job-watcher.mjs)
 *                     One file per job — slug collisions never overwrite an existing watcher file.
 *
 * SECURITY: Never writes to public/art/**. A guard check runs before every write.
 *
 * Usage:
 *   node tools/app-server/asset-generation-server.mjs [--dry-run] [--port 8787] [--help]
 */

import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGen2Bridge, resolveGen2BridgeConfig } from "./gen2-bridge.mjs";
import { buildPromptPack } from "./character-asset-prompt-pack.mjs";
import { validatePortraitPathFilesystem } from "./portrait-path-validator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;
export const VALID_LANES = ["resident-sprite-sheet", "portrait-expressions", "derived-icon", "event-standing-expressions"];
const VALID_PREVIEW_MODES = ["po-combined", "canonical-two-sheet"];
const VALID_BRIDGE_MODES = ["local-cli", "hot-folder", "manual-drop", "fake"];

// .godsandbox/jobs/ is gitignored — safe for ephemeral job state
const JOBS_APP_SERVER_DIR = path.join(repoRoot, ".godsandbox", "jobs", "local-app-server");
const JOBS_WATCHER_DIR = path.join(repoRoot, ".godsandbox", "jobs");

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

// Loopback addresses that are always permitted
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

// Allowed CORS origins (Vite dev server origins on the loopback)
const CORS_ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

/**
 * SECURITY GUARD: Reject any write path that starts with public/art/
 * This prevents generated content from accidentally being written to served assets.
 * @param {string} absPath
 */
function assertNotPublicArt(absPath) {
  const rel = path.relative(repoRoot, absPath).replaceAll("\\", "/");
  if (rel.startsWith("public/art/")) {
    throw new Error(
      `SECURITY: Refusing to write to public/art/: ${rel}. ` +
        "Asset generation output must go to .godsandbox/jobs/ or assets/generated/ only.",
    );
  }
}

function safeWriteFile(filePath, content) {
  assertNotPublicArt(filePath);
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, content);
}

export function generateJobId(prefix = "job") {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = randomBytes(4).toString("hex");
  return `${prefix}-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Request body parsing
// ---------------------------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    // Reject if Content-Length header alone exceeds limit
    const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
    if (!isNaN(contentLength) && contentLength > MAX_BODY_BYTES) {
      return reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
    }

    const chunks = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        return reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Request body validation
// ---------------------------------------------------------------------------

/**
 * Validates the POST /characters request body.
 * @param {object} body
 * @returns {{ valid: true, data: object } | { valid: false, errors: string[] }}
 */
function validateCharacterRequestBody(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body must be a JSON object."] };
  }

  if (!body.displayName || typeof body.displayName !== "string" || body.displayName.trim().length === 0) {
    errors.push("displayName is required (non-empty string).");
  }
  if (!body.personality || typeof body.personality !== "string" || body.personality.trim().length === 0) {
    errors.push("personality is required (non-empty string).");
  }
  if (!body.tone || typeof body.tone !== "string" || body.tone.trim().length === 0) {
    errors.push("tone is required (non-empty string).");
  }

  const age = parseInt(body.age, 10);
  if (body.age === undefined || body.age === null || !Number.isInteger(age) || age < 0) {
    errors.push("age is required (non-negative integer).");
  }

  if (!body.portraitPath || typeof body.portraitPath !== "string") {
    errors.push("portraitPath is required (string).");
  } else if (!body.portraitPath.endsWith(".png")) {
    errors.push("portraitPath must end with .png.");
  }

  if (body.assetBundleId !== undefined) {
    if (typeof body.assetBundleId !== "string" || !SLUG_PATTERN.test(body.assetBundleId)) {
      errors.push(
        `assetBundleId must match /^[a-z0-9][a-z0-9_-]{0,59}$/. Got: "${body.assetBundleId}".`,
      );
    }
  }

  if (body.lanes !== undefined) {
    if (!Array.isArray(body.lanes)) {
      errors.push("lanes must be an array.");
    } else {
      for (const lane of body.lanes) {
        if (!VALID_LANES.includes(lane)) {
          errors.push(`Invalid lane "${lane}". Valid: ${VALID_LANES.join(", ")}.`);
        }
      }
    }
  }

  if (body.previewMode !== undefined && !VALID_PREVIEW_MODES.includes(body.previewMode)) {
    errors.push(`Invalid previewMode "${body.previewMode}". Valid: ${VALID_PREVIEW_MODES.join(", ")}.`);
  }

  if (body.gen2Bridge !== undefined && !VALID_BRIDGE_MODES.includes(body.gen2Bridge)) {
    errors.push(`Invalid gen2Bridge "${body.gen2Bridge}". Valid: ${VALID_BRIDGE_MODES.join(", ")}.`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      displayName: body.displayName.trim(),
      personality: body.personality.trim(),
      tone: body.tone.trim(),
      age,
      portraitPath: body.portraitPath,
      assetBundleId: body.assetBundleId ?? null,
      lanes: body.lanes ?? ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
      previewMode: body.previewMode ?? "po-combined",
      gen2Bridge: body.gen2Bridge ?? "fake",
    },
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function handleHealthz(_req, res) {
  sendJson(res, 200, {
    status: "ok",
    server: "godsandbox-asset-gen",
    loopbackOnly: true,
  });
}

async function handlePostCharacters(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const code = err.statusCode === 413 ? 413 : 400;
    return sendJson(res, code, { error: err.message || "Invalid JSON body." });
  }

  const validation = validateCharacterRequestBody(body);
  if (!validation.valid) {
    return sendJson(res, 422, { error: "Validation failed.", details: validation.errors });
  }

  const data = validation.data;

  // Filesystem validation: absolute path, traversal, repo boundary, existence, PNG signature
  const portraitError = validatePortraitPathFilesystem(data.portraitPath, repoRoot);
  if (portraitError) {
    return sendJson(res, 422, { error: "Portrait path validation failed.", details: [portraitError] });
  }

  // Derive slug from assetBundleId or displayName
  // lowercase, replace spaces with hyphens, strip non-alnum-hyphen, truncate 60, ensure starts with letter/digit
  const slug = (data.assetBundleId != null)
    ? data.assetBundleId
    : (() => {
        let s = data.displayName.toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/^-+|-+$/g, "")
          .replace(/-{2,}/g, "-")
          .slice(0, 60);
        // ensure starts with letter/digit
        s = s.replace(/^[^a-z0-9]+/, "");
        return s || "character";
      })();

  // Validate bridge config before creating job (returns 400 on env-var issues)
  let bridgeConfig;
  try {
    bridgeConfig = resolveGen2BridgeConfig(data.gen2Bridge);
  } catch (err) {
    return sendJson(res, 400, { error: `gen2Bridge config error: ${err.message}` });
  }

  const assetBundleId = slug;
  const jobId = generateJobId(assetBundleId);

  // Build the job record
  const job = {
    jobVersion: "godsandbox-asset-gen-server/v0",
    jobId,
    jobType: "character-asset-bundle",
    status: "pending",
    createdAt: new Date().toISOString(),
    assetBundleId,
    characterProfile: {
      displayName: data.displayName,
      personality: data.personality,
      tone: data.tone,
      age: data.age,
      portraitPath: data.portraitPath,
    },
    lanes: data.lanes,
    previewMode: data.previewMode,
    gen2Bridge: data.gen2Bridge,
  };

  // Write status file — .godsandbox/jobs/local-app-server/ is gitignored
  const statusFilePath = path.join(JOBS_APP_SERVER_DIR, `${jobId}.json`);
  safeWriteFile(statusFilePath, JSON.stringify(job, null, 2) + "\n");

  // Write watcher-compatible request file — .godsandbox/jobs/<jobId>-request.json
  // Using jobId (not slug) as filename so concurrent jobs with the same slug don't overwrite each other.
  // Fields match what job-watcher.mjs expects: { slug, displayName, personality, tone, age, portraitPath }
  const watcherFilePath = path.join(JOBS_WATCHER_DIR, `${jobId}-request.json`);
  safeWriteFile(
    watcherFilePath,
    JSON.stringify(
      {
        jobId,
        slug,
        displayName: data.displayName,
        personality: data.personality,
        tone: data.tone,
        age: data.age,
        portraitPath: data.portraitPath,
      },
      null,
      2,
    ) + "\n",
  );

  // Dispatch to gen2 bridge and build prompt pack asynchronously
  dispatchJob(jobId, assetBundleId, job, data, bridgeConfig, statusFilePath).catch((err) => {
    console.error(`[asset-gen-server] Job ${jobId} dispatch error: ${err.message}`);
  });

  sendJson(res, 202, { jobId, status: "pending" });
}

async function dispatchJob(jobId, assetBundleId, job, data, bridgeConfig, statusFilePath) {
  try {
    // Build prompt pack
    const pack = await buildPromptPack({
      assetBundleId,
      displayName: data.displayName,
      personality: data.personality,
      tone: data.tone,
      age: data.age,
      portraitPath: data.portraitPath,
      lanes: data.lanes,
      previewMode: data.previewMode,
    });

    updateJobStatus(statusFilePath, {
      status: "prompt-pack-ready",
      promptPackDir: pack.packDir,
      promptPackFiles: pack.files,
    });

    // Prepare gen2 bridge handoff (config comes from env vars, not HTTP body)
    const bridge = createGen2Bridge(bridgeConfig);
    const handoff = await bridge.prepareJob(job);

    updateJobStatus(statusFilePath, {
      status: "gen2-dispatched",
      handoffPath: handoff.handoffPath,
      handoffType: handoff.handoffType,
      validationOnly: handoff.validationOnly ?? false,
      candidateEligible: handoff.candidateEligible ?? true,
    });
  } catch (err) {
    updateJobStatus(statusFilePath, {
      status: "error",
      error: err.message,
    });
    throw err;
  }
}

function updateJobStatus(statusFilePath, updates) {
  try {
    const existing = JSON.parse(readFileSync(statusFilePath, "utf8"));
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    safeWriteFile(statusFilePath, JSON.stringify(updated, null, 2) + "\n");
  } catch (err) {
    console.error(`[asset-gen-server] Failed to update job status: ${err.message}`);
  }
}

function handleGetJobStatus(req, res, jobId) {
  if (!jobId || typeof jobId !== "string" || jobId.includes("..") || jobId.includes("/")) {
    return sendJson(res, 400, { error: "Invalid jobId." });
  }

  const statusFilePath = path.join(JOBS_APP_SERVER_DIR, `${jobId}.json`);
  if (!existsSync(statusFilePath)) {
    return sendJson(res, 404, { error: "Job not found.", jobId });
  }

  try {
    const job = JSON.parse(readFileSync(statusFilePath, "utf8"));
    sendJson(res, 200, job);
  } catch {
    sendJson(res, 500, { error: "Failed to read job status." });
  }
}

function handleCancelJob(req, res, jobId) {
  if (!jobId || typeof jobId !== "string" || jobId.includes("..") || jobId.includes("/")) {
    return sendJson(res, 400, { error: "Invalid jobId." });
  }

  const statusFilePath = path.join(JOBS_APP_SERVER_DIR, `${jobId}.json`);
  if (!existsSync(statusFilePath)) {
    return sendJson(res, 404, { error: "Job not found.", jobId });
  }

  try {
    const job = JSON.parse(readFileSync(statusFilePath, "utf8"));

    if (job.status === "cancelled") {
      return sendJson(res, 200, { jobId, status: "cancelled", message: "Already cancelled." });
    }
    if (job.status === "error") {
      return sendJson(res, 409, { error: "Cannot cancel a job in error state.", status: job.status });
    }

    job.status = "cancelled";
    job.cancelledAt = new Date().toISOString();
    safeWriteFile(statusFilePath, JSON.stringify(job, null, 2) + "\n");
    sendJson(res, 200, { jobId, status: "cancelled" });
  } catch {
    sendJson(res, 500, { error: "Failed to cancel job." });
  }
}

// ---------------------------------------------------------------------------
// HTTP utilities
// ---------------------------------------------------------------------------

function applyCorsHeaders(req, res) {
  const origin = req.headers["origin"];
  if (origin && CORS_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function send404(res) {
  sendJson(res, 404, { error: "Not found." });
}

function send405(res) {
  sendJson(res, 405, { error: "Method not allowed." });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function router(req, res) {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  applyCorsHeaders(req, res);

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // GET /healthz
    if (url === "/healthz" && method === "GET") {
      return handleHealthz(req, res);
    }

    // POST /api/local/asset-generation/characters
    if (url === "/api/local/asset-generation/characters") {
      if (method !== "POST") return send405(res);
      return await handlePostCharacters(req, res);
    }

    // GET /api/local/asset-generation/jobs/:jobId
    const jobStatusMatch = url.match(/^\/api\/local\/asset-generation\/jobs\/([^/]+)$/);
    if (jobStatusMatch) {
      const jobId = jobStatusMatch[1];
      if (method === "GET") return handleGetJobStatus(req, res, jobId);
      return send405(res);
    }

    // POST /api/local/asset-generation/jobs/:jobId/cancel
    const jobCancelMatch = url.match(/^\/api\/local\/asset-generation\/jobs\/([^/]+)\/cancel$/);
    if (jobCancelMatch) {
      const jobId = jobCancelMatch[1];
      if (method === "POST") return handleCancelJob(req, res, jobId);
      return send405(res);
    }

    return send404(res);
  } catch (err) {
    console.error(`[asset-gen-server] Unhandled error: ${err.message}`);
    sendJson(res, 500, { error: "Internal server error." });
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`GodSandbox Local Asset Generation Server

Binds to loopback only. No external network access.

Usage:
  node tools/app-server/asset-generation-server.mjs [options]

Options:
  --port <n>    Port to listen on (default: $GODSANDBOX_ASSET_SERVER_PORT ?? 8787)
  --dry-run     Start server, print READY, then exit 0 without waiting for requests
  --help        Show this help

Environment:
  GODSANDBOX_ASSET_SERVER_HOST              Bind host (default: 127.0.0.1)
  GODSANDBOX_ASSET_SERVER_PORT              Port (default: 8787)
  GODSANDBOX_ALLOW_NON_LOOPBACK_ASSET_SERVER=1   Allow non-loopback hosts (unsafe)

Endpoints:
  GET  /healthz
  POST /api/local/asset-generation/characters
  GET  /api/local/asset-generation/jobs/:jobId
  POST /api/local/asset-generation/jobs/:jobId/cancel

Job files go to:
  .godsandbox/jobs/local-app-server/<jobId>.json   (gitignored, for GET /jobs/:jobId)
  .godsandbox/jobs/<jobId>-request.json            (gitignored, picked up by job-watcher.mjs)
`);
}

function parseCliArgs(argv) {
  const args = { dryRun: false, port: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--help" || argv[i] === "-h") { args.help = true; }
    else if (argv[i] === "--dry-run") { args.dryRun = true; }
    else if (argv[i] === "--port" && argv[i + 1]) { args.port = parseInt(argv[i + 1], 10); i++; }
  }
  return args;
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const host = process.env.GODSANDBOX_ASSET_SERVER_HOST ?? "127.0.0.1";
  const port = args.port ?? parseInt(process.env.GODSANDBOX_ASSET_SERVER_PORT ?? "8787", 10);
  const allowNonLoopback = process.env.GODSANDBOX_ALLOW_NON_LOOPBACK_ASSET_SERVER === "1";

  // Loopback-only guard
  if (!LOOPBACK_HOSTS.has(host) && !allowNonLoopback) {
    console.error(
      `Error: GODSANDBOX_ASSET_SERVER_HOST="${host}" is not a loopback address.\n` +
        "To allow non-loopback hosts (unsafe), set GODSANDBOX_ALLOW_NON_LOOPBACK_ASSET_SERVER=1.",
    );
    process.exit(1);
  }

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Error: Invalid port: ${port}`);
    process.exit(1);
  }

  // Ensure job dirs exist — these are gitignored
  ensureDir(JOBS_APP_SERVER_DIR);
  ensureDir(JOBS_WATCHER_DIR);

  if (args.dryRun) {
    // Dry-run: validate config then exit immediately
    console.log("READY");
    process.exit(0);
  }

  const server = createServer(router);

  server.listen(port, host, () => {
    console.log(`[asset-gen-server] Listening on http://${host}:${port}`);
    console.log(`[asset-gen-server] loopbackOnly: ${LOOPBACK_HOSTS.has(host)}`);
    console.log(`[asset-gen-server] Job dir: .godsandbox/jobs/ (gitignored)`);
    console.log(`[asset-gen-server] Status dir: .godsandbox/jobs/local-app-server/ (gitignored)`);
  });

  server.on("error", (err) => {
    console.error(`[asset-gen-server] Server error: ${err.message}`);
    process.exit(1);
  });
}

// Guard: only run when executed directly, not when imported by tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
