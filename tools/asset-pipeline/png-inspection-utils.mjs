#!/usr/bin/env node
/**
 * Pure Node.js PNG header reader — no external libraries.
 *
 * PNG binary layout (bytes 0-25 are all we need for header inspection):
 *   Bytes  0- 7: PNG signature (89 50 4E 47 0D 0A 1A 0A)
 *   Bytes  8-11: IHDR chunk length (00 00 00 0D = 13)
 *   Bytes 12-15: "IHDR" chunk type
 *   Bytes 16-19: width  (big-endian uint32)
 *   Bytes 20-23: height (big-endian uint32)
 *   Byte  24:    bit depth
 *   Byte  25:    color type
 *                  0 = grayscale
 *                  2 = RGB
 *                  3 = indexed
 *                  4 = grayscale + alpha
 *                  6 = RGBA
 *
 * hasAlpha is true when colorType === 4 (grayscale+alpha) or colorType === 6 (RGBA).
 *
 * NOTE: Pixel-level checks (transparent margin, etc.) require full PNG decompression
 * (zlib inflate + filter reconstruction). That is implemented in evaluate-sprite-frame-fit.mjs.
 * The stubs below are placeholders for future integration.
 */

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** Minimum byte count needed to parse the full IHDR. */
const MIN_HEADER_BYTES = 26;

// ---------------------------------------------------------------------------
// readPngHeader
// ---------------------------------------------------------------------------

/**
 * Reads the first 26 bytes of a file and returns PNG header information.
 *
 * @param {string} filePath  Absolute or resolvable path to the PNG file.
 * @returns {{ width: number, height: number, bitDepth: number, colorType: number, hasAlpha: boolean }}
 * @throws {Error} If the file cannot be read, is too small, or lacks a valid PNG signature.
 */
export function readPngHeader(filePath) {
  let buf;
  try {
    // Read only the bytes we need — saves memory on large files.
    buf = readFileSync(filePath);
  } catch (err) {
    throw new Error(`Cannot read file "${filePath}": ${err.message}`);
  }

  if (buf.length < MIN_HEADER_BYTES) {
    throw new Error(
      `File "${filePath}" is too small to be a valid PNG (${buf.length} bytes < ${MIN_HEADER_BYTES} required).`,
    );
  }

  // Validate PNG signature (bytes 0-7)
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) {
      throw new Error(
        `File "${filePath}" does not start with a valid PNG signature.`,
      );
    }
  }

  // Verify IHDR chunk type (bytes 12-15)
  const chunkType = buf.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    throw new Error(
      `File "${filePath}" is missing the IHDR chunk (got "${chunkType}").`,
    );
  }

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const hasAlpha = colorType === 4 || colorType === 6;

  return { width, height, bitDepth, colorType, hasAlpha };
}

// ---------------------------------------------------------------------------
// hasPngSignature
// ---------------------------------------------------------------------------

/**
 * Returns true if the file starts with a valid PNG signature.
 *
 * Reads only the first 8 bytes; does not validate the rest of the file structure.
 *
 * @param {string} filePath  Absolute or resolvable path to the file.
 * @returns {boolean}
 */
export function hasPngSignature(filePath) {
  let buf;
  try {
    buf = readFileSync(filePath);
  } catch {
    return false;
  }

  if (buf.length < 8) return false;

  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// PNG full decode (used by pixel-level margin checks)
// ---------------------------------------------------------------------------
//
// evaluate-sprite-frame-fit.mjs has equivalent logic but is a CLI that
// auto-runs main() on load — importing it safely is not possible.
// Both files use node:zlib inflateSync and the same 5-filter algorithm.

function _readPngChunks(bytes) {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("PNG signature is invalid.");
  }
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function _unfilterRow(filter, current, previous, bpp) {
  const output = Buffer.alloc(current.length);
  for (let i = 0; i < current.length; i++) {
    const left = i >= bpp ? output[i - bpp] : 0;
    const up = previous ? previous[i] : 0;
    const upLeft = (previous && i >= bpp) ? previous[i - bpp] : 0;
    let v;
    if (filter === 0)      v = current[i];
    else if (filter === 1) v = current[i] + left;
    else if (filter === 2) v = current[i] + up;
    else if (filter === 3) v = current[i] + Math.floor((left + up) / 2);
    else if (filter === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
      const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      v = current[i] + pred;
    } else {
      throw new Error(`Unsupported PNG filter type: ${filter}`);
    }
    output[i] = v & 0xff;
  }
  return output;
}

/**
 * Decode a PNG file to raw 8-bit RGBA pixel data (colorType=6 only).
 *
 * @param {string} filePath  Absolute path to the PNG file.
 * @returns {{ width: number, height: number, rgba: Buffer }}
 * @throws {Error} if the file cannot be decoded or is not 8-bit RGBA.
 */
export function readPngRgba(filePath) {
  const bytes = readFileSync(filePath);
  const chunks = _readPngChunks(bytes);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("PNG IHDR chunk missing.");
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  if (ihdr.data[8] !== 8 || ihdr.data[9] !== 6) {
    throw new Error("Only 8-bit RGBA PNG (colorType=6) is supported for pixel inspection.");
  }
  const idatData = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  if (idatData.length === 0) throw new Error("No IDAT chunks in PNG.");
  const inflated = inflateSync(idatData);
  const bpp = 4;
  const stride = width * bpp;
  const rgba = Buffer.alloc(width * height * bpp);
  let offset = 0;
  let prev = null;
  for (let y = 0; y < height; y++) {
    const filter = inflated[offset++];
    const raw = inflated.subarray(offset, offset + stride);
    offset += stride;
    const line = _unfilterRow(filter, raw, prev, bpp);
    line.copy(rgba, y * stride);
    prev = line;
  }
  return { width, height, rgba };
}

// ---------------------------------------------------------------------------
// Pixel-level margin checks
// ---------------------------------------------------------------------------

function _frameMarginViolations(rgba, imgWidth, x0, y0, fw, fh, safeMargins) {
  let minX = fw, maxX = -1, minY = fh, maxY = -1;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (rgba[((y0 + y) * imgWidth + (x0 + x)) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1) return []; // all transparent — no violation
  const vv = [];
  if (minX            < safeMargins.left)    vv.push({ side: "left",   actual: minX,          required: safeMargins.left });
  if (fw - 1 - maxX   < safeMargins.right)   vv.push({ side: "right",  actual: fw - 1 - maxX, required: safeMargins.right });
  if (minY            < safeMargins.top)     vv.push({ side: "top",    actual: minY,          required: safeMargins.top });
  if (fh - 1 - maxY   < safeMargins.bottom)  vv.push({ side: "bottom", actual: fh - 1 - maxY, required: safeMargins.bottom });
  return vv;
}

/**
 * Check all frames in a sprite sheet PNG for safe-margin compliance.
 * Returns { checked, passed, violations[] }.
 * checked=false if the PNG cannot be decoded (caller keeps marginCheckStatus "not-run").
 *
 * @param {string} filePath
 * @param {number} columns
 * @param {number} rows
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @param {{ top: number, bottom: number, left: number, right: number }} safeMargins
 * @returns {{ checked: boolean, passed: boolean, violations: Array<{row,column,side,actual,required}> }}
 */
export function checkSheetMargins(filePath, columns, rows, frameWidth, frameHeight, safeMargins) {
  let png;
  try { png = readPngRgba(filePath); } catch { return { checked: false, passed: false, violations: [] }; }
  if (png.width !== columns * frameWidth || png.height !== rows * frameHeight) {
    return { checked: false, passed: false, violations: [] };
  }
  const violations = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      for (const v of _frameMarginViolations(png.rgba, png.width, col * frameWidth, row * frameHeight, frameWidth, frameHeight, safeMargins)) {
        violations.push({ row, column: col, ...v });
      }
    }
  }
  return { checked: true, passed: violations.length === 0, violations };
}

/**
 * Check a single expression image PNG for safe-margin compliance.
 * Returns { checked, passed, violations[] }.
 * checked=false if the PNG cannot be decoded.
 *
 * @param {string} filePath
 * @param {{ top: number, bottom: number, left: number, right: number }} safeMargins
 * @returns {{ checked: boolean, passed: boolean, violations: Array<{side,actual,required}> }}
 */
export function checkSingleImageMargins(filePath, safeMargins) {
  let png;
  try { png = readPngRgba(filePath); } catch { return { checked: false, passed: false, violations: [] }; }
  const violations = _frameMarginViolations(png.rgba, png.width, 0, 0, png.width, png.height, safeMargins);
  return { checked: true, passed: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// checkTransparentMargin
// ---------------------------------------------------------------------------

/**
 * Check whether a PNG has any non-transparent (visible) pixels.
 * Returns { checked: false } if the PNG cannot be decoded as 8-bit RGBA.
 *
 * @param {string} filePath
 * @returns {{ checked: boolean, hasContent?: boolean }}
 */
export function checkImageHasContent(filePath) {
  let png;
  try { png = readPngRgba(filePath); } catch { return { checked: false }; }
  for (let i = 3; i < png.rgba.length; i += 4) {
    if (png.rgba[i] > 0) return { checked: true, hasContent: true };
  }
  return { checked: true, hasContent: false };
}

/**
 * Checks whether all visible pixels respect the given margin from each edge.
 * Now backed by full RGBA decode. Backward-compatible return shape.
 *
 * @param {string} filePath  Path to the PNG file.
 * @param {number | { top: number, bottom: number, left: number, right: number }} margin
 *   Uniform margin (number) or per-side object.
 * @returns {{ checked: boolean, passed?: boolean, violations?: object[], reason?: string }}
 */
export function checkTransparentMargin(filePath, margin) {
  const safeMargins = (typeof margin === "number")
    ? { top: margin, bottom: margin, left: margin, right: margin }
    : (margin ?? { top: 8, bottom: 8, left: 8, right: 8 });
  const result = checkSingleImageMargins(filePath, safeMargins);
  if (!result.checked) return { checked: false, reason: "pixel-decode-failed" };
  return { checked: true, passed: result.passed, violations: result.violations };
}
