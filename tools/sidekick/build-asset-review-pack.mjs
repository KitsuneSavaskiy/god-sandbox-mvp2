#!/usr/bin/env node
/**
 * Build Asset Review Pack
 *
 * Reads assets/generated/residents/<slug>/incoming/ and generates a local-only
 * HTML review pack that PO can open in a browser to inspect character asset
 * candidates.
 *
 * NEVER generates new art. NEVER touches public/art/ or the ready manifest.
 *
 * Output (all gitignored):
 *   assets/generated/residents/<slug>/review-pack/
 *     index.html
 *     review-summary.json
 *     missing-assets.json
 *     po-review-checklist.md
 *
 * Usage:
 *   node tools/sidekick/build-asset-review-pack.mjs \
 *     --slug <slug> \
 *     [--incoming-dir <path>] \
 *     [--output-dir <path>] \
 *     [--dry-run] \
 *     [--help]
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------------------
// Security guard — must be called before any write
// ---------------------------------------------------------------------------

/**
 * SECURITY: Refuse to write to public/art/** or src/**
 * @param {string} outputDir
 * @param {string} root
 */
function assertOutputBoundary(outputDir, root) {
  const rel = path.relative(root, path.resolve(outputDir)).replace(/\\/g, "/");
  if (rel.startsWith("public/art/") || rel.startsWith("src/")) {
    throw new Error(`SECURITY: Refusing to write review pack to ${rel}`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`Build Asset Review Pack

Reads incoming/ directory for a resident slug and generates a standalone HTML
review pack for PO inspection. No art generation. No public/art writes.

Usage:
  node tools/sidekick/build-asset-review-pack.mjs \\
    --slug <slug> \\
    [--incoming-dir <path>]   default: assets/generated/residents/<slug>/incoming/
    [--output-dir <path>]     default: assets/generated/residents/<slug>/review-pack/
    [--dry-run]               show what would be written, don't write
    [--help]

Outputs:
  index.html             Standalone browser-viewable review page (no CDN, no external resources)
  review-summary.json    Machine-readable summary with candidateOnly: true
  missing-assets.json    List of expected files not found
  po-review-checklist.md PO review checklist (fill out manually)
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === "--slug" && val) { args.slug = val; i++; }
    else if (flag === "--incoming-dir" && val) { args.incomingDir = val; i++; }
    else if (flag === "--output-dir" && val) { args.outputDir = val; i++; }
    else if (flag === "--dry-run") { args.dryRun = true; }
    else if (flag === "--help" || flag === "-h") { args.help = true; }
  }
  return args;
}

// ---------------------------------------------------------------------------
// PNG utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the buffer starts with a valid PNG signature.
 * @param {Buffer} buf
 * @returns {boolean}
 */
function hasPngSignature(buf) {
  if (buf.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Encodes a file as a base64 data URI string for inline use in HTML.
 * Returns null if file does not exist or is not a valid PNG.
 * @param {string} filePath
 * @returns {string|null}
 */
function fileToDataUri(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    const buf = readFileSync(filePath);
    if (!hasPngSignature(buf)) return null;
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadata loading
// ---------------------------------------------------------------------------

/**
 * Safely reads and parses a JSON file. Returns null on any error.
 * @param {string} filePath
 * @returns {object|null}
 */
function readJsonSafe(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Returns the first path that exists from the given list, or null.
 * Used to support both the canonical subdir layout and legacy root placement.
 * @param {...string} candidates
 * @returns {string|null}
 */
function firstExisting(...candidates) {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Reads character identity from lane-state or prompt-pack.
 * @param {string} slug
 * @param {string} residentDir
 * @returns {{ displayName?: string, personality?: string, tone?: string, age?: number, laneState?: object }}
 */
function loadCharacterMetadata(slug, residentDir) {
  const meta = { slug };

  // Lane state
  const laneStatePath = path.join(residentDir, "lane-state.json");
  const laneState = readJsonSafe(laneStatePath);
  if (laneState) {
    meta.laneState = laneState;
    if (laneState.slug) meta.slug = laneState.slug;
  }

  // Character profile from prompt-pack (if present)
  const identityPath = path.join(residentDir, "prompt-pack", "character-profile.json");
  const identity = readJsonSafe(identityPath);
  if (identity) {
    if (identity.displayName) meta.displayName = identity.displayName;
    if (identity.personality) meta.personality = identity.personality;
    if (identity.tone) meta.tone = identity.tone;
    if (identity.age !== undefined) meta.age = identity.age;
  }

  // Fallback: check lane-state for displayName (some formats embed it)
  if (!meta.displayName && laneState) {
    if (laneState.displayName) meta.displayName = laneState.displayName;
  }

  return meta;
}

// ---------------------------------------------------------------------------
// Asset presence check
// ---------------------------------------------------------------------------

const EXPECTED_ASSETS = [
  { key: "sprite-combined", rel: "resident-sprite-sheet-combined.png", label: "Sprite sheet (combined)" },
  { key: "sprite-main", rel: "resident-sprite-sheet.png", label: "Sprite sheet (main)" },
  { key: "sprite-extended", rel: "resident-sprite-sheet-extended.png", label: "Sprite sheet (extended)" },
  { key: "expr-neutral", rel: "expressions/neutral.png", label: "Expression: neutral" },
  { key: "expr-happy", rel: "expressions/happy.png", label: "Expression: happy" },
  { key: "expr-angry", rel: "expressions/angry.png", label: "Expression: angry" },
  { key: "expr-sad", rel: "expressions/sad.png", label: "Expression: sad" },
  { key: "expr-surprised", rel: "expressions/surprised.png", label: "Expression: surprised" },
  { key: "icon", rel: "icons/icon-candidate.png", label: "Icon candidate" },
  { key: "expr-manifest", rel: "expressions/expression-manifest.candidate.json", label: "Expression manifest (optional)" },
  { key: "icon-report", rel: "icons/icon-source-report.json", label: "Icon source report (optional)" },
];

const REQUIRED_ASSET_KEYS = new Set([
  "expr-neutral",
  "expr-happy",
  "expr-angry",
  "expr-sad",
  "expr-surprised",
  "icon",
]);

// Sprite sheet: at least one variant required
const SPRITE_KEYS = new Set(["sprite-combined", "sprite-main", "sprite-extended"]);

/**
 * Checks which expected assets are present and which are missing.
 * @param {string} incomingDir
 * @returns {{ presentAssets: string[], missingAssets: string[], assetPaths: object }}
 */
function checkAssets(incomingDir) {
  const presentAssets = [];
  const missingAssets = [];
  const assetPaths = {};

  for (const asset of EXPECTED_ASSETS) {
    const fullPath = path.join(incomingDir, asset.rel);
    const exists = existsSync(fullPath);

    if (exists) {
      presentAssets.push(asset.rel);
      assetPaths[asset.key] = fullPath;
    } else {
      // Only report required and sprite as missing (optionals get a note)
      if (REQUIRED_ASSET_KEYS.has(asset.key) || SPRITE_KEYS.has(asset.key)) {
        missingAssets.push({ rel: asset.rel, label: asset.label, required: REQUIRED_ASSET_KEYS.has(asset.key) });
      }
      assetPaths[asset.key] = null;
    }
  }

  // Check if at least one sprite is present
  const hasSprite = SPRITE_KEYS.size > 0 && [...SPRITE_KEYS].some(k => assetPaths[k] !== null);

  return { presentAssets, missingAssets, assetPaths, hasSprite };
}

/**
 * Finds the primary sprite sheet path (prefers combined, then main, then extended).
 * @param {object} assetPaths
 * @returns {string|null}
 */
function findPrimarySprite(assetPaths) {
  return assetPaths["sprite-combined"] ?? assetPaths["sprite-main"] ?? assetPaths["sprite-extended"] ?? null;
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

const EXPRESSIONS = ["neutral", "happy", "angry", "sad", "surprised"];

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generates the standalone HTML review page.
 * All images are base64-inlined. No external resources.
 *
 * @param {object} opts
 * @returns {string} HTML content
 */
function buildIndexHtml({
  slug,
  meta,
  assetPaths,
  hasSprite,
  missingAssets,
  expressionManifest,
  iconReport,
  generatedAt,
}) {
  const displayName = meta.displayName ?? slug;
  const personality = meta.personality ?? "—";
  const tone = meta.tone ?? "—";
  const age = meta.age !== undefined ? String(meta.age) : "—";

  // Compute lane status
  let laneStatusHtml = "<em>unknown</em>";
  if (meta.laneState && meta.laneState.lanes) {
    const lanes = meta.laneState.lanes;
    const rows = Object.entries(lanes).map(([name, info]) => {
      const status = typeof info === "string" ? info : (info?.status ?? "unknown");
      const updatedAt = typeof info === "object" ? (info?.updatedAt ?? "") : "";
      return `<tr><td>${escHtml(name)}</td><td class="status-${escHtml(status.replace(/[^a-z-]/g, ""))}">${escHtml(status)}</td><td>${escHtml(updatedAt)}</td></tr>`;
    });
    laneStatusHtml = `<table class="lane-table">
      <thead><tr><th>Lane</th><th>Status</th><th>Updated</th></tr></thead>
      <tbody>${rows.join("\n      ")}</tbody>
    </table>`;
  }

  // Sprite sheet section
  let spriteSectionHtml = `<div class="missing-asset">Sprite sheet not found in incoming/</div>`;
  if (hasSprite) {
    const spriteAbsPath = findPrimarySprite(assetPaths);
    if (spriteAbsPath) {
      const dataUri = fileToDataUri(spriteAbsPath);
      const relPath = path.relative(path.resolve(repoRoot, "assets/generated/residents", slug, "review-pack"), spriteAbsPath);
      if (dataUri) {
        spriteSectionHtml = `<div class="sprite-container"><img src="${dataUri}" alt="Sprite sheet for ${escHtml(slug)}" style="max-width:100%;border:1px solid #ccc;" /></div>`;
      } else {
        // Fallback: relative path (works when opened from review-pack/ alongside incoming/)
        spriteSectionHtml = `<div class="sprite-container"><img src="../incoming/${escHtml(path.relative(path.resolve(repoRoot, "assets/generated/residents", slug, "incoming"), spriteAbsPath))}" alt="Sprite sheet" style="max-width:100%;border:1px solid #ccc;" /><p class="note">Note: image not base64-encoded (invalid PNG signature)</p></div>`;
      }
    }
  }

  // Expression thumbnails
  const exprHtmlParts = EXPRESSIONS.map(expr => {
    const key = `expr-${expr}`;
    const absPath = assetPaths[key];
    if (absPath) {
      const dataUri = fileToDataUri(absPath);
      if (dataUri) {
        return `<div class="expr-thumb"><img src="${dataUri}" alt="${escHtml(expr)}" /><div class="expr-label">${escHtml(expr)}</div></div>`;
      }
    }
    return `<div class="expr-thumb missing"><div class="expr-placeholder">?</div><div class="expr-label missing-label">${escHtml(expr)}<br><small>missing</small></div></div>`;
  });
  const expressionsHtml = `<div class="expressions-row">${exprHtmlParts.join("\n")}</div>`;

  // Icon preview
  let iconHtml = `<div class="missing-asset">Icon candidate not found</div>`;
  if (assetPaths["icon"]) {
    const iconDataUri = fileToDataUri(assetPaths["icon"]);
    if (iconDataUri) {
      iconHtml = `<div class="icon-preview"><img src="${iconDataUri}" alt="Icon candidate" /></div>`;
    }
  }

  // Missing assets section
  let missingHtml = `<p class="all-present">All required assets present.</p>`;
  if (missingAssets.length > 0) {
    const items = missingAssets.map(m => {
      const badge = m.required ? `<span class="badge-required">required</span>` : `<span class="badge-optional">variant</span>`;
      return `<li>${badge} <code>${escHtml(m.rel)}</code> — ${escHtml(m.label)}</li>`;
    });
    missingHtml = `<ul class="missing-list">${items.join("\n")}</ul>`;
  }

  // Validation report
  let validationHtml = `<p class="note">No expression manifest or icon source report found.</p>`;
  const validationParts = [];
  if (expressionManifest) {
    validationParts.push(`<h4>expression-manifest.candidate.json</h4><pre>${escHtml(JSON.stringify(expressionManifest, null, 2))}</pre>`);
  }
  if (iconReport) {
    validationParts.push(`<h4>icon-source-report.json</h4><pre>${escHtml(JSON.stringify(iconReport, null, 2))}</pre>`);
  }
  if (validationParts.length > 0) {
    validationHtml = validationParts.join("\n");
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Asset Review Pack — ${escHtml(slug)}</title>
  <style>
    /* === Reset & Base === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f4f4f4;
      color: #1a1a1a;
      padding: 24px;
      line-height: 1.5;
    }
    h1 { font-size: 1.6rem; margin-bottom: 4px; }
    h2 { font-size: 1.1rem; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #ddd; }
    h3 { font-size: 1rem; margin: 16px 0 6px; }
    h4 { font-size: 0.9rem; margin: 12px 0 4px; color: #555; }
    code { background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
    pre {
      background: #1e1e1e; color: #d4d4d4;
      padding: 12px; border-radius: 4px;
      overflow-x: auto; font-size: 0.8rem;
      white-space: pre-wrap; word-break: break-all;
    }
    small { font-size: 0.8em; }
    ul { padding-left: 20px; }
    li { margin: 4px 0; }

    /* === Layout === */
    .container { max-width: 960px; margin: 0 auto; }
    .card {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 20px;
    }

    /* === Safety Banner === */
    .safety-banner {
      background: #fff3cd;
      border: 2px solid #f0ad4e;
      border-radius: 6px;
      padding: 14px 20px;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .safety-banner .candidate-badge {
      display: inline-block;
      background: #dc3545;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-left: 8px;
      vertical-align: middle;
    }

    /* === Identity === */
    .identity-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .identity-item { }
    .identity-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }
    .identity-value { font-size: 1rem; font-weight: 600; }

    /* === Lane table === */
    .lane-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .lane-table th, .lane-table td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
    .lane-table thead { background: #f0f0f0; }
    .status-planned { color: #888; }
    .status-running { color: #0066cc; }
    .status-candidate-ready { color: #28a745; font-weight: 600; }
    .status-ready-promoted { color: #155724; font-weight: 700; }

    /* === Sprite === */
    .sprite-container img { max-width: 100%; height: auto; display: block; }

    /* === Expressions === */
    .expressions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 8px;
    }
    .expr-thumb {
      text-align: center;
      width: 120px;
    }
    .expr-thumb img { width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px; }
    .expr-placeholder {
      width: 100%;
      height: 80px;
      background: #f0f0f0;
      border: 2px dashed #ccc;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      color: #999;
    }
    .expr-label { font-size: 0.75rem; margin-top: 4px; color: #555; }
    .missing-label { color: #dc3545; }

    /* === Icon === */
    .icon-preview img { max-width: 192px; height: auto; border: 1px solid #ccc; border-radius: 4px; }

    /* === Missing === */
    .missing-asset { color: #856404; background: #fff3cd; padding: 8px 12px; border-radius: 4px; }
    .missing-list { color: #333; }
    .badge-required {
      background: #dc3545; color: #fff;
      padding: 1px 6px; border-radius: 3px; font-size: 0.75rem; margin-right: 4px;
    }
    .badge-optional {
      background: #6c757d; color: #fff;
      padding: 1px 6px; border-radius: 3px; font-size: 0.75rem; margin-right: 4px;
    }
    .all-present { color: #155724; background: #d4edda; padding: 8px 12px; border-radius: 4px; }

    /* === Footer === */
    .footer { font-size: 0.75rem; color: #999; margin-top: 24px; }
    .note { font-size: 0.85rem; color: #666; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">

    <!-- Safety Banner -->
    <div class="safety-banner">
      ⚠ これはcandidate状態です。public/art への昇格・ready化は別PBIのPO承認フローで実施します。
      <span class="candidate-badge">candidateOnly: true</span>
    </div>

    <h1>Asset Review Pack — ${escHtml(slug)}</h1>
    <p class="note">Generated: ${escHtml(generatedAt)}</p>

    <!-- Character Identity -->
    <div class="card">
      <h2>キャラクター情報</h2>
      <div class="identity-grid">
        <div class="identity-item">
          <div class="identity-label">Slug</div>
          <div class="identity-value"><code>${escHtml(slug)}</code></div>
        </div>
        <div class="identity-item">
          <div class="identity-label">名前 (displayName)</div>
          <div class="identity-value">${escHtml(displayName)}</div>
        </div>
        <div class="identity-item">
          <div class="identity-label">性格 (personality)</div>
          <div class="identity-value">${escHtml(personality)}</div>
        </div>
        <div class="identity-item">
          <div class="identity-label">口調 (tone)</div>
          <div class="identity-value">${escHtml(tone)}</div>
        </div>
        <div class="identity-item">
          <div class="identity-label">年齢 (age)</div>
          <div class="identity-value">${escHtml(age)}</div>
        </div>
      </div>
    </div>

    <!-- Lane Status -->
    <div class="card">
      <h2>レーン状態</h2>
      ${laneStatusHtml}
    </div>

    <!-- Sprite Sheet -->
    <div class="card">
      <h2>スプライトシート</h2>
      ${spriteSectionHtml}
    </div>

    <!-- Expression Thumbnails -->
    <div class="card">
      <h2>表情差分</h2>
      ${expressionsHtml}
    </div>

    <!-- Icon Preview -->
    <div class="card">
      <h2>アイコン候補</h2>
      ${iconHtml}
    </div>

    <!-- Missing Assets -->
    <div class="card">
      <h2>不足アセット</h2>
      ${missingHtml}
    </div>

    <!-- Validation Report -->
    <div class="card">
      <h2>バリデーションレポート</h2>
      ${validationHtml}
    </div>

    <div class="footer">
      <p>このレビューパックは <code>tools/sidekick/build-asset-review-pack.mjs</code> により生成されました。</p>
      <p>public/art への書き込みは行いません。APIを呼びません。外部リソースを含みません。</p>
    </div>

  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Output file builders
// ---------------------------------------------------------------------------

/**
 * Builds review-summary.json content.
 */
function buildReviewSummary({ slug, meta, hasSprite, presentAssets, missingAssets, expressionManifest, iconReport, generatedAt }) {
  const laneState = meta.laneState ?? null;
  const validationOnlyBridge =
    (expressionManifest && expressionManifest.candidateEligible === false) ||
    (iconReport && iconReport.candidateEligible === false) ||
    false;

  return {
    slug,
    candidateOnly: true,
    readyPromotionAllowed: false,
    generatedAt,
    lanes: laneState ? (laneState.lanes ?? {}) : {},
    presentAssets,
    missingAssets: missingAssets.map(m => m.rel),
    validationOnlyBridge,
  };
}

/**
 * Builds missing-assets.json content.
 */
function buildMissingAssets({ slug, missingAssets }) {
  return {
    slug,
    missingAssets: missingAssets.map(m => ({
      rel: m.rel,
      label: m.label,
      required: m.required,
    })),
  };
}

/**
 * Builds po-review-checklist.md content.
 */
function buildPoChecklist(slug) {
  return `# PO Review Checklist — ${slug}

## 確認事項
- [ ] キャラクターのアイデンティティ（名前・性格）が一致している
- [ ] 全表情が同一キャラクターとして一貫している
- [ ] 体型・衣装・ポーズが表情間で一致している
- [ ] 透過背景（アルファチャンネル）が正しい
- [ ] Sprite sheetの行順がpreviewMode仕様と一致している
- [ ] Iconはスプライトフレームから切り出されている（AI再生成でない）
- [ ] 切り抜きによる体のはみ出しがない

## 採用判断
- [ ] PO採用OK → 別PBIのready promotion flowで昇格する
- [ ] 要修正 → 修正内容を記載して再生成依頼

## 注意
このチェックリストを完了するまで public/art への昇格は実施しません。
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  try {
    // Validate slug
    const slug = args.slug;
    if (!slug || typeof slug !== "string") {
      throw new Error("--slug is required.");
    }
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(`Slug "${slug}" is invalid. Use lowercase letters, numbers, hyphen, or underscore.`);
    }

    // Resolve directories
    const residentDir = path.join(repoRoot, "assets", "generated", "residents", slug);
    const incomingDir = args.incomingDir
      ? path.resolve(repoRoot, args.incomingDir)
      : path.join(residentDir, "incoming");
    const outputDir = args.outputDir
      ? path.resolve(repoRoot, args.outputDir)
      : path.join(residentDir, "review-pack");

    // Security guard: refuse writes to public/art or src
    assertOutputBoundary(outputDir, repoRoot);

    const generatedAt = new Date().toISOString();

    // Check incoming dir existence
    if (!existsSync(incomingDir)) {
      if (args.dryRun) {
        console.log(`[dry-run] Asset Review Pack — ${slug}`);
        console.log(`  slug:         ${slug}`);
        console.log(`  incoming-dir: ${path.relative(repoRoot, incomingDir)}`);
        console.log(`  output-dir:   ${path.relative(repoRoot, outputDir)}`);
        console.log(`\nError: incoming directory does not exist: ${path.relative(repoRoot, incomingDir)}`);
        console.log(`  Create it first by running the asset intake pipeline.`);
        process.exit(1);
      }
      throw new Error(
        `Incoming directory does not exist: ${path.relative(repoRoot, incomingDir)}\n` +
        `  Expected path: ${incomingDir}\n` +
        `  Run the asset intake pipeline first to populate this directory.`,
      );
    }

    // Load metadata
    const meta = loadCharacterMetadata(slug, residentDir);

    // Check assets
    const { presentAssets, missingAssets, assetPaths, hasSprite } = checkAssets(incomingDir);

    // Load optional JSON reports — prefer canonical subdir layout, fall back to legacy root placement
    const exprManifestPath = firstExisting(
      path.join(incomingDir, "expressions", "expression-manifest.candidate.json"),
      path.join(incomingDir, "expression-manifest.candidate.json"),
    );
    const iconReportPath = firstExisting(
      path.join(incomingDir, "icons", "icon-source-report.json"),
      path.join(incomingDir, "icon-source-report.json"),
    );
    const expressionManifest = readJsonSafe(exprManifestPath);
    const iconReport = readJsonSafe(iconReportPath);

    // Prepare output data
    const reviewSummary = buildReviewSummary({
      slug, meta, hasSprite, presentAssets, missingAssets, expressionManifest, iconReport, generatedAt,
    });
    const missingAssetsData = buildMissingAssets({ slug, missingAssets });
    const poChecklist = buildPoChecklist(slug);
    const htmlContent = buildIndexHtml({
      slug, meta, assetPaths, hasSprite, missingAssets, expressionManifest, iconReport, generatedAt,
    });

    // Output files
    const outputFiles = [
      { name: "index.html", content: htmlContent },
      { name: "review-summary.json", content: JSON.stringify(reviewSummary, null, 2) + "\n" },
      { name: "missing-assets.json", content: JSON.stringify(missingAssetsData, null, 2) + "\n" },
      { name: "po-review-checklist.md", content: poChecklist },
    ];

    // --- Dry run ---
    if (args.dryRun) {
      console.log(`\n[dry-run] Asset Review Pack — ${slug}`);
      console.log(`  slug:         ${slug}`);
      console.log(`  incoming-dir: ${path.relative(repoRoot, incomingDir)}`);
      console.log(`  output-dir:   ${path.relative(repoRoot, outputDir)}`);
      console.log(`\n  Present assets (${presentAssets.length}):`);
      for (const rel of presentAssets) {
        console.log(`    + ${rel}`);
      }
      if (missingAssets.length > 0) {
        console.log(`\n  Missing assets (${missingAssets.length}):`);
        for (const m of missingAssets) {
          const req = m.required ? "[required]" : "[variant]";
          console.log(`    - ${m.rel}  ${req}`);
        }
      } else {
        console.log(`\n  Missing assets: none`);
      }
      console.log(`\n  Would write to: ${path.relative(repoRoot, outputDir)}/`);
      for (const f of outputFiles) {
        console.log(`    ${f.name}`);
      }
      console.log(`\n  review-summary.json preview:`);
      console.log(`    candidateOnly:          ${reviewSummary.candidateOnly}`);
      console.log(`    readyPromotionAllowed:  ${reviewSummary.readyPromotionAllowed}`);
      console.log(`    validationOnlyBridge:  ${reviewSummary.validationOnlyBridge}`);
      console.log(`\n[dry-run] No files written.`);
      return;
    }

    // --- Write output ---
    // Security guard one more time before actual writes
    assertOutputBoundary(outputDir, repoRoot);
    mkdirSync(outputDir, { recursive: true });

    for (const f of outputFiles) {
      const destPath = path.join(outputDir, f.name);
      writeFileSync(destPath, f.content, "utf8");
    }

    console.log(`\nAsset review pack generated for: ${slug}`);
    console.log(`  output: ${path.relative(repoRoot, outputDir)}/`);
    for (const f of outputFiles) {
      console.log(`    ${f.name}`);
    }
    console.log(`\n  candidateOnly:         true`);
    console.log(`  readyPromotionAllowed: false`);
    console.log(`\n  Open in browser: ${path.join(outputDir, "index.html")}`);
    console.log(`\nNote: No art was generated. No public/art writes. No external API calls.`);

  } catch (err) {
    console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
