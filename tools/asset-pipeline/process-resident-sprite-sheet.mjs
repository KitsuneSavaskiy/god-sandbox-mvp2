#!/usr/bin/env node
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
import { runVisualFrameAudit } from "./audit-resident-sprite-visuals.mjs";

// Sheet 1 (motion-sheet) spec — hatch-pet native format
const expected = {
  frameWidth: 192,
  frameHeight: 208,
  columns: 8,
  rows: 9,
  width: 1536,
  height: 1872,
};

// Sheet 1 motion rows
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

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

function printHelp() {
  console.log(`Resident sprite sheet processor

motion-sheet 専用です。extended-sheet はこのスクリプトに渡さないでください。

使い方:
  node tools/asset-pipeline/process-resident-sprite-sheet.mjs <residentId>
  node tools/asset-pipeline/process-resident-sprite-sheet.mjs <residentId> <png-file-or-folder>

例:
  node tools/asset-pipeline/process-resident-sprite-sheet.mjs ryo

入力:
  assets/generated/residents/<residentId>/incoming/

出力:
  assets/residents/<residentId>/sprites/resident-sprite-sheet.png
  assets/residents/<residentId>/sprites/resident-sprite-sheet.frames.json
  assets/residents/<residentId>/sprites/resident-sprite-manifest.draft.json
  assets/residents/<residentId>/sprites/resident-sprite-sheet.visual-audit.svg
  assets/residents/<residentId>/sprites/resident-sprite-sheet.visual-audit.json

注意:
  - これは採用候補であり、まだ正本ではありません。
  - 採用済みassetへコピーしません。
  - manifestをready化しません。
  - visual audit は human review を強制するための出力です。
  - OpenAI Images APIや画像生成APIを呼びません。`);
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

function assertMotionSheetSource(filePath) {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName === "resident-sprite-sheet-extended.png") {
    throw new Error("extended-sheet は処理できません。motion-sheet だけをこのスクリプトに渡してください。");
  }
}

function readPngInfo(filePath) {
  const bytes = readFileSync(filePath);
  if (bytes.length < 29 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error("PNGファイルではありません。ChatGPTからPNGとして保存した画像を選んでください。");
  }

  if (bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("PNGの先頭情報を読めませんでした。画像を保存し直してください。");
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes.readUInt8(24),
    colorType: bytes.readUInt8(25),
  };
}

function hasAlphaChannel(colorType) {
  return colorType === 4 || colorType === 6;
}

function validateInput(filePath) {
  const info = readPngInfo(filePath);
  const failures = [];

  if (info.width !== expected.width) {
    failures.push(`横幅が ${expected.width}px ではありません。現在は ${info.width}px です。`);
  }
  if (info.height !== expected.height) {
    failures.push(`高さが ${expected.height}px ではありません。現在は ${info.height}px です。`);
  }

  if (failures.length > 0) {
    throw new Error([
      ...failures,
      `期待値: 192x208 frame、8列、9行、画像全体 ${expected.width}x${expected.height}px。`,
      "この画像は採用候補へ進めず、incoming または tmp で直してください。",
    ].join("\n"));
  }

  return info;
}

function createFrameMap() {
  const frames = [];
  const motions = {};

  for (const [rowIndex, motion] of motionRows.entries()) {
    motions[motion] = {
      row: rowIndex,
      frames: expected.columns,
    };

    for (let column = 0; column < expected.columns; column += 1) {
      frames.push({
        motion,
        row: rowIndex,
        column,
        x: column * expected.frameWidth,
        y: rowIndex * expected.frameHeight,
        width: expected.frameWidth,
        height: expected.frameHeight,
      });
    }
  }

  return { motions, frames };
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createDraftManifest({
  residentId,
  sourcePath,
  spriteSheetPath,
  frameMapPath,
  visualAudit,
}) {
  const { motions } = createFrameMap();

  return {
    schemaVersion: "resident-sprite-manifest-draft-v1",
    note: "これは採用候補であり、まだ正本ではありません。Git管理外のローカル作業用draftです。",
    residentId,
    status: "candidate",
    sourcePath: toRepoRelative(sourcePath),
    localOutputPath: toRepoRelative(spriteSheetPath),
    frameMapPath: toRepoRelative(frameMapPath),
    publicPathCandidate: `art/characters/defaults/${residentId}/sprites/resident-sprite-sheet.png`,
    frameSize: {
      width: expected.frameWidth,
      height: expected.frameHeight,
    },
    columns: expected.columns,
    rows: expected.rows,
    imageSize: {
      width: expected.width,
      height: expected.height,
    },
    visualAudit,
    motions,
    adoptionRequired: true,
    ready: false,
    nextSteps: [
      "visual audit の contact sheet を人間が確認し、split / crop / row mixing がないか見る。",
      "透明背景、文字混入、別人化、立ち絵縮小だけになっていないか人間が確認する。",
      "PO が sandbox 表示を確認するまで ready にしない。",
      "採用する場合だけ、別PBIで public/art/** と src/persistence/** の正本参照を更新する。",
      "manifests/residents.json はローカルplaceholderなので、正本manifestとしてcommitしない。",
    ],
    forbidden: [
      "採用済みassetへの自動コピー",
      "manifestの自動ready化",
      "OpenAI Images API呼び出し",
      "API key保存",
      "Passport schema変更",
    ],
  };
}

function processResidentSpriteSheet(residentId, inputArg) {
  assertResidentId(residentId);
  const normalizedId = residentId.toLowerCase();
  const targetPath = inputArg ? path.resolve(repoRoot, inputArg) : toIncomingDir(normalizedId);
  const motionInputPath =
    existsSync(targetPath) && statSync(targetPath).isDirectory()
      ? path.join(targetPath, "resident-sprite-sheet.png")
      : targetPath;
  const pngFiles = collectPngFiles(motionInputPath);
  const sourcePath = pngFiles[0];
  assertMotionSheetSource(sourcePath);
  const info = validateInput(sourcePath);

  const outputDir = toOutputDir(normalizedId);
  mkdirSync(outputDir, { recursive: true });

  const spriteSheetPath = path.join(outputDir, "resident-sprite-sheet.png");
  const frameMapPath = path.join(outputDir, "resident-sprite-sheet.frames.json");
  const manifestDraftPath = path.join(outputDir, "resident-sprite-manifest.draft.json");

  copyFileSync(sourcePath, spriteSheetPath);
  writeJson(frameMapPath, {
    schemaVersion: "resident-sprite-frame-map-v1",
    note: "これは192x208セルで切り出せることを示すローカル作業用frame mapです（Sheet 1 / motion-sheet）。画像の採用を意味しません。",
    residentId: normalizedId,
    spriteSheet: toRepoRelative(spriteSheetPath),
    frameSize: {
      width: expected.frameWidth,
      height: expected.frameHeight,
    },
    columns: expected.columns,
    rows: expected.rows,
    ...createFrameMap(),
  });
  const visualAudit = runVisualFrameAudit({
    residentId: normalizedId,
    inputPath: spriteSheetPath,
    outputDir,
    sourceLabel: sourcePath,
    sheetKind: "motion",
  });
  writeJson(
    manifestDraftPath,
    createDraftManifest({
      residentId: normalizedId,
      sourcePath,
      spriteSheetPath,
      frameMapPath,
      visualAudit: {
        generatedAt: visualAudit.generatedAt,
        sourceHash: visualAudit.sourceHash,
        contactSheetPath: toRepoRelative(visualAudit.svgPath),
        reportPath: toRepoRelative(visualAudit.reportPath),
        warningFrameCount: visualAudit.warningFrameCount,
        warningsByCode: visualAudit.warningsByCode,
        humanReviewRequired: true,
        poConfirmationRequired: true,
      },
    }),
  );

  return {
    info,
    sourcePath,
    spriteSheetPath,
    frameMapPath,
    manifestDraftPath,
    visualAudit,
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.some(isHelpArg)) {
    printHelp();
    return 0;
  }

  const [residentId, inputArg] = args;

  try {
    const result = processResidentSpriteSheet(residentId, inputArg);
    const alphaMessage = hasAlphaChannel(result.info.colorType)
      ? "alpha channelを持つPNGとして読めました。"
      : "注意: PNGですが、alpha channelを持つ形式としては読めませんでした。透明背景は目視確認してください。";

    console.log("処理が完了しました。");
    console.log("これは採用候補であり、まだ正本ではありません。");
    console.log(`入力: ${toRepoRelative(result.sourcePath)}`);
    console.log(`出力: ${toRepoRelative(result.spriteSheetPath)}`);
    console.log(`slice map: ${toRepoRelative(result.frameMapPath)}`);
    console.log(`manifest draft: ${toRepoRelative(result.manifestDraftPath)}`);
    console.log(`visual audit: ${toRepoRelative(result.visualAudit.svgPath)}`);
    console.log(`audit report: ${toRepoRelative(result.visualAudit.reportPath)}`);
    console.log(`audit warnings: ${result.visualAudit.warningFrameCount}`);
    console.log(alphaMessage);
    console.log("Human review と PO 確認が終わるまで ready にしないでください。");
    console.log("採用済みassetへのコピー、manifest ready化、画像生成API呼び出しはしていません。");
    return 0;
  } catch (error) {
    console.error("処理できませんでした。");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("この画像は採用候補へ進めず、incoming または tmp で確認してください。");
    return 1;
  }
}

process.exitCode = main();
