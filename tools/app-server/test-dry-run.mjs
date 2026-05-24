#!/usr/bin/env node
/**
 * Dry-run test script for Sprint9-5 asset generation tools.
 * Uses node:assert — no external dependencies required.
 *
 * Run with: node tools/app-server/test-dry-run.mjs
 */

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

// ---------------------------------------------------------------------------
// Test 1: resolveGen2BridgeConfig('hot-folder') throws when env var not set
// ---------------------------------------------------------------------------

async function test1_hotFolderThrowsWithoutEnvVar() {
  const { resolveGen2BridgeConfig } = await import("./gen2-bridge.mjs");

  const saved = process.env.GODSANDBOX_GEN2_HOT_FOLDER;
  delete process.env.GODSANDBOX_GEN2_HOT_FOLDER;

  try {
    assert.throws(
      () => resolveGen2BridgeConfig("hot-folder"),
      (err) => {
        assert.ok(
          err.message.includes("GODSANDBOX_GEN2_HOT_FOLDER"),
          `Expected error about GODSANDBOX_GEN2_HOT_FOLDER, got: ${err.message}`,
        );
        return true;
      },
      "resolveGen2BridgeConfig('hot-folder') should throw when GODSANDBOX_GEN2_HOT_FOLDER is not set",
    );
    console.log("[PASS] test1: resolveGen2BridgeConfig('hot-folder') throws when env var not set");
  } finally {
    if (saved !== undefined) process.env.GODSANDBOX_GEN2_HOT_FOLDER = saved;
  }
}

// ---------------------------------------------------------------------------
// Test 2: FakeGen2Bridge sets validationOnly: true and candidateEligible: false
// ---------------------------------------------------------------------------

async function test2_fakeGen2BridgeValidationOnly() {
  const { FakeGen2Bridge } = await import("./gen2-bridge.mjs");

  const tmpDir = path.join(os.tmpdir(), `godsandbox-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // We need to patch the JOBS_BASE. Instead, we create a fake job with a
  // predictable ID and check the returned values — the return value is the
  // contract we care about most.
  const bridge = new FakeGen2Bridge({});
  const fakeJob = {
    jobId: `test-fake-${Date.now()}`,
    assetBundleId: "test-char",
    lanes: ["resident-sprite-sheet"],
  };

  const result = await bridge.prepareJob(fakeJob);

  assert.strictEqual(result.validationOnly, true, "FakeGen2Bridge.prepareJob should return validationOnly: true");
  assert.strictEqual(result.candidateEligible, false, "FakeGen2Bridge.prepareJob should return candidateEligible: false");
  assert.strictEqual(result.handoffType, "fake", "FakeGen2Bridge.prepareJob should return handoffType: 'fake'");
  console.log("[PASS] test2: FakeGen2Bridge returns validationOnly: true, candidateEligible: false");
}

// ---------------------------------------------------------------------------
// Test 3: buildPromptPack with po-combined produces sprites/combined.prompt.md
//         containing "826x1904" and "118×136" and "row 13: emote-surprised"
// ---------------------------------------------------------------------------

async function test3_poCombinedPromptContent() {
  const { buildPromptPack } = await import("./character-asset-prompt-pack.mjs");

  const testRoot = path.join(os.tmpdir(), `godsandbox-pp-test-${Date.now()}`);
  mkdirSync(testRoot, { recursive: true });

  const result = await buildPromptPack({
    assetBundleId: "test-po",
    displayName: "TestChar",
    personality: "bright",
    tone: "casual",
    age: 18,
    portraitPath: "assets/generated/residents/test-po/reference/portrait.png",
    lanes: ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
    previewMode: "po-combined",
    repoRoot: testRoot,
  });

  // Find combined.prompt.md in the written files
  const combinedRel = result.files.find((f) => f.endsWith("combined.prompt.md"));
  assert.ok(combinedRel, "buildPromptPack should produce sprites/combined.prompt.md for po-combined mode");

  const combinedAbs = path.join(testRoot, combinedRel);
  const { readFileSync } = await import("node:fs");
  const content = readFileSync(combinedAbs, "utf8");

  assert.ok(
    content.includes("826×1904"),
    `combined.prompt.md should contain "826×1904". Got:\n${content.slice(0, 500)}`,
  );
  assert.ok(
    content.includes("118×136"),
    `combined.prompt.md should contain "118×136". Got:\n${content.slice(0, 500)}`,
  );
  assert.ok(
    content.includes("row 13: emote-surprised"),
    `combined.prompt.md should contain "row 13: emote-surprised". Got:\n${content.slice(0, 800)}`,
  );

  console.log("[PASS] test3: po-combined combined.prompt.md contains correct specs");
}

// ---------------------------------------------------------------------------
// Test 4: buildPromptPack with canonical-two-sheet produces correct row content
// ---------------------------------------------------------------------------

async function test4_canonicalTwoSheetPromptContent() {
  const { buildPromptPack } = await import("./character-asset-prompt-pack.mjs");

  const testRoot = path.join(os.tmpdir(), `godsandbox-pp-test2-${Date.now()}`);
  mkdirSync(testRoot, { recursive: true });

  const result = await buildPromptPack({
    assetBundleId: "test-cts",
    displayName: "TestChar2",
    personality: "cool",
    tone: "formal",
    age: 25,
    portraitPath: "assets/generated/residents/test-cts/reference/portrait.png",
    lanes: ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
    previewMode: "canonical-two-sheet",
    repoRoot: testRoot,
  });

  const { readFileSync } = await import("node:fs");

  // sheet1.prompt.md
  const sheet1Rel = result.files.find((f) => f.endsWith("sheet1.prompt.md"));
  assert.ok(sheet1Rel, "buildPromptPack should produce sprites/sheet1.prompt.md for canonical-two-sheet");
  const sheet1Content = readFileSync(path.join(testRoot, sheet1Rel), "utf8");

  assert.ok(
    sheet1Content.includes("row 0: idle"),
    `sheet1.prompt.md should contain "row 0: idle". Got:\n${sheet1Content.slice(0, 600)}`,
  );
  assert.ok(
    sheet1Content.includes("row 7: running"),
    `sheet1.prompt.md should contain "row 7: running". Got:\n${sheet1Content.slice(0, 600)}`,
  );

  // sheet2.prompt.md
  const sheet2Rel = result.files.find((f) => f.endsWith("sheet2.prompt.md"));
  assert.ok(sheet2Rel, "buildPromptPack should produce sprites/sheet2.prompt.md for canonical-two-sheet");
  const sheet2Content = readFileSync(path.join(testRoot, sheet2Rel), "utf8");

  assert.ok(
    sheet2Content.includes("row 1: walk-down"),
    `sheet2.prompt.md should contain "row 1: walk-down". Got:\n${sheet2Content.slice(0, 600)}`,
  );

  console.log("[PASS] test4: canonical-two-sheet sheet1 contains 'row 0: idle' and 'row 7: running'; sheet2 contains 'row 1: walk-down'");
}

// ---------------------------------------------------------------------------
// Test 5: portrait-expressions lane exclusion means no expression files written
// ---------------------------------------------------------------------------

async function test5_noExpressionFilesWhenLaneExcluded() {
  const { buildPromptPack } = await import("./character-asset-prompt-pack.mjs");

  const testRoot = path.join(os.tmpdir(), `godsandbox-pp-test3-${Date.now()}`);
  mkdirSync(testRoot, { recursive: true });

  const result = await buildPromptPack({
    assetBundleId: "test-noexpr",
    displayName: "TestChar3",
    personality: "quiet",
    tone: "polite",
    age: 20,
    portraitPath: "assets/generated/residents/test-noexpr/reference/portrait.png",
    // portrait-expressions NOT in lanes
    lanes: ["resident-sprite-sheet", "derived-icon"],
    previewMode: "po-combined",
    repoRoot: testRoot,
  });

  const expressionFiles = result.files.filter((f) => f.includes("/expressions/"));
  assert.strictEqual(
    expressionFiles.length,
    0,
    `No expression files should be written when portrait-expressions is not in lanes. Got: ${JSON.stringify(expressionFiles)}`,
  );

  // Also verify no expressions dir contains prompt files
  const expressionsDir = path.join(testRoot, "assets", "generated", "residents", "test-noexpr", "prompt-pack", "expressions");
  if (existsSync(expressionsDir)) {
    const files = readdirSync(expressionsDir).filter((f) => f.endsWith(".prompt.md"));
    assert.strictEqual(
      files.length,
      0,
      `expressions dir should have no .prompt.md files when lane excluded. Got: ${JSON.stringify(files)}`,
    );
  }

  console.log("[PASS] test5: No expression prompt files written when portrait-expressions not in lanes");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log("Running Sprint9-5 dry-run tests...\n");
  let passed = 0;
  let failed = 0;

  const tests = [
    test1_hotFolderThrowsWithoutEnvVar,
    test2_fakeGen2BridgeValidationOnly,
    test3_poCombinedPromptContent,
    test4_canonicalTwoSheetPromptContent,
    test5_noExpressionFilesWhenLaneExcluded,
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${test.name}: ${err.message}`);
      if (err.stack) console.error(err.stack.split("\n").slice(1, 4).join("\n"));
      failed++;
    }
  }

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
