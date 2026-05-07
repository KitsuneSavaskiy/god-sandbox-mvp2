#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expected = {
  frameWidth: 192,
  frameHeight: 208,
  columns: 8,
  rows: 9,
  width: 1536,
  height: 1872,
};

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

function printHelp() {
  console.log(`Resident sprite sheet validator

使い方:
  node tools/asset-pipeline/validate-resident-sprite-sheet.mjs <residentId>
  node tools/asset-pipeline/validate-resident-sprite-sheet.mjs <png-file-or-folder>
  node tools/asset-pipeline/validate-resident-sprite-sheet.mjs --all

例:
  node tools/asset-pipeline/validate-resident-sprite-sheet.mjs ryo

見る場所:
  assets/generated/residents/<residentId>/incoming/

確認すること:
  - PNGファイルであること
  - 画像サイズが ${expected.width}x${expected.height}px であること
  - これは single-sheet の寸法確認だけです。2-sheet ready 判定には \`npm run sprite:check -- <slug>\` を使ってください。
  - これは採用前の検査だけです。採用済みassetへコピーしません。
  - manifestを書き換えません。`);
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
      problem: `フォルダまたはファイルが見つかりません: ${path.relative(repoRoot, targetPath)}`,
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
      problem: `これは検査できるファイルまたはフォルダではありません: ${path.relative(repoRoot, targetPath)}`,
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
      problem: `PNGファイルが見つかりません: ${path.relative(repoRoot, targetPath)}`,
    };
  }

  return {
    files,
    problem: null,
  };
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

  if (bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    return {
      ok: false,
      reason: "PNGの先頭情報を読めませんでした。画像を保存し直してください。",
      info: null,
    };
  }

  return {
    ok: true,
    reason: null,
    info: {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      bitDepth: bytes.readUInt8(24),
      colorType: bytes.readUInt8(25),
    },
  };
}

function hasAlphaChannel(colorType) {
  return colorType === 4 || colorType === 6;
}

function validateFile(filePath) {
  const relative = path.relative(repoRoot, filePath);
  const png = readPngInfo(filePath);

  if (!png.ok) {
    return {
      ok: false,
      lines: [`NG: ${relative}`, `  ${png.reason}`],
    };
  }

  const failures = [];
  if (png.info.width !== expected.width) {
    failures.push(`横幅が ${expected.width}px ではありません。現在は ${png.info.width}px です。`);
  }
  if (png.info.height !== expected.height) {
    failures.push(`高さが ${expected.height}px ではありません。現在は ${png.info.height}px です。`);
  }

  const alphaMessage = hasAlphaChannel(png.info.colorType)
    ? "透明背景向けのalpha channelを持つPNGとして読めました。"
    : "注意: PNGですが、alpha channelを持つ形式としては読めませんでした。背景が透明か目視確認してください。";

  if (failures.length > 0) {
    return {
      ok: false,
      lines: [
        `NG: ${relative}`,
        ...failures.map((failure) => `  ${failure}`),
        `  期待値: 192x208 frame、8列、9行、画像全体 ${expected.width}x${expected.height}px。`,
        `  この画像は採用済みにはせず、incoming または tmp で直してください。`,
      ],
    };
  }

  return {
    ok: true,
    lines: [
      `OK: ${relative}`,
      `  PNGで、画像サイズは ${expected.width}x${expected.height}px です。`,
      `  ${alphaMessage}`,
      `  次は processor と visual audit へ進められます。`,
      `  これは採用前の確認です。採用済みassetへのコピーやmanifest更新はしていません。`,
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
    console.error("検査するincomingフォルダが見つかりませんでした。");
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
    console.error("検査できるPNGファイルがありませんでした。");
    return 1;
  }

  if (failedCount > 0) {
    console.error(`検査結果: ${failedCount}件に確認が必要です。`);
    return 1;
  }

  console.log(`検査結果: ${checkedCount}件すべてOKです。`);
  console.log("これは single-sheet の寸法確認だけです。ready 判定には sprite:check を使ってください。");
  return 0;
}

process.exitCode = main();
