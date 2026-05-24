#!/usr/bin/env node
/**
 * Portrait Expression Intake
 *
 * Organizes expression candidate PNG files from GEN2 bridge output into
 * the resident's incoming/expressions/ folder.
 *
 * Steps:
 *   1. Validate slug
 *   2. Find PNG files named neutral/happy/angry/sad/surprised in --source-dir
 *   3. Validate PNG signature (first 8 bytes)
 *   4. Validate dimensions >= 100×100 (parse IHDR chunk)
 *   5. Copy to assets/generated/residents/<slug>/incoming/expressions/
 *   6. Write expression-manifest.candidate.json
 *
 * Rejects non-PNG files with exit 1.
 * Output directory (assets/generated/) is gitignored.
 *
 * Usage:
 *   node tools/sidekick/portrait-expression-intake.mjs \\
 *     --slug <slug> --source-dir <dir> [--dry-run]
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;

const EXPECTED_EXPRESSIONS = ["neutral", "happy", "angry", "sad", "surprised"];
const MIN_DIMENSION = 100;

function printHelp() {
  console.log(`Portrait Expression Intake

Organizes expression candidate PNG files from GEN2 bridge output.

Usage:
  node tools/sidekick/portrait-expression-intake.mjs \\
    --slug <slug> \\
    --source-dir <dir> \\
    [--dry-run]

Arguments:
  --slug        Character slug (e.g. "ryo")
  --source-dir  Directory containing neutral.png, happy.png, angry.png, sad.png, surprised.png
  --dry-run     Validate only; do not copy files or write manifest
  --help        Show this help

Expected files in --source-dir:
  neutral.png, happy.png, angry.png, sad.png, surprised.png

Output (gitignored):
  assets/generated/residents/<slug>/incoming/expressions/*.png
  assets/generated/residents/<slug>/incoming/expressions/expression-manifest.candidate.json

Rejects any file that is not a valid PNG (exit 1).
Rejects any file with dimensions smaller than ${MIN_DIMENSION}×${MIN_DIMENSION} (exit 1).
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === "--slug" && val) { args.slug = val; i++; }
    else if (flag === "--source-dir" && val) { args.sourceDir = val; i++; }
    else if (flag === "--dry-run") { args.dryRun = true; }
    else if (flag === "--help" || flag === "-h") { args.help = true; }
  }
  return args;
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

/**
 * Validates PNG signature (first 8 bytes) and parses IHDR dimensions.
 * Returns { valid: true, width, height } or { valid: false, reason }.
 *
 * @param {string} filePath
 * @returns {{ valid: boolean, width?: number, height?: number, reason?: string }}
 */
function readPngInfo(filePath) {
  let bytes;
  try {
    bytes = readFileSync(filePath);
  } catch (err) {
    return { valid: false, reason: `Cannot read file: ${err.message}` };
  }

  // Validate PNG signature (bytes 0–7)
  if (bytes.length < 29) {
    return { valid: false, reason: "File too small to be a valid PNG." };
  }
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return {
        valid: false,
        reason: `Invalid PNG signature. First 8 bytes do not match the PNG magic number.`,
      };
    }
  }

  // IHDR chunk starts at byte 8:
  //   bytes  8–11: chunk length (4 bytes)
  //   bytes 12–15: chunk type "IHDR"
  //   bytes 16–19: width (uint32 BE)
  //   bytes 20–23: height (uint32 BE)
  const chunkType = bytes.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    return { valid: false, reason: `Expected IHDR as first PNG chunk, got "${chunkType}".` };
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);

  return { valid: true, width, height };
}

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

  if (!args.sourceDir) {
    console.error("Error: --source-dir is required.");
    process.exit(1);
  }

  const sourceDirResolved = path.resolve(repoRoot, args.sourceDir);
  if (!existsSync(sourceDirResolved)) {
    console.error(`Error: --source-dir not found: ${args.sourceDir}`);
    process.exit(1);
  }
  if (!statSync(sourceDirResolved).isDirectory()) {
    console.error(`Error: --source-dir is not a directory: ${args.sourceDir}`);
    process.exit(1);
  }

  const slug = args.slug;

  // --- Locate expression PNG files ---
  const sourceDirEntries = readdirSync(sourceDirResolved);

  const expressionResults = [];
  let hasError = false;

  for (const expr of EXPECTED_EXPRESSIONS) {
    const expectedFilename = `${expr}.png`;
    const found = sourceDirEntries.find(
      (name) => name.toLowerCase() === expectedFilename,
    );

    if (!found) {
      console.error(`Error: Required file "${expectedFilename}" not found in ${args.sourceDir}`);
      hasError = true;
      continue;
    }

    const filePath = path.join(sourceDirResolved, found);

    // Reject if not a regular file
    if (!statSync(filePath).isFile()) {
      console.error(`Error: "${found}" is not a regular file.`);
      hasError = true;
      continue;
    }

    // Reject non-PNG extension (belt-and-suspenders alongside signature check)
    if (!found.toLowerCase().endsWith(".png")) {
      console.error(`Error: "${found}" is not a PNG file. Only .png files are accepted.`);
      hasError = true;
      continue;
    }

    // Validate PNG signature and dimensions
    const pngInfo = readPngInfo(filePath);
    if (!pngInfo.valid) {
      console.error(`Error: "${found}" is not a valid PNG — ${pngInfo.reason}`);
      hasError = true;
      continue;
    }

    if (pngInfo.width < MIN_DIMENSION || pngInfo.height < MIN_DIMENSION) {
      console.error(
        `Error: "${found}" dimensions ${pngInfo.width}×${pngInfo.height} are below ` +
          `the minimum ${MIN_DIMENSION}×${MIN_DIMENSION} required for expressions.`,
      );
      hasError = true;
      continue;
    }

    expressionResults.push({
      expression: expr,
      sourceFile: filePath,
      filename: expectedFilename,
      width: pngInfo.width,
      height: pngInfo.height,
    });
  }

  if (hasError) {
    console.error("\nExpression intake failed due to validation errors above.");
    process.exit(1);
  }

  // --- Dry-run output ---
  if (args.dryRun) {
    console.log(`\n[dry-run] Portrait Expression Intake for "${slug}"`);
    console.log(`  source-dir: ${args.sourceDir}`);
    console.log(`  Expressions found and validated:`);
    for (const r of expressionResults) {
      console.log(`    ${r.filename}  (${r.width}×${r.height})`);
    }
    console.log(
      `\n  Would copy to: assets/generated/residents/${slug}/incoming/expressions/`,
    );
    console.log(
      `  Would write:   assets/generated/residents/${slug}/incoming/expressions/expression-manifest.candidate.json`,
    );
    console.log(`\n[dry-run] No files written.`);
    process.exit(0);
  }

  // --- Copy files to incoming/expressions/ ---
  // assets/generated/ is gitignored
  const destDir = path.join(
    repoRoot,
    "assets",
    "generated",
    "residents",
    slug,
    "incoming",
    "expressions",
  );
  ensureDir(destDir);

  const manifestExpressions = {};

  for (const r of expressionResults) {
    const destPath = path.join(destDir, r.filename);
    copyFileSync(r.sourceFile, destPath);
    console.log(`  Copied: ${r.filename}  (${r.width}×${r.height})`);

    manifestExpressions[r.expression] = {
      file: r.filename,
      width: r.width,
      height: r.height,
      validPngSignature: true,
    };
  }

  // --- Write expression-manifest.candidate.json ---
  const manifestPath = path.join(destDir, "expression-manifest.candidate.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        candidateOnly: true,
        adoptedAt: null,
        slug,
        createdAt: new Date().toISOString(),
        expressions: manifestExpressions,
      },
      null,
      2,
    ) + "\n",
  );

  const manifestRel = path.relative(repoRoot, manifestPath);
  const destRel = path.relative(repoRoot, destDir);

  console.log(`\nPortrait expression intake complete.`);
  console.log(`  slug:          ${slug}`);
  console.log(`  expressions:   ${expressionResults.length}`);
  console.log(`  destDir:       ${destRel}/`);
  console.log(`  manifest:      ${manifestRel}`);
  console.log(
    `\nNote: These are candidates only (candidateOnly: true). Use the adopt step to promote them.`,
  );
  console.log(``);
}

main().catch((err) => {
  console.error(`\nFatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
