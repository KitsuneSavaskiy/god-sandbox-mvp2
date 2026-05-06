#!/usr/bin/env node
// Node built-ins only — no external npm packages.

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_MANIFEST = join(__dirname, 'sprint9-phase2-dispatch.json');
const TEMPLATES_DIR = join(__dirname, 'templates');

const FORBIDDEN_EXPRESSIONS = [
  'Readyまたはmain入り',
  'レビュー後すぐ承認・merge可能',
  'Line 3と臨時Line Cは、作業開始時にIssueを新規作成',
  'Line 3と臨時Line Cは作業開始時にIssueを新規作成',
];

// Control chars excluding tab (\x09), LF (\x0A), CR (\x0D)
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

// U+FFFD: encoding failure sentinel
const REPLACEMENT_CHAR = '�';

// Wave gate constants
const MVP_MAX_WAVE = 1; // Wave 2/3 start not supported in MVP

// --- arg parsing ---

function parseArgs(argv) {
  const args = {
    manifest: null,
    wave: null,
    issue: null,
    mode: 'start',
    dryRun: false,
    post: false,
    status: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--wave') args.wave = parseInt(argv[++i], 10);
    else if (a === '--issue') args.issue = parseInt(argv[++i], 10);
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--post') args.post = true;
    else if (a === '--status') args.status = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

// --- manifest ---

function loadManifest(manifestPath) {
  const p = resolve(manifestPath);
  if (!existsSync(p)) {
    console.error(`Manifest not found: ${p}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

// --- template rendering ---

function loadTemplate(mode) {
  const templatePath = join(TEMPLATES_DIR, `line-${mode}.md`);
  if (!existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }
  return readFileSync(templatePath, 'utf8');
}

function renderList(items) {
  if (!items || items.length === 0) return '(なし)';
  return items.map(item => `- ${item}`).join('\n');
}

function renderDeps(deps) {
  if (!deps || deps.length === 0) return '(なし)';
  return deps.map(d => `- #${d}`).join('\n');
}

function render(template, entry) {
  const vars = {
    '{{issue}}': String(entry.issue),
    '{{pbi}}': entry.pbi,
    '{{line}}': entry.line,
    '{{wave}}': String(entry.wave),
    '{{mergeOrder}}': String(entry.mergeOrder),
    '{{waveStartPolicy}}': entry.waveStartPolicy ?? '(未定義)',
    '{{ownedPaths}}': renderList(entry.ownedPaths),
    '{{forbiddenPaths}}': renderList(entry.forbiddenPaths),
    '{{reservedScripts}}': renderList(entry.reservedScripts),
    '{{dependencies}}': renderDeps(entry.dependencies),
    '{{requiredDocs}}': renderList(entry.requiredDocs),
    '{{tasks}}': renderList(entry.tasks),
    '{{notDo}}': renderList(entry.notDo),
    '{{requiredTests}}': renderList(entry.requiredTests),
    '{{acceptanceCriteria}}': renderList(entry.acceptanceCriteria),
    '{{conflictNotes}}': renderList(entry.conflictNotes),
    '{{prBodyRequirements}}': renderList(entry.prBodyRequirements),
  };
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(k, v);
  }
  return out;
}

// --- validation ---

function validate(text, entry) {
  const errors = [];

  // Forbidden expressions
  for (const expr of FORBIDDEN_EXPRESSIONS) {
    if (text.includes(expr)) errors.push(`Forbidden expression: "${expr}"`);
  }

  // Control characters (excluding tab and newline)
  if (CONTROL_CHAR_RE.test(text)) errors.push('Control characters detected (excluding tab and newline)');

  // Replacement character — encoding failure
  if (text.includes(REPLACEMENT_CHAR)) {
    errors.push('Replacement character (U+FFFD) detected — possible encoding issue');
  }

  // Per-entry required keywords from manifest.
  // validationKeywords: [] or omitted = skip keyword check.
  const required = entry.validationKeywords ?? [];
  for (const kw of required) {
    if (!text.includes(kw)) {
      errors.push(`Required keyword missing for #${entry.issue}: "${kw}"`);
    }
  }

  return errors;
}

// --- wave gate ---

function ghExec(cmd, opts = {}) {
  return execSync(`gh ${cmd}`, { encoding: 'utf8', ...opts });
}

function getIssueState(issueNumber) {
  try {
    return ghExec(`issue view ${issueNumber} --json state --jq '.state'`).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function enforceWaveGate(args, entries) {
  const { mode, post, dryRun } = args;

  // prep mode: Wave 1 only
  if (mode === 'prep') {
    const invalid = entries.filter(e => e.wave !== 1);
    if (invalid.length > 0) {
      console.error('Error: --mode prep is only allowed for Wave 1 entries.');
      console.error(`  Non-Wave-1: ${invalid.map(e => `#${e.issue} (wave ${e.wave})`).join(', ')}`);
      process.exit(1);
    }
    return;
  }

  // blocked mode: any wave allowed
  if (mode === 'blocked') return;

  // start mode
  if (mode !== 'start') return;

  // Wave 2/3: not supported in MVP — always fail
  const highWave = entries.filter(e => e.wave > MVP_MAX_WAVE);
  if (highWave.length > 0) {
    console.error(`Error: Wave ${[...new Set(highWave.map(e => e.wave))].join('/')} start is not supported in this MVP dispatcher.`);
    console.error(`  Issues: ${highWave.map(e => `#${e.issue} (wave ${e.wave})`).join(', ')}`);
    console.error('  Use --mode blocked or --mode prep for non-MVP waves, or update MVP_MAX_WAVE.');
    process.exit(1);
  }

  // Wave 1 start: dependency gate — enforced when posting (not dry-run)
  if (post && !dryRun) {
    const wave1 = entries.filter(e => e.wave === 1);
    if (wave1.length > 0) {
      const deps = [...new Set(wave1.flatMap(e => e.dependencies))];
      if (deps.length > 0) {
        const openDeps = deps.filter(d => getIssueState(d) !== 'CLOSED');
        if (openDeps.length > 0) {
          console.error('Error: Wave 1 dependency gate failed.');
          console.error(`  Open (not yet merged to main): ${openDeps.map(d => `#${d}`).join(', ')}`);
          console.error('  All Wave 1 dependencies must be merged to main before posting start instructions.');
          process.exit(1);
        }
      }
    }
  }
}

// --- GitHub operations ---

function getRepo() {
  try {
    const { owner, name } = JSON.parse(ghExec('repo view --json owner,name'));
    return `${owner.login}/${name}`;
  } catch {
    console.error('Failed to get repo info. Is gh CLI configured?');
    process.exit(1);
  }
}

function isAlreadyPosted(repo, issueNumber, wave, mode) {
  const marker = `<!-- sprint9-dispatch issue=${issueNumber} wave=${wave} mode=${mode} -->`;
  try {
    const body = ghExec(
      `api repos/${repo}/issues/${issueNumber}/comments --jq '[.[].body] | join("\\n")'`
    );
    return body.includes(marker);
  } catch {
    return false;
  }
}

function postComment(repo, issueNumber, body) {
  ghExec(`issue comment ${issueNumber} --repo ${repo} --body-file -`, {
    input: body,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

// --- status display ---

function showStatus(manifest) {
  console.log('## Sprint9 Wave Status\n');
  const waves = [...new Set(manifest.map(e => e.wave))].sort((a, b) => a - b);

  for (const wave of waves) {
    const entries = manifest.filter(e => e.wave === wave);
    console.log(`### Wave ${wave}`);
    for (const entry of entries) {
      const state = getIssueState(entry.issue);
      const tag = state === 'CLOSED' ? '[merged]' : '[open]  ';
      console.log(`  ${tag} #${entry.issue} (${entry.line}) ${entry.pbi}`);
      if (entry.dependencies.length > 0) {
        console.log(`           deps: ${entry.dependencies.map(d => `#${d}`).join(', ')}`);
      }
    }
    console.log();
  }

  console.log('### Wave gate summary');
  for (const wave of waves.slice(1)) {
    const deps = [...new Set(manifest.filter(e => e.wave === wave).flatMap(e => e.dependencies))];
    if (deps.length === 0) {
      console.log(`  Wave ${wave}: no dependencies`);
      continue;
    }
    const allMerged = deps.every(d => getIssueState(d) === 'CLOSED');
    const status = allMerged ? 'READY to open' : 'BLOCKED';
    console.log(`  Wave ${wave}: ${status} (deps: ${deps.map(d => `#${d}`).join(', ')})`);
  }
}

// --- help ---

function printHelp() {
  console.log(`Usage: npm run sprint9:dispatch -- [options]

Options:
  --manifest PATH  Path to manifest JSON (default: sprint9-phase2-dispatch.json)
  --wave N         Target wave number
  --issue N        Target issue number
  --mode M         Template mode: start | prep | blocked  (default: start)
  --dry-run        Print rendered output without posting
  --post           Post to GitHub issue comment (uses gh CLI)
  --status         Show current wave / merge status
  --help, -h       Show this help

Wave gate rules:
  start + wave 0:   no dependency check
  start + wave 1:   dependency gate enforced when using --post
  start + wave 2+:  not supported in MVP (always fails)
  prep:             Wave 1 only
  blocked:          any wave allowed

Examples:
  npm run sprint9:dispatch -- --wave 0 --dry-run
  npm run sprint9:dispatch -- --issue 197 --dry-run
  npm run sprint9:dispatch -- --wave 1 --mode prep --dry-run
  npm run sprint9:dispatch -- --status
  npm run sprint9:dispatch -- --issue 201 --post
  npm run sprint9:dispatch -- --manifest tools/sprint10-dispatch/sprint10-dispatch.json --status

New issue notes:
  Add a new entry to the manifest JSON with validationKeywords field.
  Do NOT edit dispatch.mjs per issue — extend the manifest instead.

Notes:
  --post checks for idempotency marker before posting.
  --dry-run and --post together prints without posting.
`);
}

// --- main ---

const args = parseArgs(process.argv);

if (args.help) {
  printHelp();
  process.exit(0);
}

const manifestPath = args.manifest ?? DEFAULT_MANIFEST;
const manifest = loadManifest(manifestPath);

if (args.status) {
  showStatus(manifest);
  process.exit(0);
}

let entries = manifest;
if (args.wave !== null) entries = entries.filter(e => e.wave === args.wave);
if (args.issue !== null) entries = entries.filter(e => e.issue === args.issue);

if (entries.length === 0) {
  console.error('No matching PBIs found in manifest.');
  process.exit(1);
}

enforceWaveGate(args, entries);

const template = loadTemplate(args.mode);
let repo = null;

for (const entry of entries) {
  const rendered = render(template, entry);
  const marker = `<!-- sprint9-dispatch issue=${entry.issue} wave=${entry.wave} mode=${args.mode} -->`;
  const fullBody = `${rendered}\n\n${marker}`;

  const errors = validate(fullBody, entry);
  if (errors.length > 0) {
    console.error(`Validation failed for issue #${entry.issue}:`);
    errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }

  if (args.post && !args.dryRun) {
    if (!repo) repo = getRepo();
    if (isAlreadyPosted(repo, entry.issue, entry.wave, args.mode)) {
      console.log(`#${entry.issue}: already posted (idempotency marker found). Skipping.`);
      continue;
    }
    postComment(repo, entry.issue, fullBody);
    console.log(`#${entry.issue}: posted to issue.`);
  } else {
    console.log(`=== Issue #${entry.issue} | ${entry.line} | Wave ${entry.wave} | mode: ${args.mode} ===`);
    console.log(fullBody);
    console.log();
  }
}
