#!/usr/bin/env node
/**
 * Portrait path safety validator for the Sprint9-5 asset generation pipeline.
 * Called by asset-generation-server.mjs before creating a job.
 *
 * All checks are local and synchronous; no external I/O beyond reading the first 8 bytes.
 */

import { existsSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Validates a portraitPath for safety and filesystem existence.
 *
 * Checks (in order):
 *   1. Not an absolute path
 *   2. No '..' traversal segments
 *   3. Resolves within repoRoot (repo boundary)
 *   4. File exists at the resolved path
 *   5. File has a valid PNG signature (first 8 bytes = 89 50 4E 47 0D 0A 1A 0A)
 *
 * @param {string} portraitPath - repo-relative path (e.g. "assets/generated/residents/.../portrait.png")
 * @param {string} repoRoot - absolute path to repository root
 * @returns {string|null} error message if invalid, null if all checks pass
 */
export function validatePortraitPathFilesystem(portraitPath, repoRoot) {
  if (path.isAbsolute(portraitPath)) {
    return "portraitPath must be a relative path, not an absolute path.";
  }

  const parts = portraitPath.replace(/\\/g, "/").split("/");
  if (parts.includes("..")) {
    return "portraitPath must not contain '..' path traversal segments.";
  }

  const repoRootAbs = path.resolve(repoRoot);
  const absPath = path.resolve(repoRootAbs, portraitPath);
  if (!absPath.startsWith(repoRootAbs + path.sep) && absPath !== repoRootAbs) {
    return "portraitPath must resolve within the repository root (path escapes repo boundary).";
  }

  if (!existsSync(absPath)) {
    return `portraitPath does not exist: ${portraitPath}`;
  }

  let fd;
  try {
    fd = openSync(absPath, "r");
    const sigBuf = Buffer.alloc(8);
    const bytesRead = readSync(fd, sigBuf, 0, 8, 0);
    if (bytesRead < 8 || !sigBuf.equals(PNG_SIGNATURE)) {
      return "portraitPath does not contain a valid PNG file (invalid PNG signature).";
    }
  } catch (err) {
    return `portraitPath could not be read: ${err.message}`;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* ignore close errors */ }
    }
  }

  return null;
}
