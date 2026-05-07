#!/usr/bin/env node
import { inflateSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expected = {
  width: 1536,
  height: 1872,
};

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

function printHelp() {
  console.log(`Resident sprite alpha checker

使い方:
  node tools/asset-pipeline/check-resident-sprite-alpha.mjs <residentId>
  node tools/asset-pipeline/check-resident-sprite-alpha.mjs <png-file-or-folder>
  node tools/asset-pipeline/check-resident-sprite-alpha.mjs --all

例:
  node tools/asset-pipeline/check-resident-sprite-alpha.mjs eve

見る場所:
  assets/generated/residents/<residentId>/incoming/

確認すること:
  - PNGファイルであること
  - 画像サイズが ${expected.width}x${expected.height}px であること
  - alpha channelを持つPNGであること
  - 透明ピクセルが1件以上あること
  - これは single-sheet の技術確認だけです。2-sheet ready 判定には \`npm run sprite:check -- <slug>\` を使ってください。
  - この確認では画像を変更しません。`);
}

function toRepoRelative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function isHelpArg(value) {
  return value === "--help" || value === "-h";
}

function toResidentIncomingDir(residentId) {
  return path.join(repoRoot, "assets", "generated", "residents", residentId, "incoming");
}

function resolveTarget(arg) {
  if (arg === "--all") {
    const residentsRoot = path.join(repoRoot, "assets", "generated", "residents");
    if (!existsSync(residentsRoot)) {
      return [];
    }

    return readdirSync(residentsRoot)
      .map((name) => toResidentIncomingDir(name))
      .filter((candidate) => existsSync(candidate) && statSync(candidate).isDirectory());
  }

  if (/^[A-Za-z0-9_-]+$/.test(arg)) {
    return [toResidentIncomingDir(arg.toLowerCase())];
  }

  return [path.resolve(repoRoot, arg)];
}

function collectPngFiles(targetPath) {
  if (!existsSync(targetPath)) {
    return {
      files: [],
      problem: `フォルダまたはファイルが見つかりません: ${toRepoRelative(targetPath)}`,
    };
  }

  const stats = statSync(targetPath);
  if (stats.isFile()) {
    return {
      files: [targetPath],
      problem: null,
    };
  }

  if (!stats.isDirectory()) {
    return {
      files: [],
      problem: `これは確認できるファイルまたはフォルダではありません: ${toRepoRelative(targetPath)}`,
    };
  }

  const files = readdirSync(targetPath)
    .map((name) => path.join(targetPath, name))
    .filter((candidate) => {
      try {
        return statSync(candidate).isFile() && candidate.toLowerCase().endsWith(".png");
      } catch {
        return false;
      }
    });

  if (files.length === 0) {
    return {
      files,
      problem: `PNGファイルが見つかりません: ${toRepoRelative(targetPath)}`,
    };
  }

  return {
    files,
    problem: null,
  };
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
    return {
      ok: false,
      reason: "PNGファイルではありません。ChatGPTからPNGとして保存した画像を選んでください。",
      info: null,
    };
  }

  try {
    const chunks = readChunks(bytes);
    const ihdr = chunks.find((chunk) => chunk.type === "IHDR");
    const idats = chunks.filter((chunk) => chunk.type === "IDAT");

    if (!ihdr || ihdr.data.length !== 13) {
      return {
        ok: false,
        reason: "PNGの先頭情報を読めませんでした。画像を保存し直してください。",
        info: null,
      };
    }
    if (idats.length === 0) {
      return {
        ok: false,
        reason: "PNGの画像データを読めませんでした。画像を保存し直してください。",
        info: null,
      };
    }

    return {
      ok: true,
      reason: null,
      info: {
        width: ihdr.data.readUInt32BE(0),
        height: ihdr.data.readUInt32BE(4),
        bitDepth: ihdr.data.readUInt8(8),
        colorType: ihdr.data.readUInt8(9),
        compressionMethod: ihdr.data.readUInt8(10),
        filterMethod: ihdr.data.readUInt8(11),
        interlaceMethod: ihdr.data.readUInt8(12),
        compressedData: Buffer.concat(idats.map((chunk) => chunk.data)),
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "PNGの中身を読めませんでした。画像を保存し直してください。",
      info: null,
    };
  }
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
      const upperLeft = row > 0 && column >= bytesPerPixel
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

function countTransparentPixels(pngInfo) {
  if (!hasAlphaChannel(pngInfo.colorType)) {
    return null;
  }
  if (pngInfo.bitDepth !== 8 || pngInfo.interlaceMethod !== 0 || pngInfo.compressionMethod !== 0 || pngInfo.filterMethod !== 0) {
    throw new Error("透明ピクセル数を確認できないPNG形式です。8bit / non-interlaced PNGとして保存し直してください。");
  }

  const bytesPerPixel = pngInfo.colorType === 6 ? 4 : 2;
  const alphaOffset = pngInfo.colorType === 6 ? 3 : 1;
  const inflated = inflateSync(pngInfo.compressedData);
  const pixels = unfilterScanlines(inflated, pngInfo.width, pngInfo.height, bytesPerPixel);
  let transparentCount = 0;

  for (let offset = alphaOffset; offset < pixels.length; offset += bytesPerPixel) {
    if (pixels[offset] === 0) {
      transparentCount += 1;
    }
  }

  return transparentCount;
}

function inferResidentId(filePath) {
  const parts = toRepoRelative(filePath).split("/");
  const residentsIndex = parts.findIndex((part, index) => {
    return part === "residents" && parts[index - 1] === "generated";
  });

  return residentsIndex >= 0 ? parts[residentsIndex + 1] : null;
}

function validateFile(filePath) {
  const relative = toRepoRelative(filePath);
  const png = readPngInfo(filePath);

  if (!png.ok) {
    return {
      ok: false,
      lines: [`NG: ${relative}`, `  ${png.reason}`],
    };
  }

  const failures = [];
  let transparentCount = null;
  if (png.info.width !== expected.width) {
    failures.push(`横幅が ${expected.width}px ではありません。現在は ${png.info.width}px です。`);
  }
  if (png.info.height !== expected.height) {
    failures.push(`高さが ${expected.height}px ではありません。現在は ${png.info.height}px です。`);
  }
  if (!hasAlphaChannel(png.info.colorType)) {
    failures.push("alpha channelがありません。背景を透明にした候補PNGを作ってください。");
  } else {
    try {
      transparentCount = countTransparentPixels(png.info);
      if (transparentCount === 0) {
        failures.push("alpha channelはありますが、透明ピクセルが0件です。背景が透過されていない可能性があります。");
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "透明ピクセル数を確認できませんでした。画像を保存し直してください。");
    }
  }

  if (failures.length > 0) {
    const residentId = inferResidentId(filePath);
    const normalizeCommand = residentId
      ? `node tools/asset-pipeline/normalize-resident-sprite-alpha.mjs ${residentId} ${relative}`
      : "node tools/asset-pipeline/normalize-resident-sprite-alpha.mjs <residentId> <png-file>";

    return {
      ok: false,
      lines: [
        `NG: ${relative}`,
        ...failures.map((failure) => `  ${failure}`),
        "  alpha化候補を作る場合:",
        `  ${normalizeCommand}`,
      ],
    };
  }

  return {
    ok: true,
    lines: [
      `OK: ${relative}`,
      `  ${expected.width}x${expected.height}px のPNGです。`,
      "  alpha channelがあります。",
      `  透明ピクセル数: ${transparentCount}`,
      "  次に validator と processor へ進められます。",
    ],
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.some(isHelpArg)) {
    printHelp();
    return 0;
  }

  const targets = args.flatMap(resolveTarget);
  if (targets.length === 0) {
    console.error("確認するincomingフォルダが見つかりませんでした。");
    console.error("先に tools/asset-pipeline/setup-resident-asset-folders.bat を実行してください。");
    return 1;
  }

  let checkedCount = 0;
  let failedCount = 0;

  for (const target of targets) {
    const collection = collectPngFiles(target);
    if (collection.problem) {
      console.error(`NG: ${collection.problem}`);
      failedCount += 1;
      continue;
    }

    for (const filePath of collection.files) {
      const result = validateFile(filePath);
      checkedCount += 1;
      if (!result.ok) {
        failedCount += 1;
      }
      console.log(result.lines.join("\n"));
    }
  }

  if (checkedCount === 0) {
    console.error("確認できるPNGファイルがありませんでした。");
    return 1;
  }

  if (failedCount > 0) {
    console.error(`確認結果: ${failedCount}件にalpha化または修正が必要です。`);
    return 1;
  }

  console.log(`確認結果: ${checkedCount}件すべてOKです。`);
  console.log("これは single-sheet の alpha 確認だけです。ready 判定には sprite:check を使ってください。");
  return 0;
}

process.exitCode = main();
