#!/usr/bin/env node
/**
 * Resident sprite sheet validation suite.
 *
 * Runs all pipeline checks for any character in order.
 * See docs/operations/resident-sprite-spec.md for the spec this suite enforces.
 *
 * Usage:
 *   node tools/asset-pipeline/check-sprite-suite.mjs <characterId>
 *   node tools/asset-pipeline/check-sprite-suite.mjs <path/to/sprite-sheet.png>
 *   npm run sprite:check -- <characterId>
 *
 * Pass a characterId to scan assets/generated/residents/<characterId>/incoming/.
 * Pass a PNG path to check a specific file directly (e.g. the adopted public path).
 */

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOOLS = [
  'check-resident-sprite-alpha.mjs',
  'validate-resident-sprite-sheet.mjs',
  'audit-resident-sprite-visuals.mjs',
];

function printUsage() {
  console.log(`Resident sprite sheet validation suite
---
Usage:
  npm run sprite:check -- <characterId>
  npm run sprite:check -- <path/to/sprite-sheet.png>
  node tools/asset-pipeline/check-sprite-suite.mjs <characterId>

Checks run in order:
  1. check-resident-sprite-alpha    PNG size and alpha channel
  2. validate-resident-sprite-sheet grid structure
  3. audit-resident-sprite-visuals  visual frame audit (produces contact sheet)

Incoming scan (characterId):
  assets/generated/residents/<characterId>/incoming/

Direct file check:
  public/art/characters/defaults/<characterId>/sprites/resident-sprite-sheet.png

See docs/operations/resident-sprite-spec.md for the full spec.

Exit code: 0 = all pass  1 = any fail
`);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printUsage();
  process.exit(args.length === 0 ? 1 : 0);
}

const target = args[0];
const DIVIDER = '─'.repeat(56);

console.log(`\n${DIVIDER}`);
console.log(`sprite:check  target: ${target}`);
console.log(DIVIDER);

let passed = 0;
let failed = 0;

for (const tool of TOOLS) {
  const label = tool.replace('.mjs', '');
  console.log(`\n── ${label}`);

  const result = spawnSync(process.execPath, [join(__dirname, tool), target], {
    stdio: 'inherit',
  });

  if (result.status === 0) {
    passed++;
    console.log(`   ✓ passed`);
  } else {
    failed++;
    console.error(`   ✗ failed  (exit ${result.status})`);
  }
}

console.log(`\n${DIVIDER}`);
if (failed === 0) {
  console.log(`✓ Suite passed  ${passed}/${TOOLS.length} checks  target: ${target}`);
  process.exit(0);
} else {
  console.error(`✗ Suite failed  ${failed}/${TOOLS.length} checks failed  target: ${target}`);
  process.exit(1);
}
