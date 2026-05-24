#!/usr/bin/env node
/**
 * Character Asset Prompt Pack Builder
 *
 * Generates a structured set of prompt files for a character's asset bundle.
 * Output is written to assets/generated/residents/<assetBundleId>/prompt-pack/
 * which is gitignored (see .gitignore: assets/generated/).
 *
 * Usage (as a module):
 *   import { buildPromptPack } from "./character-asset-prompt-pack.mjs";
 *   const { packDir, files } = await buildPromptPack({ ... });
 *
 * Usage (CLI standalone):
 *   node tools/app-server/character-asset-prompt-pack.mjs --help
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;

const VALID_LANES = ["resident-sprite-sheet", "portrait-expressions", "derived-icon"];
const VALID_PREVIEW_MODES = ["po-combined", "canonical-two-sheet"];

// assets/generated/ is gitignored — safe for prompt-pack staging output
const RESIDENTS_BASE = path.join(repoRoot, "assets", "generated", "residents");

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

/**
 * Builds a character asset prompt pack.
 *
 * @param {object} params
 * @param {string} params.assetBundleId      - Slug (must match SLUG_PATTERN)
 * @param {string} params.displayName        - Human-readable character name
 * @param {string} params.personality        - Personality description
 * @param {string} params.tone               - Speech tone description
 * @param {number} params.age                - Character age (non-negative integer)
 * @param {string} params.portraitPath       - Relative path to portrait PNG from repoRoot
 * @param {string[]} params.lanes            - Which asset lanes to prepare prompts for
 * @param {"po-combined"|"canonical-two-sheet"} params.previewMode
 * @param {string} params.repoRoot           - Repo root path (optional override)
 * @returns {Promise<{packDir: string, files: string[]}>}
 */
export async function buildPromptPack(params) {
  const {
    assetBundleId,
    displayName,
    personality,
    tone,
    age,
    portraitPath,
    lanes = ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
    previewMode = "po-combined",
    repoRoot: repoRootOverride,
  } = params;

  const root = repoRootOverride ?? repoRoot;

  // --- Validation ---
  if (!assetBundleId || !SLUG_PATTERN.test(assetBundleId)) {
    throw new Error(
      `assetBundleId "${assetBundleId}" is invalid. Must match /^[a-z0-9][a-z0-9_-]{0,59}$/.`,
    );
  }
  if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
    throw new Error("displayName is required.");
  }
  if (!personality || typeof personality !== "string" || personality.trim().length === 0) {
    throw new Error("personality is required.");
  }
  if (!tone || typeof tone !== "string" || tone.trim().length === 0) {
    throw new Error("tone is required.");
  }
  const ageNum = typeof age === "number" ? age : parseInt(age, 10);
  if (!Number.isInteger(ageNum) || ageNum < 0) {
    throw new Error(`age must be a non-negative integer. Got: ${age}`);
  }
  if (!portraitPath || typeof portraitPath !== "string") {
    throw new Error("portraitPath is required.");
  }

  for (const lane of lanes) {
    if (!VALID_LANES.includes(lane)) {
      throw new Error(`Invalid lane "${lane}". Valid lanes: ${VALID_LANES.join(", ")}`);
    }
  }
  if (!VALID_PREVIEW_MODES.includes(previewMode)) {
    throw new Error(
      `Invalid previewMode "${previewMode}". Valid: ${VALID_PREVIEW_MODES.join(", ")}`,
    );
  }

  // --- Directory setup ---
  // assets/generated/ is gitignored
  const packDir = path.join(root, "assets", "generated", "residents", assetBundleId, "prompt-pack");
  const expressionsDir = path.join(packDir, "expressions");
  const spritesDir = path.join(packDir, "sprites");

  ensureDir(packDir);
  ensureDir(expressionsDir);
  ensureDir(spritesDir);

  const writtenFiles = [];

  function write(filePath, content) {
    writeFileSync(filePath, content);
    writtenFiles.push(path.relative(root, filePath));
  }

  const CHARACTER = displayName.trim();

  // --- character-profile.json ---
  const profilePath = path.join(packDir, "character-profile.json");
  write(
    profilePath,
    JSON.stringify(
      {
        assetBundleId,
        displayName: CHARACTER,
        personality: personality.trim(),
        tone: tone.trim(),
        age: ageNum,
        portraitPath,
        lanes,
        previewMode,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );

  // --- standing-base.prompt.md ---
  const standingBasePath = path.join(packDir, "standing-base.prompt.md");
  write(
    standingBasePath,
    buildStandingBasePrompt({ CHARACTER, personality: personality.trim(), tone: tone.trim(), ageNum, portraitPath }),
  );

  // --- Expression prompts — only if portrait-expressions lane is active ---
  if (lanes.includes("portrait-expressions")) {
    const expressions = ["neutral", "happy", "angry", "sad", "surprised"];
    for (const expr of expressions) {
      const exprPath = path.join(expressionsDir, `${expr}.prompt.md`);
      write(exprPath, buildExpressionPrompt({ CHARACTER, expression: expr, portraitPath }));
    }
  }

  // --- Sprite sheet prompts — only if resident-sprite-sheet lane is active ---
  // derived-icon is output metadata only; no prompt file to generate
  if (lanes.includes("resident-sprite-sheet")) {
    if (previewMode === "po-combined") {
      const combinedPath = path.join(spritesDir, "combined.prompt.md");
      write(
        combinedPath,
        buildCombinedSpritePrompt({ CHARACTER, personality: personality.trim(), tone: tone.trim(), ageNum, portraitPath }),
      );
    } else {
      // canonical-two-sheet
      const sheet1Path = path.join(spritesDir, "sheet1.prompt.md");
      const sheet2Path = path.join(spritesDir, "sheet2.prompt.md");
      write(
        sheet1Path,
        buildSheet1Prompt({ CHARACTER, personality: personality.trim(), tone: tone.trim(), ageNum, portraitPath }),
      );
      write(
        sheet2Path,
        buildSheet2Prompt({ CHARACTER, personality: personality.trim(), tone: tone.trim(), ageNum, portraitPath }),
      );
    }
  }

  return { packDir: path.relative(root, packDir), files: writtenFiles };
}

// ---------------------------------------------------------------------------
// Prompt content builders
// ---------------------------------------------------------------------------

function buildStandingBasePrompt({ CHARACTER, personality, tone, ageNum, portraitPath }) {
  return `# Standing Base Prompt — ${CHARACTER}

## Character Reference
- Portrait: ${portraitPath}
- Name: ${CHARACTER}
- Personality: ${personality}
- Tone: ${tone}
- Age: ${ageNum}

## Generation Instructions
Create a full-body standing sprite for ${CHARACTER}.

- Same character identity as [${CHARACTER}]
- Same hair, costume, body shape, pose, camera angle, lighting as the portrait reference
- Transparent background (alpha channel)
- Front-facing neutral standing pose
- No labels, no text, no frame markers, no watermarks
- Sprite dimensions: 192×208 px per frame
`;
}

/**
 * Builds an expression prompt for a specific emotion.
 * The five key consistency instructions are always present (per spec).
 */
function buildExpressionPrompt({ CHARACTER, expression, portraitPath }) {
  const expressionDescriptions = {
    neutral: "Calm, relaxed, default resting expression. Mouth closed or slightly open.",
    happy: "Bright smile, slightly raised cheeks, eyes may narrow or curve with joy.",
    angry: "Furrowed brows, narrowed or sharp eyes, mouth in a frown or tight line.",
    sad: "Downturned mouth, drooping eyelids, eyebrows angled with sorrow.",
    surprised: "Wide open eyes, slightly raised eyebrows, mouth open in surprise.",
  };

  const desc = expressionDescriptions[expression] ?? "Expression variant.";

  return `# Expression Prompt — ${CHARACTER} / ${expression}

## Character Reference
- Portrait: ${portraitPath}
- Character: ${CHARACTER}

## Expression Target
${expression.charAt(0).toUpperCase() + expression.slice(1)}: ${desc}

## Consistency Requirements (mandatory)
- same character identity as [${CHARACTER}]
- same hair, costume, body shape, pose, camera angle, lighting
- transparent background (alpha channel)
- only facial expression changes
- no labels, no text, no frame markers, no watermarks

## Generation Instructions
Render ${CHARACTER} with a ${expression} expression.
Keep all elements identical to the standing base except the facial expression.
`;
}

function buildCombinedSpritePrompt({ CHARACTER, personality, tone, ageNum, portraitPath }) {
  return `# Combined Sprite Sheet Prompt — ${CHARACTER} (PO Combined / po-combined)

## Character Reference
- Portrait: ${portraitPath}
- Name: ${CHARACTER}
- Personality: ${personality}
- Tone: ${tone}
- Age: ${ageNum}

## Sheet Layout
Single combined sheet: 826×1904 px (7 columns × 14 rows, each frame 118×136 px)

Row mapping (po-combined layout):
- row 0: idle (7 frames)
- row 1: walk-right (7 frames)
- row 2: walk-left (7 frames)
- row 3: waving (7 frames)
- row 4: jumping (7 frames)
- row 5: failed (7 frames)
- row 6: waiting (7 frames)
- row 7: review (7 frames)
- row 8: walk-up / walk-back (7 frames)
- row 9: walk-down / walk-forward (7 frames)
- row 10: emote-happy (7 frames)
- row 11: emote-angry (7 frames)
- row 12: emote-sad (7 frames)
- row 13: emote-surprised (7 frames)

## Generation Instructions
- Same character identity as [${CHARACTER}]
- Same hair, costume, body shape, camera angle, lighting throughout all frames
- Transparent background (alpha channel) for every frame
- Consistent pixel art style, no motion blur
- No labels, no text, no frame markers, no watermarks
- Fill unused cells with fully transparent pixels
`;
}

function buildSheet1Prompt({ CHARACTER, personality, tone, ageNum, portraitPath }) {
  return `# Sprite Sheet 1 — Motion (resident-sprite-sheet.png) — ${CHARACTER} (Canonical Two-Sheet)

## Character Reference
- Portrait: ${portraitPath}
- Name: ${CHARACTER}
- Personality: ${personality}
- Tone: ${tone}
- Age: ${ageNum}

## Sheet Layout
Sheet 1 (motion-sheet, resident-sprite-sheet.png): 1536×1872 px (8 columns × 9 rows, each frame 192×208 px)

Row mapping (canonical motion-sheet):
- row 0: idle (8 frames)
- row 1: walk-right (8 frames)
- row 2: walk-left (8 frames)
- row 3: waving (8 frames)
- row 4: jumping (8 frames)
- row 5: failed (8 frames)
- row 6: waiting (8 frames)
- row 7: running (8 frames)
- row 8: review (8 frames)

## Generation Instructions
- Same character identity as [${CHARACTER}]
- Same hair, costume, body shape, camera angle, lighting throughout all frames
- Transparent background (alpha channel) for every frame
- Smooth walk and idle cycles
- No labels, no text, no frame markers, no watermarks
- Fill unused cells with fully transparent pixels
`;
}

function buildSheet2Prompt({ CHARACTER, personality, tone, ageNum, portraitPath }) {
  return `# Sprite Sheet 2 — Extended (resident-sprite-sheet-extended.png) — ${CHARACTER} (Canonical Two-Sheet)

## Character Reference
- Portrait: ${portraitPath}
- Name: ${CHARACTER}
- Personality: ${personality}
- Tone: ${tone}
- Age: ${ageNum}

## Sheet Layout
Sheet 2 (extended-sheet, resident-sprite-sheet-extended.png): 1536×1872 px (8 columns × 9 rows, each frame 192×208 px)

Row mapping (canonical extended-sheet):
- row 0: walk-up (8 frames)
- row 1: walk-down (8 frames)
- row 2: walk-forward (8 frames)
- row 3: walk-back (8 frames)
- row 4: emote-happy (8 frames)
- row 5: emote-angry (8 frames)
- row 6: emote-sad (8 frames)
- row 7: emote-surprised (8 frames)
- row 8: spare (transparent or duplicate row 7)

## Consistency Requirements (mandatory)
- same character identity as [${CHARACTER}]
- same hair, costume, body shape, pose, camera angle, lighting
- transparent background (alpha channel)
- only facial expression changes (for emote rows)
- no labels, no text, no frame markers, no watermarks

## Generation Instructions
- Keep all non-emote elements identical to Sheet 1
- Emote rows: only facial expression changes between columns
- No labels, no text, no frame markers, no watermarks
- Fill unused cells with fully transparent pixels
`;
}

// ---------------------------------------------------------------------------
// CLI entry point (standalone use)
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`Character Asset Prompt Pack Builder

Generates prompt files for a character asset bundle.
Output goes to: assets/generated/residents/<assetBundleId>/prompt-pack/
(This directory is gitignored.)

Usage:
  node tools/app-server/character-asset-prompt-pack.mjs \\
    --slug <assetBundleId> \\
    --name <displayName> \\
    --personality <personality> \\
    --tone <tone> \\
    --age <age> \\
    --portrait <path> \\
    [--lanes resident-sprite-sheet,portrait-expressions,derived-icon] \\
    [--preview-mode po-combined|canonical-two-sheet]
`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (argv.length === 0) {
    printHelp();
    process.exit(1);
  }

  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === "--slug" && val) { args.slug = val; i++; }
    else if (flag === "--name" && val) { args.name = val; i++; }
    else if (flag === "--personality" && val) { args.personality = val; i++; }
    else if (flag === "--tone" && val) { args.tone = val; i++; }
    else if (flag === "--age" && val) { args.age = val; i++; }
    else if (flag === "--portrait" && val) { args.portrait = val; i++; }
    else if (flag === "--lanes" && val) { args.lanes = val.split(",").map((s) => s.trim()); i++; }
    else if (flag === "--preview-mode" && val) { args.previewMode = val; i++; }
  }

  try {
    const result = await buildPromptPack({
      assetBundleId: args.slug,
      displayName: args.name,
      personality: args.personality,
      tone: args.tone,
      age: args.age !== undefined ? parseInt(args.age, 10) : undefined,
      portraitPath: args.portrait,
      lanes: args.lanes,
      previewMode: args.previewMode,
    });

    console.log(`\nPrompt pack created: ${result.packDir}`);
    for (const f of result.files) {
      console.log(`  ${f}`);
    }
  } catch (err) {
    console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Run as CLI only when invoked directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
