#!/usr/bin/env node
import { deflateSync, inflateSync } from "node:zlib";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
  console.log(`Resident sprite alpha normalizer

使い方:
  node tools/asset-pipeline/normalize-resident-sprite-alpha.mjs <residentId>
  node tools/asset-pipeline/normalize-resident-sprite-alpha.mjs <residentId> <png-file-or-folder>
  node tools/asset-pipeline/normalize-resident-sprite-alpha.mjs <residentId> <png-file> --tolerance=24

例:
  node tools/asset-pipeline/normalize-resident-sprite-alpha.mjs eve

入力:
  assets/generated/residents/<residentId>/incoming/

出力:
  assets/generated/residents/<residentId>/tmp/resident-<id>-sprite-alpha-candidate-<timestamp>.png

注意:
  - 元画像は上書きしません。
  - 出力はGit管理外のtmpに置きます。
  - 背景透明化の候補なので、必ず目視確認してください。
  - 採用済みassetへコピーしません。
  - 画像生成APIを呼びません。`);
}

function toRepoRelative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function assertResidentId(residentId) {
  if (!/^[A-Za-z0-9_-]+$/.test(residentId)) {
    throw new Error("住民IDに使えるのは英数字、ハイフン、アンダースコアだけです。");
  }
}

function toIncomingDir(residentId) {
  return path.join(repoRoot, "assets", "generated", "residents", residentId, "incoming");
}

function toTmpDir(residentId) {
  return path.join(repoRoot, "assets", "generated", "residents", residentId, "tmp");
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
    throw new Error(`これは処理できるファイルまたはフォルダではありません: ${toRepoRelative(targetPath)}`);
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

function parseArgs(args) {
  const options = {
    tolerance: 24,
  };
  const positional = [];

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg.startsWith("--tolerance=")) {
      const value = Number(arg.slice("--tolerance=".length));
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error("toleranceは0〜255の整数で指定してください。");
      }
      options.tolerance = value;
      continue;
    }

    positional.push(arg);
  }

  return { positional, options };
}

function readChunks(bytes) {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error("PNGファイルではありません。ChatGPTからPNGとして保存した画像を選んでください。");
  }

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

function readPng(filePath) {
  const bytes = readFileSync(filePath);
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

function isBackgroundPixel({ red, green, blue }, background, tolerance) {
  return (
    Math.abs(red - background.red) <= tolerance &&
    Math.abs(green - background.green) <= tolerance &&
    Math.abs(blue - background.blue) <= tolerance
  );
}

function toRgbaScanlines(rgbPixels, width, height, tolerance) {
  const rgba = Buffer.alloc(width * height * 4);
  const background = {
    red: rgbPixels[0],
    green: rgbPixels[1],
    blue: rgbPixels[2],
  };

  let transparentCount = 0;

  for (let index = 0; index < width * height; index += 1) {
    const rgbOffset = index * 3;
    const rgbaOffset = index * 4;
    const pixel = {
      red: rgbPixels[rgbOffset],
      green: rgbPixels[rgbOffset + 1],
      blue: rgbPixels[rgbOffset + 2],
    };
    const transparent = isBackgroundPixel(pixel, background, tolerance);

    rgba[rgbaOffset] = pixel.red;
    rgba[rgbaOffset + 1] = pixel.green;
    rgba[rgbaOffset + 2] = pixel.blue;
    rgba[rgbaOffset + 3] = transparent ? 0 : 255;

    if (transparent) {
      transparentCount += 1;
    }
  }

  return {
    rgba,
    background,
    transparentCount,
  };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
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

  const pngBytes = Buffer.concat([
    pngSignature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", deflateSync(raw)),
    makeChunk("IEND"),
  ]);

  writeFileSync(filePath, pngBytes);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function normalizeAlpha({ residentId, inputPath, tolerance }) {
  const png = readPng(inputPath);
  if (png.width !== expected.width || png.height !== expected.height) {
    throw new Error(`画像サイズが ${expected.width}x${expected.height}px ではありません。現在は ${png.width}x${png.height}px です。`);
  }
  if (png.bitDepth !== 8 || png.interlaceMethod !== 0 || png.compressionMethod !== 0 || png.filterMethod !== 0) {
    throw new Error("このPNG形式は最小normalizerでは処理できません。8bit / non-interlaced PNGとして保存し直してください。");
  }
  if (hasAlphaChannel(png.colorType)) {
    return {
      alreadyAlpha: true,
      outputPath: null,
      transparentCount: countTransparentPixels(png),
      background: null,
    };
  }
  if (png.colorType !== 2) {
    throw new Error("alpha channelなしPNGですが、RGB形式ではありません。RGB PNGとして保存し直してください。");
  }

  const inflated = inflateSync(png.compressedData);
  const rgbPixels = unfilterScanlines(inflated, png.width, png.height, 3);
  const rgbaResult = toRgbaScanlines(rgbPixels, png.width, png.height, tolerance);

  const outputDir = toTmpDir(residentId);
  mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `resident-${residentId}-sprite-alpha-candidate-${timestamp()}.png`);
  writeRgbaPng(outputPath, png.width, png.height, rgbaResult.rgba);

  return {
    alreadyAlpha: false,
    outputPath,
    transparentCount: rgbaResult.transparentCount,
    background: rgbaResult.background,
  };
}

function resolveInput(residentId, inputArg) {
  const targetPath = inputArg ? path.resolve(repoRoot, inputArg) : toIncomingDir(residentId);
  const pngFiles = collectPngFiles(targetPath);
  return pngFiles[0];
}

function main() {
  try {
    const { positional, options } = parseArgs(process.argv.slice(2));
    if (options.help || positional.length === 0) {
      printHelp();
      return 0;
    }

    const [residentIdRaw, inputArg] = positional;
    assertResidentId(residentIdRaw);
    const residentId = residentIdRaw.toLowerCase();
    const inputPath = resolveInput(residentId, inputArg);
    const result = normalizeAlpha({
      residentId,
      inputPath,
      tolerance: options.tolerance,
    });

    if (result.alreadyAlpha) {
      console.log(`入力: ${toRepoRelative(inputPath)}`);
      console.log("このPNGにはalpha channelがあります。");
      console.log(`透明ピクセル数: ${result.transparentCount}`);
      console.log("元画像は変更していません。");
      if (result.transparentCount === 0) {
        console.error("注意: alpha channelはありますが、透明ピクセルが0件です。");
        console.error("背景透過されていない可能性があります。画像を確認し、必要なら背景除去し直してください。");
        return 1;
      }
      console.log("次に validator と processor へ進められます。");
      return 0;
    }

    console.log("alpha化候補を作成しました。");
    console.log("これは候補です。必ず目視確認してください。");
    console.log(`入力: ${toRepoRelative(inputPath)}`);
    console.log(`出力: ${toRepoRelative(result.outputPath)}`);
    console.log(`背景として扱った色: rgb(${result.background.red}, ${result.background.green}, ${result.background.blue})`);
    console.log(`透明化したピクセル数: ${result.transparentCount}`);
    console.log("元画像は上書きしていません。");
    console.log("出力先はGit管理外のtmpです。");
    console.log("問題なければ、この候補PNGをincomingへ置いて validator と processor に進めてください。");
    return 0;
  } catch (error) {
    console.error("alpha化できませんでした。");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("元画像は変更していません。PNGを保存し直すか、別の背景除去手段を使ってください。");
    return 1;
  }
}

process.exitCode = main();
