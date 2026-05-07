#!/usr/bin/env node
/**
 * Resident sprite sheet validation suite.
 *
 * Usage:
 *   npm run sprite:check -- <slug>
 *   npm run sprite:check -- <slug> motion
 *   npm run sprite:check -- <slug> extended
 *   npm run sprite:check -- <path/to/sprite-sheet.png> --kind motion
 *   npm run sprite:check -- <path/to/sprite-sheet-extended.png> --kind extended
 *
 * Rules:
 * - slug only: both motion + extended sheets must exist and both must pass
 * - slug + kind: only that sheet is checked
 * - direct path: --kind is required
 */

import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const DIVIDER = '─'.repeat(56);
const VALID_KINDS = ['motion', 'extended'];

const SHEETS = {
  motion: {
    filename: 'resident-sprite-sheet.png',
    label: 'Sheet 1 (motion)',
  },
  extended: {
    filename: 'resident-sprite-sheet-extended.png',
    label: 'Sheet 2 (extended)',
  },
};

const TOOLS = [
  'check-resident-sprite-alpha.mjs',
  'validate-resident-sprite-sheet.mjs',
  'audit-resident-sprite-visuals.mjs',
];

function printUsage() {
  console.log(`Resident sprite sheet validation suite
---
Usage:
  npm run sprite:check -- <slug>
  npm run sprite:check -- <slug> motion
  npm run sprite:check -- <slug> extended
  npm run sprite:check -- <path/to/sprite-sheet.png> --kind motion
  npm run sprite:check -- <path/to/sprite-sheet-extended.png> --kind extended

Checks run in order:
  1. check-resident-sprite-alpha    PNG size and alpha channel
  2. validate-resident-sprite-sheet grid structure
  3. audit-resident-sprite-visuals  visual frame audit (produces contact sheet)

Rules:
  slug only:
    assets/generated/residents/<slug>/incoming/resident-sprite-sheet.png
    assets/generated/residents/<slug>/incoming/resident-sprite-sheet-extended.png
    の2枚が必須です。

  direct path:
    --kind motion|extended が必須です。

Examples:
  npm run sprite:check -- ryo
  npm run sprite:check -- ryo motion
  npm run sprite:check -- ryo extended
  npm run sprite:check -- public/art/characters/defaults/ryo/sprites/resident-sprite-sheet.png --kind motion
  npm run sprite:check -- public/art/characters/defaults/ryo/sprites/resident-sprite-sheet-extended.png --kind extended

Exit code: 0 = all pass  1 = any fail
`);
}

function parseArgs(args) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return {
      help: true,
    };
  }

  const options = {
    target: null,
    kind: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!options.target) {
      options.target = arg;
      continue;
    }

    if (arg === '--kind') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--kind requires motion or extended.');
      }
      options.kind = normalizeKind(value);
      index += 1;
      continue;
    }

    if (!options.kind && VALID_KINDS.includes(arg)) {
      options.kind = normalizeKind(arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.target) {
    throw new Error('A slug or PNG path is required.');
  }

  return options;
}

function normalizeKind(value) {
  const normalized = String(value).trim().toLowerCase();
  if (!VALID_KINDS.includes(normalized)) {
    throw new Error(`Invalid kind: ${value}. Use motion or extended.`);
  }
  return normalized;
}

function isSlugTarget(value) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function toIncomingSheetPath(slug, kind) {
  return join(
    repoRoot,
    'assets',
    'generated',
    'residents',
    slug,
    'incoming',
    SHEETS[kind].filename,
  );
}

function toDisplayPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function assertExistingFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} is missing: ${toDisplayPath(filePath)}`);
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`${label} is not a file: ${toDisplayPath(filePath)}`);
  }
}

function assertPathKindMatchesFileName(filePath, kind) {
  const actualName = basename(filePath).toLowerCase();
  const expectedName = SHEETS[kind].filename;
  if (actualName !== expectedName) {
    throw new Error(
      `Path/kind mismatch. ${kind} expects ${expectedName}, but got ${basename(filePath)}.`,
    );
  }
}

function resolveTargets({ target, kind }) {
  if (isSlugTarget(target)) {
    const slug = target.toLowerCase();
    if (kind) {
      const filePath = toIncomingSheetPath(slug, kind);
      assertExistingFile(filePath, `${SHEETS[kind].label} candidate`);
      return [
        {
          target: filePath,
          kind,
          label: `${slug} / ${SHEETS[kind].label}`,
        },
      ];
    }

    const motionPath = toIncomingSheetPath(slug, 'motion');
    const extendedPath = toIncomingSheetPath(slug, 'extended');
    assertExistingFile(motionPath, 'Sheet 1 candidate');
    assertExistingFile(extendedPath, 'Sheet 2 candidate');

    return [
      {
        target: motionPath,
        kind: 'motion',
        label: `${slug} / ${SHEETS.motion.label}`,
      },
      {
        target: extendedPath,
        kind: 'extended',
        label: `${slug} / ${SHEETS.extended.label}`,
      },
    ];
  }

  if (!kind) {
    throw new Error('Direct PNG path checks require --kind motion|extended.');
  }

  const filePath = resolve(process.cwd(), target);
  assertPathKindMatchesFileName(filePath, kind);
  assertExistingFile(filePath, 'PNG path');

  return [
    {
      target: filePath,
      kind,
      label: `${toDisplayPath(filePath)} / ${SHEETS[kind].label}`,
    },
  ];
}

function buildToolArgs(tool, target, kind) {
  const args = [join(__dirname, tool), target];
  if (tool === 'audit-resident-sprite-visuals.mjs') {
    args.push('--kind', kind);
  }
  return args;
}

function runChecksForTarget(checkTarget) {
  let passed = 0;
  let failed = 0;

  console.log(`\n${DIVIDER}`);
  console.log(`sprite:check  target: ${checkTarget.label}`);
  console.log(DIVIDER);

  for (const tool of TOOLS) {
    const label = tool.replace('.mjs', '');
    console.log(`\n── ${label}`);

    const result = spawnSync(process.execPath, buildToolArgs(tool, checkTarget.target, checkTarget.kind), {
      stdio: 'inherit',
    });

    if (result.status === 0) {
      passed += 1;
      console.log('   ✓ passed');
    } else {
      failed += 1;
      console.error(`   ✗ failed  (exit ${result.status})`);
    }
  }

  return { passed, failed };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return process.argv.slice(2).length === 0 ? 1 : 0;
    }

    const targets = resolveTargets(options);
    let passed = 0;
    let failed = 0;

    for (const target of targets) {
      const result = runChecksForTarget(target);
      passed += result.passed;
      failed += result.failed;
    }

    console.log(`\n${DIVIDER}`);
    if (failed === 0) {
      console.log(`✓ Suite passed  ${passed}/${targets.length * TOOLS.length} checks`);
      return 0;
    }

    console.error(`✗ Suite failed  ${failed}/${targets.length * TOOLS.length} checks failed`);
    return 1;
  } catch (error) {
    console.error('sprite:check could not complete.');
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

process.exitCode = main();
