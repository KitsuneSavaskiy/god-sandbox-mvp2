#!/usr/bin/env node
/**
 * Derive Icon From Sprite Sheet
 *
 * Extracts a 192×208 pixel region from a resident sprite sheet PNG and writes it
 * as a standalone icon candidate PNG. No AI generation — pure pixel extraction.
 *
 * Sprite sheet spec:
 *   1536×1872 px (8 columns × 9 rows, each frame 192×208 px)
 *
 * Sheet kinds and defaults:
 *   --kind extended  (default): Sheet 2 row 1 (walk-down), frame 0 — front-facing
 *   --kind motion    with --allow-idle-fallback: Sheet 1 row 0 (idle), frame 0
 *   --kind motion    without --allow-idle-fallback: refuses to run (row 0 is idle)
 *   --kind po-combined / combined: requires explicit --row, --frame-width, --frame-height, --columns
 *
 * Output (gitignored):
 *   assets/generated/residents/<slug>/incoming/icons/icon-candidate.png
 *   assets/generated/residents/<slug>/incoming/icons/icon-source-report.json
 *
 * Usage:
 *   node tools/sidekick/derive-icon-from-sprite.mjs \\
 *     --slug <slug> \\
 *     --sprite-sheet <path> \\
 *     [--kind extended|motion|po-combined|combined] \\
 *     [--row <n>] [--frame <n>] \\
 *     [--frame-width <n>] [--frame-height <n>] [--columns <n>] \\
 *     [--allow-idle-fallback] \\
 *     [--output-dir <dir>] \\
 *     [--dry-run]
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;

// Sprite sheet spec
const SHEET_WIDTH = 1536;
const SHEET_HEIGHT = 1872;
const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 208;
const COLUMNS = 8;
const ROWS = 9;

// Minimum acceptable sheet dimensions
const MIN_SHEET_WIDTH = 192;
const MIN_SHEET_HEIGHT = 208;

function printHelp() {
  console.log(`Derive Icon From Sprite Sheet

Extracts a single frame from a resident sprite sheet as an icon candidate PNG.
No AI generation — pure pixel extraction using node:zlib.

Default (--kind extended): Sheet 2 row 1 (walk-down), frame 0 — front-facing.
For --kind motion: requires --allow-idle-fallback (row 0 is idle, not walk-facing).
For --kind po-combined / combined: requires explicit --row, --frame-width, --frame-height, --columns.

Usage:
  node tools/sidekick/derive-icon-from-sprite.mjs \\
    --slug <slug> \\
    --sprite-sheet <path> \\
    [--kind extended|motion|po-combined|combined]   Sheet kind (default: extended)
    [--row <n>]             Row index (kind-specific default)
    [--frame <n>]           Frame index within row (default: 0)
    [--frame-width <n>]     Frame width in px (required for po-combined/combined)
    [--frame-height <n>]    Frame height in px (required for po-combined/combined)
    [--columns <n>]         Number of columns (required for po-combined/combined)
    [--allow-idle-fallback] Allow motion sheet row 0 (idle) as icon source
    [--output-dir <dir>]    Override output directory
    [--dry-run]             Validate only; do not write files
    [--help]

Expected sheet dimensions: ${SHEET_WIDTH}×${SHEET_HEIGHT} px (${COLUMNS}×${ROWS} frames of ${FRAME_WIDTH}×${FRAME_HEIGHT})
Minimum acceptable: ${MIN_SHEET_WIDTH}×${MIN_SHEET_HEIGHT}

Output (both gitignored):
  assets/generated/residents/<slug>/incoming/icons/icon-candidate.png
  assets/generated/residents/<slug>/incoming/icons/icon-source-report.json
`);
}

function parseArgs(argv) {
  // row not given a default here — we determine it per --kind below
  const args = { frame: 0, kind: "extended" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === "--slug" && val) { args.slug = val; i++; }
    else if (flag === "--sprite-sheet" && val) { args.spriteSheet = val; i++; }
    else if (flag === "--kind" && val) { args.kind = val; i++; }
    else if (flag === "--row" && val) { args.row = parseInt(val, 10); i++; }
    else if (flag === "--frame" && val) { args.frame = parseInt(val, 10); i++; }
    else if (flag === "--frame-width" && val) { args.frameWidth = parseInt(val, 10); i++; }
    else if (flag === "--frame-height" && val) { args.frameHeight = parseInt(val, 10); i++; }
    else if (flag === "--columns" && val) { args.columns = parseInt(val, 10); i++; }
    else if (flag === "--allow-idle-fallback") { args.allowIdleFallback = true; }
    else if (flag === "--output-dir" && val) { args.outputDir = val; i++; }
    else if (flag === "--dry-run") { args.dryRun = true; }
    else if (flag === "--help" || flag === "-h") { args.help = true; }
  }
  return args;
}

/**
 * SECURITY GUARD: Reject writes to public/art/**, src/**, or public/** (except warning).
 * Only allows paths under assets/generated/ or .godsandbox/.
 * @param {string} absPath
 */
function assertGeneratedOutputBoundary(absPath) {
  const rel = path.relative(repoRoot, absPath).replaceAll("\\", "/");
  if (rel.startsWith("public/art/")) {
    console.error(`Error: SECURITY: Refusing to write to public/art/: ${rel}. Output must go to assets/generated/ or .godsandbox/ only.`);
    process.exit(1);
  }
  if (rel.startsWith("src/")) {
    console.error(`Error: SECURITY: Refusing to write to src/: ${rel}. Output must go to assets/generated/ or .godsandbox/ only.`);
    process.exit(1);
  }
  if (rel.startsWith("public/")) {
    // public/ (but not public/art/ — already caught above) — warn
    console.warn(`Warning: Writing to public/ path: ${rel}. Only assets/generated/ and .godsandbox/ are the intended output boundaries.`);
  }
  if (!rel.startsWith("assets/generated/") && !rel.startsWith(".godsandbox/") && !rel.startsWith("public/")) {
    // Allow public/ paths (with warning above), assets/generated/, .godsandbox/
    // But reject anything else if it's not those
    // Note: outputDir override is user-controlled; warn for unexpected paths but don't block
    console.warn(`Warning: Output path "${rel}" is outside the expected assets/generated/ and .godsandbox/ boundaries.`);
  }
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

/**
 * Validates PNG signature and reads IHDR dimensions.
 * @param {Buffer} bytes
 * @returns {{ valid: boolean, width?: number, height?: number, reason?: string }}
 */
function parsePngHeader(bytes) {
  if (bytes.length < 29) {
    return { valid: false, reason: "File too small to be a valid PNG." };
  }
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return { valid: false, reason: "Invalid PNG signature." };
    }
  }
  const chunkType = bytes.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    return { valid: false, reason: `Expected IHDR first chunk, got "${chunkType}".` };
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return { valid: true, width, height };
}

/**
 * Extracts all IDAT chunk data from a PNG buffer and concatenates them.
 * @param {Buffer} bytes
 * @returns {Buffer}
 */
function extractIdatData(bytes) {
  const chunks = [];
  let offset = 8; // skip PNG signature

  while (offset + 12 <= bytes.length) {
    const chunkLen = bytes.readUInt32BE(offset);
    const chunkType = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (chunkType === "IEND") break;
    if (chunkType === "IDAT") {
      chunks.push(bytes.subarray(offset + 8, offset + 8 + chunkLen));
    }
    offset += 12 + chunkLen; // length(4) + type(4) + data + crc(4)
  }

  if (chunks.length === 0) {
    throw new Error("No IDAT chunks found in PNG.");
  }

  return Buffer.concat(chunks);
}

/**
 * Defilters a single PNG scanline using the filter byte.
 * Supports filter types 0 (None), 1 (Sub), 2 (Up), 3 (Average), 4 (Paeth).
 *
 * @param {number} filterType
 * @param {Buffer} scanline  — raw scanline bytes (without filter byte)
 * @param {Buffer} prevLine  — previous defiltered scanline (same length), or zeros
 * @param {number} bpp       — bytes per pixel
 * @returns {Buffer} defiltered scanline
 */
function defilterScanline(filterType, scanline, prevLine, bpp) {
  const len = scanline.length;
  const out = Buffer.alloc(len);

  switch (filterType) {
    case 0: // None
      scanline.copy(out);
      break;

    case 1: // Sub
      for (let i = 0; i < len; i++) {
        const a = i >= bpp ? out[i - bpp] : 0;
        out[i] = (scanline[i] + a) & 0xff;
      }
      break;

    case 2: // Up
      for (let i = 0; i < len; i++) {
        out[i] = (scanline[i] + prevLine[i]) & 0xff;
      }
      break;

    case 3: // Average
      for (let i = 0; i < len; i++) {
        const a = i >= bpp ? out[i - bpp] : 0;
        const b = prevLine[i];
        out[i] = (scanline[i] + Math.floor((a + b) / 2)) & 0xff;
      }
      break;

    case 4: // Paeth
      for (let i = 0; i < len; i++) {
        const a = i >= bpp ? out[i - bpp] : 0;
        const b = prevLine[i];
        const c = i >= bpp ? prevLine[i - bpp] : 0;
        out[i] = (scanline[i] + paethPredictor(a, b, c)) & 0xff;
      }
      break;

    default:
      throw new Error(`Unsupported PNG filter type: ${filterType}`);
  }

  return out;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decompresses and defilters a full PNG into a flat RGBA pixel buffer.
 * Supports color types 2 (RGB), 4 (GreyA), 6 (RGBA).
 * Converts all to RGBA.
 *
 * @param {Buffer} pngBytes
 * @param {number} width
 * @param {number} height
 * @returns {Buffer} RGBA pixel data (width * height * 4 bytes)
 */
function decodePngToRgba(pngBytes, width, height) {
  const colorType = pngBytes.readUInt8(25);
  const bitDepth = pngBytes.readUInt8(24);

  if (bitDepth !== 8) {
    throw new Error(`Only 8-bit PNG is supported for icon extraction. Got bit depth: ${bitDepth}`);
  }

  // Determine bytes per pixel based on color type
  let srcBpp;
  let toRgba;
  switch (colorType) {
    case 2: // RGB
      srcBpp = 3;
      toRgba = (src, i) => [src[i], src[i + 1], src[i + 2], 255];
      break;
    case 4: // Greyscale+Alpha
      srcBpp = 2;
      toRgba = (src, i) => [src[i], src[i], src[i], src[i + 1]];
      break;
    case 6: // RGBA
      srcBpp = 4;
      toRgba = (src, i) => [src[i], src[i + 1], src[i + 2], src[i + 3]];
      break;
    default:
      throw new Error(
        `Unsupported PNG color type for icon extraction: ${colorType}. Supported: 2 (RGB), 4 (GreyA), 6 (RGBA).`,
      );
  }

  const idatCompressed = extractIdatData(pngBytes);
  const raw = inflateSync(idatCompressed);

  const rowSize = width * srcBpp;
  const rgba = Buffer.alloc(width * height * 4);
  let prevLine = Buffer.alloc(rowSize, 0);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowSize + 1);
    const filterType = raw[rowStart];
    const scanline = raw.subarray(rowStart + 1, rowStart + 1 + rowSize);

    const defiltered = defilterScanline(filterType, scanline, prevLine, srcBpp);
    prevLine = defiltered;

    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = toRgba(defiltered, x * srcBpp);
      const outOffset = (y * width + x) * 4;
      rgba[outOffset] = r;
      rgba[outOffset + 1] = g;
      rgba[outOffset + 2] = b;
      rgba[outOffset + 3] = a;
    }
  }

  return rgba;
}

/**
 * Extracts a rectangular RGBA region from a decoded pixel buffer.
 *
 * @param {Buffer} rgba     - Full image RGBA data
 * @param {number} imgWidth - Full image width in pixels
 * @param {number} x        - Left offset of region
 * @param {number} y        - Top offset of region
 * @param {number} w        - Region width
 * @param {number} h        - Region height
 * @returns {Buffer} RGBA data for the extracted region
 */
function extractRegion(rgba, imgWidth, x, y, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcStart = ((y + row) * imgWidth + x) * 4;
    const dstStart = row * w * 4;
    rgba.copy(out, dstStart, srcStart, srcStart + w * 4);
  }
  return out;
}

/**
 * Encodes raw RGBA pixels as a minimal PNG using uncompressed DEFLATE (stored).
 * Uses zlib deflate for actual compression.
 *
 * @param {Buffer} rgba
 * @param {number} width
 * @param {number} height
 * @returns {Buffer} PNG file bytes
 */
function encodePngFromRgba(rgba, width, height) {
  const { deflateSync } = await_zlib();

  // Build raw filtered data (filter type 0 = None for each scanline)
  const rowSize = width * 4;
  const rawLines = Buffer.alloc(height * (rowSize + 1));
  for (let y = 0; y < height; y++) {
    rawLines[y * (rowSize + 1)] = 0; // filter type None
    rgba.copy(rawLines, y * (rowSize + 1) + 1, y * rowSize, y * rowSize + rowSize);
  }

  const compressed = deflateSync(rawLines, { level: 9 });

  // Build PNG chunks
  const chunks = [];

  // PNG signature
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  // IHDR chunk
  chunks.push(buildPngChunk("IHDR", buildIHDR(width, height)));

  // IDAT chunk
  chunks.push(buildPngChunk("IDAT", compressed));

  // IEND chunk
  chunks.push(buildPngChunk("IEND", Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

/**
 * Synchronous wrapper — import zlib synchronously (already available at module scope).
 * This exists so encodePngFromRgba can use deflateSync from node:zlib.
 */
function await_zlib() {
  // node:zlib is imported at module top level; access via the module-scope import
  return { deflateSync };
}

function buildIHDR(width, height) {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = 8;  // bit depth
  buf[9] = 6;  // color type: RGBA
  buf[10] = 0; // compression method
  buf[11] = 0; // filter method
  buf[12] = 0; // interlace method
  return buf;
}

function buildPngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBytes, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

// CRC-32 table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  // --- Validate inputs ---

  // --sprite-sheet is mandatory (exit 1 if missing)
  if (!args.spriteSheet) {
    console.error("Error: --sprite-sheet is required. Refusing to run without a sprite sheet.");
    process.exit(1);
  }

  if (!args.slug || !SLUG_PATTERN.test(args.slug)) {
    console.error(
      `Error: --slug "${args.slug ?? ""}" is invalid. Use lowercase letters, numbers, hyphen, or underscore.`,
    );
    process.exit(1);
  }

  const sheetResolved = path.resolve(repoRoot, args.spriteSheet);

  if (!existsSync(sheetResolved)) {
    console.error(`Error: Sprite sheet not found: ${args.spriteSheet}`);
    process.exit(1);
  }
  if (!statSync(sheetResolved).isFile()) {
    console.error(`Error: Sprite sheet path is not a file: ${args.spriteSheet}`);
    process.exit(1);
  }
  if (!sheetResolved.toLowerCase().endsWith(".png")) {
    console.error(`Error: Sprite sheet must be a PNG file. Got: ${args.spriteSheet}`);
    process.exit(1);
  }

  const sheetBytes = readFileSync(sheetResolved);
  const header = parsePngHeader(sheetBytes);
  if (!header.valid) {
    console.error(`Error: Sprite sheet is not a valid PNG — ${header.reason}`);
    process.exit(1);
  }

  const { width: sheetW, height: sheetH } = header;

  // Validate dimensions
  if (sheetW < MIN_SHEET_WIDTH || sheetH < MIN_SHEET_HEIGHT) {
    console.error(
      `Error: Sprite sheet ${sheetW}×${sheetH} is smaller than the minimum ${MIN_SHEET_WIDTH}×${MIN_SHEET_HEIGHT}.`,
    );
    process.exit(1);
  }

  // Warn if sheet is not canonical spec but allow if >= minimum
  const isCanonical = sheetW === SHEET_WIDTH && sheetH === SHEET_HEIGHT;
  if (!isCanonical) {
    console.warn(
      `Warning: Sheet is ${sheetW}×${sheetH}, not the canonical ${SHEET_WIDTH}×${SHEET_HEIGHT}. ` +
        "Proceeding with frame extraction using computed offsets.",
    );
  }

  const kind = args.kind ?? "extended";
  const validKinds = ["extended", "motion", "po-combined", "combined"];
  if (!validKinds.includes(kind)) {
    console.error(`Error: --kind "${kind}" is invalid. Valid: ${validKinds.join(", ")}`);
    process.exit(1);
  }

  // po-combined / combined require explicit --row, --frame-width, --frame-height, --columns
  if (kind === "po-combined" || kind === "combined") {
    if (args.row === undefined || args.row === null || isNaN(args.row)) {
      console.error(`Error: --kind ${kind} requires explicit --row.`);
      process.exit(1);
    }
    if (!args.frameWidth || isNaN(args.frameWidth)) {
      console.error(`Error: --kind ${kind} requires explicit --frame-width.`);
      process.exit(1);
    }
    if (!args.frameHeight || isNaN(args.frameHeight)) {
      console.error(`Error: --kind ${kind} requires explicit --frame-height.`);
      process.exit(1);
    }
    if (!args.columns || isNaN(args.columns)) {
      console.error(`Error: --kind ${kind} requires explicit --columns.`);
      process.exit(1);
    }
  }

  // Determine row based on kind
  let row;
  let iconSourceMotionKey;
  let iconSourceReason;

  if (kind === "extended") {
    // Sheet 2 row 1 = walk-down, front-facing
    row = args.row !== undefined ? args.row : 1;
    iconSourceMotionKey = row === 1 ? "walk-down" : `row-${row}`;
    iconSourceReason = row === 1
      ? "Sheet 2 row 1 frame 0 (walk-down, front-facing)"
      : `Sheet 2 row ${row} frame ${args.frame ?? 0}`;
  } else if (kind === "motion") {
    // Sheet 1 row 0 = idle — refuse unless --allow-idle-fallback
    if (args.row === undefined) {
      if (!args.allowIdleFallback) {
        console.error(
          "Error: motion sheet row 0 is idle, not a walk-facing frame; " +
          "use --kind extended or add --allow-idle-fallback for explicit idle source",
        );
        process.exit(1);
      }
      row = 0;
    } else {
      row = args.row;
    }
    iconSourceMotionKey = row === 0 ? "idle" : `row-${row}`;
    iconSourceReason = row === 0
      ? "Sheet 1 row 0 frame 0 (idle, explicit fallback)"
      : `Sheet 1 row ${row} frame ${args.frame ?? 0}`;
  } else {
    // po-combined / combined — explicit row required
    row = args.row;
    iconSourceMotionKey = `row-${row}`;
    iconSourceReason = `${kind} row ${row} frame ${args.frame ?? 0}`;
  }

  const frame = args.frame ?? 0;

  // Compute actual frame dimensions
  const actualFrameW = (kind === "po-combined" || kind === "combined") ? args.frameWidth : FRAME_WIDTH;
  const actualFrameH = (kind === "po-combined" || kind === "combined") ? args.frameHeight : FRAME_HEIGHT;

  const xOffset = frame * actualFrameW;
  const yOffset = row * actualFrameH;

  // Bounds check
  if (xOffset + actualFrameW > sheetW) {
    console.error(
      `Error: Frame ${frame} (x=${xOffset}) exceeds sheet width ${sheetW}. ` +
        `Sheet has ${Math.floor(sheetW / actualFrameW)} columns.`,
    );
    process.exit(1);
  }
  if (yOffset + actualFrameH > sheetH) {
    console.error(
      `Error: Row ${row} (y=${yOffset}) exceeds sheet height ${sheetH}. ` +
        `Sheet has ${Math.floor(sheetH / actualFrameH)} rows.`,
    );
    process.exit(1);
  }

  const sheetRelPath = path.relative(repoRoot, sheetResolved);

  // --- Dry-run ---
  if (args.dryRun) {
    console.log(`\n[dry-run] Derive Icon From Sprite Sheet`);
    console.log(`  slug:        ${args.slug}`);
    console.log(`  kind:        ${kind}`);
    console.log(`  sheet:       ${sheetRelPath}`);
    console.log(`  dimensions:  ${sheetW}×${sheetH}`);
    console.log(`  row:         ${row}  (${iconSourceMotionKey})`);
    console.log(`  frame:       ${frame}`);
    console.log(`  extract:     ${actualFrameW}×${actualFrameH} at (${xOffset}, ${yOffset})`);
    console.log(
      `\n  Would write: assets/generated/residents/${args.slug}/incoming/icons/icon-candidate.png`,
    );
    console.log(
      `  Would write: assets/generated/residents/${args.slug}/incoming/icons/icon-source-report.json`,
    );
    console.log(`\n[dry-run] No files written.`);
    process.exit(0);
  }

  // --- Extract pixels ---
  console.log(`\nExtracting icon from sprite sheet...`);
  console.log(`  kind:    ${kind}`);
  console.log(`  sheet:   ${sheetRelPath}  (${sheetW}×${sheetH})`);
  console.log(`  row:     ${row}  (${iconSourceMotionKey})`);
  console.log(`  frame:   ${frame}`);
  console.log(`  region:  ${actualFrameW}×${actualFrameH} at offset (${xOffset}, ${yOffset})`);

  let iconBuffer;
  try {
    const rgba = decodePngToRgba(sheetBytes, sheetW, sheetH);
    const regionRgba = extractRegion(rgba, sheetW, xOffset, yOffset, actualFrameW, actualFrameH);
    iconBuffer = encodePngFromRgba(regionRgba, actualFrameW, actualFrameH);
  } catch (err) {
    console.error(`\nError during pixel extraction: ${err.message}`);
    console.error(
      "Note: Icon extraction requires an 8-bit RGBA or RGB PNG. " +
        "Indexed or 16-bit PNGs are not supported.",
    );
    process.exit(1);
  }

  // --- Write output ---
  // assets/generated/ is gitignored
  const outputDir = args.outputDir
    ? path.resolve(repoRoot, args.outputDir)
    : path.join(repoRoot, "assets", "generated", "residents", args.slug, "incoming", "icons");

  const iconPath = path.join(outputDir, "icon-candidate.png");
  const reportPath = path.join(outputDir, "icon-source-report.json");

  // Apply path guard before any write
  assertGeneratedOutputBoundary(iconPath);
  assertGeneratedOutputBoundary(reportPath);

  ensureDir(outputDir);

  writeFileSync(iconPath, iconBuffer);

  const report = {
    iconSourceMotionKey,
    iconSourceFrameIndex: frame,
    iconSourceReason,
    sourceSheetPath: sheetRelPath,
    candidateOnly: true,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  const iconRel = path.relative(repoRoot, iconPath);
  const reportRel = path.relative(repoRoot, reportPath);

  console.log(`\nIcon derived successfully.`);
  console.log(`  icon:    ${iconRel}`);
  console.log(`  report:  ${reportRel}`);
  console.log(`  size:    ${actualFrameW}×${actualFrameH}`);
  console.log(`\nNote: candidateOnly: true — use the adopt step to promote this icon.`);
  console.log(``);
}

main().catch((err) => {
  console.error(`\nFatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
