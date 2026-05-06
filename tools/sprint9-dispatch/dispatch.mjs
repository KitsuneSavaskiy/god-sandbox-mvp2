#!/usr/bin/env node
// Node built-ins only — no external npm packages.

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MANIFEST_PATH = join(__dirname, 'sprint9-phase2-dispatch.json');
const TEMPLATES_DIR = join(__dirname, 'templates');

const FORBIDDEN_EXPRESSIONS = [
  'Readyまたはmain入り',
  'レビュー後すぐ承認・merge可能',
  'Line 3と臨時Line Cは、作業開始時にIssueを新規作成',
  'Line 3と臨時Line Cは作業開始時にIssueを新規作成',
];

// Control chars excluding tab (\x09), LF (\x0A), CR (\x0D)
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

// --- arg parsing ---

function parseArgs(argv) {
  const args = {
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
    if (a === '--wave') args.wave = parseInt(argv[++i], 10);
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

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
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

function validate(text) {
  const errors = [];
  for (const expr of FORBIDDEN_EXPRESSIONS) {
    if (text.includes(expr)) {
      errors.push(`Forbidden expression: "${expr}"`);
    }
  }
  if (CONTROL_CHAR_RE.test(text)) {
    errors.push('Control characters detected (excluding tab and newline)');
  }
  return errors;
}

// --- GitHub operations ---

function ghExec(cmd, opts = {}) {
  return execSync(`gh ${cmd}`, { encoding: 'utf8', ...opts });
}

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

function getIssueState(issueNumber) {
  try {
    return ghExec(`issue view ${issueNumber} --json state --jq '.state'`).trim();
  } catch {
    return 'UNKNOWN';
  }
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
  --wave N       Target wave number
  --issue N      Target issue number
  --mode M       Template mode: start | prep | blocked  (default: start)
  --dry-run      Print rendered output without posting
  --post         Post to GitHub issue comment (uses gh CLI)
  --status       Show current wave / merge status
  --help, -h     Show this help

Examples:
  npm run sprint9:dispatch -- --wave 0 --dry-run
  npm run sprint9:dispatch -- --issue 197 --dry-run
  npm run sprint9:dispatch -- --wave 1 --mode prep --dry-run
  npm run sprint9:dispatch -- --status
  npm run sprint9:dispatch -- --issue 201 --post

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

const manifest = loadManifest();

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

const template = loadTemplate(args.mode);
let repo = null;

for (const entry of entries) {
  const rendered = render(template, entry);
  const marker = `<!-- sprint9-dispatch issue=${entry.issue} wave=${entry.wave} mode=${args.mode} -->`;
  const fullBody = `${rendered}\n\n${marker}`;

  const errors = validate(fullBody);
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
