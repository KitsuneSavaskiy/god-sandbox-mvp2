#!/usr/bin/env node
/**
 * Sidekick Player Asset Intake — Layer 1 + 2
 *
 * The non-technical user provides only: character name, personality, tone, age, portrait PNG.
 * These are collected by the game's character creation screen and passed to this tool.
 * The Codex sidekick (separate process) executes all remaining steps autonomously,
 * including sprite sheet generation via Codex pet.
 * Current PO preview work uses the Eve/Ryo combined-sheet procedure; this intake
 * tool only prepares source folders and canonical two-sheet prompt files.
 *
 * Operator usage:
 *   npm run sidekick:intake -- --slug ryo --name "Ryo" --personality "明るい" --tone "タメ口" --age 17 --portrait <path>
 *   node tools/sidekick/sidekick-intake.mjs --slug ryo --name "Ryo" ...
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

This command is for the sidekick / watcher flow.
The player-facing character form collects only these 5 inputs:
  --name         Display name  (例: "Ryo")
  --personality  Personality   (例: "明るい")
  --tone         Speech tone   (例: "タメ口")
  --age          Age (integer) (例: 17)
  --portrait     Portrait PNG path

Internal operator input:
  --slug         Internal asset key — lowercase, alphanumeric, hyphen, underscore
                 Manual CLI only. Game request JSON / watcher flow derives this automatically.

Operator usage:
  npm run sidekick:intake -- --slug ryo --name "Ryo" --personality "明るい" --tone "タメ口" --age 17 --portrait <path>

What this tool does:
  1. Validates all inputs
  2. Prepares local folders and portrait reference
  3. Auto-generates internal IDs and job record
  4. Auto-generates prompt files for the canonical 2 sprite sheets if absent
  5. Outputs the canonical-ready generation / validation gate

Current PO preview exception:
  If the task is PO visual preview from one portrait, use the Eve/Ryo combined-sheet procedure:
    .agents/skills/godsandbox-po-preview-sprite-from-portrait/SKILL.md
    docs/operations/resident-sprite-po-preview-quality.md

The non-technical user provides only the 5 character creation inputs via the game UI.
The Codex sidekick executes all remaining steps autonomously.
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--slug" && argv[i + 1]) { args.slug = argv[i + 1]; i++; }
    else if (argv[i] === "--name" && argv[i + 1]) { args.name = argv[i + 1]; i++; }
    else if (argv[i] === "--personality" && argv[i + 1]) { args.personality = argv[i + 1]; i++; }
    else if (argv[i] === "--tone" && argv[i + 1]) { args.tone = argv[i + 1]; i++; }
    else if (argv[i] === "--age" && argv[i + 1]) { args.age = argv[i + 1]; i++; }
    else if (argv[i] === "--portrait" && argv[i + 1]) { args.portrait = argv[i + 1]; i++; }
    else if (argv[i] === "--help" || argv[i] === "-h") { args.help = true; }
  }
  return args;
}

function assertSlug(slug) {
  if (!slug || typeof slug !== "string") throw new Error("--slug is required.");
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Slug "${slug}" is invalid. Use lowercase letters, numbers, hyphen, or underscore.`);
  }
}

function assertNonEmpty(value, flag) {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${flag} is required and must not be empty.`);
  }
}

function assertAge(value) {
  const n = parseInt(value, 10);
  if (!value || isNaN(n) || n < 0 || String(n) !== String(value).trim()) {
    throw new Error(`--age must be a non-negative integer. Got: ${value}`);
  }
  return n;
}

function assertPortrait(portraitPath, resolvedPath) {
  if (!portraitPath || typeof portraitPath !== "string") {
    throw new Error("--portrait is required.");
  }
  if (!existsSync(resolvedPath)) throw new Error(`Portrait file not found: ${portraitPath}`);
  if (!statSync(resolvedPath).isFile()) throw new Error(`Portrait path is not a file: ${portraitPath}`);
  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== ".png") throw new Error(`Portrait must be a PNG file (got ${ext}): ${portraitPath}`);
  const header = readFileSync(resolvedPath).subarray(0, 8);
  if (!PNG_SIGNATURE.every((byte, i) => header[i] === byte)) {
    throw new Error(`File is not a valid PNG: ${portraitPath}`);
  }
}

function ensurePromptFromTemplate(templateName, outputName, slug, portraitRelPath) {
  const promptPath = path.join(repoRoot, ".prompts", "resident-sprites", outputName);
  const promptRelPath = path.relative(repoRoot, promptPath);

  if (existsSync(promptPath)) return { generated: false, path: promptRelPath };

  const templatePath = path.join(repoRoot, ".prompts", "resident-sprites", templateName);
  if (!existsSync(templatePath)) {
    throw new Error(`Prompt template not found: .prompts/resident-sprites/${templateName}`);
  }

  const raw = readFileSync(templatePath, "utf8");
  const separatorIndex = raw.indexOf("\n---\n");
  const body = separatorIndex === -1 ? raw : raw.slice(separatorIndex + 5);
  const filled = body.replaceAll("[CHARACTER]", slug).replaceAll("[PORTRAIT_PATH]", portraitRelPath);

  writeFileSync(promptPath, filled.trim() + "\n");
  return { generated: true, path: promptRelPath };
}

function ensurePrompt(slug, portraitRelPath) {
  return ensurePromptFromTemplate("_template.md", `${slug}.md`, slug, portraitRelPath);
}

function ensureExtendedPrompt(slug, portraitRelPath) {
  return ensurePromptFromTemplate("_template-extended.md", `${slug}-extended.md`, slug, portraitRelPath);
}

function generateJobId(slug) {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${slug}-sprite-${timestamp}`;
}

function composeJob(slug, jobId, profile) {
  return {
    jobVersion: "godsandbox-sidekick-job/v0",
    jobId,
    jobType: "character-asset-bundle",
    createdAt: new Date().toISOString(),
    characterId: `chr_${slug}`,
    assetBundleId: slug,
    worldDirectoryName: "default",
    characterProfile: profile,
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  };
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  try {
    assertSlug(args.slug);
    assertNonEmpty(args.name, "--name");
    assertNonEmpty(args.personality, "--personality");
    assertNonEmpty(args.tone, "--tone");
    const age = assertAge(args.age);

    const slug = args.slug;
    const portraitResolved = path.resolve(repoRoot, args.portrait);
    assertPortrait(args.portrait, portraitResolved);

    const jobId = generateJobId(slug);
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

    const refDir = path.join(repoRoot, "assets", "generated", "residents", slug, "reference");
    ensureDir(refDir);
    const refFileName = `${slug}-portrait-reference-${timestamp}.png`;
    const refFilePath = path.join(refDir, refFileName);
    copyFileSync(portraitResolved, refFilePath);
    const refRelPath = path.relative(repoRoot, refFilePath);

    const profile = {
      displayName: args.name.trim(),
      personality: args.personality.trim(),
      tone: args.tone.trim(),
      age,
      portraitRef: refRelPath,
    };

    const job = composeJob(slug, jobId, profile);

    const jobsDir = path.join(repoRoot, ".godsandbox", "jobs");
    ensureDir(jobsDir);
    const jobFilePath = path.join(jobsDir, `${jobId}.json`);
    writeFileSync(jobFilePath, JSON.stringify(job, null, 2) + "\n");

    const incomingDir = path.join(repoRoot, "assets", "generated", "residents", slug, "incoming");
    ensureDir(incomingDir);

    const portraitRelPath = path.relative(repoRoot, portraitResolved);
    const prompt = ensurePrompt(slug, portraitRelPath);
    const extendedPrompt = ensureExtendedPrompt(slug, portraitRelPath);
    const incomingRelDir = path.relative(repoRoot, incomingDir);
    const jobRelPath = path.relative(repoRoot, jobFilePath);

    console.log(`\nSidekick intake complete.`);
    console.log(`  displayName:    ${profile.displayName}`);
    console.log(`  personality:    ${profile.personality}`);
    console.log(`  tone:           ${profile.tone}`);
    console.log(`  age:            ${profile.age}`);
    console.log(`  job record:     ${jobRelPath}`);
    console.log(`  portrait ref:   ${refRelPath}`);
    console.log(`  incoming:       ${incomingRelDir}/`);
    console.log(`  prompt (Sheet 1): ${prompt.path}${prompt.generated ? "  (auto-generated)" : ""}`);
    console.log(`  prompt (Sheet 2): ${extendedPrompt.path}${extendedPrompt.generated ? "  (auto-generated)" : ""}`);

    console.log(`\nPO preview note:`);
    console.log(`  Eve/Ryo-style PO preview should use one combined Codex pet sheet, not this 2-sheet gate.`);
    console.log(`  Read .agents/skills/godsandbox-po-preview-sprite-from-portrait/SKILL.md before preview generation.`);
    console.log(`\nGeneration gate — Sheet 1 (motion):`);
    console.log(`  npm run sidekick:resident:hatch-pet -- --slug ${slug} --sheet motion --portrait ${refRelPath} --prompt ${prompt.path}`);
    console.log(`\nGeneration gate — Sheet 2 (extended):`);
    console.log(`  npm run sidekick:resident:hatch-pet -- --slug ${slug} --sheet extended --portrait ${refRelPath} --prompt ${extendedPrompt.path}`);
    console.log(`\nValidation:`);
    console.log(`  The wrapper copies only validated hatch-pet final output into ${incomingRelDir}/`);
    console.log(`  It runs sprite:check after both motion and extended sheets are present.`);
    console.log(``);
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
