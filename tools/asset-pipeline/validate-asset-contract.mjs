#!/usr/bin/env node
/**
 * Asset Contract Validator — Sprint 10-B
 *
 * Validates generated PNG assets against machine-readable contracts and
 * emits JSON + markdown reports including an actionable retry plan.
 *
 * Usage:
 *   node tools/asset-pipeline/validate-asset-contract.mjs \
 *     --slug <slug> \
 *     --contract <contractId> \
 *     --asset-dir <abs-or-relative-path> \
 *     [--dry-run] \
 *     [--help]
 *
 * Security: Refuses to write to public/art/** (throws SECURITY error).
 * Does NOT call external APIs, generate art, or use API keys.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readPngHeader, hasPngSignature, checkSheetMargins, checkSingleImageMargins, checkImageHasContent } from "./png-inspection-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

// ---------------------------------------------------------------------------
// Inline contract definitions — used when registry is not yet available
// ---------------------------------------------------------------------------

const INLINE_CONTRACTS = {
  "resident-canonical-two-sheet-v1": {
    id: "resident-canonical-two-sheet-v1",
    description: "Canonical 2-sheet resident sprite contract",
    sheets: 2,
    canvasWidth: 1536,
    canvasHeight: 1872,
    frameWidth: 192,
    frameHeight: 208,
    columns: 8,
    rows: 9,
    alphaRequired: true,
  },
  "resident-po-combined-preview-v1": {
    id: "resident-po-combined-preview-v1",
    description: "PO combined preview sprite sheet contract",
    canvasWidth: 826,
    canvasHeight: 1904,
    frameWidth: 118,
    frameHeight: 136,
    columns: 7,
    rows: 14,
    rowManifest: [
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
    ],
    alphaRequired: true,
  },
  "portrait-expression-set-v1": {
    id: "portrait-expression-set-v1",
    description: "Portrait expression set contract (5 expressions)",
    requiredExpressions: ["neutral", "happy", "angry", "sad", "surprised"],
    alphaRequired: true,
    transparentBackgroundRequired: true,
  },
  "event-standing-expression-set-v1": {
    id: "event-standing-expression-set-v1",
    description: "Event standing expression set contract (8 expressions)",
    requiredExpressions: [
      "neutral",
      "happy",
      "angry",
      "sad",
      "surprised",
      "worried",
      "determined",
      "shocked",
    ],
    alphaRequired: true,
    transparentBackgroundRequired: true,
    canvasSizeConsistencyRequired: true,
  },
};

// ---------------------------------------------------------------------------
// Contract registry adapter — tries external registry first, falls back inline
// ---------------------------------------------------------------------------

async function loadContracts() {
  try {
    const mod = await import("../asset-contracts/asset-contract-registry.mjs");
    if (mod.CONTRACTS) return mod.CONTRACTS;
  } catch {
    /* registry not yet available */
  }
  return INLINE_CONTRACTS;
}

// ---------------------------------------------------------------------------
// Valid scope values
// ---------------------------------------------------------------------------

const VALID_SCOPES = [
  "full-sheet",
  "row-only",
  "frame-only",
  "expression-only",
  "event-expression-only",
];

// ---------------------------------------------------------------------------
// Security guard
// ---------------------------------------------------------------------------

function assertOutputBoundary(outputDir) {
  const abs = path.resolve(repoRoot, outputDir);
  const publicArt = path.resolve(repoRoot, "public", "art");
  if (abs.startsWith(publicArt + path.sep) || abs === publicArt) {
    throw new Error(
      `SECURITY: Refusing to write to public/art/**. Output path "${outputDir}" is not allowed.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Check builders
// ---------------------------------------------------------------------------

function checkFileExists(filePath, label) {
  const exists = existsSync(filePath);
  return {
    check: "file-exists",
    label: label ?? path.basename(filePath),
    path: filePath,
    passed: exists,
    ...(exists ? {} : { reason: `File not found: ${filePath}` }),
  };
}

function checkPngSignatureCheck(filePath, label) {
  const ok = hasPngSignature(filePath);
  return {
    check: "png-signature",
    label: label ?? path.basename(filePath),
    path: filePath,
    passed: ok,
    ...(ok ? {} : { reason: `File does not have a valid PNG signature: ${filePath}` }),
  };
}

function checkDimensions(filePath, expectedWidth, expectedHeight, label) {
  let header;
  try {
    header = readPngHeader(filePath);
  } catch (err) {
    return {
      check: "dimensions",
      label: label ?? path.basename(filePath),
      path: filePath,
      passed: false,
      expected: `${expectedWidth}x${expectedHeight}`,
      actual: "unreadable",
      reason: err.message,
    };
  }

  const passed = header.width === expectedWidth && header.height === expectedHeight;
  return {
    check: "dimensions",
    label: label ?? path.basename(filePath),
    path: filePath,
    passed,
    expected: `${expectedWidth}x${expectedHeight}`,
    actual: `${header.width}x${header.height}`,
    ...(passed ? {} : {
      reason: `Expected ${expectedWidth}x${expectedHeight}, got ${header.width}x${header.height}`,
    }),
  };
}

function checkAlpha(filePath, label) {
  let header;
  try {
    header = readPngHeader(filePath);
  } catch (err) {
    return {
      check: "alpha-channel",
      label: label ?? path.basename(filePath),
      path: filePath,
      passed: false,
      reason: err.message,
    };
  }

  const passed = header.hasAlpha;
  return {
    check: "alpha-channel",
    label: label ?? path.basename(filePath),
    path: filePath,
    passed,
    colorType: header.colorType,
    ...(passed ? {} : {
      reason: `File lacks alpha channel (colorType=${header.colorType}, expected 4 or 6)`,
    }),
  };
}

// ---------------------------------------------------------------------------
// Per-contract validators
// ---------------------------------------------------------------------------

function validateResidentPoCombinedPreview(assetDir, contract, slug) {
  const filePath = path.join(assetDir, "resident-sprite-sheet-combined.png");
  const checks = [];
  const identityConsistencyNeedsHumanReview = false;
  let marginChecked = false;
  let marginViolated = false;

  const existsCheck = checkFileExists(filePath, "resident-sprite-sheet-combined.png");
  checks.push(existsCheck);

  if (existsCheck.passed) {
    checks.push(checkPngSignatureCheck(filePath, "resident-sprite-sheet-combined.png"));
    checks.push(checkDimensions(filePath, contract.canvasWidth, contract.canvasHeight, "resident-sprite-sheet-combined.png"));
    checks.push(checkAlpha(filePath, "resident-sprite-sheet-combined.png"));

    const cols = contract.columns ?? 7;
    const rowCount = contract.rows ?? 14;
    const fw = contract.frameWidth ?? 118;
    const fh = contract.frameHeight ?? 136;
    const safeMargins = contract.safeMargins ?? { top: 8, bottom: 8, left: 8, right: 8 };

    const mr = checkSheetMargins(filePath, cols, rowCount, fw, fh, safeMargins);
    if (mr.checked) {
      marginChecked = true;
      for (const v of mr.violations) {
        marginViolated = true;
        checks.push({
          check: "pixel-margin",
          scope: "frame-only",
          label: `resident-sprite-sheet-combined.png row ${v.row} col ${v.column}`,
          path: filePath,
          passed: false,
          side: v.side,
          actual: v.actual,
          required: v.required,
          row: v.row,
          column: v.column,
          reason: `row ${v.row} col ${v.column}: ${v.side} margin ${v.actual}px < ${v.required}px required`,
        });
      }
    }
  }

  const marginCheckStatus = marginChecked ? (marginViolated ? "fail" : "pass") : "not-run";
  return { checks, identityConsistencyNeedsHumanReview, marginCheckStatus, contentCheckStatus: "not-run" };
}

function validateResidentCanonicalTwoSheet(assetDir, contract, slug) {
  // Registry format uses contract.sheets[]; inline fallback uses top-level canvasWidth/canvasHeight.
  const sheetSpecs = contract.sheets
    ? [
        {
          fileName: "resident-sprite-sheet.png",
          label: "resident-sprite-sheet.png (motion)",
          sheetKind: "motion",
          canvasWidth: contract.sheets[0]?.canvasWidth,
          canvasHeight: contract.sheets[0]?.canvasHeight,
          columns: contract.sheets[0]?.columns ?? 8,
          rows: contract.sheets[0]?.rows ?? 9,
          frameWidth: contract.sheets[0]?.frameWidth ?? 192,
          frameHeight: contract.sheets[0]?.frameHeight ?? 208,
        },
        {
          fileName: "resident-sprite-sheet-extended.png",
          label: "resident-sprite-sheet-extended.png (extended)",
          sheetKind: "extended",
          canvasWidth: contract.sheets[1]?.canvasWidth,
          canvasHeight: contract.sheets[1]?.canvasHeight,
          columns: contract.sheets[1]?.columns ?? 8,
          rows: contract.sheets[1]?.rows ?? 9,
          frameWidth: contract.sheets[1]?.frameWidth ?? 192,
          frameHeight: contract.sheets[1]?.frameHeight ?? 208,
        },
      ]
    : [
        {
          fileName: "resident-sprite-sheet.png",
          label: "resident-sprite-sheet.png (motion)",
          sheetKind: "motion",
          canvasWidth: contract.canvasWidth,
          canvasHeight: contract.canvasHeight,
          columns: contract.columns ?? 8,
          rows: contract.rows ?? 9,
          frameWidth: contract.frameWidth ?? 192,
          frameHeight: contract.frameHeight ?? 208,
        },
        {
          fileName: "resident-sprite-sheet-extended.png",
          label: "resident-sprite-sheet-extended.png (extended)",
          sheetKind: "extended",
          canvasWidth: contract.canvasWidth,
          canvasHeight: contract.canvasHeight,
          columns: contract.columns ?? 8,
          rows: contract.rows ?? 9,
          frameWidth: contract.frameWidth ?? 192,
          frameHeight: contract.frameHeight ?? 208,
        },
      ];

  const safeMargins = contract.safeMargins ?? { top: 8, bottom: 8, left: 10, right: 10 };
  const checks = [];
  const identityConsistencyNeedsHumanReview = false;
  let marginChecked = false;
  let marginViolated = false;

  for (const spec of sheetSpecs) {
    const filePath = path.join(assetDir, spec.fileName);
    const existsCheck = checkFileExists(filePath, spec.label);
    checks.push(existsCheck);

    if (existsCheck.passed) {
      checks.push(checkPngSignatureCheck(filePath, spec.label));
      checks.push(checkDimensions(filePath, spec.canvasWidth, spec.canvasHeight, spec.label));
      checks.push(checkAlpha(filePath, spec.label));

      const mr = checkSheetMargins(filePath, spec.columns, spec.rows, spec.frameWidth, spec.frameHeight, safeMargins);
      if (mr.checked) {
        marginChecked = true;
        for (const v of mr.violations) {
          marginViolated = true;
          checks.push({
            check: "pixel-margin",
            scope: "frame-only",
            label: `${spec.label} row ${v.row} col ${v.column}`,
            path: filePath,
            sheetKind: spec.sheetKind,
            passed: false,
            side: v.side,
            actual: v.actual,
            required: v.required,
            row: v.row,
            column: v.column,
            reason: `${spec.sheetKind} sheet row ${v.row} col ${v.column}: ${v.side} margin ${v.actual}px < ${v.required}px required`,
          });
        }
      }
    }
  }

  const marginCheckStatus = marginChecked ? (marginViolated ? "fail" : "pass") : "not-run";
  return { checks, identityConsistencyNeedsHumanReview, marginCheckStatus, contentCheckStatus: "not-run" };
}

function validateExpressionSet(assetDir, contract, slug, isEventSet) {
  const checks = [];
  const identityConsistencyNeedsHumanReview = !isEventSet; // Portrait expressions need human review
  const scope = isEventSet ? "event-expression-only" : "expression-only";
  const expressionsSubDir = isEventSet
    ? path.join(assetDir, "event-expressions")
    : path.join(assetDir, "expressions");
  const expressionDir = existsSync(expressionsSubDir) ? expressionsSubDir : assetDir;
  const safeMargins = contract.safeMargins ?? { top: 8, bottom: 8, left: 8, right: 8 };
  const validDimensions = [];
  let marginChecked = false;
  let marginViolated = false;
  let contentChecked = false;
  let contentFailed = false;

  for (const expr of contract.requiredExpressions) {
    const filePath = path.join(expressionDir, `${expr}.png`);
    const label = `${expr}.png`;

    const existsCheck = checkFileExists(filePath, label);
    checks.push(existsCheck);

    if (existsCheck.passed) {
      const sigCheck = checkPngSignatureCheck(filePath, label);
      checks.push(sigCheck);

      if (sigCheck.passed) {
        checks.push(checkAlpha(filePath, label));

        try {
          const header = readPngHeader(filePath);
          validDimensions.push({ file: filePath, width: header.width, height: header.height });
        } catch {
          // Handled by alpha check
        }

        const mr = checkSingleImageMargins(filePath, safeMargins);
        if (mr.checked) {
          marginChecked = true;
          for (const v of mr.violations) {
            marginViolated = true;
            checks.push({
              check: "pixel-margin",
              scope,
              label,
              path: filePath,
              passed: false,
              side: v.side,
              actual: v.actual,
              required: v.required,
              reason: `${label}: ${v.side} margin ${v.actual}px < ${v.required}px required`,
            });
          }
        }

        const cc = checkImageHasContent(filePath);
        if (cc.checked) {
          contentChecked = true;
          if (!cc.hasContent) {
            contentFailed = true;
            checks.push({
              check: "required-content",
              scope,
              label,
              path: filePath,
              passed: false,
              reason: `${label}: image is fully transparent (no visible pixels)`,
            });
          }
        }
      }
    }
  }

  // Canvas size consistency check (required for event-standing sets)
  if (contract.canvasSizeConsistencyRequired && validDimensions.length > 1) {
    const referenceWidth = validDimensions[0].width;
    const referenceHeight = validDimensions[0].height;
    let allSame = true;

    for (const { file, width, height } of validDimensions) {
      if (width !== referenceWidth || height !== referenceHeight) {
        allSame = false;
        checks.push({
          check: "canvas-size-consistency",
          path: file,
          passed: false,
          expected: `${referenceWidth}x${referenceHeight}`,
          actual: `${width}x${height}`,
          reason: `Inconsistent canvas size. Expected ${referenceWidth}x${referenceHeight} (from first file), got ${width}x${height}`,
        });
      }
    }

    if (allSame) {
      checks.push({
        check: "canvas-size-consistency",
        path: expressionDir,
        passed: true,
        note: `All ${validDimensions.length} expression files share ${referenceWidth}x${referenceHeight}`,
      });
    }
  }

  const marginCheckStatus = marginChecked ? (marginViolated ? "fail" : "pass") : "not-run";
  const contentCheckStatus = contentChecked ? (contentFailed ? "fail" : "pass") : "not-run";
  return { checks, identityConsistencyNeedsHumanReview, marginCheckStatus, contentCheckStatus };
}

// ---------------------------------------------------------------------------
// Retry plan builder
// ---------------------------------------------------------------------------

function buildPromptPatch(check, contractId) {
  const { check: checkType, expected, actual, path: filePath, reason } = check;

  switch (checkType) {
    case "file-exists":
      return `The file "${path.basename(filePath ?? "")}" is missing. ` +
        `Regenerate this asset and ensure it is placed in the expected location.`;

    case "png-signature":
      return `The file "${path.basename(filePath ?? "")}" is not a valid PNG. ` +
        `Ensure the output file is saved as a real PNG (not JPEG, WebP, or a renamed file).`;

    case "dimensions":
      if (expected) {
        const [ew, eh] = expected.split("x").map(Number);
        return `Canvas must be exactly ${ew} pixels wide and ${eh} pixels tall. ` +
          `The file was ${actual}. Do not resize after generation — generate at the exact target dimensions.`;
      }
      return `Dimensions do not match the contract. Regenerate at the exact required canvas size.`;

    case "alpha-channel":
      return `The PNG must have a real alpha (transparency) channel. ` +
        `Save as PNG-32 (RGBA) or PNG-24 with transparency. ` +
        `If the generator cannot produce alpha, use an exact #ff00ff chroma-key background and run the alpha converter.`;

    case "canvas-size-consistency":
      return `All expression files in this set must have the same canvas dimensions. ` +
        `File "${path.basename(filePath ?? "")}" has ${actual} but the reference is ${expected}. ` +
        `Regenerate all expressions at a consistent canvas size.`;

    case "pixel-margin":
      return `Character content enters the ${check.side} safe margin zone. ` +
        `The ${check.side} margin is ${check.actual}px but must be ≥${check.required}px. ` +
        `Ensure no visible pixels appear within ${check.required}px of the ${check.side} edge.`;

    case "required-content":
      return `The file "${path.basename(filePath ?? "")}" is fully transparent — no visible pixels detected. ` +
        `Regenerate this asset; the final image must contain non-transparent character content.`;

    default:
      return reason ?? `Check failed: ${checkType}. Review the asset and regenerate as needed.`;
  }
}

function determineScopeForCheck(check, contractId) {
  const { check: checkType } = check;

  // pixel-margin and required-content checks carry their scope directly
  if (checkType === "pixel-margin") return check.scope ?? "frame-only";
  if (checkType === "required-content") return check.scope ?? "expression-only";

  // Expression-related contracts
  if (contractId === "portrait-expression-set-v1") return "expression-only";
  if (contractId === "event-standing-expression-set-v1") return "event-expression-only";

  // Sheet-level checks
  if (checkType === "dimensions" || checkType === "alpha-channel" || checkType === "png-signature") {
    return "full-sheet";
  }

  if (checkType === "canvas-size-consistency") return "full-sheet";

  return "full-sheet";
}

function buildRetryPlan(checks, slug, contractId) {
  const failures = checks
    .filter((c) => !c.passed)
    .map((c) => ({
      check: c.check,
      filePath: c.path ?? "",
      reason: c.reason ?? `Check "${c.check}" failed`,
      scope: determineScopeForCheck(c, contractId),
      promptPatch: buildPromptPatch(c, contractId),
    }));

  return failures;
}

// ---------------------------------------------------------------------------
// Report + retry plan writer
// ---------------------------------------------------------------------------

function writeReports(slug, contractId, checks, identityConsistencyNeedsHumanReview, outputDir, dryRun, marginCheckStatus = "not-run", contentCheckStatus = "not-run") {
  const generatedAt = new Date().toISOString();
  const passCount = checks.filter((c) => c.passed).length;
  const failCount = checks.filter((c) => !c.passed).length;

  const hardGatePassed = failCount === 0;
  const qualityGateStatus = failCount === 0
    ? (identityConsistencyNeedsHumanReview ? "needs-human-review" : "pass")
    : "fail";

  const report = {
    candidateOnly: true,
    slug,
    contractId,
    generatedAt,
    passCount,
    failCount,
    hardGatePassed,
    qualityGateStatus,
    marginCheckStatus,
    contentCheckStatus,
    checks,
    ...(identityConsistencyNeedsHumanReview ? { identityConsistencyNeedsHumanReview: true } : {}),
  };

  const retryFailures = buildRetryPlan(checks, slug, contractId);

  const retryPlan = {
    candidateOnly: true,
    slug,
    contractId,
    generatedAt,
    failures: retryFailures,
    passCount,
    failCount,
  };

  const retryMdLines = [
    `# Retry Plan`,
    ``,
    `- **slug**: ${slug}`,
    `- **contract**: ${contractId}`,
    `- **generated**: ${generatedAt}`,
    `- **pass**: ${passCount}  **fail**: ${failCount}`,
    ``,
  ];

  if (retryFailures.length === 0) {
    retryMdLines.push(`All checks passed. No retry needed.`);
  } else {
    retryMdLines.push(`## Failures`);
    retryMdLines.push(``);
    for (const f of retryFailures) {
      retryMdLines.push(`### ${f.check}`);
      retryMdLines.push(``);
      retryMdLines.push(`- **scope**: \`${f.scope}\``);
      retryMdLines.push(`- **file**: \`${f.filePath}\``);
      retryMdLines.push(`- **reason**: ${f.reason}`);
      retryMdLines.push(``);
      retryMdLines.push(`**Action**: ${f.promptPatch}`);
      retryMdLines.push(``);
    }
  }

  if (identityConsistencyNeedsHumanReview) {
    retryMdLines.push(`## Human Review Required`);
    retryMdLines.push(``);
    retryMdLines.push(
      `Identity consistency (semantic match between expressions and character portrait) ` +
      `cannot be verified automatically. A human reviewer must confirm that all expression ` +
      `files depict the same character as the reference portrait.`,
    );
    retryMdLines.push(``);
  }

  const retryMd = retryMdLines.join("\n");

  const reportJsonPath = path.join(outputDir, "asset-contract-report.json");
  const retryJsonPath = path.join(outputDir, "retry-plan.json");
  const retryMdPath = path.join(outputDir, "retry-plan.md");

  if (dryRun) {
    console.log(`\n[dry-run] Would write to: ${outputDir}`);
    console.log(`  ${path.relative(repoRoot, reportJsonPath)}`);
    console.log(`  ${path.relative(repoRoot, retryJsonPath)}`);
    console.log(`  ${path.relative(repoRoot, retryMdPath)}`);
    console.log(`\n[dry-run] Report summary:`);
    console.log(`  passCount: ${passCount}`);
    console.log(`  failCount: ${failCount}`);
    return { report, retryPlan, retryMd };
  }

  assertOutputBoundary(outputDir);
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(reportJsonPath, JSON.stringify(report, null, 2) + "\n");
  writeFileSync(retryJsonPath, JSON.stringify(retryPlan, null, 2) + "\n");
  writeFileSync(retryMdPath, retryMd + "\n");

  console.log(`  Wrote: ${path.relative(repoRoot, reportJsonPath)}`);
  console.log(`  Wrote: ${path.relative(repoRoot, retryJsonPath)}`);
  console.log(`  Wrote: ${path.relative(repoRoot, retryMdPath)}`);

  return { report, retryPlan, retryMd };
}

// ---------------------------------------------------------------------------
// Validation entry point (exported for programmatic use in tests)
// ---------------------------------------------------------------------------

/**
 * Validate a slug's asset directory against a given contract.
 *
 * @param {object} opts
 * @param {string} opts.slug
 * @param {string} opts.contractId
 * @param {string} opts.assetDir    Absolute path to asset directory
 * @param {boolean} [opts.dryRun]
 * @param {object} [opts.contracts] Pre-loaded contracts map (optional, for testing)
 * @returns {Promise<{ report: object, retryPlan: object, retryMd: string }>}
 */
export async function validateAssetContract({ slug, contractId, assetDir, dryRun = false, contracts }) {
  const contractMap = contracts ?? (await loadContracts());
  const contract = contractMap[contractId];

  if (!contract) {
    throw new Error(
      `Unknown contractId: "${contractId}". Valid IDs: ${Object.keys(contractMap).join(", ")}`,
    );
  }

  const resolvedAssetDir = path.resolve(repoRoot, assetDir);

  let checks;
  let identityConsistencyNeedsHumanReview = false;
  let marginCheckStatus = "not-run";
  let contentCheckStatus = "not-run";

  switch (contractId) {
    case "resident-po-combined-preview-v1": {
      const result = validateResidentPoCombinedPreview(resolvedAssetDir, contract, slug);
      checks = result.checks;
      identityConsistencyNeedsHumanReview = result.identityConsistencyNeedsHumanReview;
      marginCheckStatus = result.marginCheckStatus;
      contentCheckStatus = result.contentCheckStatus ?? "not-run";
      break;
    }
    case "resident-canonical-two-sheet-v1": {
      const result = validateResidentCanonicalTwoSheet(resolvedAssetDir, contract, slug);
      checks = result.checks;
      identityConsistencyNeedsHumanReview = result.identityConsistencyNeedsHumanReview;
      marginCheckStatus = result.marginCheckStatus;
      contentCheckStatus = result.contentCheckStatus ?? "not-run";
      break;
    }
    case "portrait-expression-set-v1": {
      const result = validateExpressionSet(resolvedAssetDir, contract, slug, false);
      checks = result.checks;
      identityConsistencyNeedsHumanReview = result.identityConsistencyNeedsHumanReview;
      marginCheckStatus = result.marginCheckStatus;
      contentCheckStatus = result.contentCheckStatus ?? "not-run";
      break;
    }
    case "event-standing-expression-set-v1": {
      const result = validateExpressionSet(resolvedAssetDir, contract, slug, true);
      checks = result.checks;
      identityConsistencyNeedsHumanReview = result.identityConsistencyNeedsHumanReview;
      marginCheckStatus = result.marginCheckStatus;
      contentCheckStatus = result.contentCheckStatus ?? "not-run";
      break;
    }
    default:
      throw new Error(`No validator implemented for contractId: "${contractId}"`);
  }

  const outputDir = path.join(
    repoRoot,
    "assets",
    "generated",
    "residents",
    slug,
    "qa",
  );

  return writeReports(slug, contractId, checks, identityConsistencyNeedsHumanReview, outputDir, dryRun, marginCheckStatus, contentCheckStatus);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`Asset Contract Validator — Sprint 10-B

Validates generated PNG assets against machine-readable contracts and emits
JSON + markdown reports including an actionable retry plan.

Usage:
  node tools/asset-pipeline/validate-asset-contract.mjs \\
    --slug <slug> \\
    --contract <contractId> \\
    --asset-dir <path> \\
    [--dry-run] \\
    [--help]

Arguments:
  --slug              Character slug (e.g. "ryo")
  --contract          Contract ID (see below)
  --asset-dir         Directory containing the asset(s) to validate
  --dry-run           Print what would be validated; do not write files
  --fail-on-violation Exit 2 if any check fails (failCount > 0). Default: exit 0.
  --help              Show this help

Contract IDs:
  resident-canonical-two-sheet-v1     Two-sheet 1536x1872 canonical sprite
  resident-po-combined-preview-v1     826x1904 combined PO preview sheet
  portrait-expression-set-v1         5-expression portrait set (neutral/happy/angry/sad/surprised)
  event-standing-expression-set-v1   8-expression event set

Output (unless --dry-run):
  assets/generated/residents/<slug>/qa/asset-contract-report.json
  assets/generated/residents/<slug>/qa/retry-plan.json
  assets/generated/residents/<slug>/qa/retry-plan.md

Security:
  Writing to public/art/** is refused with a SECURITY error.

Exit codes:
  0 = ran successfully (check passCount/failCount in JSON for results)
  1 = error (bad arguments, missing contract, security violation, etc.)
  2 = validation failures found (only with --fail-on-violation)
`);
}

function parseArgs(argv) {
  const opts = {
    slug: null,
    contractId: null,
    assetDir: null,
    dryRun: false,
    failOnViolation: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") { opts.help = true; continue; }
    if (arg === "--dry-run") { opts.dryRun = true; continue; }
    if (arg === "--fail-on-violation") { opts.failOnViolation = true; continue; }
    if (arg === "--slug" && argv[i + 1]) { opts.slug = argv[++i]; continue; }
    if (arg === "--contract" && argv[i + 1]) { opts.contractId = argv[++i]; continue; }
    if (arg === "--asset-dir" && argv[i + 1]) { opts.assetDir = argv[++i]; continue; }
    // Unknown flags are silently ignored to allow callers to pass extra flags
  }

  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help || process.argv.length <= 2) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  if (!opts.slug) {
    console.error("Error: --slug is required.");
    process.exit(1);
  }
  if (!opts.contractId) {
    console.error("Error: --contract is required.");
    process.exit(1);
  }
  if (!opts.assetDir) {
    console.error("Error: --asset-dir is required.");
    process.exit(1);
  }

  const contracts = await loadContracts();
  const contractIds = Object.keys(contracts);
  if (!contractIds.includes(opts.contractId)) {
    console.error(`Error: Unknown contract "${opts.contractId}". Valid IDs: ${contractIds.join(", ")}`);
    process.exit(1);
  }

  console.log(`\nAsset Contract Validator`);
  console.log(`  slug:       ${opts.slug}`);
  console.log(`  contract:   ${opts.contractId}`);
  console.log(`  asset-dir:  ${opts.assetDir}`);
  if (opts.dryRun) console.log(`  [dry-run mode]`);
  console.log(``);

  if (opts.dryRun) {
    const resolvedAssetDir = path.resolve(repoRoot, opts.assetDir);
    console.log(`[dry-run] Would validate assets in: ${resolvedAssetDir}`);
    const outputDir = path.join(repoRoot, "assets", "generated", "residents", opts.slug, "qa");
    console.log(`[dry-run] Would write reports to: ${outputDir}`);
    console.log(`  asset-contract-report.json`);
    console.log(`  retry-plan.json`);
    console.log(`  retry-plan.md`);
    console.log(``);
  }

  const { report } = await validateAssetContract({
    slug: opts.slug,
    contractId: opts.contractId,
    assetDir: opts.assetDir,
    dryRun: opts.dryRun,
    contracts,
  });

  const { passCount, failCount } = report;
  const status = failCount === 0 ? "PASS" : "FAIL";

  console.log(`\n${status}  passCount=${passCount}  failCount=${failCount}  qualityGateStatus=${report.qualityGateStatus}`);
  if (failCount > 0) {
    console.log(`\nFailed checks:`);
    for (const check of report.checks.filter((c) => !c.passed)) {
      console.log(`  [${check.check}] ${check.reason ?? check.path}`);
    }
  }
  if (report.marginCheckStatus === "not-run") {
    console.log(`\nNote: marginCheckStatus=not-run — pixel-level margin checks require full PNG decode.`);
    console.log(`      Run sprite:fit for detailed per-frame margin analysis.`);
  }

  if (opts.failOnViolation && failCount > 0) {
    console.log(`\nExit 2: --fail-on-violation is set and failCount=${failCount}.`);
    process.exit(2);
  }

  // Default: exit 0 regardless of pass/fail — caller reads the JSON for detailed results.
  process.exitCode = 0;
}

// Only run CLI when this module is the entry point (not when imported by tests)
const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error(`\nFatal: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
