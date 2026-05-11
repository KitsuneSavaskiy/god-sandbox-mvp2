#!/usr/bin/env node
/**
 * Resident hatch-pet wrapper.
 *
 * This script is a fail-closed gate around hatch-pet resident atlas output.
 * It never treats raw imagegen output as a candidate and copies only a
 * validated hatch-pet final atlas into the resident incoming folder.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const CANVAS_BY_SHEET = {
  motion: {
    width: 1536,
    height: 1872,
    frameWidth: 192,
    frameHeight: 208,
    columns: 8,
    rows: 9,
  },
  extended: {
    width: 1536,
    height: 1872,
    frameWidth: 192,
    frameHeight: 208,
    columns: 8,
    rows: 9,
  },
  combined: {
    width: 888,
    height: 2016,
    frameWidth: 148,
    frameHeight: 144,
    columns: 6,
    rows: 14,
  },
};

const SHEET_DEFINITIONS = {
  motion: {
    label: "Sheet 1 (motion)",
    filename: "resident-sprite-sheet.png",
    rows: [
      "idle",
      "walk-right",
      "walk-left",
      "waving",
      "jumping",
      "failed",
      "waiting",
      "running",
      "review",
    ],
    forbiddenRows: [],
  },
  extended: {
    label: "Sheet 2 (extended)",
    filename: "resident-sprite-sheet-extended.png",
    rows: [
      "walk-up",
      "walk-down",
      "walk-forward",
      "walk-back",
      "emote-happy",
      "emote-angry",
      "emote-sad",
      "emote-surprised",
      "spare",
    ],
    forbiddenRows: [
      "idle",
      "running-right",
      "running-left",
      "run-right",
      "run-left",
      "waving",
      "jumping",
      "failed",
      "waiting",
      "running",
      "review",
    ],
  },
  combined: {
    label: "GodSandbox combined resident sheet",
    filename: "resident-sprite-sheet-combined.png",
    rows: [
      "idle",
      "walk-right",
      "walk-left",
      "waving",
      "jumping",
      "failed",
      "waiting",
      "review",
      "walk-up / walk-back",
      "walk-down / walk-forward",
      "emote-happy",
      "emote-angry",
      "emote-sad",
      "emote-surprised",
    ],
    forbiddenRows: [],
  },
};

function printHelp() {
  console.log(`resident hatch-pet wrapper

Usage:
  npm run sidekick:resident:hatch-pet -- --slug ryo --sheet motion --portrait <png> --prompt <prompt.md> --dry-run
  npm run sidekick:resident:hatch-pet -- --slug ryo --sheet extended --portrait <png> --prompt <prompt.md> --dry-run
  npm run sidekick:resident:hatch-pet -- --slug ryo --sheet combined --portrait <png> --prompt <prompt.md> --dry-run
  npm run sidekick:resident:hatch-pet -- --slug ryo --sheet motion --portrait <png> --prompt <prompt.md> --run-dir .hatch-pet-runs/ryo-motion

Options:
  --slug <id>          Resident asset key, lowercase letters/numbers/_/-
  --sheet <kind>      motion, extended, or combined
  --portrait <path>   Existing PNG portrait reference. A single * filename glob is allowed.
  --prompt <path>     Existing resident prompt file
  --run-dir <path>    hatch-pet run directory. Default: .hatch-pet-runs/<slug>-<sheet>
  --final-output <p>  hatch-pet final atlas. Default: <run-dir>/final/spritesheet.png
  --dry-run           Validate preflight and print run definition only
`);
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (["--slug", "--sheet", "--portrait", "--prompt", "--run-dir", "--final-output"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value.`);
      }
      args[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return args;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || process.argv.length <= 2) {
      printHelp();
      return args.help ? 0 : 1;
    }

    const plan = createRunPlan(args);
    printRunPlan(plan);

    if (plan.dryRun) {
      console.log("\nDry run complete. No files were written.");
      return 0;
    }

    executeRunPlan(plan);
    return 0;
  } catch (error) {
    console.error("\nresident hatch-pet wrapper failed.");
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function createRunPlan(args) {
  assertSlug(args.slug);
  const sheet = normalizeSheet(args.sheet);
  const definition = SHEET_DEFINITIONS[sheet];
  const portraitPath = resolveExistingInputPath(args.portrait, "--portrait");
  const promptPath = resolveExistingInputPath(args.prompt, "--prompt");
  assertHatchPetSkillExists();
  const promptText = readFileSync(promptPath, "utf8");
  validatePromptRows(promptText, sheet);
  const canvas = CANVAS_BY_SHEET[sheet];

  const runDir = path.resolve(repoRoot, args.runDir ?? path.join(".hatch-pet-runs", `${args.slug}-${sheet}`));
  const finalOutput = args.finalOutput
    ? path.resolve(repoRoot, args.finalOutput)
    : path.join(runDir, "final", "spritesheet.png");
  const incomingPath = path.join(
    repoRoot,
    "assets",
    "generated",
    "residents",
    args.slug,
    "incoming",
    definition.filename,
  );

  validatePetRequest(runDir, sheet, Boolean(args.dryRun));

  return {
    dryRun: Boolean(args.dryRun),
    slug: args.slug,
    sheet,
    definition,
    canvas,
    portraitPath,
    promptPath,
    runDir,
    finalOutput,
    incomingPath,
    rowManifest: definition.rows.map((name, row) => ({ row, name })),
  };
}

function executeRunPlan(plan) {
  mkdirSync(plan.runDir, { recursive: true });
  writeFileSync(
    path.join(plan.runDir, "resident-wrapper-run.json"),
    `${JSON.stringify(toSerializablePlan(plan), null, 2)}\n`,
  );

  assertHatchPetFinalOutput(plan.finalOutput, plan.runDir);
  const metadata = readPngMetadata(plan.finalOutput);
  assertResidentFinalPng(metadata, plan.finalOutput, plan.canvas);

  if (!metadata.hasAlphaChannel && !metadata.hasMagentaChromaKey) {
    throw new Error("Final PNG must have an alpha channel or a #ff00ff chroma-key background.");
  }
  if (metadata.hasAlphaChannel && metadata.transparentPixelCount === null) {
    throw new Error("Final PNG alpha channel could not be inspected.");
  }
  if (metadata.hasAlphaChannel && metadata.transparentPixelCount === 0) {
    throw new Error("Final PNG has an alpha channel but no transparent pixels.");
  }

  mkdirSync(path.dirname(plan.incomingPath), { recursive: true });
  if (metadata.hasAlphaChannel) {
    copyFileSync(plan.finalOutput, plan.incomingPath);
  } else {
    writeMagentaChromaKeyAsAlpha(plan.finalOutput, plan.incomingPath, metadata);
    console.log("Converted #ff00ff chroma-key background to alpha before incoming placement.");
  }
  console.log(`\nCopied validated final atlas to ${toRepoPath(plan.incomingPath)}`);

  runPostCopyValidation(plan);
}

function printRunPlan(plan) {
  console.log(`resident hatch-pet wrapper: ${plan.slug} / ${plan.definition.label}`);
  console.log(`portrait: ${toRepoPath(plan.portraitPath)}`);
  console.log(`prompt: ${toRepoPath(plan.promptPath)}`);
  console.log(
    `canvas: ${plan.canvas.width}x${plan.canvas.height} (${plan.canvas.columns}x${plan.canvas.rows}, ${plan.canvas.frameWidth}x${plan.canvas.frameHeight} frame)`,
  );
  console.log(`run dir: ${toRepoPath(plan.runDir)}`);
  console.log(`final output: ${toRepoPath(plan.finalOutput)}`);
  console.log(`incoming target: ${toRepoPath(plan.incomingPath)}`);
  console.log("\nRow manifest:");
  for (const row of plan.rowManifest) {
    console.log(`  row ${row.row}: ${row.name}`);
  }
}

function toSerializablePlan(plan) {
  return {
    format: "godsandbox-resident-hatch-pet-wrapper/v1",
    createdAt: new Date().toISOString(),
    slug: plan.slug,
    sheet: plan.sheet,
    canvas: plan.canvas,
    rowManifest: plan.rowManifest,
    portrait: toRepoPath(plan.portraitPath),
    prompt: toRepoPath(plan.promptPath),
    runDir: toRepoPath(plan.runDir),
    finalOutput: toRepoPath(plan.finalOutput),
    incomingTarget: toRepoPath(plan.incomingPath),
    rawOutputPolicy: "raw imagegen output is evidence only and must not be copied to incoming",
    readyPolicy: "PO visual OK is required before public/art or manifest ready promotion",
  };
}

function assertSlug(value) {
  if (!value || !SLUG_PATTERN.test(value)) {
    throw new Error("--slug must be lowercase letters, numbers, hyphen, or underscore.");
  }
}

function normalizeSheet(value) {
  const sheet = String(value ?? "").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SHEET_DEFINITIONS, sheet)) {
    throw new Error("--sheet must be motion, extended, or combined.");
  }
  return sheet;
}

function resolveExistingInputPath(value, label) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }

  const resolved = resolveMaybeSingleGlob(value);
  if (!existsSync(resolved)) {
    throw new Error(`${label} does not exist: ${sanitizePath(resolved)}`);
  }
  if (!statSync(resolved).isFile()) {
    throw new Error(`${label} is not a file: ${sanitizePath(resolved)}`);
  }
  return resolved;
}

function resolveMaybeSingleGlob(value) {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized.includes("*")) {
    return path.resolve(repoRoot, value);
  }

  const directory = path.resolve(repoRoot, path.dirname(normalized));
  const basenamePattern = path.basename(normalized);
  if (!existsSync(directory)) {
    throw new Error(`Glob directory does not exist: ${sanitizePath(directory)}`);
  }

  const escaped = basenamePattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const pattern = new RegExp(`^${escaped}$`);
  const matches = readdirSync(directory)
    .filter((entry) => pattern.test(entry))
    .map((entry) => path.join(directory, entry));

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one match for ${value}, found ${matches.length}.`);
  }

  return matches[0];
}

function assertHatchPetSkillExists() {
  const candidates = [
    process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, "skills", "hatch-pet", "SKILL.md") : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".codex", "skills", "hatch-pet", "SKILL.md") : null,
    process.env.HOME ? path.join(process.env.HOME, ".codex", "skills", "hatch-pet", "SKILL.md") : null,
  ].filter(Boolean);

  if (!candidates.some((candidate) => existsSync(candidate))) {
    throw new Error("hatch-pet skill folder is missing. Expected .codex/skills/hatch-pet/SKILL.md.");
  }
}

function validatePromptRows(promptText, sheet) {
  const definition = SHEET_DEFINITIONS[sheet];
  const missing = definition.rows.filter((row) => !promptText.includes(row));
  if (missing.length > 0) {
    throw new Error(`${definition.label} prompt is missing row(s): ${missing.join(", ")}`);
  }

  if (definition.forbiddenRows.length > 0) {
    const forbidden = definition.forbiddenRows.filter((row) => promptText.includes(row));
    if (forbidden.length > 0) {
      throw new Error(`${definition.label} prompt includes forbidden row(s): ${forbidden.join(", ")}`);
    }
  }
}

function validatePetRequest(runDir, sheet, dryRun) {
  const requestPath = path.join(runDir, "pet_request.json");
  if (!existsSync(requestPath)) {
    if (dryRun) {
      return;
    }
    throw new Error("pet_request.json is required for non-dry-run resident hatch-pet runs.");
  }

  let requestText;
  try {
    requestText = readFileSync(requestPath, "utf8");
    JSON.parse(requestText);
  } catch {
    throw new Error(`Existing pet_request.json is not valid JSON: ${toRepoPath(requestPath)}`);
  }

  const definition = SHEET_DEFINITIONS[sheet];
  const missing = definition.rows.filter((row) => !requestText.includes(row));
  if (missing.length > 0) {
    throw new Error(`Existing pet_request.json is missing row(s): ${missing.join(", ")}`);
  }

  if (definition.forbiddenRows.length > 0) {
    const forbidden = definition.forbiddenRows.filter((row) => requestText.includes(row));
    if (forbidden.length > 0) {
      throw new Error(`Existing ${definition.label} pet_request.json includes forbidden row(s): ${forbidden.join(", ")}`);
    }
  }
}

function assertHatchPetFinalOutput(finalOutput, runDir) {
  if (!isInsideDirectory(finalOutput, path.join(runDir, "final"))) {
    throw new Error("Final output must be under the hatch-pet run final/ directory.");
  }
  if (!existsSync(finalOutput)) {
    throw new Error(`Hatch-pet final output is missing: ${toRepoPath(finalOutput)}. Raw imagegen output is not accepted.`);
  }
  if (!statSync(finalOutput).isFile()) {
    throw new Error(`Hatch-pet final output is not a file: ${toRepoPath(finalOutput)}`);
  }
}

function isInsideDirectory(filePath, directoryPath) {
  const relative = path.relative(path.resolve(directoryPath), path.resolve(filePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readPngMetadata(filePath) {
  const buffer = readFileSync(filePath);
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`Final output is not a PNG file: ${toRepoPath(filePath)}`);
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let hasTransparencyChunk = false;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === "tRNS") {
      hasTransparencyChunk = true;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  const hasAlphaChannel = colorType === 4 || colorType === 6;
  const baseMetadata = {
    width,
    height,
    bitDepth,
    colorType,
    interlace,
    hasTransparencyChunk,
    idatChunks,
  };
  return {
    ...baseMetadata,
    hasAlphaChannel,
    transparentPixelCount: hasAlphaChannel ? countTransparentPixels(baseMetadata) : null,
    hasMagentaChromaKey: hasAlphaChannel
      ? false
      : detectMagentaChromaKey(baseMetadata),
  };
}

function assertResidentFinalPng(metadata, filePath, canvas) {
  if (metadata.width !== canvas.width || metadata.height !== canvas.height) {
    throw new Error(
      `Final PNG has wrong size: ${metadata.width}x${metadata.height}. Expected ${canvas.width}x${canvas.height}. File: ${toRepoPath(filePath)}`,
    );
  }
}

function detectMagentaChromaKey({ width, height, bitDepth, colorType, interlace, idatChunks }) {
  if (bitDepth !== 8 || colorType !== 2 || interlace !== 0 || idatChunks.length === 0) {
    return false;
  }

  const pixels = decodeScanlines({ width, height, idatChunks, bytesPerPixel: 3 });
  for (let index = 0; index < pixels.length; index += 3) {
    if (pixels[index] === 255 && pixels[index + 1] === 0 && pixels[index + 2] === 255) {
      return true;
    }
  }

  return false;
}

function countTransparentPixels({ width, height, bitDepth, colorType, interlace, idatChunks }) {
  if (bitDepth !== 8 || interlace !== 0 || idatChunks.length === 0) {
    return null;
  }
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 4 ? 2 : 0;
  const alphaOffset = colorType === 6 ? 3 : colorType === 4 ? 1 : null;
  if (!bytesPerPixel || alphaOffset === null) {
    return null;
  }

  const pixels = decodeScanlines({ width, height, idatChunks, bytesPerPixel });
  let transparentPixelCount = 0;
  for (let index = alphaOffset; index < pixels.length; index += bytesPerPixel) {
    if (pixels[index] === 0) {
      transparentPixelCount += 1;
    }
  }
  return transparentPixelCount;
}

function decodeScanlines({ width, height, idatChunks, bytesPerPixel }) {
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  let offset = 0;
  let previous = Buffer.alloc(stride);
  const pixels = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated.readUInt8(offset);
    offset += 1;
    const scanline = Buffer.from(inflated.subarray(offset, offset + stride));
    offset += stride;
    unfilterScanline(scanline, previous, bytesPerPixel, filter);
    scanline.copy(pixels, y * stride);
    previous = scanline;
  }

  return pixels;
}

function writeMagentaChromaKeyAsAlpha(inputPath, outputPath, metadata) {
  const rgbPixels = decodeScanlines({
    width: metadata.width,
    height: metadata.height,
    idatChunks: metadata.idatChunks,
    bytesPerPixel: 3,
  });
  const rgbaPixels = Buffer.alloc(metadata.width * metadata.height * 4);
  let transparentPixelCount = 0;

  for (let inputIndex = 0, outputIndex = 0; inputIndex < rgbPixels.length; inputIndex += 3, outputIndex += 4) {
    const red = rgbPixels[inputIndex];
    const green = rgbPixels[inputIndex + 1];
    const blue = rgbPixels[inputIndex + 2];
    const transparent = red === 255 && green === 0 && blue === 255;

    rgbaPixels[outputIndex] = red;
    rgbaPixels[outputIndex + 1] = green;
    rgbaPixels[outputIndex + 2] = blue;
    rgbaPixels[outputIndex + 3] = transparent ? 0 : 255;

    if (transparent) {
      transparentPixelCount += 1;
    }
  }

  if (transparentPixelCount === 0) {
    throw new Error(`Final PNG has no #ff00ff pixels to convert: ${toRepoPath(inputPath)}`);
  }

  writeRgbaPng(outputPath, metadata.width, metadata.height, rgbaPixels);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function writeRgbaPng(filePath, width, height, rgbaPixels) {
  const rowLength = width * 4;
  const raw = Buffer.alloc((rowLength + 1) * height);

  for (let row = 0; row < height; row += 1) {
    const rawRowStart = row * (rowLength + 1);
    raw[rawRowStart] = 0;
    rgbaPixels.copy(raw, rawRowStart + 1, row * rowLength, (row + 1) * rowLength);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  writeFileSync(
    filePath,
    Buffer.concat([
      PNG_SIGNATURE,
      makeChunk("IHDR", ihdr),
      makeChunk("IDAT", deflateSync(raw)),
      makeChunk("IEND"),
    ]),
  );
}

function unfilterScanline(scanline, previous, bytesPerPixel, filter) {
  for (let index = 0; index < scanline.length; index += 1) {
    const left = index >= bytesPerPixel ? scanline[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] ?? 0 : 0;

    switch (filter) {
      case 0:
        break;
      case 1:
        scanline[index] = (scanline[index] + left) & 0xff;
        break;
      case 2:
        scanline[index] = (scanline[index] + up) & 0xff;
        break;
      case 3:
        scanline[index] = (scanline[index] + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4:
        scanline[index] = (scanline[index] + paethPredictor(left, up, upLeft)) & 0xff;
        break;
      default:
        throw new Error(`Unsupported PNG filter type: ${filter}`);
    }
  }
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function runPostCopyValidation(plan) {
  if (plan.sheet === "combined") {
    console.log(
      "\ncombined sheet copied. sprite:check is skipped because it validates the motion + extended pair.",
    );
    return;
  }

  runSpriteCheckIfPairExists(plan.slug);
}

function runSpriteCheckIfPairExists(slug) {
  const incomingDir = path.join(repoRoot, "assets", "generated", "residents", slug, "incoming");
  const motionPath = path.join(incomingDir, SHEET_DEFINITIONS.motion.filename);
  const extendedPath = path.join(incomingDir, SHEET_DEFINITIONS.extended.filename);

  if (!existsSync(motionPath) || !existsSync(extendedPath)) {
    console.log("\nsprite:check skipped until both motion and extended sheets exist in incoming.");
    return;
  }

  console.log("\nBoth sheets exist. Running sprite:check.");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", "sprite:check", "--", slug], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`sprite:check failed for ${slug}.`);
  }
}

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll("\\", "/");
}

function sanitizePath(filePath) {
  return filePath
    .replace(/[A-Za-z]:[\\/][^\s]+/g, "<host-absolute-path>")
    .replace(/\/(?:Users|home)\/[^\s]+/g, "<host-absolute-path>");
}

process.exitCode = main();
