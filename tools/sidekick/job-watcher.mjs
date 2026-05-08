#!/usr/bin/env node
/**
 * Sidekick Job Watcher
 *
 * Polls .godsandbox/jobs/ every 2 seconds for new *-request.json files
 * and calls sidekick:intake to process them.
 *
 * Usage: npm run sidekick:watch
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const jobsDir = path.join(repoRoot, ".godsandbox", "jobs");
const doneDir = path.join(jobsDir, "done");
const failedDir = path.join(jobsDir, "failed");
const intakeScript = path.join(repoRoot, "tools", "sidekick", "sidekick-intake.mjs");

const processing = new Set();

const DEFAULT_JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const SIGKILL_GRACE_MS = 5_000;
const rawTimeout = Number(process.env.SIDEKICK_JOB_TIMEOUT_MS);
const JOB_TIMEOUT_MS = Number.isFinite(rawTimeout) && rawTimeout > 0
  ? rawTimeout
  : DEFAULT_JOB_TIMEOUT_MS;

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function processRequest(filename) {
  if (!filename.endsWith("-request.json")) return;
  if (processing.has(filename)) return;

  const filePath = path.join(jobsDir, filename);
  if (!existsSync(filePath)) return;

  processing.add(filename);

  try {
    let request;
    try {
      request = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (e) {
      console.error(`[watcher] Failed to parse ${filename}: ${e.message}`);
      ensureDir(failedDir);
      renameSync(filePath, path.join(failedDir, filename));
      return;
    }

    const { slug, displayName, personality, tone, age, portraitPath } = request;

    if (!slug || !displayName || !portraitPath) {
      console.error(`[watcher] Missing required fields in ${filename} (slug, displayName, portraitPath required)`);
      ensureDir(failedDir);
      renameSync(filePath, path.join(failedDir, filename));
      return;
    }

    console.log(`[watcher] Processing: ${displayName} (${slug})`);

    const args = [
      intakeScript,
      "--slug", slug,
      "--name", displayName,
      "--personality", personality ?? "",
      "--tone", tone ?? "",
      "--age", String(age ?? 0),
      "--portrait", portraitPath,
    ];

    await new Promise((resolve, reject) => {
      const proc = spawn("node", args, { cwd: repoRoot, stdio: "inherit" });
      let settled = false;

      const killTimer = setTimeout(() => {
        if (settled) return;
        console.error(`[watcher] Timeout (${JOB_TIMEOUT_MS}ms): sending SIGTERM to ${filename}`);
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (settled) return;
          console.error(`[watcher] Grace period elapsed: sending SIGKILL to ${filename}`);
          proc.kill("SIGKILL");
        }, SIGKILL_GRACE_MS);
      }, JOB_TIMEOUT_MS);

      proc.on("close", (code) => {
        settled = true;
        clearTimeout(killTimer);
        if (code === 0) resolve();
        else reject(new Error(`sidekick:intake exited with code ${code}`));
      });
      proc.on("error", (err) => {
        settled = true;
        clearTimeout(killTimer);
        reject(err);
      });
    });

    ensureDir(doneDir);
    renameSync(filePath, path.join(doneDir, filename));
    console.log(`[watcher] Done: ${filename}`);
  } catch (error) {
    console.error(`[watcher] Failed: ${error.message}`);
    try {
      ensureDir(failedDir);
      if (existsSync(path.join(jobsDir, filename))) {
        renameSync(path.join(jobsDir, filename), path.join(failedDir, filename));
      }
    } catch {
      // already moved or deleted
    }
  } finally {
    processing.delete(filename);
  }
}

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

function main() {
  ensureDir(jobsDir);
  console.log(`[watcher] Watching ${path.relative(repoRoot, jobsDir)}/`);
  console.log(`[watcher] Polling every 2 seconds for *-request.json files`);

  pollJobsDir();
  setInterval(pollJobsDir, 2000);
}

main();
