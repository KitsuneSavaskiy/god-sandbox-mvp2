#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

const defaults = {
  frameWidth: 192,
  frameHeight: 208,
  minMarginX: 10,
  minMarginTop: 8,
  minMarginBottom: 8,
  edgeBand: 8,
  rowSeamBand: 8,
  minComponentArea: 12,
  significantComponentRatio: 0.015,
  detachedComponentGap: 12,
};

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

const combinedRows17 = [
  ...motionRows,
  ...extendedRows.slice(0, 8),
];

const combinedRows16 = [
  "idle",
  "walk-right",
  "walk-left",
  "waving",
  "jumping",
  "failed",
  "running",
  "review",
  ...extendedRows.slice(0, 8),
];

const combinedRows14 = [
  "idle",
  "walk-right",
  "walk-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "review",
  "walk-up",
  "walk-down",
  "emote-happy",
  "emote-angry",
  "emote-sad",
  "emote-surprised",
];

function printHelp() {
  console.log(`Resident sprite frame-fit evaluator

使い方:
  node tools/asset-pipeline/evaluate-sprite-frame-fit.mjs <png> --kind motion --columns 4 --rows 9
  node tools/asset-pipeline/evaluate-sprite-frame-fit.mjs <png> --kind extended --columns 4 --rows 9 --blank-row 8
  node tools/asset-pipeline/evaluate-sprite-frame-fit.mjs <png> --kind combined --columns 7 --rows 14 --frame-width 118 --frame-height 136 --min-margin-x 3 --min-margin-top 3 --min-margin-bottom 3 --edge-band 3 --row-seam-band 3
  node tools/asset-pipeline/evaluate-sprite-frame-fit.mjs <png> --kind combined --columns 7 --rows 14 --frame-width 118 --frame-height 136 --wide-row 5:2:3
  node tools/asset-pipeline/evaluate-sprite-frame-fit.mjs <png> --kind combined --columns 7 --rows 14 --frame-width 118 --frame-height 136 --mixed-row 5:1,1,1,2,2
  node tools/asset-pipeline/evaluate-sprite-frame-fit.mjs <png> --kind combined --columns 8 --rows 17
  node tools/asset-pipeline/evaluate-sprite-frame-fit.mjs <png> --kind combined --columns 7 --rows 16
  node tools/asset-pipeline/evaluate-sprite-frame-fit.mjs <png> --kind combined --columns 7 --rows 17

見ること:
  - 実画像サイズが columns × frameWidth / rows × frameHeight と一致する
  - 各セルが空でない。ただし --blank-row は完全透明
  - 各セルの見えるピクセルが上下左右の安全余白を守る
  - 空白を含む各行のセル高さが厳密に frameHeight と一致する
  - 行境界の上下に、前後行から混入したような画素がない
  - セル上端/下端の帯に、前後行から混入したような部品がない
  - 主要キャラ本体から離れた大きめの部品がない
  - --wide-row row:span:frames を指定した行は、spanセル幅を1コマとして評価する
  - --mixed-row row:span,span,... を指定した行は、コマごとに違うセル幅で評価する

この評価は PO preview の足切りです。canonical ready 判定ではありません。`);
}

function parseArgs(argv) {
  const args = {
    file: null,
    kind: null,
    columns: 8,
    rows: 9,
    frameWidth: defaults.frameWidth,
    frameHeight: defaults.frameHeight,
    minMarginX: defaults.minMarginX,
    minMarginTop: defaults.minMarginTop,
    minMarginBottom: defaults.minMarginBottom,
    edgeBand: defaults.edgeBand,
    rowSeamBand: defaults.rowSeamBand,
    blankRows: new Set(),
    wideRows: new Map(),
    mixedRows: new Map(),
    out: null,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }
    if (!args.file && !value.startsWith("--")) {
      args.file = value;
      continue;
    }
    if (value === "--kind") {
      args.kind = argv[++index];
      continue;
    }
    if (value === "--columns") {
      args.columns = Number(argv[++index]);
      continue;
    }
    if (value === "--rows") {
      args.rows = Number(argv[++index]);
      continue;
    }
    if (value === "--frame-width") {
      args.frameWidth = Number(argv[++index]);
      continue;
    }
    if (value === "--frame-height") {
      args.frameHeight = Number(argv[++index]);
      continue;
    }
    if (value === "--min-margin-x") {
      args.minMarginX = Number(argv[++index]);
      continue;
    }
    if (value === "--min-margin-top") {
      args.minMarginTop = Number(argv[++index]);
      continue;
    }
    if (value === "--min-margin-bottom") {
      args.minMarginBottom = Number(argv[++index]);
      continue;
    }
    if (value === "--edge-band") {
      args.edgeBand = Number(argv[++index]);
      continue;
    }
    if (value === "--row-seam-band") {
      args.rowSeamBand = Number(argv[++index]);
      continue;
    }
    if (value === "--blank-row") {
      args.blankRows.add(Number(argv[++index]));
      continue;
    }
    if (value === "--wide-row") {
      const raw = argv[++index];
      const [rowRaw, spanRaw, framesRaw] = raw.split(":");
      const row = Number(rowRaw);
      const span = Number(spanRaw);
      const frames = Number(framesRaw);
      if (!Number.isInteger(row) || !Number.isInteger(span) || !Number.isInteger(frames) || row < 0 || span <= 0 || frames <= 0) {
        throw new Error("--wide-row must be row:span:frames, for example 5:2:3.");
      }
      args.wideRows.set(row, { span, frames });
      continue;
    }
    if (value === "--mixed-row") {
      const raw = argv[++index];
      const [rowRaw, spansRaw] = raw.split(":");
      const row = Number(rowRaw);
      const spans = spansRaw?.split(",").map((item) => Number(item)) ?? [];
      if (!Number.isInteger(row) || row < 0 || spans.length === 0 || spans.some((span) => !Number.isInteger(span) || span <= 0)) {
        throw new Error("--mixed-row must be row:span,span,..., for example 5:1,1,1,2,2.");
      }
      args.mixedRows.set(row, { spans });
      continue;
    }
    if (value === "--out") {
      args.out = argv[++index];
      continue;
    }
    if (value === "--json") {
      args.json = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  if (!args.file) {
    throw new Error("PNG file is required.");
  }
  if (!["motion", "extended", "combined"].includes(args.kind)) {
    throw new Error("--kind motion|extended|combined is required.");
  }
  for (const numericKey of ["columns", "rows", "frameWidth", "frameHeight"]) {
    if (!Number.isInteger(args[numericKey]) || args[numericKey] <= 0) {
      throw new Error(`${numericKey} must be a positive integer.`);
    }
  }
  for (const numericKey of ["minMarginX", "minMarginTop", "minMarginBottom", "edgeBand", "rowSeamBand"]) {
    if (!Number.isInteger(args[numericKey]) || args[numericKey] < 0) {
      throw new Error(`${numericKey} must be a non-negative integer.`);
    }
  }
  for (const [row, spec] of args.wideRows) {
    if (row >= args.rows) {
      throw new Error(`--wide-row row ${row} is outside rows=${args.rows}.`);
    }
    if (spec.span * spec.frames > args.columns) {
      throw new Error(`--wide-row ${row}:${spec.span}:${spec.frames} exceeds columns=${args.columns}.`);
    }
  }
  for (const [row, spec] of args.mixedRows) {
    if (row >= args.rows) {
      throw new Error(`--mixed-row row ${row} is outside rows=${args.rows}.`);
    }
    const totalSpan = spec.spans.reduce((sum, span) => sum + span, 0);
    if (totalSpan > args.columns) {
      throw new Error(`--mixed-row ${row}:${spec.spans.join(",")} exceeds columns=${args.columns}.`);
    }
    if (args.wideRows.has(row)) {
      throw new Error(`row ${row} cannot be both --wide-row and --mixed-row.`);
    }
  }

  return args;
}

function readChunks(bytes) {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(pngSignature)) {
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

function unfilterScanline(filter, current, previous, bytesPerPixel) {
  const output = Buffer.alloc(current.length);
  for (let index = 0; index < current.length; index += 1) {
    const left = index >= bytesPerPixel ? output[index - bytesPerPixel] : 0;
    const up = previous ? previous[index] : 0;
    const upLeft = previous && index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    let value;
    if (filter === 0) {
      value = current[index];
    } else if (filter === 1) {
      value = current[index] + left;
    } else if (filter === 2) {
      value = current[index] + up;
    } else if (filter === 3) {
      value = current[index] + Math.floor((left + up) / 2);
    } else if (filter === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left);
      const pb = Math.abs(p - up);
      const pc = Math.abs(p - upLeft);
      const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      value = current[index] + predictor;
    } else {
      throw new Error(`Unsupported PNG filter: ${filter}`);
    }
    output[index] = value & 0xff;
  }
  return output;
}

function readPngRgba(filePath) {
  const bytes = readFileSync(filePath);
  const chunks = readChunks(bytes);
  const header = chunks.find((chunk) => chunk.type === "IHDR");
  if (!header) throw new Error("PNG IHDR chunk is missing.");

  const width = header.data.readUInt32BE(0);
  const height = header.data.readUInt32BE(4);
  const bitDepth = header.data[8];
  const colorType = header.data[9];
  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error("Only 8-bit RGBA PNG is supported for frame-fit evaluation.");
  }

  const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
  const inflated = inflateSync(compressed);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rgba = Buffer.alloc(width * height * bytesPerPixel);

  let offset = 0;
  let previous = null;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[offset];
    offset += 1;
    const raw = inflated.subarray(offset, offset + stride);
    offset += stride;
    const scanline = unfilterScanline(filter, raw, previous, bytesPerPixel);
    scanline.copy(rgba, y * stride);
    previous = scanline;
  }

  return { width, height, rgba };
}

function alphaAt(png, x, y) {
  return png.rgba[(y * png.width + x) * 4 + 3];
}

function analyzeComponents(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (visited[start] || mask[start] === 0) continue;
    visited[start] = 1;
    const queue = [start];
    let cursor = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (cursor < queue.length) {
      const current = queue[cursor];
      cursor += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (visited[next] || mask[next] === 0) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }

    components.push({
      area,
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }

  return components.sort((a, b) => b.area - a.area);
}

function analyzeFrameAt(png, x0, y0, width, height, column, row, options) {
  const mask = new Uint8Array(width * height);
  let pixelCount = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let topBandPixels = 0;
  let bottomBandPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = alphaAt(png, x0 + x, y0 + y);
      if (alpha === 0) continue;
      mask[y * width + x] = 1;
      pixelCount += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (y < options.edgeBand) topBandPixels += 1;
      if (y >= height - options.edgeBand) bottomBandPixels += 1;
    }
  }

  const components = analyzeComponents(mask, width, height);
  const main = components[0] ?? null;
  const significantThreshold = main
    ? Math.max(defaults.minComponentArea, Math.floor(main.area * defaults.significantComponentRatio))
    : defaults.minComponentArea;
  const significantDetachedComponents = components
    .slice(1)
    .filter((component) => component.area >= significantThreshold);

  return {
    column,
    row,
    pixelCount,
    blank: pixelCount === 0,
    bounds: pixelCount === 0 ? null : { minX, maxX, minY, maxY },
    margins:
      pixelCount === 0
        ? null
        : {
            left: minX,
            right: width - 1 - maxX,
            top: minY,
            bottom: height - 1 - maxY,
          },
    topBandPixels,
    bottomBandPixels,
    componentCount: components.length,
    mainComponent: main,
    significantDetachedComponents,
  };
}

function analyzeFrame(png, column, row, options) {
  return analyzeFrameAt(
    png,
    column * options.frameWidth,
    row * options.frameHeight,
    options.frameWidth,
    options.frameHeight,
    column,
    row,
    options,
  );
}

function countVisiblePixelsInRect(png, xStart, yStart, width, height) {
  let pixelCount = 0;
  const xEnd = Math.min(png.width, xStart + width);
  const yEnd = Math.min(png.height, yStart + height);

  for (let y = Math.max(0, yStart); y < yEnd; y += 1) {
    for (let x = Math.max(0, xStart); x < xEnd; x += 1) {
      if (alphaAt(png, x, y) > 0) {
        pixelCount += 1;
      }
    }
  }

  return pixelCount;
}

function rowNamesForKind(kind, rows) {
  if (kind === "extended") return extendedRows;
  if (kind === "combined" && rows === 14) return combinedRows14;
  if (kind === "combined" && rows === 16) return combinedRows16;
  if (kind === "combined") return combinedRows17;
  return motionRows;
}

function bboxGap(a, b) {
  const gapX = Math.max(0, Math.max(a.minX - b.maxX - 1, b.minX - a.maxX - 1));
  const gapY = Math.max(0, Math.max(a.minY - b.maxY - 1, b.minY - a.maxY - 1));
  return Math.max(gapX, gapY);
}

function countVisiblePixelsInGlobalBand(png, yStart, yEnd) {
  const start = Math.max(0, yStart);
  const end = Math.min(png.height - 1, yEnd);
  let pixelCount = 0;

  for (let y = start; y <= end; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (alphaAt(png, x, y) > 0) {
        pixelCount += 1;
      }
    }
  }

  return pixelCount;
}

function summarizeRowGeometry(png, rows, rowNames, options, hardFailures) {
  const actualRowHeight = png.height / options.rows;
  const uniformCellHeight = Number.isInteger(actualRowHeight) && actualRowHeight === options.frameHeight;

  if (!uniformCellHeight) {
    hardFailures.push({
      code: "row-cell-height-mismatch",
      message: `Expected every row cell to be exactly ${options.frameHeight}px high, got imageHeight / rows = ${actualRowHeight}.`,
    });
  }

  const seams = [];
  for (let row = 1; row < options.rows; row += 1) {
    const seamY = row * options.frameHeight;
    const visiblePixels = countVisiblePixelsInGlobalBand(
      png,
      seamY - options.rowSeamBand,
      seamY + options.rowSeamBand - 1,
    );
    const seam = {
      betweenRows: [row - 1, row],
      y: seamY,
      band: options.rowSeamBand,
      visiblePixels,
    };
    seams.push(seam);
    if (visiblePixels > 0) {
      hardFailures.push({
        code: "row-seam-contamination",
        message: `Row seam ${row - 1}/${row} has ${visiblePixels} visible pixels within ${options.rowSeamBand}px seam band.`,
      });
    }
  }

  return {
    uniformCellHeight,
    expectedCellHeight: options.frameHeight,
    actualCellHeight: actualRowHeight,
    rowCount: options.rows,
    rows: rows.map((rowSummary) => {
      const visibleFrames = rowSummary.frames.filter((frame) => !frame.blank);
      const contentHeights = visibleFrames
        .map((frame) => frame.mainComponent?.height ?? (frame.bounds ? frame.bounds.maxY - frame.bounds.minY + 1 : null))
        .filter((height) => height !== null);
      const topMargins = visibleFrames.map((frame) => frame.margins?.top).filter((margin) => margin !== undefined);
      const bottomMargins = visibleFrames.map((frame) => frame.margins?.bottom).filter((margin) => margin !== undefined);

      return {
        row: rowSummary.row,
        motion: rowNames[rowSummary.row] ?? null,
        cellTop: rowSummary.row * options.frameHeight,
        cellBottom: (rowSummary.row + 1) * options.frameHeight - 1,
        cellHeight: options.frameHeight,
        expectedBlank: rowSummary.expectedBlank,
        visibleFrameCount: visibleFrames.length,
        contentHeight:
          contentHeights.length === 0
            ? null
            : {
                min: Math.min(...contentHeights),
                max: Math.max(...contentHeights),
                delta: Math.max(...contentHeights) - Math.min(...contentHeights),
              },
        topMargin:
          topMargins.length === 0
            ? null
            : {
                min: Math.min(...topMargins),
                max: Math.max(...topMargins),
              },
        bottomMargin:
          bottomMargins.length === 0
            ? null
            : {
                min: Math.min(...bottomMargins),
                max: Math.max(...bottomMargins),
              },
      };
    }),
    seams,
  };
}

function evaluate(filePath, options) {
  const png = readPngRgba(filePath);
  const expectedWidth = options.columns * options.frameWidth;
  const expectedHeight = options.rows * options.frameHeight;
  const hardFailures = [];
  const warnings = [];

  if (png.width !== expectedWidth || png.height !== expectedHeight) {
    hardFailures.push({
      code: "canvas-mismatch",
      message: `Expected ${expectedWidth}x${expectedHeight}, got ${png.width}x${png.height}.`,
    });
  }

  const rows = [];
  const rowNames = rowNamesForKind(options.kind, options.rows);

  for (let row = 0; row < options.rows; row += 1) {
    const frames = [];
    const expectedBlank = options.blankRows.has(row);
    const mixedSpec = options.mixedRows.get(row);
    if (mixedSpec && !expectedBlank) {
      let cellStart = 0;
      for (let frameIndex = 0; frameIndex < mixedSpec.spans.length; frameIndex += 1) {
        const span = mixedSpec.spans[frameIndex];
        const frame = analyzeFrameAt(
          png,
          cellStart * options.frameWidth,
          row * options.frameHeight,
          span * options.frameWidth,
          options.frameHeight,
          frameIndex,
          row,
          options,
        );
        frames.push({
          ...frame,
          mixedFrame: true,
          columnStart: cellStart,
          columnSpan: span,
        });
        const label = `row ${row} ${rowNames[row] ?? "row"} mixed-frame ${frameIndex}`;

        if (frame.blank) {
          hardFailures.push({ code: "empty-mixed-frame", message: `${label} is empty.` });
          cellStart += span;
          continue;
        }

        if (frame.margins.top < options.minMarginTop) {
          hardFailures.push({ code: "top-crop-risk", message: `${label} top margin ${frame.margins.top}px < ${options.minMarginTop}px.` });
        }
        if (frame.margins.bottom < options.minMarginBottom) {
          hardFailures.push({ code: "bottom-crop-risk", message: `${label} bottom margin ${frame.margins.bottom}px < ${options.minMarginBottom}px.` });
        }
        if (frame.margins.left < options.minMarginX) {
          hardFailures.push({ code: "left-crop-risk", message: `${label} left margin ${frame.margins.left}px < ${options.minMarginX}px.` });
        }
        if (frame.margins.right < options.minMarginX) {
          hardFailures.push({ code: "right-crop-risk", message: `${label} right margin ${frame.margins.right}px < ${options.minMarginX}px.` });
        }
        if (frame.topBandPixels > 0) {
          hardFailures.push({ code: "top-band-contamination", message: `${label} has ${frame.topBandPixels} visible pixels in top ${options.edgeBand}px band.` });
        }
        if (frame.bottomBandPixels > 0) {
          hardFailures.push({ code: "bottom-band-contamination", message: `${label} has ${frame.bottomBandPixels} visible pixels in bottom ${options.edgeBand}px band.` });
        }

        const largeDetached = frame.significantDetachedComponents.filter((component) => {
          if (frame.mainComponent && bboxGap(frame.mainComponent, component) <= defaults.detachedComponentGap) {
            return false;
          }
          return true;
        });
        if (largeDetached.length > 0) {
          hardFailures.push({
            code: "detached-body-part-risk",
            message: `${label} has ${largeDetached.length} significant detached component(s).`,
          });
        } else if (frame.significantDetachedComponents.length > 0) {
          warnings.push({
            code: "small-detached-effect",
            message: `${label} has small detached component(s).`,
          });
        }

        cellStart += span;
      }

      const unusedStartX = cellStart * options.frameWidth;
      const unusedWidth = options.columns * options.frameWidth - unusedStartX;
      if (unusedWidth > 0) {
        const unusedPixels = countVisiblePixelsInRect(
          png,
          unusedStartX,
          row * options.frameHeight,
          unusedWidth,
          options.frameHeight,
        );
        if (unusedPixels > 0) {
          hardFailures.push({
            code: "mixed-row-unused-tail-has-pixels",
            message: `row ${row} ${rowNames[row] ?? "row"} unused tail has ${unusedPixels} visible pixels.`,
          });
        }
      }

      rows.push({
        row,
        motion: rowNames[row] ?? null,
        expectedBlank,
        mixedFrameSpans: mixedSpec.spans,
        frames,
      });
      continue;
    }
    const wideSpec = options.wideRows.get(row);
    if (wideSpec && !expectedBlank) {
      const wideOptions = {
        ...options,
        frameWidth: options.frameWidth * wideSpec.span,
      };
      for (let frameIndex = 0; frameIndex < wideSpec.frames; frameIndex += 1) {
        const frame = analyzeFrame(png, frameIndex, row, wideOptions);
        frames.push({
          ...frame,
          wideFrame: true,
          columnStart: frameIndex * wideSpec.span,
          columnSpan: wideSpec.span,
        });
        const label = `row ${row} ${rowNames[row] ?? "row"} wide-frame ${frameIndex}`;

        if (frame.blank) {
          hardFailures.push({ code: "empty-wide-frame", message: `${label} is empty.` });
          continue;
        }

        if (frame.margins.top < options.minMarginTop) {
          hardFailures.push({ code: "top-crop-risk", message: `${label} top margin ${frame.margins.top}px < ${options.minMarginTop}px.` });
        }
        if (frame.margins.bottom < options.minMarginBottom) {
          hardFailures.push({ code: "bottom-crop-risk", message: `${label} bottom margin ${frame.margins.bottom}px < ${options.minMarginBottom}px.` });
        }
        if (frame.margins.left < options.minMarginX) {
          hardFailures.push({ code: "left-crop-risk", message: `${label} left margin ${frame.margins.left}px < ${options.minMarginX}px.` });
        }
        if (frame.margins.right < options.minMarginX) {
          hardFailures.push({ code: "right-crop-risk", message: `${label} right margin ${frame.margins.right}px < ${options.minMarginX}px.` });
        }
        if (frame.topBandPixels > 0) {
          hardFailures.push({ code: "top-band-contamination", message: `${label} has ${frame.topBandPixels} visible pixels in top ${options.edgeBand}px band.` });
        }
        if (frame.bottomBandPixels > 0) {
          hardFailures.push({ code: "bottom-band-contamination", message: `${label} has ${frame.bottomBandPixels} visible pixels in bottom ${options.edgeBand}px band.` });
        }

        const largeDetached = frame.significantDetachedComponents.filter((component) => {
          if (frame.mainComponent && bboxGap(frame.mainComponent, component) <= defaults.detachedComponentGap) {
            return false;
          }
          return true;
        });
        if (largeDetached.length > 0) {
          hardFailures.push({
            code: "detached-body-part-risk",
            message: `${label} has ${largeDetached.length} significant detached component(s).`,
          });
        } else if (frame.significantDetachedComponents.length > 0) {
          warnings.push({
            code: "small-detached-effect",
            message: `${label} has small detached component(s).`,
          });
        }
      }

      const unusedStartX = wideSpec.span * wideSpec.frames * options.frameWidth;
      const unusedWidth = options.columns * options.frameWidth - unusedStartX;
      if (unusedWidth > 0) {
        const unusedPixels = countVisiblePixelsInRect(
          png,
          unusedStartX,
          row * options.frameHeight,
          unusedWidth,
          options.frameHeight,
        );
        if (unusedPixels > 0) {
          hardFailures.push({
            code: "wide-row-unused-tail-has-pixels",
            message: `row ${row} ${rowNames[row] ?? "row"} unused tail has ${unusedPixels} visible pixels.`,
          });
        }
      }

      rows.push({
        row,
        motion: rowNames[row] ?? null,
        expectedBlank,
        wideFrameSpan: wideSpec.span,
        wideFrameCount: wideSpec.frames,
        frames,
      });
      continue;
    }
    for (let column = 0; column < options.columns; column += 1) {
      const frame = analyzeFrame(png, column, row, options);
      frames.push(frame);
      const label = `row ${row} ${rowNames[row] ?? "row"} col ${column}`;

      if (expectedBlank) {
        if (!frame.blank) {
          hardFailures.push({
            code: "blank-row-has-pixels",
            message: `${label} should be blank but has visible pixels.`,
          });
        }
        continue;
      }

      if (frame.blank) {
        hardFailures.push({ code: "empty-frame", message: `${label} is empty.` });
        continue;
      }

      if (frame.margins.top < options.minMarginTop) {
        hardFailures.push({ code: "top-crop-risk", message: `${label} top margin ${frame.margins.top}px < ${options.minMarginTop}px.` });
      }
      if (frame.margins.bottom < options.minMarginBottom) {
        hardFailures.push({ code: "bottom-crop-risk", message: `${label} bottom margin ${frame.margins.bottom}px < ${options.minMarginBottom}px.` });
      }
      if (frame.margins.left < options.minMarginX) {
        hardFailures.push({ code: "left-crop-risk", message: `${label} left margin ${frame.margins.left}px < ${options.minMarginX}px.` });
      }
      if (frame.margins.right < options.minMarginX) {
        hardFailures.push({ code: "right-crop-risk", message: `${label} right margin ${frame.margins.right}px < ${options.minMarginX}px.` });
      }
      if (frame.topBandPixels > 0) {
        hardFailures.push({ code: "top-band-contamination", message: `${label} has ${frame.topBandPixels} visible pixels in top ${options.edgeBand}px band.` });
      }
      if (frame.bottomBandPixels > 0) {
        hardFailures.push({ code: "bottom-band-contamination", message: `${label} has ${frame.bottomBandPixels} visible pixels in bottom ${options.edgeBand}px band.` });
      }

      const isEmote = rowNames[row]?.startsWith("emote-");
      const largeDetached = frame.significantDetachedComponents.filter((component) => {
        if (frame.mainComponent && bboxGap(frame.mainComponent, component) <= defaults.detachedComponentGap) {
          return false;
        }
        if (!isEmote) return true;
        return component.area > (frame.mainComponent?.area ?? 0) * 0.08;
      });
      if (largeDetached.length > 0) {
        hardFailures.push({
          code: "detached-body-part-risk",
          message: `${label} has ${largeDetached.length} significant detached component(s).`,
        });
      } else if (frame.significantDetachedComponents.length > 0) {
        warnings.push({
          code: "small-detached-effect",
          message: `${label} has small detached component(s); allowed only if they are emote effects.`,
        });
      }
    }
    rows.push({ row, motion: rowNames[row] ?? null, expectedBlank, frames });
  }

  const rowGeometry = summarizeRowGeometry(png, rows, rowNames, options, hardFailures);
  const score = Math.max(0, 100 - hardFailures.length * 10 - warnings.length * 2);
  return {
    schemaVersion: "resident-sprite-frame-fit-evaluation-v1",
    source: path.relative(repoRoot, filePath).replaceAll(path.sep, "/"),
    kind: options.kind,
    columns: options.columns,
    rows: options.rows,
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    wideRows: Array.from(options.wideRows.entries()).map(([row, spec]) => ({
      row,
      span: spec.span,
      frames: spec.frames,
    })),
    mixedRows: Array.from(options.mixedRows.entries()).map(([row, spec]) => ({
      row,
      spans: spec.spans,
    })),
    image: { width: png.width, height: png.height },
    score,
    pass: hardFailures.length === 0,
    hardFailureCount: hardFailures.length,
    warningCount: warnings.length,
    hardFailures,
    warnings,
    rowGeometry,
    frameRows: rows,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(repoRoot, args.file);
  if (!existsSync(filePath)) {
    throw new Error(`PNG file not found: ${args.file}`);
  }

  const report = evaluate(filePath, args);
  if (args.out) {
    const outputPath = path.resolve(repoRoot, args.out);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`${report.pass ? "PASS" : "FAIL"} score=${report.score} hardFailures=${report.hardFailureCount} warnings=${report.warningCount}`);
    for (const failure of report.hardFailures.slice(0, 40)) {
      console.log(`failure: [${failure.code}] ${failure.message}`);
    }
    for (const warning of report.warnings.slice(0, 20)) {
      console.log(`warning: [${warning.code}] ${warning.message}`);
    }
    if (args.out) {
      console.log(`report: ${path.relative(repoRoot, path.resolve(repoRoot, args.out)).replaceAll(path.sep, "/")}`);
    }
  }

  process.exitCode = report.pass ? 0 : 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
