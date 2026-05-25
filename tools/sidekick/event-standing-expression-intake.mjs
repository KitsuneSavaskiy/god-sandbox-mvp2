#!/usr/bin/env node
/**
 * Event Standing Expression Intake
 *
 * Organizes event standing expression candidate PNG files from GEN2 bridge output
 * into the resident's incoming/event-expressions/ folder.
 *
 * Key differences from portrait-expression-intake.mjs:
 *   - Required expressions: neutral, happy, angry, sad, surprised, worried, determined, shocked
 *   - Strict alpha requirement: PNG colorType must be 4 (grayscale+alpha) or 6 (RGBA)
 *   - Same-dimensions check: all files must have identical width and height
 *   - Output dir: assets/generated/residents/<slug>/incoming/event-expressions/
 *   - Manifest: event-expression-manifest.candidate.json with { candidateOnly: true, adopted: false }
 *
 * Steps:
 *   1. Validate slug
 *   2. Find PNG files named with expected expressions in --source-dir
 *   3. Validate PNG signature (first 8 bytes)
 *   4. Validate alpha channel (colorType must be 4 or 6)
 *   5. Validate all files have same dimensions
 *   6. Copy to assets/generated/residents/<slug>/incoming/event-expressions/
 *   7. Write event-expression-manifest.candidate.json
 *
 * Security: Refuses to write to public/art/** (throws SECURITY error).
 *
 * Usage:
 *   node tools/sidekick/event-standing-expression-intake.mjs \
 *     --slug <slug> \
 *     --source-dir <dir-with-pngs> \
 *     [--dry-run] \
 *     [--help]
 */

import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;

const REQUIRED_EXPRESSIONS = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "surprised",
  "worried",
  "determined",
  "shocked",
];

// ---------------------------------------------------------------------------
// Security guard
// ---------------------------------------------------------------------------

/**
 * SECURITY: Refuse to write to public/art/**
 * @param {string} outputDir
 */
function assertOutputBoundary(outputDir) {
  const rel = path.relative(repoRoot, path.resolve(outputDir)).replace(/\\/g, "/");
  if (rel.startsWith("public/art/")) {
    throw new Error(`SECURITY: Refusing to write event expression output to ${rel}`);
  }
}

// ---------------------------------------------------------------------------
// PNG header reading
// ---------------------------------------------------------------------------

/**
 * Reads the first 26 bytes of a PNG file to extract header information.
 * Returns width, height, bitDepth, colorType, and hasAlpha.
 *
 * colorType 4 = grayscale+alpha, colorType 6 = RGBA (both have alpha).
 *
 * @param {string} filePath
 * @returns {{ width: number, height: number, bitDepth: number, colorType: number, hasAlpha: boolean }}
 */
function readPngHeader(filePath) {
  const buf = Buffer.alloc(26);
  const fd = openSync(filePath, "r");
  try {
    readSync(fd, buf, 0, 26, 0);
  } finally {
    closeSync(fd);
  }

  // Check PNG signature (first 8 bytes)
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIG[i]) {
      throw new Error(`Not a valid PNG: invalid signature in "${path.basename(filePath)}"`);
    }
  }

  // IHDR chunk starts at byte 8:
  //   bytes  8-11: chunk length (4 bytes, big-endian)
  //   bytes 12-15: chunk type "IHDR"
  //   bytes 16-19: width (uint32 BE)
  //   bytes 20-23: height (uint32 BE)
  //   byte  24:    bit depth
  //   byte  25:    color type
  const chunkType = buf.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    throw new Error(`Not a valid PNG: expected IHDR chunk, got "${chunkType}" in "${path.basename(filePath)}"`);
  }

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const hasAlpha = colorType === 4 || colorType === 6;

  return { width, height, bitDepth, colorType, hasAlpha };
}

// ---------------------------------------------------------------------------
// CLI help and arg parsing
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`Event Standing Expression Intake

Organizes event standing expression candidate PNG files from GEN2 bridge output.
All PNG files MUST have an alpha channel (colorType 4 or 6).
All PNG files MUST have identical dimensions.

Usage:
  node tools/sidekick/event-standing-expression-intake.mjs \\
    --slug <slug> \\
    --source-dir <dir> \\
    [--dry-run] \\
    [--help]

Arguments:
  --slug        Character slug (e.g. "ryo")
  --source-dir  Directory containing the 8 required expression PNGs (with alpha)
  --dry-run     Validate only; do not copy files or write manifest
  --help        Show this help

Required files in --source-dir (all must have alpha channel):
  ${REQUIRED_EXPRESSIONS.map((e) => `${e}.png`).join(", ")}

Output (gitignored):
  assets/generated/residents/<slug>/incoming/event-expressions/*.png
  assets/generated/residents/<slug>/incoming/event-expressions/event-expression-manifest.candidate.json

Security:
  Refuses to write to public/art/** (SECURITY error).

Rejects any PNG without alpha channel (colorType must be 4 or 6).
Rejects if any files have differing dimensions.
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

  // Security guard on output dir
  const destDir = path.join(
    repoRoot,
    "assets",
    "generated",
    "residents",
    slug,
    "incoming",
    "event-expressions",
  );
  assertOutputBoundary(destDir);

  // --- Locate expression PNG files ---
  const sourceDirEntries = readdirSync(sourceDirResolved);

  const expressionResults = [];
  let hasError = false;

  for (const expr of REQUIRED_EXPRESSIONS) {
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

    // Reject non-PNG extension
    if (!found.toLowerCase().endsWith(".png")) {
      console.error(`Error: "${found}" is not a PNG file. Only .png files are accepted.`);
      hasError = true;
      continue;
    }

    // Read PNG header and validate alpha
    let pngHeader;
    try {
      pngHeader = readPngHeader(filePath);
    } catch (err) {
      console.error(`Error: "${found}" — ${err.message}`);
      hasError = true;
      continue;
    }

    // Strict alpha requirement
    if (!pngHeader.hasAlpha) {
      console.error(
        `Error: "${found}" does not have an alpha channel (colorType=${pngHeader.colorType}). ` +
          `Event standing expressions require PNG colorType 4 (grayscale+alpha) or 6 (RGBA). ` +
          `Rejected.`,
      );
      hasError = true;
      continue;
    }

    expressionResults.push({
      expression: expr,
      sourceFile: filePath,
      filename: expectedFilename,
      width: pngHeader.width,
      height: pngHeader.height,
      bitDepth: pngHeader.bitDepth,
      colorType: pngHeader.colorType,
    });
  }

  if (hasError) {
    console.error("\nEvent standing expression intake failed due to validation errors above.");
    process.exit(1);
  }

  // --- Same-dimensions check ---
  if (expressionResults.length > 1) {
    const refWidth = expressionResults[0].width;
    const refHeight = expressionResults[0].height;
    const mismatch = expressionResults.find(
      (r) => r.width !== refWidth || r.height !== refHeight,
    );
    if (mismatch) {
      console.error(
        `Error: Dimension mismatch detected. All event standing expression files must have identical dimensions.\n` +
          `  "${expressionResults[0].filename}": ${refWidth}×${refHeight}\n` +
          `  "${mismatch.filename}": ${mismatch.width}×${mismatch.height}`,
      );
      process.exit(1);
    }
  }

  const dimensions =
    expressionResults.length > 0
      ? `${expressionResults[0].width}×${expressionResults[0].height}`
      : "unknown";

  // --- Dry-run output ---
  if (args.dryRun) {
    console.log(`\n[dry-run] Event Standing Expression Intake for "${slug}"`);
    console.log(`  source-dir: ${args.sourceDir}`);
    console.log(`  Expressions found and validated (all have alpha):`);
    for (const r of expressionResults) {
      console.log(`    ${r.filename}  (${r.width}×${r.height}, colorType=${r.colorType})`);
    }
    console.log(`  All dimensions: ${dimensions}`);
    console.log(
      `\n  Would copy to: assets/generated/residents/${slug}/incoming/event-expressions/`,
    );
    console.log(
      `  Would write:   assets/generated/residents/${slug}/incoming/event-expressions/event-expression-manifest.candidate.json`,
    );
    console.log(`\n[dry-run] No files written.`);
    process.exit(0);
  }

  // --- Copy files to incoming/event-expressions/ ---
  // assets/generated/ is gitignored
  ensureDir(destDir);

  const manifestExpressions = {};

  for (const r of expressionResults) {
    const destPath = path.join(destDir, r.filename);
    copyFileSync(r.sourceFile, destPath);
    console.log(`  Copied: ${r.filename}  (${r.width}×${r.height}, colorType=${r.colorType})`);

    manifestExpressions[r.expression] = {
      file: r.filename,
      width: r.width,
      height: r.height,
      bitDepth: r.bitDepth,
      colorType: r.colorType,
      hasAlpha: true,
      validPngSignature: true,
    };
  }

  // --- Write event-expression-manifest.candidate.json ---
  const manifestPath = path.join(destDir, "event-expression-manifest.candidate.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        candidateOnly: true,
        adopted: false,
        slug,
        createdAt: new Date().toISOString(),
        dimensions,
        expressions: manifestExpressions,
      },
      null,
      2,
    ) + "\n",
  );

  const manifestRel = path.relative(repoRoot, manifestPath);
  const destRel = path.relative(repoRoot, destDir);

  console.log(`\nEvent standing expression intake complete.`);
  console.log(`  slug:          ${slug}`);
  console.log(`  expressions:   ${expressionResults.length}`);
  console.log(`  dimensions:    ${dimensions}`);
  console.log(`  destDir:       ${destRel}/`);
  console.log(`  manifest:      ${manifestRel}`);
  console.log(
    `\nNote: These are candidates only (candidateOnly: true, adopted: false). Use the adopt step to promote them.`,
  );
  console.log(``);
}

main().catch((err) => {
  console.error(`\nFatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
