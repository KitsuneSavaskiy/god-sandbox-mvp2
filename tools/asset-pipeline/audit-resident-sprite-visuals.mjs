#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";

const expected = {
  frameWidth: 192,
  frameHeight: 208,
  columns: 8,
  rows: 9,
  width: 1536,
  height: 1872,
};

const safeArea = {
  left: 10,
  right: 10,
  top: 8,
  bottom: 8,
};

// Sheet 1 (motion-sheet) row labels — hatch-pet native format
const motionRows = [
  "idle",
  "walk-right",
  "walk-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
];

const extendedRows = [
  "walk-up",
  "walk-down",
  "walk-forward",
  "walk-back",
  "emote-happy",
  "emote-angry",
  "emote-sad",
  "emote-surprised",
  "spare",
];

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

function printHelp() {
  console.log(`Resident sprite visual auditor

使い方:
  node tools/asset-pipeline/audit-resident-sprite-visuals.mjs <residentId> --kind motion|extended
  node tools/asset-pipeline/audit-resident-sprite-visuals.mjs <png-file-or-folder>
  node tools/asset-pipeline/audit-resident-sprite-visuals.mjs <png-file> --kind motion|extended

例:
  node tools/asset-pipeline/audit-resident-sprite-visuals.mjs eve --kind motion
  node tools/asset-pipeline/audit-resident-sprite-visuals.mjs public/art/characters/defaults/eve/sprites/resident-sprite-sheet-extended.png --kind extended

入力:
  assets/generated/residents/<residentId>/incoming/

出力:
  assets/residents/<residentId>/sprites/<source>.visual-audit.svg
  assets/residents/<residentId>/sprites/<source>.visual-audit.json

この監査は contact sheet を作り、見た目確認を必須にします。
sheetKind と expectedRows も report に記録します。
warning が出ても自動ready化はしません。人間レビューが必要です。`);
}

function isHelpArg(value) {
  return value === "--help" || value === "-h";
}

function assertResidentId(residentId) {
  if (!/^[A-Za-z0-9_-]+$/.test(residentId)) {
    throw new Error("住民IDに使えるのは英数字、ハイフン、アンダースコアだけです。");
  }
}

function toRepoRelative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function toIncomingDir(residentId) {
  return path.join(repoRoot, "assets", "generated", "residents", residentId, "incoming");
}

function toOutputDir(residentId) {
  return path.join(repoRoot, "assets", "residents", residentId, "sprites");
}

function filenameToKind(filePath) {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName === "resident-sprite-sheet.png") {
    return "motion";
  }
  if (fileName === "resident-sprite-sheet-extended.png") {
    return "extended";
  }
  return null;
}

function getRowsForKind(kind) {
  return kind === "extended" ? extendedRows : motionRows;
}

function getExpectedFileName(kind) {
  return kind === "extended"
    ? "resident-sprite-sheet-extended.png"
    : "resident-sprite-sheet.png";
}

function resolveSheetKind(filePath, providedKind) {
  if (providedKind === "motion" || providedKind === "extended") {
    const inferred = filenameToKind(filePath);
    if (inferred && inferred !== providedKind) {
      throw new Error(
        `sheetKind とファイル名が一致しません。${providedKind} には ${getExpectedFileName(providedKind)} を使ってください。`,
      );
    }
    return providedKind;
  }

  const inferred = filenameToKind(filePath);
  if (inferred) {
    return inferred;
  }

  throw new Error("sheetKind を判定できません。--kind motion|extended を指定してください。");
}

function collectPngFiles(targetPath) {
  if (!existsSync(targetPath)) {
    throw new Error(`PNGファイルまたはフォルダが見つかりません: ${toRepoRelative(targetPath)}`);
  }

  const stats = statSync(targetPath);
  if (stats.isFile()) {
    return [targetPath];
  }

  if (!stats.isDirectory()) {
    throw new Error(`これは監査できるファイルまたはフォルダではありません: ${toRepoRelative(targetPath)}`);
  }

  const files = readdirSync(targetPath)
    .map((name) => path.join(targetPath, name))
    .filter((candidate) => {
      try {
        return statSync(candidate).isFile() && candidate.toLowerCase().endsWith(".png");
      } catch {
        return false;
      }
    })
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

  if (files.length === 0) {
    throw new Error(`PNGファイルが見つかりません: ${toRepoRelative(targetPath)}`);
  }

  return files;
}

function inferResidentId(filePath) {
  const parts = toRepoRelative(filePath).split("/");
  const generatedIndex = parts.findIndex((part, index) => {
    return part === "residents" && parts[index - 1] === "generated";
  });
  if (generatedIndex >= 0) {
    return parts[generatedIndex + 1] ?? null;
  }

  const adoptedIndex = parts.findIndex((part, index) => {
    return part === "residents" && parts[index - 1] === "assets";
  });
  if (adoptedIndex >= 0) {
    return parts[adoptedIndex + 1] ?? null;
  }

  const defaultsIndex = parts.findIndex((part, index) => {
    return part === "defaults" && parts[index - 1] === "characters";
  });
  if (defaultsIndex >= 0) {
    return parts[defaultsIndex + 1] ?? null;
  }

  return null;
}

function readChunks(bytes) {
  let offset = 8;
  const chunks = [];

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;

    if (crcEnd > bytes.length) {
      throw new Error("PNGの中身が途中で切れているようです。画像を保存し直してください。");
    }

    chunks.push({
      type,
      data: bytes.subarray(dataStart, dataEnd),
    });

    offset = crcEnd;
    if (type === "IEND") {
      break;
    }
  }

  return chunks;
}

function readPngInfo(filePath) {
  const bytes = readFileSync(filePath);
  if (bytes.length < 29 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error("PNGファイルではありません。ChatGPTからPNGとして保存した画像を選んでください。");
  }

  const chunks = readChunks(bytes);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR");
  const idats = chunks.filter((chunk) => chunk.type === "IDAT");

  if (!ihdr || ihdr.data.length !== 13) {
    throw new Error("PNGの先頭情報を読めませんでした。画像を保存し直してください。");
  }
  if (idats.length === 0) {
    throw new Error("PNGの画像データを読めませんでした。画像を保存し直してください。");
  }

  return {
    bytes,
    width: ihdr.data.readUInt32BE(0),
    height: ihdr.data.readUInt32BE(4),
    bitDepth: ihdr.data.readUInt8(8),
    colorType: ihdr.data.readUInt8(9),
    compressionMethod: ihdr.data.readUInt8(10),
    filterMethod: ihdr.data.readUInt8(11),
    interlaceMethod: ihdr.data.readUInt8(12),
    compressedData: Buffer.concat(idats.map((chunk) => chunk.data)),
  };
}

function hasAlphaChannel(colorType) {
  return colorType === 4 || colorType === 6;
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceAbove = Math.abs(estimate - above);
  const distanceUpperLeft = Math.abs(estimate - upperLeft);

  if (distanceLeft <= distanceAbove && distanceLeft <= distanceUpperLeft) {
    return left;
  }
  if (distanceAbove <= distanceUpperLeft) {
    return above;
  }
  return upperLeft;
}

function unfilterScanlines(data, width, height, bytesPerPixel) {
  const rowLength = width * bytesPerPixel;
  const expectedLength = (rowLength + 1) * height;
  if (data.length < expectedLength) {
    throw new Error("PNGの画像データが想定より短いです。画像を保存し直してください。");
  }

  const output = Buffer.alloc(rowLength * height);
  let sourceOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filterType = data[sourceOffset];
    sourceOffset += 1;
    const rowStart = row * rowLength;
    const previousRowStart = rowStart - rowLength;

    for (let column = 0; column < rowLength; column += 1) {
      const raw = data[sourceOffset + column];
      const left = column >= bytesPerPixel ? output[rowStart + column - bytesPerPixel] : 0;
      const above = row > 0 ? output[previousRowStart + column] : 0;
      const upperLeft =
        row > 0 && column >= bytesPerPixel
          ? output[previousRowStart + column - bytesPerPixel]
          : 0;

      let value;
      switch (filterType) {
        case 0:
          value = raw;
          break;
        case 1:
          value = raw + left;
          break;
        case 2:
          value = raw + above;
          break;
        case 3:
          value = raw + Math.floor((left + above) / 2);
          break;
        case 4:
          value = raw + paethPredictor(left, above, upperLeft);
          break;
        default:
          throw new Error("対応していないPNGフィルタが含まれています。画像を書き出し直してください。");
      }

      output[rowStart + column] = value & 0xff;
    }

    sourceOffset += rowLength;
  }

  return output;
}

function decodeRgba(pngInfo) {
  if (!hasAlphaChannel(pngInfo.colorType)) {
    throw new Error("alpha channelがないため、見た目監査を進められません。先に透明背景PNGを用意してください。");
  }
  if (
    pngInfo.bitDepth !== 8 ||
    pngInfo.interlaceMethod !== 0 ||
    pngInfo.compressionMethod !== 0 ||
    pngInfo.filterMethod !== 0
  ) {
    throw new Error("見た目監査に対応していないPNG形式です。8bit / non-interlaced PNGとして保存し直してください。");
  }

  const bytesPerPixel = pngInfo.colorType === 6 ? 4 : 2;
  const inflated = inflateSync(pngInfo.compressedData);
  const raw = unfilterScanlines(inflated, pngInfo.width, pngInfo.height, bytesPerPixel);
  const rgba = Buffer.alloc(pngInfo.width * pngInfo.height * 4);

  if (pngInfo.colorType === 6) {
    raw.copy(rgba);
    return rgba;
  }

  for (let sourceOffset = 0, targetOffset = 0; sourceOffset < raw.length; sourceOffset += 2, targetOffset += 4) {
    const gray = raw[sourceOffset];
    const alpha = raw[sourceOffset + 1];
    rgba[targetOffset] = gray;
    rgba[targetOffset + 1] = gray;
    rgba[targetOffset + 2] = gray;
    rgba[targetOffset + 3] = alpha;
  }

  return rgba;
}

function addFlag(flags, notes, code, note) {
  if (flags.includes(code)) {
    return;
  }
  flags.push(code);
  notes.push(note);
}

function computeComponentGap(upper, lower) {
  if (lower.minY > upper.maxY) {
    return lower.minY - upper.maxY - 1;
  }
  return 0;
}

function findComponents(mask) {
  const visited = new Uint8Array(mask.length);
  const components = [];
  const neighborOffsets = [
    -1, 0,
    1, 0,
    0, -1,
    0, 1,
    -1, -1,
    1, -1,
    -1, 1,
    1, 1,
  ];

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) {
      continue;
    }

    const queue = [index];
    visited[index] = 1;
    let area = 0;
    let minX = expected.frameWidth;
    let minY = expected.frameHeight;
    let maxX = -1;
    let maxY = -1;

    while (queue.length > 0) {
      const current = queue.pop();
      const x = current % expected.frameWidth;
      const y = Math.floor(current / expected.frameWidth);
      area += 1;
      if (x < minX) {
        minX = x;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }

      for (let offsetIndex = 0; offsetIndex < neighborOffsets.length; offsetIndex += 2) {
        const nextX = x + neighborOffsets[offsetIndex];
        const nextY = y + neighborOffsets[offsetIndex + 1];
        if (
          nextX < 0 ||
          nextX >= expected.frameWidth ||
          nextY < 0 ||
          nextY >= expected.frameHeight
        ) {
          continue;
        }

        const nextIndex = nextY * expected.frameWidth + nextX;
        if (!mask[nextIndex] || visited[nextIndex]) {
          continue;
        }

        visited[nextIndex] = 1;
        queue.push(nextIndex);
      }
    }

    components.push({
      area,
      minX,
      minY,
      maxX,
      maxY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    });
  }

  return components.sort((left, right) => right.area - left.area);
}

function analyzeFrame(rgba, frameColumn, frameRow, motion) {
  const frameX = frameColumn * expected.frameWidth;
  const frameY = frameRow * expected.frameHeight;
  const mask = new Uint8Array(expected.frameWidth * expected.frameHeight);
  let visiblePixels = 0;
  let minX = expected.frameWidth;
  let minY = expected.frameHeight;
  let maxX = -1;
  let maxY = -1;
  let topBandPixels = 0;
  let centerBandPixels = 0;
  let bottomBandPixels = 0;

  for (let y = 0; y < expected.frameHeight; y += 1) {
    for (let x = 0; x < expected.frameWidth; x += 1) {
      const pixelIndex = ((frameY + y) * expected.width + (frameX + x)) * 4;
      const alpha = rgba[pixelIndex + 3];
      if (alpha < 32) {
        continue;
      }

      const maskIndex = y * expected.frameWidth + x;
      mask[maskIndex] = 1;
      visiblePixels += 1;
      if (x < minX) {
        minX = x;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }

      if (y < 32) {
        topBandPixels += 1;
      } else if (y >= 64) {
        bottomBandPixels += 1;
      } else {
        centerBandPixels += 1;
      }
    }
  }

  const flags = [];
  const notes = [];
  if (visiblePixels === 0) {
    addFlag(flags, notes, "EMPTY", "visible pixel がありません。空フレームの可能性があります。");
    return {
      motion,
      row: frameRow,
      column: frameColumn,
      visiblePixels,
      bounds: null,
      margins: null,
      componentCount: 0,
      significantComponentCount: 0,
      codes: flags,
      notes,
    };
  }

  const bounds = {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  const margins = {
    left: minX,
    right: expected.frameWidth - 1 - maxX,
    top: minY,
    bottom: expected.frameHeight - 1 - maxY,
  };

  if (margins.top < safeArea.top) {
    addFlag(flags, notes, "TOP", `頭側が上端に近すぎます。top margin=${margins.top}px。`);
  }
  if (margins.bottom < safeArea.bottom) {
    addFlag(flags, notes, "BOT", `足側が下端に近すぎます。bottom margin=${margins.bottom}px。`);
  }
  if (margins.left < safeArea.left || margins.right < safeArea.right) {
    addFlag(
      flags,
      notes,
      "SIDE",
      `左右の余白が不足しています。left=${margins.left}px, right=${margins.right}px。`,
    );
  }
  if (
    margins.left === 0 ||
    margins.right === 0 ||
    margins.top === 0 ||
    margins.bottom === 0
  ) {
    addFlag(flags, notes, "BOUND", "シルエットが frame 境界に触れています。");
  }

  const components = findComponents(mask);
  const significantComponents = components.filter((component) => component.area >= 24);

  if (significantComponents.length >= 3) {
    addFlag(
      flags,
      notes,
      "PARTS",
      `大きめの分離パーツが ${significantComponents.length} 個あります。body split の可能性があります。`,
    );
  }

  if (significantComponents.length >= 2) {
    const [first, second] = significantComponents;
    const ordered = [first, second].sort((left, right) => left.centerY - right.centerY);
    const upper = ordered[0];
    const lower = ordered[1];
    const gap = computeComponentGap(upper, lower);

    if (
      upper.area >= 120 &&
      lower.area >= 120 &&
      upper.maxY <= 40 &&
      lower.minY >= 52 &&
      gap >= 8
    ) {
      addFlag(
        flags,
        notes,
        "SPLIT",
        `上側と下側に大きな分離パーツがあります。gap=${gap}px。row またぎの疑いがあります。`,
      );
    }
  }

  if (
    topBandPixels >= 80 &&
    bottomBandPixels >= 80 &&
    centerBandPixels <= Math.max(16, Math.floor(Math.min(topBandPixels, bottomBandPixels) * 0.12))
  ) {
    addFlag(
      flags,
      notes,
      "CENTER",
      `中央帯の visible pixel が少なく、上半身と下半身が離れて見えます。center=${centerBandPixels}px。`,
    );
  }

  return {
    motion,
    row: frameRow,
    column: frameColumn,
    visiblePixels,
    bounds,
    margins,
    componentCount: components.length,
    significantComponentCount: significantComponents.length,
    codes: flags,
    notes,
  };
}

function countWarningCodes(frames) {
  const counts = {};
  for (const frame of frames) {
    for (const code of frame.codes) {
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  return counts;
}

function summarizeRowWarnings(frames) {
  const warningFrames = frames.filter((frame) => frame.codes.length > 0);
  if (warningFrames.length === 0) {
    return "warnings: none";
  }

  const counts = countWarningCodes(warningFrames);
  const summary = Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `${code}x${count}`)
    .join(", ");

  return `${warningFrames.length}/${frames.length} frames warned: ${summary}`;
}

function svgEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function buildAuditSvg({
  residentId,
  sourceFileName,
  sourceHash,
  generatedAt,
  pngInfo,
  sheetKind,
  report,
}) {
  const sheetX = 164;
  const sheetY = 124;
  const headerHeight = 92;
  const rightPanelWidth = 420;
  const footerStartY = sheetY + expected.height + 32;
  const detailLines = report.rows.flatMap((row) => {
    return row.frames
      .filter((frame) => frame.codes.length > 0)
      .map((frame) => `row ${row.rowIndex} ${row.motion} frame ${frame.column}: ${frame.notes.join(" / ")}`);
  });
  const detailLineHeight = 17;
  const footerHeight = Math.max(110, detailLines.length * detailLineHeight + 68);
  const width = sheetX + expected.width + rightPanelWidth + 32;
  const height = footerStartY + footerHeight;
  const embeddedPng = `data:image/png;base64,${pngInfo.bytes.toString("base64")}`;
  const warningFrames = report.rows.reduce((total, row) => total + row.warningFrameCount, 0);
  const statusTone = warningFrames > 0 ? "#b33f1f" : "#3f6b2f";
  const statusBackground = warningFrames > 0 ? "#fff3e8" : "#edf7e6";

  const rowMarkup = report.rows
    .map((row) => {
      const rowY = sheetY + row.rowIndex * expected.frameHeight;
      const summaryY = rowY + 18;
      return [
        `<text x="24" y="${rowY + 52}" font-size="18" font-weight="700" fill="#20311f">${svgEscape(row.motion)}</text>`,
        `<text x="${sheetX + expected.width + 28}" y="${summaryY}" font-size="14" fill="#455244">${svgEscape(summarizeRowWarnings(row.frames))}</text>`,
      ].join("");
    })
    .join("");

  const columnMarkup = Array.from({ length: expected.columns }, (_, column) => {
    const x = sheetX + column * expected.frameWidth + expected.frameWidth / 2;
    return `<text x="${x}" y="${sheetY - 18}" text-anchor="middle" font-size="14" font-weight="700" fill="#334233">frame ${column}</text>`;
  }).join("");

  const overlayMarkup = report.rows
    .flatMap((row) =>
      row.frames.flatMap((frame) => {
        const frameX = sheetX + frame.column * expected.frameWidth;
        const frameY = sheetY + row.rowIndex * expected.frameHeight;
        const baseRect = `<rect x="${frameX}" y="${frameY}" width="${expected.frameWidth}" height="${expected.frameHeight}" fill="none" stroke="rgba(39,61,35,0.16)" stroke-width="1" />`;
        if (frame.codes.length === 0) {
          return [baseRect];
        }

        const codeBadges = frame.codes
          .slice(0, 3)
          .map((code, index) => {
            const badgeY = frameY + 6 + index * 18;
            return [
              `<rect x="${frameX + 6}" y="${badgeY}" rx="4" ry="4" width="${Math.max(30, code.length * 8 + 10)}" height="14" fill="#b33f1f" opacity="0.92" />`,
              `<text x="${frameX + 12}" y="${badgeY + 11}" font-size="10" font-weight="700" fill="#fffaf5">${svgEscape(code)}</text>`,
            ].join("");
          })
          .join("");

        return [
          baseRect,
          `<rect x="${frameX + 1.5}" y="${frameY + 1.5}" width="${expected.frameWidth - 3}" height="${expected.frameHeight - 3}" fill="none" stroke="#b33f1f" stroke-width="3" />`,
          codeBadges,
        ];
      }),
    )
    .join("");

  const detailMarkup = detailLines.length > 0
    ? detailLines
        .map((line, index) => {
          return `<text x="24" y="${footerStartY + 44 + index * detailLineHeight}" font-size="13" fill="#334233">${svgEscape(line)}</text>`;
        })
        .join("")
    : `<text x="24" y="${footerStartY + 44}" font-size="13" fill="#334233">No heuristic warnings. Human review is still required before ready promotion.</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f5f1e6" />
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="24" ry="24" fill="#fffdfa" stroke="#d8d0bd" />
  <text x="24" y="46" font-size="28" font-weight="700" fill="#20311f">Resident Sprite Visual Audit</text>
  <text x="24" y="72" font-size="15" fill="#435243">resident: ${svgEscape(residentId)}</text>
  <text x="24" y="92" font-size="15" fill="#435243">sheetKind: ${svgEscape(sheetKind)}</text>
  <text x="24" y="112" font-size="15" fill="#435243">source: ${svgEscape(sourceFileName)}</text>
  <text x="24" y="132" font-size="15" fill="#435243">generated: ${svgEscape(generatedAt)} / hash: ${svgEscape(sourceHash)}</text>
  <rect x="${sheetX + expected.width + 24}" y="28" width="336" height="74" rx="16" ry="16" fill="${statusBackground}" stroke="${statusTone}" />
  <text x="${sheetX + expected.width + 44}" y="54" font-size="18" font-weight="700" fill="${statusTone}">status: ${warningFrames > 0 ? "warning" : "pass"}</text>
  <text x="${sheetX + expected.width + 44}" y="76" font-size="14" fill="#435243">warning frames: ${warningFrames} / ${expected.columns * expected.rows}</text>
  <text x="${sheetX + expected.width + 44}" y="96" font-size="14" fill="#435243">ready promotion requires human review and PO check.</text>

  <text x="${sheetX}" y="${sheetY - 48}" font-size="15" fill="#435243">display contract: ${expected.frameWidth}x${expected.frameHeight}, ${expected.columns} columns, ${expected.rows} rows</text>
  <text x="${sheetX}" y="${sheetY - 28}" font-size="15" fill="#435243">expected rows: ${svgEscape(report.expectedRows.join(", "))}</text>
  <text x="${sheetX}" y="${sheetY - 8}" font-size="15" fill="#435243">safe area: left/right ${safeArea.left}px, top/bottom ${safeArea.top}px</text>

  ${columnMarkup}
  <image href="${embeddedPng}" x="${sheetX}" y="${sheetY}" width="${expected.width}" height="${expected.height}" />
  <rect x="${sheetX}" y="${sheetY}" width="${expected.width}" height="${expected.height}" fill="none" stroke="#435243" stroke-width="2" />
  ${rowMarkup}
  ${overlayMarkup}

  <text x="24" y="${footerStartY + 16}" font-size="20" font-weight="700" fill="#20311f">Detailed warnings</text>
  ${detailMarkup}
</svg>
`;
}

function buildReport({
  residentId,
  filePath,
  generatedAt,
  sourceHash,
  sheetKind,
  expectedRows,
  framesByRow,
  svgPath,
  reportPath,
}) {
  const warningsByCode = {};
  let warningFrameCount = 0;

  for (const row of framesByRow) {
    for (const frame of row.frames) {
      if (frame.codes.length > 0) {
        warningFrameCount += 1;
      }
      for (const code of frame.codes) {
        warningsByCode[code] = (warningsByCode[code] ?? 0) + 1;
      }
    }
  }

  return {
    schemaVersion: "resident-sprite-visual-audit-v1",
    residentId,
    sheetKind,
    sourcePath: toRepoRelative(filePath),
    actualFile: path.basename(filePath),
    generatedAt,
    sourceHash,
    expectedRows,
    safeArea,
    imageSize: {
      width: expected.width,
      height: expected.height,
    },
    frameSize: {
      width: expected.frameWidth,
      height: expected.frameHeight,
    },
    rows: framesByRow.map((row) => ({
      motion: row.motion,
      rowIndex: row.rowIndex,
      warningFrameCount: row.frames.filter((frame) => frame.codes.length > 0).length,
      frames: row.frames,
    })),
    summary: {
      totalFrames: expected.columns * expected.rows,
      warningFrameCount,
      warningsByCode,
      suggestedReadyState: warningFrameCount > 0 ? "fallback-or-regenerate" : "human-review-required",
      humanReviewRequired: true,
      poConfirmationRequired: true,
    },
    outputs: {
      contactSheetPath: toRepoRelative(svgPath),
      reportPath: toRepoRelative(reportPath),
    },
  };
}

export function runVisualFrameAudit({
  residentId,
  inputPath,
  outputDir,
  sourceLabel,
  sheetKind,
}) {
  const normalizedInputPath =
    sheetKind &&
    existsSync(inputPath) &&
    statSync(inputPath).isDirectory()
      ? path.join(inputPath, getExpectedFileName(sheetKind))
      : inputPath;
  const pngFiles = collectPngFiles(normalizedInputPath);
  const filePath = pngFiles[0];
  const normalizedResidentId = (residentId ?? inferResidentId(filePath) ?? "resident").toLowerCase();
  const resolvedOutputDir = outputDir ?? toOutputDir(normalizedResidentId);
  mkdirSync(resolvedOutputDir, { recursive: true });
  const normalizedSheetKind = resolveSheetKind(filePath, sheetKind);
  const expectedRows = getRowsForKind(normalizedSheetKind);

  const pngInfo = readPngInfo(filePath);
  if (pngInfo.width !== expected.width || pngInfo.height !== expected.height) {
    throw new Error(
      `見た目監査の対象サイズが違います。期待値は ${expected.width}x${expected.height}px ですが、現在は ${pngInfo.width}x${pngInfo.height}px です。`,
    );
  }

  const rgba = decodeRgba(pngInfo);
  const generatedAt = new Date().toISOString();
  const sourceHash = createHash("sha256").update(pngInfo.bytes).digest("hex").slice(0, 12);
  const baseName = path.parse(filePath).name;

  const framesByRow = expectedRows.map((motion, rowIndex) => ({
    motion,
    rowIndex,
    frames: Array.from({ length: expected.columns }, (_, column) =>
      analyzeFrame(rgba, column, rowIndex, motion),
    ),
  }));

  const svgPath = path.join(resolvedOutputDir, `${baseName}.visual-audit.svg`);
  const reportPath = path.join(resolvedOutputDir, `${baseName}.visual-audit.json`);
  const report = buildReport({
    residentId: normalizedResidentId,
    filePath,
    generatedAt,
    sourceHash,
    sheetKind: normalizedSheetKind,
    expectedRows,
    framesByRow,
    svgPath,
    reportPath,
  });
  const svg = buildAuditSvg({
    residentId: normalizedResidentId,
    sourceFileName: path.basename(sourceLabel ?? filePath),
    sourceHash,
    generatedAt,
    pngInfo,
    sheetKind: normalizedSheetKind,
    report,
  });

  writeFileSync(svgPath, svg, "utf8");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    residentId: normalizedResidentId,
    filePath,
    generatedAt,
    sourceHash,
    sheetKind: normalizedSheetKind,
    svgPath,
    reportPath,
    warningFrameCount: report.summary.warningFrameCount,
    warningsByCode: report.summary.warningsByCode,
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.some(isHelpArg)) {
    printHelp();
    return 0;
  }

  const [targetArg, ...restArgs] = args;

  try {
    let providedKind;
    for (let index = 0; index < restArgs.length; index += 1) {
      const arg = restArgs[index];
      if (arg === "--kind") {
        const value = restArgs[index + 1];
        if (!value || (value !== "motion" && value !== "extended")) {
          throw new Error("--kind には motion または extended を指定してください。");
        }
        providedKind = value;
        index += 1;
        continue;
      }
      throw new Error(`Unknown argument: ${arg}`);
    }

    let residentId = inferResidentId(path.resolve(repoRoot, targetArg));
    let inputPath = path.resolve(repoRoot, targetArg);
    let outputDir;

    if (/^[A-Za-z0-9_-]+$/.test(targetArg)) {
      if (!providedKind) {
        throw new Error("residentId 直指定では --kind motion|extended が必須です。");
      }
      residentId = targetArg.toLowerCase();
      assertResidentId(residentId);
      inputPath = toIncomingDir(residentId);
      outputDir = toOutputDir(residentId);
    } else if (existsSync(inputPath) && statSync(inputPath).isDirectory() && !providedKind) {
      throw new Error("フォルダ指定では --kind motion|extended が必須です。");
    }

    const result = runVisualFrameAudit({
      residentId,
      inputPath,
      outputDir,
      sheetKind: providedKind,
    });

    const hasWarnings = result.warningFrameCount > 0;

    console.log("見た目監査が完了しました。");
    console.log(`監査対象: ${toRepoRelative(result.filePath)}`);
    console.log(`sheet kind: ${result.sheetKind}`);
    console.log(`contact sheet: ${toRepoRelative(result.svgPath)}`);
    console.log(`report: ${toRepoRelative(result.reportPath)}`);
    console.log(`warning frames: ${result.warningFrameCount}`);
    if (Object.keys(result.warningsByCode).length > 0) {
      console.log(
        `warning codes: ${Object.entries(result.warningsByCode)
          .map(([code, count]) => `${code}x${count}`)
          .join(", ")}`,
      );
    }
    if (hasWarnings) {
      console.log("note: warnings are heuristic hints for human review — exit code is 0 (not a failure)");
    }
    console.log("Human review と PO 確認が終わるまで ready にしないでください。");
    return 0;
  } catch (error) {
    console.error("見た目監査を完了できませんでした。");
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
