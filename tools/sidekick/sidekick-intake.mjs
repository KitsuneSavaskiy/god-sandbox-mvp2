#!/usr/bin/env node
/**
 * Sidekick Player Asset Intake — Layer 1 + 2
 *
 * The non-technical user provides only: character name (slug) + portrait PNG.
 * This tool auto-generates the job and sets up folders. The operator then
 * takes the prompt and portrait reference to an external image generation UI.
 *
 * Usage:
 *   npm run sidekick:intake -- --slug ryo --portrait <path-to-portrait.png>
 *   node tools/sidekick/sidekick-intake.mjs --slug ryo --portrait <path>
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,59}$/;

function printHelp() {
  console.log(`Sidekick Player Asset Intake — Layer 1 + 2

Usage:
  npm run sidekick:intake -- --slug <slug> --portrait <path>
  node tools/sidekick/sidekick-intake.mjs --slug <slug> --portrait <path>

Arguments:
  --slug      Character slug (lowercase letters, numbers, hyphen, underscore)
              Examples: ryo, suzu, new-char
  --portrait  Path to the character portrait PNG
              Example: public/art/characters/defaults/ryo/portrait.png

What this tool does:
  1. Validates slug and portrait
  2. Auto-generates characterId, assetBundleId, jobId, createdAt
  3. Writes job JSON to .godsandbox/jobs/<jobId>.json
  4. Creates assets/generated/residents/<slug>/incoming/ folder
  5. Copies portrait to a gitignored reference location
  6. Auto-generates .prompts/resident-sprites/<slug>.md from _template.md if it does not exist
  7. Prints prompt path and next steps for the operator

The non-technical user provides only: character name (slug) + portrait PNG.
The operator uses the auto-generated prompt with an external image generation UI.
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--slug" && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (argv[i] === "--portrait" && argv[i + 1]) {
      args.portrait = argv[i + 1];
      i++;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    }
  }
  return args;
}

function assertSlug(slug) {
  if (!slug || typeof slug !== "string") {
    throw new Error("--slug is required. Example: --slug ryo");
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Slug "${slug}" is invalid. Use lowercase letters, numbers, hyphen, or underscore. Must start with a letter or number.`,
    );
  }
}

function assertPortrait(portraitPath, resolvedPath) {
  if (!portraitPath || typeof portraitPath !== "string") {
    throw new Error("--portrait is required. Example: --portrait public/art/characters/defaults/ryo/portrait.png");
  }
  if (!existsSync(resolvedPath)) {
    throw new Error(`Portrait file not found: ${portraitPath}`);
  }
  if (!statSync(resolvedPath).isFile()) {
    throw new Error(`Portrait path is not a file: ${portraitPath}`);
  }
  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== ".png") {
    throw new Error(`Portrait must be a PNG file (got ${ext}): ${portraitPath}`);
  }
  const header = readFileSync(resolvedPath).subarray(0, 8);
  if (!PNG_SIGNATURE.every((byte, i) => header[i] === byte)) {
    throw new Error(`File is not a valid PNG: ${portraitPath}`);
  }
}

function ensurePrompt(slug, portraitRelPath) {
  const promptPath = path.join(repoRoot, ".prompts", "resident-sprites", `${slug}.md`);
  const promptRelPath = path.relative(repoRoot, promptPath);

  if (existsSync(promptPath)) {
    return { generated: false, path: promptRelPath };
  }

  const templatePath = path.join(repoRoot, ".prompts", "resident-sprites", "_template.md");
  if (!existsSync(templatePath)) {
    throw new Error(`Prompt template not found: .prompts/resident-sprites/_template.md`);
  }

  const raw = readFileSync(templatePath, "utf8");
  const separatorIndex = raw.indexOf("\n---\n");
  if (separatorIndex === -1) {
    throw new Error("Prompt template is missing the --- separator.");
  }
  const body = raw.slice(separatorIndex + 5); // skip "\n---\n"

  const filled = body
    .replaceAll("[CHARACTER]", slug)
    .replaceAll("[PORTRAIT_PATH]", portraitRelPath);

  const header = `# ${slug} resident sprite sheet prompt\n\n`;
  writeFileSync(promptPath, header + filled);

  return { generated: true, path: promptRelPath };
}

function generateJobId(slug) {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${slug}-sprite-${timestamp}`;
}

function composeJob(slug, jobId) {
  return {
    jobVersion: "godsandbox-sidekick-job/v0",
    jobId,
    jobType: "character-asset-bundle",
    createdAt: new Date().toISOString(),
    characterId: `chr_${slug}`,
    assetBundleId: `${slug}-default-resident-v1`,
    worldDirectoryName: "default",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  };
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  try {
    assertSlug(args.slug);
    const slug = args.slug;
    const portraitResolved = path.resolve(repoRoot, args.portrait);
    assertPortrait(args.portrait, portraitResolved);

    const jobId = generateJobId(slug);
    const job = composeJob(slug, jobId);

    const jobsDir = path.join(repoRoot, ".godsandbox", "jobs");
    ensureDir(jobsDir);
    const jobFilePath = path.join(jobsDir, `${jobId}.json`);
    writeFileSync(jobFilePath, JSON.stringify(job, null, 2) + "\n");

    const incomingDir = path.join(repoRoot, "assets", "generated", "residents", slug, "incoming");
    ensureDir(incomingDir);

    const refDir = path.join(repoRoot, "assets", "generated", "residents", slug, "reference");
    ensureDir(refDir);
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const refFileName = `${slug}-portrait-reference-${timestamp}.png`;
    const refFilePath = path.join(refDir, refFileName);
    copyFileSync(portraitResolved, refFilePath);

    const portraitRelPath = path.relative(repoRoot, portraitResolved);
    const prompt = ensurePrompt(slug, portraitRelPath);
    const incomingRelDir = path.relative(repoRoot, incomingDir);
    const jobRelPath = path.relative(repoRoot, jobFilePath);
    const refRelPath = path.relative(repoRoot, refFilePath);

    console.log(`\nSidekick intake complete.`);
    console.log(`  characterId:    chr_${slug}`);
    console.log(`  assetBundleId:  ${slug}-default-resident-v1`);
    console.log(`  jobId:          ${jobId}`);
    console.log(`  job:            ${jobRelPath}`);
    console.log(`  portrait ref:   ${refRelPath}`);
    console.log(`  incoming:       ${incomingRelDir}/`);
    console.log(`  prompt:         ${prompt.path}${prompt.generated ? "  (auto-generated)" : ""}`);

    console.log(`\nOperator next steps:`);
    console.log(`  1. Open Codex pet or an approved external image generation UI.`);
    console.log(`  2. Upload the portrait reference: ${refRelPath}`);
    console.log(`  3. Paste the contents of ${prompt.path} as the prompt.`);
    console.log(`  4. Generate the sprite sheet and download the PNG.`);
    console.log(`  5. Place the PNG in: ${incomingRelDir}/`);
    console.log(`  6. Run: npm run sprite:check -- ${slug}`);
    console.log(``);
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
