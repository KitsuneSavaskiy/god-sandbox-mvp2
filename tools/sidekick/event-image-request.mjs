#!/usr/bin/env node
/**
 * Event Image Request CLI — PBI 9b-event-visual-reference-request
 *
 * Generates event image request JSON, prompt markdown, and reference manifest.
 * Does NOT call any image generation API. Does NOT write to .godsandbox/jobs/.
 * Output goes to .asset-pipeline/event-images/<requestId>/ (gitignored).
 *
 * Usage:
 *   node tools/sidekick/event-image-request.mjs --help
 *   npm run sidekick:event-image -- --help
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const TEMPLATE_PATH = path.join(
  repoRoot,
  "docs/art-prompts/event-images/event-image-request-template.md"
);
const VALID_ROLES = new Set(["primary", "supporting"]);
const VALID_COMPOSITIONS = new Set(["landscape", "portrait", "square"]);

function printHelp() {
  console.log(`Event Image Request CLI — PBI 9b

Generates a request JSON, prompt markdown, and reference manifest for event illustration.
Does NOT call any image generation API.
Output: .asset-pipeline/event-images/<requestId>/

Required:
  --event-id <id>       Event instance ID (e.g. evt_test_shared_nap)
  --template-id <id>    Event template ID (e.g. shared-nap-place)
  --summary <text>      Short description of the scene
  --participant <spec>  characterId:displayName:role:referencePath
                        role: primary | supporting
                        (repeat for multiple participants, 1–4 total)

Optional:
  --tag <tag>             Situation tag (repeatable)
  --location-label <text> Location description
  --mood-tag <tag>        Mood tag (repeatable)
  --composition <value>   landscape | portrait | square  (default: landscape)
  --background-hint <text>
  --style-hint <text>
  --dry-run               Preview only — no files written

Example:
  node tools/sidekick/event-image-request.mjs \\
    --event-id evt_test_shared_nap \\
    --template-id shared-nap-place \\
    --summary "RyoとSuzuが木陰で同じ時間を過ごしている" \\
    --tag daily-life \\
    --tag shared-nap \\
    --participant chr_ryo:Ryo:primary:public/art/characters/defaults/ryo/portrait.png \\
    --participant chr_suzu:Suzu:supporting:public/art/characters/defaults/suzu/portrait.png \\
    --composition landscape \\
    --background-hint "緑の木陰、午後の木漏れ日" \\
    --style-hint "watercolor, soft light" \\
    --dry-run
`);
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(argv) {
  const args = {
    tags: [],
    moodTags: [],
    participants: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") { args.help = true; }
    else if (flag === "--dry-run") { args.dryRun = true; }
    else if (flag === "--event-id") { args.eventId = requireValue(argv, i, flag); i++; }
    else if (flag === "--template-id") { args.templateId = requireValue(argv, i, flag); i++; }
    else if (flag === "--summary") { args.summary = requireValue(argv, i, flag); i++; }
    else if (flag === "--tag") { args.tags.push(requireValue(argv, i, flag)); i++; }
    else if (flag === "--location-label") { args.locationLabel = requireValue(argv, i, flag); i++; }
    else if (flag === "--mood-tag") { args.moodTags.push(requireValue(argv, i, flag)); i++; }
    else if (flag === "--composition") { args.composition = requireValue(argv, i, flag); i++; }
    else if (flag === "--background-hint") { args.backgroundHint = requireValue(argv, i, flag); i++; }
    else if (flag === "--style-hint") { args.styleHint = requireValue(argv, i, flag); i++; }
    else if (flag === "--participant") { args.participants.push(requireValue(argv, i, flag)); i++; }
    else if (flag.startsWith("-")) {
      throw new Error(`Unknown flag: "${flag}". Run --help to see valid flags.`);
    }
  }
  return args;
}

function parseParticipant(spec) {
  const parts = spec.split(":");
  if (parts.length < 4) {
    throw new Error(
      `Invalid --participant format: "${spec}"\nExpected: characterId:displayName:role:referencePath`
    );
  }
  const [characterId, displayName, role, ...rest] = parts;
  // referencePath may contain colons on Windows — rejoin remainder
  const referencePath = rest.join(":");
  return { characterId, displayName, role, referencePath };
}

function inferReferenceKind(refPath) {
  const lower = refPath.toLowerCase();
  if (lower.includes("portrait")) return "portrait";
  if (lower.includes("sprite")) return "sprite";
  if (lower.includes("icon")) return "icon";
  return "other";
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildRequestId(eventId) {
  const now = new Date();
  const ts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ].join("");
  return `evtimg-${ts}-${slugify(eventId)}`;
}

function validate(args) {
  if (!args.eventId || !args.eventId.trim()) {
    throw new Error("--event-id is required and must not be empty.");
  }
  if (!args.templateId || !args.templateId.trim()) {
    throw new Error("--template-id is required and must not be empty.");
  }
  if (!args.summary || !args.summary.trim()) {
    throw new Error("--summary is required and must not be empty.");
  }
  if (args.participants.length === 0) {
    throw new Error("At least one --participant is required.");
  }
  if (args.participants.length > 4) {
    throw new Error("--participant count must be 1–4.");
  }

  const composition = args.composition ?? "landscape";
  if (!VALID_COMPOSITIONS.has(composition)) {
    throw new Error(
      `--composition must be landscape, portrait, or square. Got: "${composition}"`
    );
  }

  const parsed = args.participants.map(parseParticipant);

  for (const p of parsed) {
    if (!p.characterId.trim()) throw new Error("characterId must not be empty.");
    if (!p.displayName.trim()) throw new Error("displayName must not be empty.");
    if (!VALID_ROLES.has(p.role)) {
      throw new Error(`role must be "primary" or "supporting". Got: "${p.role}"`);
    }
    if (!p.referencePath.trim()) {
      throw new Error("referencePath must not be empty.");
    }
    // Reject POSIX absolute paths and Windows-style absolute paths (C:\...)
    if (path.isAbsolute(p.referencePath) || /^[a-zA-Z]:[\\\/]/.test(p.referencePath)) {
      throw new Error(
        `referencePath must be a repo-relative path, not absolute: "${p.referencePath}"`
      );
    }
    const normalized = path.normalize(p.referencePath);
    if (normalized.startsWith("..")) {
      throw new Error(
        `referencePath must not escape the repo root: "${p.referencePath}"`
      );
    }
  }

  const primaryCount = parsed.filter((p) => p.role === "primary").length;
  if (primaryCount < 1) {
    throw new Error("At least one participant must have role=primary.");
  }

  return { parsed, composition };
}

function validateReferencePath(referencePath) {
  const abs = path.join(repoRoot, referencePath);
  if (!existsSync(abs)) return "missing";
  if (!statSync(abs).isFile()) return "not-a-file";
  return "ok";
}

function buildParticipantRefs(parsedParticipants) {
  return parsedParticipants.map((p) => ({
    characterId: p.characterId,
    displayName: p.displayName,
    role: p.role,
    referencePath: p.referencePath,
    referenceKind: inferReferenceKind(p.referencePath),
    exists: existsSync(path.join(repoRoot, p.referencePath)),
  }));
}

function buildRequest(args, requestId, refs, composition) {
  /** @type {import('./event-image-request.mjs').EventImageRequest} */
  const req = {
    requestFormat: "godsandbox-event-image-request/v1",
    requestId,
    createdAt: new Date().toISOString(),
    event: {
      eventId: args.eventId,
      templateId: args.templateId,
      summary: args.summary,
      situationTags: args.tags,
      ...(args.locationLabel ? { locationLabel: args.locationLabel } : {}),
      ...(args.moodTags.length ? { moodTags: args.moodTags } : {}),
    },
    participants: refs.map(({ exists: _exists, ...r }) => r),
    visualDirection: {
      imageKind: "event-illustration",
      composition,
      includeResidents: true,
      ...(args.backgroundHint ? { backgroundHint: args.backgroundHint } : {}),
      ...(args.styleHint ? { styleHint: args.styleHint } : {}),
      negativePrompt: [
        "UI elements",
        "buttons",
        "text labels",
        "status values",
        "score display",
        "faith value",
        "internal parameters",
        "horror",
        "gore",
        "tragedy",
      ],
    },
    output: {
      promptPath: `.asset-pipeline/event-images/${requestId}/prompt.md`,
      referenceManifestPath: `.asset-pipeline/event-images/${requestId}/reference-manifest.json`,
      incomingDir: `.asset-pipeline/event-images/${requestId}/incoming/`,
    },
  };
  return req;
}

function buildPrompt(args, refs, composition) {
  if (!existsSync(TEMPLATE_PATH)) {
    throw new Error(`Prompt template not found: docs/art-prompts/event-images/event-image-request-template.md`);
  }
  const template = readFileSync(TEMPLATE_PATH, "utf8");

  const participantLines = refs
    .map(
      (r) =>
        `- ${r.displayName} (${r.role}) — ref: ${r.referencePath} [${r.referenceKind}]`
    )
    .join("\n");

  return template
    .replace("{{eventId}}", args.eventId)
    .replace("{{templateId}}", args.templateId)
    .replace("{{summary}}", args.summary)
    .replace("{{situationTags}}", args.tags.join(", ") || "(none)")
    .replace("{{locationLabel}}", args.locationLabel ?? "(unspecified)")
    .replace("{{moodTags}}", args.moodTags.join(", ") || "(none)")
    .replace("{{participants}}", participantLines)
    .replace("{{composition}}", composition)
    .replace("{{backgroundHint}}", args.backgroundHint ?? "(unspecified)")
    .replace("{{styleHint}}", args.styleHint ?? "(unspecified)");
}

function buildManifest(requestId, refs) {
  return {
    format: "godsandbox-event-image-reference-manifest/v1",
    requestId,
    references: refs,
  };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[error] ${err.message}`);
    process.exit(1);
  }

  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(0);
  }

  let parsed, composition;
  try {
    ({ parsed, composition } = validate(args));
  } catch (err) {
    console.error(`[error] ${err.message}`);
    process.exit(1);
  }

  // Validate each referencePath: must exist and be a file
  const refErrors = parsed
    .map((p) => ({ p, status: validateReferencePath(p.referencePath) }))
    .filter(({ status }) => status !== "ok");
  if (refErrors.length > 0) {
    for (const { p, status } of refErrors) {
      const msg =
        status === "missing"
          ? `referencePath not found: ${p.referencePath}`
          : `referencePath is not a file: ${p.referencePath}`;
      console.error(`[error] ${msg}`);
    }
    process.exit(1);
  }

  const refs = buildParticipantRefs(parsed);
  const requestId = buildRequestId(args.eventId);

  let request, prompt, manifest;
  try {
    request = buildRequest(args, requestId, refs, composition);
    prompt = buildPrompt(args, refs, composition);
    manifest = buildManifest(requestId, refs);
  } catch (err) {
    console.error(`[error] ${err.message}`);
    process.exit(1);
  }

  if (args.dryRun) {
    console.log("=== DRY RUN — no files written ===\n");
    console.log("--- request.json preview ---");
    console.log(JSON.stringify(request, null, 2));
    console.log("\n--- prompt.md preview ---");
    console.log(prompt);
    console.log("\n--- reference-manifest.json preview ---");
    console.log(JSON.stringify(manifest, null, 2));
    console.log("\n[dry-run] Done. Pass without --dry-run to write files.");
    return;
  }

  const outDir = path.join(repoRoot, ".asset-pipeline", "event-images", requestId);
  mkdirSync(path.join(outDir, "incoming"), { recursive: true });

  writeFileSync(path.join(outDir, "request.json"), JSON.stringify(request, null, 2) + "\n");
  writeFileSync(path.join(outDir, "prompt.md"), prompt);
  writeFileSync(
    path.join(outDir, "reference-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );

  console.log(`[ok] Request created: .asset-pipeline/event-images/${requestId}/`);
  console.log(`     request.json`);
  console.log(`     prompt.md`);
  console.log(`     reference-manifest.json`);
  console.log(`     incoming/`);
  console.log(`\nNext step: share prompt.md and reference-manifest.json with your image generation tool.`);
  console.log(`Generated images go in incoming/. Promotion to public/art requires PO review.`);
}

main();
