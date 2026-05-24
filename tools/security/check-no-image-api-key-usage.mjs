#!/usr/bin/env node
/**
 * Security Guard: Check for Forbidden Image API Key Usage
 *
 * Scans tool files to ensure no code contains references to external image
 * generation API credentials or endpoints. Fails with exit 1 if any match found.
 *
 * Forbidden patterns (case-sensitive unless noted):
 *   - OPENAI_API_KEY (as assignment or usage, not just documentation "forbidden" mentions)
 *   - api.openai.com
 *   - images.generate  (OpenAI image API method)
 *   - dall-e           (case insensitive)
 *   - "Authorization": "Bearer sk-  (bearer token pattern in JSON)
 *
 * Exception: lines that also contain the word "forbidden" or "DO NOT" are
 * treated as documentation examples and are not flagged.
 *
 * Usage:
 *   node tools/security/check-no-image-api-key-usage.mjs [--help]
 *   node tools/security/check-no-image-api-key-usage.mjs --files tools/path/file.mjs
 *   node tools/security/check-no-image-api-key-usage.mjs --files "tools/**"
 *
 * Defaults to scanning the tools/ directory recursively if no --files arg is given.
 * Exit 0 if clean.
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultScanDir = path.join(repoRoot, "tools");

function printHelp() {
  console.log(`Security Guard: Check for Forbidden Image API Key Usage

Scans for hardcoded OpenAI credentials, API endpoints, or DALL-E references
that must not appear in tool code.

Usage:
  node tools/security/check-no-image-api-key-usage.mjs
  node tools/security/check-no-image-api-key-usage.mjs --files <path> [--files <path> ...]
  node tools/security/check-no-image-api-key-usage.mjs --help

Flags:
  --files <path>   File or directory path to scan (may be repeated; default: tools/)
  --help           Show this help

Forbidden patterns:
  OPENAI_API_KEY          as assignment or usage (not documentation-only)
  api.openai.com          external API endpoint
  images.generate         OpenAI image API method
  dall-e                  DALL-E model reference (case insensitive)
  "Authorization": "Bearer sk-   Bearer token in JSON

Exception: lines also containing "forbidden" or "DO NOT" are allowed
(documentation examples showing what NOT to do).

Exit 0 if clean. Exit 1 if any matches found.
`);
}

// ---------------------------------------------------------------------------
// Forbidden pattern definitions
// ---------------------------------------------------------------------------

const FORBIDDEN_PATTERNS = [
  {
    id: "openai-api-key",
    label: "OPENAI_API_KEY assignment or usage",
    // Matches OPENAI_API_KEY when used as an assignment target or referenced in code.
    // Does NOT match if the line is clearly a documentation-only "forbidden" mention
    // (handled by the exemption check below).
    test: (line) => /\bOPENAI_API_KEY\b/.test(line),
  },
  {
    id: "openai-api-domain",
    label: "api.openai.com endpoint",
    test: (line) => /api\.openai\.com/.test(line),
  },
  {
    id: "openai-images-generate",
    label: "images.generate (OpenAI image API method)",
    test: (line) => /\bimages\.generate\b/.test(line),
  },
  {
    id: "dall-e-reference",
    label: "dall-e model reference (case insensitive)",
    test: (line) => /dall-e/i.test(line),
  },
  {
    id: "bearer-sk-token",
    label: '"Authorization": "Bearer sk- (hardcoded bearer token in JSON)',
    test: (line) => /"Authorization"\s*:\s*"Bearer\s+sk-/.test(line),
  },
];

/**
 * Returns true if the line is a documentation-only exemption.
 *
 * Exemption criteria (per spec):
 *   - Line contains the word "forbidden" (case-insensitive)
 *   - Line contains "DO NOT"
 *
 * This allows documentation comments and pattern-table strings that describe
 * what is forbidden without actually using the patterns in executable code.
 *
 * @param {string} line
 * @returns {boolean}
 */
function isExemptLine(line) {
  return /forbidden/i.test(line) || /DO NOT/.test(line);
}

/**
 * Returns true if the file should be excluded from scanning entirely.
 * The security guard script itself contains the forbidden pattern strings
 * as data (in its pattern table) — it is not misusing them.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isSelfExcluded(filePath) {
  // The scanner excludes itself to avoid false positives from its own pattern table.
  const selfPath = fileURLToPath(import.meta.url);
  return path.resolve(filePath) === path.resolve(selfPath);
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/**
 * Recursively collects all files under a directory.
 * @param {string} dirPath
 * @returns {string[]}
 */
function collectFilesRecursive(dirPath) {
  if (!existsSync(dirPath)) return [];

  const stat = statSync(dirPath);
  if (stat.isFile()) return [dirPath];
  if (!stat.isDirectory()) return [];

  const results = [];
  for (const entry of readdirSync(dirPath)) {
    const full = path.join(dirPath, entry);
    try {
      const s = statSync(full);
      if (s.isFile()) {
        results.push(full);
      } else if (s.isDirectory()) {
        results.push(...collectFilesRecursive(full));
      }
    } catch {
      // skip unreadable entries
    }
  }
  return results;
}

/**
 * Resolves a --files argument to a list of file paths.
 * If the path is a directory, recurse. If a file, return it directly.
 * Simple glob support: trailing "**" or "*" suffix expands to directory scan.
 *
 * @param {string} fileArg
 * @returns {string[]}
 */
function resolveFilesArg(fileArg) {
  // Strip simple glob suffixes and treat as directory scan
  const cleaned = fileArg.replace(/\/?\*+$/, "");
  const resolved = path.resolve(repoRoot, cleaned);

  if (!existsSync(resolved)) {
    console.warn(`Warning: Path not found, skipping: ${fileArg}`);
    return [];
  }

  return collectFilesRecursive(resolved);
}

// ---------------------------------------------------------------------------
// Scan logic
// ---------------------------------------------------------------------------

/**
 * Scans a single file for forbidden patterns.
 * @param {string} filePath
 * @returns {{ filePath: string, findings: { line: number, pattern: object, text: string }[] }}
 */
function scanFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return { filePath, findings: [], readError: true };
  }

  const lines = content.split(/\r?\n/);
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip exempted documentation lines
    if (isExemptLine(line)) continue;

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          line: i + 1,
          pattern,
          text: line.trim(),
        });
        // Report each pattern only once per line (don't double-report)
        break;
      }
    }
  }

  return { filePath, findings };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function sanitizeForOutput(value) {
  return value
    .replace(/[A-Za-z]:[\\/][^\s]+/g, "<host-path>")
    .replace(/\/(?:Users|home)\/[^\s]+/g, "<host-path>")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "<redacted-secret>")
    .replace(/ghp_[A-Za-z0-9_]{8,}/g, "<redacted-token>")
    .replace(/github_pat_[A-Za-z0-9_]{8,}/g, "<redacted-token>");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { files: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === "--files" && val) { args.files.push(val); i++; }
    else if (flag === "--help" || flag === "-h") { args.help = true; }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Collect files to scan
  let filesToScan;
  if (args.files.length > 0) {
    filesToScan = args.files.flatMap(resolveFilesArg);
  } else {
    filesToScan = collectFilesRecursive(defaultScanDir);
  }

  // Deduplicate
  filesToScan = [...new Set(filesToScan)];

  if (filesToScan.length === 0) {
    console.log("No files to scan.");
    process.exit(0);
  }

  // Scan all files
  const allFindings = [];
  let errorCount = 0;
  let excludedCount = 0;

  for (const filePath of filesToScan) {
    // Skip this scanner script itself — its pattern table contains the forbidden
    // strings as data, not as executable code. DO NOT flag the scanner itself.
    if (isSelfExcluded(filePath)) {
      excludedCount++;
      continue;
    }
    const result = scanFile(filePath);
    if (result.readError) {
      errorCount++;
      continue;
    }
    if (result.findings.length > 0) {
      allFindings.push(result);
    }
  }

  // Report results
  if (allFindings.length === 0) {
    console.log(`check-no-image-api-key-usage: PASSED`);
    console.log(`  Scanned: ${filesToScan.length} file(s)`);
    if (errorCount > 0) {
      console.warn(`  Warning: ${errorCount} file(s) could not be read.`);
    }
    process.exit(0);
  }

  // Failures
  console.error(`check-no-image-api-key-usage: FAILED`);
  console.error(
    `Found forbidden image API references in ${allFindings.length} file(s).\n`,
  );

  for (const result of allFindings) {
    const relPath = path.relative(repoRoot, result.filePath);
    console.error(`  ${relPath}`);
    for (const finding of result.findings) {
      console.error(
        `    Line ${finding.line}: [${finding.pattern.id}] ${finding.pattern.label}`,
      );
      console.error(`      ${sanitizeForOutput(finding.text)}`);
    }
  }

  console.error(`\nForbidden patterns:`);
  for (const p of FORBIDDEN_PATTERNS) {
    console.error(`  - ${p.id}: ${p.label}`);
  }
  console.error(`\nException: lines containing "forbidden" or "DO NOT" are allowed (documentation).`);
  console.error(`\nTo fix: remove or replace external API references with local-only alternatives.`);

  process.exit(1);
}

main();
