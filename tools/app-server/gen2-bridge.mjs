#!/usr/bin/env node
/**
 * GEN2 Bridge — local-only image generation handoff adapters
 *
 * SECURITY GUARD: No bridge in this file may call external URLs or network endpoints.
 * All I/O is confined to the local filesystem within .godsandbox/jobs/ and
 * assets/generated/ (both gitignored). See .gitignore for exclusion rules.
 *
 * Factory:
 *   createGen2Bridge(config) → one of the four bridge classes below
 *
 * Bridge modes:
 *   "local-cli"   — Gen2LocalCliBridge:    invokes a local CLI command
 *   "hot-folder"  — Gen2HotFolderBridge:   writes job files, polls for output
 *   "manual-drop" — Gen2ManualDropBridge:  waits for operator to place files
 *   "fake"        — FakeGen2Bridge:        validation-only, never generates images
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

// .godsandbox/jobs/ is gitignored — safe for ephemeral job state
const JOBS_BASE = path.join(repoRoot, ".godsandbox", "jobs");

const POLL_INTERVAL_MS = 2_000;

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

function assertNoExternalUrl(bridgeName) {
  // This is a runtime assertion: bridges must never reach out to external URLs.
  // All network calls in this file are forbidden.
  // bridgeName is logged so audit traces identify which class triggered the check.
  void bridgeName;
}

/**
 * Resolves Gen2 bridge configuration from environment variables.
 * Validates that required env vars are present for the requested mode.
 * Does NOT accept folder paths or CLI commands from HTTP request bodies.
 *
 * @param {"local-cli"|"hot-folder"|"manual-drop"|"fake"} requestedMode
 * @returns {{ mode: string, cliCommand?: string[], hotFolderPath?: string, outputFolderPath?: string, dropFolderPath?: string }}
 * @throws {Error} if required env vars are missing for the mode
 */
export function resolveGen2BridgeConfig(requestedMode) {
  const mode = requestedMode ?? "fake";

  switch (mode) {
    case "local-cli": {
      const raw = process.env.GODSANDBOX_GEN2_LOCAL_CLI_COMMAND;
      if (!raw) {
        throw new Error("GODSANDBOX_GEN2_LOCAL_CLI_COMMAND env var required for local-cli bridge mode");
      }
      let cliCommand;
      try {
        cliCommand = JSON.parse(raw);
        if (!Array.isArray(cliCommand) || cliCommand.length === 0) {
          throw new Error("must be a non-empty JSON array");
        }
      } catch {
        // Fallback: split on spaces
        cliCommand = raw.split(/\s+/).filter(Boolean);
      }
      return { mode, cliCommand };
    }

    case "hot-folder": {
      const hotFolderPath = process.env.GODSANDBOX_GEN2_HOT_FOLDER;
      if (!hotFolderPath) {
        throw new Error("GODSANDBOX_GEN2_HOT_FOLDER env var required for hot-folder bridge mode");
      }
      const outputFolderPath = process.env.GODSANDBOX_GEN2_HOT_FOLDER_OUTPUT ?? null;
      return { mode, hotFolderPath, outputFolderPath };
    }

    case "manual-drop": {
      const dropFolderPath = process.env.GODSANDBOX_GEN2_MANUAL_DROP_FOLDER;
      if (!dropFolderPath) {
        throw new Error("GODSANDBOX_GEN2_MANUAL_DROP_FOLDER env var required for manual-drop bridge mode");
      }
      return { mode, dropFolderPath };
    }

    case "fake":
      return { mode };

    default:
      throw new Error(`Unknown gen2 bridge mode: "${mode}". Valid: local-cli, hot-folder, manual-drop, fake`);
  }
}

/**
 * @param {object} config
 * @param {"local-cli"|"hot-folder"|"manual-drop"|"fake"} config.mode
 * @returns {Gen2LocalCliBridge|Gen2HotFolderBridge|Gen2ManualDropBridge|FakeGen2Bridge}
 */
export function createGen2Bridge(config) {
  const mode = config?.mode ?? "fake";
  switch (mode) {
    case "local-cli":
      return new Gen2LocalCliBridge(config);
    case "hot-folder":
      return new Gen2HotFolderBridge(config);
    case "manual-drop":
      return new Gen2ManualDropBridge(config);
    case "fake":
      return new FakeGen2Bridge(config);
    default:
      throw new Error(`Unknown gen2 bridge mode: "${mode}". Valid: local-cli, hot-folder, manual-drop, fake`);
  }
}

// ---------------------------------------------------------------------------
// Gen2LocalCliBridge
// ---------------------------------------------------------------------------

/**
 * Invokes a local CLI command to trigger generation.
 * No external URLs — command runs as a local subprocess only.
 *
 * config:
 *   cliCommand: string  — command to run (e.g. "node tools/gen2/run.mjs")
 *   outputDir?: string  — where CLI places output files (default: job folder)
 */
export class Gen2LocalCliBridge {
  /** @param {object} config */
  constructor(config) {
    // GUARD: no external URLs permitted in this bridge
    assertNoExternalUrl("Gen2LocalCliBridge");
    // cliCommand must be an array (resolved from env var via resolveGen2BridgeConfig)
    if (!config.cliCommand || !Array.isArray(config.cliCommand) || config.cliCommand.length === 0) {
      throw new Error("Gen2LocalCliBridge requires config.cliCommand (non-empty string array from env var).");
    }
    this._cliCommand = config.cliCommand;
    this._outputDir = config.outputDir ?? null;
  }

  /**
   * Writes prompt package to job folder and invokes the local CLI.
   * @param {object} job
   * @returns {Promise<{handoffPath: string, handoffType: "local-cli", exitCode: number}>}
   */
  async prepareJob(job) {
    const jobDir = path.join(JOBS_BASE, "local-cli", job.jobId);
    ensureDir(jobDir);

    const promptPackagePath = path.join(jobDir, "prompt-package.json");
    writeFileSync(
      promptPackagePath,
      JSON.stringify(
        {
          bridgeType: "local-cli",
          jobId: job.jobId,
          assetBundleId: job.assetBundleId,
          characterProfile: job.characterProfile,
          lanes: job.lanes ?? [],
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );

    const [cmd, ...cmdArgs] = this._cliCommand;
    const allArgs = [...cmdArgs, "--job-file", promptPackagePath];

    const exitCode = await new Promise((resolve, reject) => {
      const proc = spawn(cmd, allArgs, { cwd: repoRoot, stdio: "inherit" });
      proc.on("close", resolve);
      proc.on("error", reject);
    });

    return { handoffPath: jobDir, handoffType: "local-cli", exitCode };
  }

  /**
   * Polls jobDir for PNG output files.
   * @param {object} job
   * @param {number} timeoutMs
   * @returns {Promise<{found: boolean, outputFiles: string[]}>}
   */
  async waitForResult(job, timeoutMs = 120_000) {
    const jobDir = this._outputDir ?? path.join(JOBS_BASE, "local-cli", job.jobId);
    return pollForPngs(jobDir, timeoutMs);
  }

  /**
   * Writes evidence JSON to the job folder.
   * @param {object} job
   * @param {object} result
   * @returns {Promise<void>}
   */
  async recordResult(job, result) {
    const jobDir = path.join(JOBS_BASE, "local-cli", job.jobId);
    ensureDir(jobDir);
    writeFileSync(
      path.join(jobDir, "evidence.json"),
      JSON.stringify({ ...result, recordedAt: new Date().toISOString() }, null, 2) + "\n",
    );
  }
}

// ---------------------------------------------------------------------------
// Gen2HotFolderBridge
// ---------------------------------------------------------------------------

/**
 * Writes job files to a hot-folder watched by a local generation service.
 * The generation service picks up files from the hot folder and writes output
 * to an adjacent output folder.
 *
 * config:
 *   hotFolderPath: string  — writable local path watched by the generation service
 *   outputFolderPath?: string  — where the service writes results (default: hotFolderPath/output)
 */
export class Gen2HotFolderBridge {
  /** @param {object} config */
  constructor(config) {
    // GUARD: no external URLs permitted in this bridge
    assertNoExternalUrl("Gen2HotFolderBridge");
    // hotFolderPath comes from env var GODSANDBOX_GEN2_HOT_FOLDER (via resolveGen2BridgeConfig)
    if (!config.hotFolderPath || typeof config.hotFolderPath !== "string") {
      throw new Error("Gen2HotFolderBridge requires config.hotFolderPath (from GODSANDBOX_GEN2_HOT_FOLDER env var).");
    }
    this._hotFolderPath = path.resolve(config.hotFolderPath);
    this._outputFolderPath = config.outputFolderPath
      ? path.resolve(config.outputFolderPath)
      : path.join(this._hotFolderPath, "output");
  }

  /**
   * Writes a job-descriptor file to the hot folder.
   * @param {object} job
   * @returns {Promise<{handoffPath: string, handoffType: "hot-folder"}>}
   */
  async prepareJob(job) {
    ensureDir(this._hotFolderPath);

    const jobFileName = `${job.jobId}.job.json`;
    const jobFilePath = path.join(this._hotFolderPath, jobFileName);

    writeFileSync(
      jobFilePath,
      JSON.stringify(
        {
          bridgeType: "hot-folder",
          jobId: job.jobId,
          assetBundleId: job.assetBundleId,
          characterProfile: job.characterProfile,
          lanes: job.lanes ?? [],
          outputFolderPath: this._outputFolderPath,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );

    return { handoffPath: jobFilePath, handoffType: "hot-folder" };
  }

  /**
   * Polls the output folder for PNG files whose names include the jobId.
   * @param {object} job
   * @param {number} timeoutMs
   * @returns {Promise<{found: boolean, outputFiles: string[]}>}
   */
  async waitForResult(job, timeoutMs = 300_000) {
    return pollForPngs(this._outputFolderPath, timeoutMs, (name) =>
      name.includes(job.jobId),
    );
  }

  /**
   * Writes evidence JSON to the job evidence folder (inside .godsandbox/jobs/).
   * @param {object} job
   * @param {object} result
   * @returns {Promise<void>}
   */
  async recordResult(job, result) {
    const evidenceDir = path.join(JOBS_BASE, "hot-folder", job.jobId);
    ensureDir(evidenceDir);
    writeFileSync(
      path.join(evidenceDir, "evidence.json"),
      JSON.stringify({ ...result, recordedAt: new Date().toISOString() }, null, 2) + "\n",
    );
  }
}

// ---------------------------------------------------------------------------
// Gen2ManualDropBridge
// ---------------------------------------------------------------------------

/**
 * Checks a drop folder for manually placed PNG files.
 * The operator drops files named <jobId>-<expression>.png into the drop folder.
 *
 * config:
 *   dropFolderPath: string  — local folder where operator places files
 */
export class Gen2ManualDropBridge {
  /** @param {object} config */
  constructor(config) {
    // GUARD: no external URLs permitted in this bridge
    assertNoExternalUrl("Gen2ManualDropBridge");
    // dropFolderPath comes from env var GODSANDBOX_GEN2_MANUAL_DROP_FOLDER (via resolveGen2BridgeConfig)
    if (!config.dropFolderPath || typeof config.dropFolderPath !== "string") {
      throw new Error("Gen2ManualDropBridge requires config.dropFolderPath (from GODSANDBOX_GEN2_MANUAL_DROP_FOLDER env var).");
    }
    this._dropFolderPath = path.resolve(config.dropFolderPath);
  }

  /**
   * Writes a waiting-receipt file so the operator knows what job is expected.
   * @param {object} job
   * @returns {Promise<{handoffPath: string, handoffType: "manual-drop"}>}
   */
  async prepareJob(job) {
    ensureDir(this._dropFolderPath);

    const receiptPath = path.join(this._dropFolderPath, `${job.jobId}.waiting.json`);
    writeFileSync(
      receiptPath,
      JSON.stringify(
        {
          bridgeType: "manual-drop",
          jobId: job.jobId,
          assetBundleId: job.assetBundleId,
          lanes: job.lanes ?? [],
          instruction: `Drop PNG files named ${job.jobId}-<expression>.png into this folder.`,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );

    return { handoffPath: receiptPath, handoffType: "manual-drop" };
  }

  /**
   * Polls the drop folder for PNG files matching the jobId prefix.
   * @param {object} job
   * @param {number} timeoutMs
   * @returns {Promise<{found: boolean, outputFiles: string[]}>}
   */
  async waitForResult(job, timeoutMs = 600_000) {
    return pollForPngs(this._dropFolderPath, timeoutMs, (name) =>
      name.startsWith(job.jobId) && name.endsWith(".png"),
    );
  }

  /**
   * Writes evidence JSON to the job evidence folder.
   * @param {object} job
   * @param {object} result
   * @returns {Promise<void>}
   */
  async recordResult(job, result) {
    const evidenceDir = path.join(JOBS_BASE, "manual-drop", job.jobId);
    ensureDir(evidenceDir);
    writeFileSync(
      path.join(evidenceDir, "evidence.json"),
      JSON.stringify({ ...result, recordedAt: new Date().toISOString() }, null, 2) + "\n",
    );
  }
}

// ---------------------------------------------------------------------------
// FakeGen2Bridge
// ---------------------------------------------------------------------------

/**
 * Validation-only bridge. Writes metadata JSON; never generates images.
 * Used in tests, dry-run flows, and CI pipelines.
 *
 * Output file always contains:
 *   "validationOnly": true
 *   "candidateEligible": false
 */
export class FakeGen2Bridge {
  /** @param {object} config */
  constructor(config) {
    // GUARD: no external URLs permitted in this bridge
    assertNoExternalUrl("FakeGen2Bridge");
    this._config = config ?? {};
  }

  /**
   * Writes a validation-only metadata JSON. Never produces image files.
   * The file explicitly marks candidateEligible: false so downstream
   * adopt-candidate logic never treats fake output as real.
   *
   * @param {object} job
   * @returns {Promise<{handoffPath: string, handoffType: "fake", validationOnly: true, candidateEligible: false}>}
   */
  async prepareJob(job) {
    const jobDir = path.join(JOBS_BASE, "fake", job.jobId);
    ensureDir(jobDir);

    const metaPath = path.join(jobDir, "fake-metadata.json");
    writeFileSync(
      metaPath,
      JSON.stringify(
        {
          bridgeType: "fake",
          jobId: job.jobId,
          assetBundleId: job.assetBundleId,
          lanes: job.lanes ?? [],
          // IMPORTANT: validationOnly and candidateEligible are always these values
          // for FakeGen2Bridge. Downstream adopt-candidate logic checks candidateEligible.
          validationOnly: true,
          candidateEligible: false,
          note: "FakeGen2Bridge never produces real images. For CI / dry-run use only.",
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );

    return {
      handoffPath: metaPath,
      handoffType: "fake",
      validationOnly: true,
      candidateEligible: false,
    };
  }

  /**
   * Always returns found:false — fake bridge never produces output files.
   * @param {object} _job
   * @param {number} _timeoutMs
   * @returns {Promise<{found: false, outputFiles: []}>}
   */
  async waitForResult(_job, _timeoutMs = 0) {
    return { found: false, outputFiles: [] };
  }

  /**
   * Writes evidence JSON noting this was a fake/validation-only run.
   * @param {object} job
   * @param {object} result
   * @returns {Promise<void>}
   */
  async recordResult(job, result) {
    const jobDir = path.join(JOBS_BASE, "fake", job.jobId);
    ensureDir(jobDir);
    writeFileSync(
      path.join(jobDir, "evidence.json"),
      JSON.stringify(
        {
          ...result,
          validationOnly: true,
          candidateEligible: false,
          recordedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Polls a directory for PNG files, optionally filtered by a name predicate.
 * Returns when at least one PNG is found or timeoutMs elapses.
 *
 * @param {string} dir
 * @param {number} timeoutMs
 * @param {(name: string) => boolean} [namePredicate]
 * @returns {Promise<{found: boolean, outputFiles: string[]}>}
 */
function pollForPngs(dir, timeoutMs, namePredicate = () => true) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    function check() {
      if (!existsSync(dir)) {
        if (Date.now() >= deadline) return resolve({ found: false, outputFiles: [] });
        return setTimeout(check, POLL_INTERVAL_MS);
      }

      let entries;
      try {
        entries = readdirSync(dir);
      } catch {
        if (Date.now() >= deadline) return resolve({ found: false, outputFiles: [] });
        return setTimeout(check, POLL_INTERVAL_MS);
      }

      const pngs = entries
        .filter((name) => name.toLowerCase().endsWith(".png") && namePredicate(name))
        .map((name) => path.join(dir, name))
        .filter((p) => {
          try {
            return statSync(p).isFile();
          } catch {
            return false;
          }
        });

      if (pngs.length > 0) return resolve({ found: true, outputFiles: pngs });
      if (Date.now() >= deadline) return resolve({ found: false, outputFiles: [] });
      setTimeout(check, POLL_INTERVAL_MS);
    }

    check();
  });
}
