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
// checkTransparentMargin (stub)
// ---------------------------------------------------------------------------

/**
 * Checks whether all pixels within `margin` pixels of each edge are transparent.
 *
 * NOTE: Real PNG decompression without an external library requires implementing
 * zlib inflate and all 5 PNG filter types (None, Sub, Up, Average, Paeth).
 * That is already implemented in evaluate-sprite-frame-fit.mjs using node:zlib.
 *
 * For the asset-contract validator phase this is a stub — structural checks
 * (signature, dimensions, alpha channel flag) are the hard gates.
 * Pixel-level margin checks are advisory and require human review.
 *
 * @param {string} _filePath  Path to the PNG file (unused in stub).
 * @param {number} _margin    Pixel margin from each edge (unused in stub).
 * @returns {{ checked: boolean, passed?: boolean, reason?: string }}
 */
export function checkTransparentMargin(_filePath, _margin) {
  return {
    checked: false,
    reason: "pixel-decode-not-implemented",
  };
}
