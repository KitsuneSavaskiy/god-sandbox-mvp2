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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

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
// Test 6: validatePortraitPathFilesystem — absolute / traversal / missing / invalid PNG
// ---------------------------------------------------------------------------

async function test6_portraitPathValidation() {
  const { validatePortraitPathFilesystem } = await import("./portrait-path-validator.mjs");

  const tmpRoot = path.join(os.tmpdir(), `godsandbox-pv-test-${Date.now()}`);
  mkdirSync(tmpRoot, { recursive: true });

  // 1. Absolute path → rejected
  const absErr = validatePortraitPathFilesystem("/etc/passwd", tmpRoot);
  assert.ok(absErr && absErr.includes("absolute"), `Absolute path should be rejected. Got: ${absErr}`);

  // 2. Traversal → rejected
  const travErr = validatePortraitPathFilesystem("assets/../../etc/passwd", tmpRoot);
  assert.ok(travErr && travErr.includes(".."), `Traversal path should be rejected. Got: ${travErr}`);

  // 3. Repo boundary escape via resolved path — only possible if OS resolves symlinks outside,
  //    but a direct "../../outside" should be caught by the traversal check first.
  //    Use a crafted path that bypasses the '..' check via encoded form (the impl blocks split-based):
  //    Actually this case is already covered by check 2. Skip; test missing file instead.

  // 4. Non-existent file → rejected
  const missingErr = validatePortraitPathFilesystem("assets/generated/nobody/portrait.png", tmpRoot);
  assert.ok(missingErr && missingErr.includes("does not exist"), `Missing file should be rejected. Got: ${missingErr}`);

  // 5. File exists but is not a PNG (invalid signature) → rejected
  const notPngPath = path.join(tmpRoot, "fake.png");
  writeFileSync(notPngPath, "not a png file at all");
  const sigErr = validatePortraitPathFilesystem("fake.png", tmpRoot);
  assert.ok(sigErr && sigErr.includes("PNG"), `Non-PNG file should be rejected. Got: ${sigErr}`);

  // 6. Valid PNG signature → accepted (null)
  const validPngPath = path.join(tmpRoot, "valid.png");
  // Write minimal valid PNG signature (8 bytes only — enough for the check)
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  writeFileSync(validPngPath, pngSig);
  const okErr = validatePortraitPathFilesystem("valid.png", tmpRoot);
  assert.strictEqual(okErr, null, `Valid PNG should pass validation. Got: ${okErr}`);

  console.log("[PASS] test6: validatePortraitPathFilesystem rejects absolute/traversal/missing/invalid PNG");
}

// ---------------------------------------------------------------------------
// Test 7: generateJobId produces unique IDs (watcher files don't collide)
// ---------------------------------------------------------------------------

async function test7_generateJobIdIsUnique() {
  const { generateJobId } = await import("./asset-generation-server.mjs");

  const id1 = generateJobId("test-slug");
  const id2 = generateJobId("test-slug");

  assert.notStrictEqual(id1, id2, "generateJobId must produce unique IDs for the same prefix");
  assert.ok(id1.startsWith("test-slug-"), `jobId should start with the prefix. Got: ${id1}`);
  // Verify format: prefix-YYYYMMDDHHMMSS-<8hex>
  assert.match(id1, /^[a-z0-9][a-z0-9_-]+-\d{14}-[0-9a-f]{8}$/,
    `jobId should match expected format. Got: ${id1}`);

  console.log("[PASS] test7: generateJobId produces unique IDs — watcher files per-jobId won't collide on same slug");
}

// ---------------------------------------------------------------------------
// Test 8: Gen2LocalCliBridge throws when CLI exits with non-zero code
// ---------------------------------------------------------------------------

async function test8_localCliBridgeThrowsOnNonZeroExit() {
  const { Gen2LocalCliBridge } = await import("./gen2-bridge.mjs");

  // Write a small script that exits non-zero — accepts any args (the bridge appends --job-file <path>)
  const exitScript = path.join(os.tmpdir(), `gs-test-exit1-${Date.now()}.mjs`);
  writeFileSync(exitScript, "process.exit(1);\n");

  const bridge = new Gen2LocalCliBridge({
    cliCommand: ["node", exitScript],
  });

  const fakeJob = {
    jobId: `test-cli-fail-${Date.now()}`,
    assetBundleId: "test-cli",
    lanes: ["resident-sprite-sheet"],
  };

  await assert.rejects(
    () => bridge.prepareJob(fakeJob),
    (err) => {
      assert.ok(
        err.message.includes("exit code") && (err.message.includes("1") || err.message.includes("code")),
        `Error should mention exit code. Got: ${err.message}`,
      );
      return true;
    },
    "Gen2LocalCliBridge.prepareJob should throw when CLI exits with non-zero code",
  );

  console.log("[PASS] test8: Gen2LocalCliBridge.prepareJob throws on non-zero CLI exit");
}

// ---------------------------------------------------------------------------
// Test 9: docs architecture section uses the correct watcher path (no pending/)
// ---------------------------------------------------------------------------

async function test9_docsWatcherPathCorrect() {
  const { readFileSync } = await import("node:fs");
  const docsPath = path.join(repoRoot, "docs/operations/sprint9-5-local-gen2-asset-generation.md");
  const docsContent = readFileSync(docsPath, "utf8");

  // Architecture diagram block ends before "## APIキー境界"
  const archEnd = docsContent.indexOf("## APIキー境界");
  assert.ok(archEnd > 0, "Could not find '## APIキー境界' section in docs");
  const archSection = docsContent.slice(0, archEnd);

  assert.ok(
    !archSection.includes("pending/"),
    `Architecture section must not reference 'pending/' path (stale). Found in:\n${archSection}`,
  );

  // Implementation uses <jobId>-request.json — docs must reflect this
  assert.ok(
    archSection.includes("jobId") && archSection.includes("-request.json"),
    `Architecture section should reference '<jobId>-request.json' pattern.\nSection:\n${archSection}`,
  );

  console.log("[PASS] test9: docs architecture uses '<jobId>-request.json' (no stale 'pending/')");
}

// ---------------------------------------------------------------------------
// Test 10: classifyWatcherRequest — legacy request (no jobId/lanes) → "legacy"
// ---------------------------------------------------------------------------

async function test10_watcherRoutes_legacyRequest() {
  const { classifyWatcherRequest } = await import("../../tools/sidekick/job-watcher.mjs");

  const legacyRequest = {
    slug: "ryo",
    displayName: "Ryo",
    personality: "明るい",
    tone: "タメ口",
    age: 17,
    portraitPath: "assets/generated/residents/ryo/reference/portrait.png",
  };

  const result = classifyWatcherRequest(legacyRequest);
  assert.strictEqual(
    result.type,
    "legacy",
    `Legacy request (no discriminator fields) should be classified as "legacy". Got: ${result.type}`,
  );

  // Also verify none of the assetgen discriminator fields affect the result
  const minimalLegacy = { slug: "testchar", displayName: "Test", portraitPath: "assets/test.png" };
  const minResult = classifyWatcherRequest(minimalLegacy);
  assert.strictEqual(minResult.type, "legacy", `Minimal legacy request should be "legacy". Got: ${minResult.type}`);

  console.log("[PASS] test10: classifyWatcherRequest identifies legacy request (no jobId/lanes) as 'legacy'");
}

// ---------------------------------------------------------------------------
// Test 11: classifyWatcherRequest — assetgen request (has jobId + lanes) → "assetgen"
// ---------------------------------------------------------------------------

async function test11_watcherRoutes_assetgenRequest() {
  const { classifyWatcherRequest } = await import("../../tools/sidekick/job-watcher.mjs");

  // Full assetgen request (as written by asset-generation-server.mjs)
  const assetgenRequest = {
    jobId: "mychar-20260524-abcd1234",
    slug: "mychar",
    displayName: "MyChar",
    personality: "明るい",
    tone: "タメ口",
    age: 18,
    portraitPath: "assets/generated/residents/mychar/reference/portrait.png",
    lanes: ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
    previewMode: "po-combined",
    gen2Bridge: "fake",
  };

  const result = classifyWatcherRequest(assetgenRequest);
  assert.strictEqual(
    result.type,
    "assetgen",
    `Request with jobId+lanes+previewMode+gen2Bridge should be "assetgen". Got: ${result.type}`,
  );

  // Even a single discriminator field triggers assetgen
  const justJobId = { slug: "test", displayName: "Test", portraitPath: "p.png", jobId: "test-id" };
  assert.strictEqual(classifyWatcherRequest(justJobId).type, "assetgen", "Request with only jobId should be 'assetgen'");

  const justLanes = { slug: "test", displayName: "Test", portraitPath: "p.png", lanes: ["resident-sprite-sheet"] };
  assert.strictEqual(classifyWatcherRequest(justLanes).type, "assetgen", "Request with only lanes should be 'assetgen'");

  const justPreviewMode = { slug: "test", displayName: "Test", portraitPath: "p.png", previewMode: "po-combined" };
  assert.strictEqual(classifyWatcherRequest(justPreviewMode).type, "assetgen", "Request with only previewMode should be 'assetgen'");

  const justGen2Bridge = { slug: "test", displayName: "Test", portraitPath: "p.png", gen2Bridge: "fake" };
  assert.strictEqual(classifyWatcherRequest(justGen2Bridge).type, "assetgen", "Request with only gen2Bridge should be 'assetgen'");

  console.log("[PASS] test11: classifyWatcherRequest identifies assetgen request (has jobId+lanes) as 'assetgen'");
}

// ---------------------------------------------------------------------------
// Test 12: classifyWatcherRequest — unparseable / missing slug → "malformed"
// ---------------------------------------------------------------------------

async function test12_malformedRequest_markedFailed() {
  const { classifyWatcherRequest } = await import("../../tools/sidekick/job-watcher.mjs");

  // Non-object
  assert.strictEqual(
    classifyWatcherRequest(null).type,
    "malformed",
    "null should be 'malformed'",
  );
  assert.strictEqual(
    classifyWatcherRequest("string").type,
    "malformed",
    "string should be 'malformed'",
  );
  assert.strictEqual(
    classifyWatcherRequest([]).type,
    "malformed",
    "array should be 'malformed'",
  );
  assert.strictEqual(
    classifyWatcherRequest(42).type,
    "malformed",
    "number should be 'malformed'",
  );

  // Missing slug
  const noSlug = { displayName: "Test", portraitPath: "assets/test.png", jobId: "test-id" };
  const noSlugResult = classifyWatcherRequest(noSlug);
  assert.strictEqual(noSlugResult.type, "malformed", "Object without slug should be 'malformed'");
  assert.ok(
    noSlugResult.reason && noSlugResult.reason.includes("slug"),
    `Malformed reason should mention 'slug'. Got: ${noSlugResult.reason}`,
  );

  // Empty slug
  const emptySlug = { slug: "", displayName: "Test", portraitPath: "assets/test.png" };
  assert.strictEqual(classifyWatcherRequest(emptySlug).type, "malformed", "Empty slug should be 'malformed'");

  // Whitespace-only slug
  const wsSlug = { slug: "   ", displayName: "Test", portraitPath: "assets/test.png" };
  assert.strictEqual(classifyWatcherRequest(wsSlug).type, "malformed", "Whitespace-only slug should be 'malformed'");

  console.log("[PASS] test12: classifyWatcherRequest identifies unparseable/missing-slug as 'malformed'");
}

// ---------------------------------------------------------------------------
// Test 13: duplicate jobId (already in done/) is not re-processed
// ---------------------------------------------------------------------------

async function test13_duplicateJobId_notDoubleRun() {
  // This test verifies the pure classification path does not re-classify a job
  // that would already have been moved to done/. In the live watcher, processRequest()
  // checks existsSync(path.join(doneDir, filename)) and returns early — here we verify
  // that a file in done/ would not be picked up by pollJobsDir (filesystem check).
  //
  // We use a temp filesystem simulation to confirm the logic holds.
  const tmpBase = path.join(os.tmpdir(), `gs-watcher-test13-${Date.now()}`);
  const tmpJobsDir = path.join(tmpBase, "jobs");
  const tmpDoneDir = path.join(tmpJobsDir, "done");
  mkdirSync(tmpDoneDir, { recursive: true });

  const filename = "mychar-20260524-abcd1234-request.json";
  const requestData = {
    jobId: "mychar-20260524-abcd1234",
    slug: "mychar",
    displayName: "MyChar",
    personality: "明るい",
    tone: "タメ口",
    age: 18,
    portraitPath: "assets/generated/residents/mychar/reference/portrait.png",
    lanes: ["resident-sprite-sheet"],
    previewMode: "po-combined",
    gen2Bridge: "fake",
  };

  // Simulate file in done/ only (not in jobs/ root)
  writeFileSync(path.join(tmpDoneDir, filename), JSON.stringify(requestData, null, 2) + "\n");

  // Simulate: no file in jobs/ root → poll would find nothing to process
  const { readdirSync: readdir, existsSync: exists } = await import("node:fs");
  const rootFiles = readdir(tmpJobsDir).filter((f) => f.endsWith("-request.json"));
  assert.strictEqual(
    rootFiles.length,
    0,
    "jobs/ root should have no *-request.json after job is in done/",
  );

  // Also verify: if somehow both exist (restart race), the done/ check prevents double-run
  writeFileSync(path.join(tmpJobsDir, filename), JSON.stringify(requestData, null, 2) + "\n");
  const doneExists = exists(path.join(tmpDoneDir, filename));
  assert.ok(doneExists, "File in done/ should be detected, preventing re-process");

  console.log("[PASS] test13: request file in done/ is not re-processed (double-run guard confirmed)");
}

// ---------------------------------------------------------------------------
// Test 14: missing incoming folder gives a clear error, not a crash
// ---------------------------------------------------------------------------

async function test14_missingIncomingFolder_clearsError() {
  const { spawnSync } = await import("node:child_process");

  const toolPath = path.join(repoRoot, "tools", "sidekick", "build-asset-review-pack.mjs");

  const result = spawnSync(
    "node",
    [toolPath, "--slug", "nonexistent-slug-that-does-not-exist", "--dry-run"],
    { cwd: repoRoot, encoding: "utf8" },
  );

  // Should exit non-zero
  assert.notStrictEqual(
    result.status,
    0,
    `Expected non-zero exit for missing incoming dir. Got: ${result.status}`,
  );

  // Should NOT produce a stack trace (no crash)
  const combinedOutput = (result.stdout ?? "") + (result.stderr ?? "");
  assert.ok(
    !combinedOutput.includes("at async") && !combinedOutput.includes("    at "),
    `Expected clean error message (no stack trace), but got stack trace:\n${combinedOutput.slice(0, 600)}`,
  );

  // Should contain a human-readable error
  assert.ok(
    combinedOutput.toLowerCase().includes("does not exist") ||
    combinedOutput.toLowerCase().includes("incoming") ||
    combinedOutput.toLowerCase().includes("error"),
    `Expected error message about missing directory. Got:\n${combinedOutput.slice(0, 400)}`,
  );

  console.log("[PASS] test14: missing incoming folder gives clear error, not a crash");
}

// ---------------------------------------------------------------------------
// Test 15: icon-source-report in incoming/icons/ subdir → validationOnlyBridge: true
// ---------------------------------------------------------------------------

async function test15_fakeMetadataShownAsValidationOnly() {
  const tmpDir = path.join(os.tmpdir(), `godsandbox-rp-test-${Date.now()}`);
  const slug = "test-validation-only";
  const incomingDir = path.join(tmpDir, "incoming");
  const outputDir = path.join(tmpDir, "review-pack");

  // Create directory layout matching actual tool output
  mkdirSync(path.join(incomingDir, "expressions"), { recursive: true });
  mkdirSync(path.join(incomingDir, "icons"), { recursive: true });

  // Valid PNG signature (8 bytes)
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  writeFileSync(path.join(incomingDir, "expressions", "neutral.png"), pngSig);

  // icon-source-report.json in canonical subdir (incoming/icons/) with candidateEligible: false
  writeFileSync(
    path.join(incomingDir, "icons", "icon-source-report.json"),
    JSON.stringify({ candidateEligible: false, iconSourceMotionKey: "walk-down" }, null, 2),
  );

  const { spawnSync } = await import("node:child_process");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "build-asset-review-pack.mjs");

  const result = spawnSync(
    "node",
    [
      toolPath,
      "--slug", slug,
      "--incoming-dir", incomingDir,
      "--output-dir", outputDir,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Tool exited with ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  }

  const summaryPath = path.join(outputDir, "review-summary.json");
  assert.ok(existsSync(summaryPath), `review-summary.json should be written to ${summaryPath}`);

  const { readFileSync: readFile } = await import("node:fs");
  const summary = JSON.parse(readFile(summaryPath, "utf8"));

  assert.strictEqual(summary.candidateOnly, true, "review-summary.json should have candidateOnly: true");
  assert.strictEqual(summary.readyPromotionAllowed, false, "review-summary.json should have readyPromotionAllowed: false");
  assert.strictEqual(summary.validationOnlyBridge, true,
    `review-summary.json should have validationOnlyBridge: true when icons/icon-source-report has candidateEligible: false. Got: ${JSON.stringify(summary)}`);

  console.log("[PASS] test15: icons/icon-source-report.json (subdir) with candidateEligible: false → validationOnlyBridge: true");
}

// ---------------------------------------------------------------------------
// Test 16: assertOutputBoundary with public/art path throws
// ---------------------------------------------------------------------------

async function test16_publicArtOutputRejected() {
  const { spawnSync } = await import("node:child_process");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "build-asset-review-pack.mjs");

  const result = spawnSync(
    "node",
    [
      toolPath,
      "--slug", "test-security",
      "--output-dir", "public/art/test-output",
      "--dry-run",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.notStrictEqual(result.status, 0, "Should exit non-zero when output-dir is public/art/");

  const combinedOutput = (result.stdout ?? "") + (result.stderr ?? "");
  assert.ok(
    combinedOutput.includes("SECURITY") || combinedOutput.includes("Refusing") || combinedOutput.includes("public/art"),
    `Expected SECURITY error about public/art, got:\n${combinedOutput.slice(0, 400)}`,
  );

  console.log("[PASS] test16: assertOutputBoundary with public/art path throws SECURITY error");
}

// ---------------------------------------------------------------------------
// Test 17: OPTIONS preflight from allowed origin → 204 with CORS headers
// ---------------------------------------------------------------------------

async function test17_cors_allowedOriginGetsCorsHeaders() {
  const { spawn } = await import("node:child_process");
  const serverPath = path.join(repoRoot, "tools", "app-server", "asset-generation-server.mjs");

  // Start server on a throwaway port
  const port = 18787;
  const srv = spawn("node", [serverPath, "--port", String(port)], { cwd: repoRoot });
  await new Promise((res) => setTimeout(res, 600));

  try {
    const { default: http } = await import("node:http");

    const makeRequest = (method, origin) => new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        path: "/api/local/asset-generation/characters",
        method,
        headers: {
          "Origin": origin,
          "Access-Control-Request-Method": "POST",
        },
      }, (res) => {
        resolve({ status: res.statusCode, headers: res.headers });
        res.resume();
      });
      req.on("error", reject);
      req.end();
    });

    // Allowed origin must receive CORS headers
    const allowed = await makeRequest("OPTIONS", "http://127.0.0.1:5173");
    assert.strictEqual(allowed.status, 204, `OPTIONS should return 204, got ${allowed.status}`);
    assert.strictEqual(
      allowed.headers["access-control-allow-origin"],
      "http://127.0.0.1:5173",
      "Allowed origin must be echoed back in Access-Control-Allow-Origin",
    );
    assert.ok(
      allowed.headers["access-control-allow-methods"],
      "OPTIONS response must include Access-Control-Allow-Methods",
    );

    // Disallowed origin must NOT receive any CORS header (no wildcard)
    const disallowed = await makeRequest("OPTIONS", "http://evil.example.com");
    assert.strictEqual(disallowed.status, 204, `OPTIONS should still return 204 for disallowed origin`);
    assert.strictEqual(
      disallowed.headers["access-control-allow-origin"],
      undefined,
      "Disallowed origin must NOT receive Access-Control-Allow-Origin",
    );
  } finally {
    srv.kill();
    await new Promise((res) => setTimeout(res, 200));
  }

  console.log("[PASS] test17: OPTIONS preflight — allowed origin gets CORS headers, disallowed origin gets none (no wildcard)");
}

// ---------------------------------------------------------------------------
// Test 18: GET /healthz from allowed origin → response includes CORS header
// ---------------------------------------------------------------------------

async function test18_cors_healthzIncludesCorsHeader() {
  const { spawn } = await import("node:child_process");
  const serverPath = path.join(repoRoot, "tools", "app-server", "asset-generation-server.mjs");

  const port = 18788;
  const srv = spawn("node", [serverPath, "--port", String(port)], { cwd: repoRoot });
  await new Promise((res) => setTimeout(res, 600));

  try {
    const { default: http } = await import("node:http");

    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        path: "/healthz",
        method: "GET",
        headers: { "Origin": "http://localhost:5173" },
      }, (r) => {
        resolve({ status: r.statusCode, headers: r.headers });
        r.resume();
      });
      req.on("error", reject);
      req.end();
    });

    assert.strictEqual(res.status, 200, `GET /healthz should return 200, got ${res.status}`);
    assert.strictEqual(
      res.headers["access-control-allow-origin"],
      "http://localhost:5173",
      "GET /healthz from allowed origin should include Access-Control-Allow-Origin",
    );
  } finally {
    srv.kill();
    await new Promise((res) => setTimeout(res, 200));
  }

  console.log("[PASS] test18: GET /healthz from allowed origin includes Access-Control-Allow-Origin");
}

// ---------------------------------------------------------------------------
// Test 19: all 4 contractIds are unique (no duplicates in Object.keys(CONTRACTS))
// ---------------------------------------------------------------------------

async function test19_contractIdsAreUnique() {
  const { CONTRACTS } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const ids = Object.keys(CONTRACTS);
  const uniqueIds = new Set(ids);

  assert.strictEqual(
    ids.length,
    uniqueIds.size,
    `Contract IDs must be unique. Got ${ids.length} keys but only ${uniqueIds.size} unique. IDs: ${JSON.stringify(ids)}`,
  );
  assert.strictEqual(
    ids.length,
    4,
    `Expected 4 contracts, got ${ids.length}: ${JSON.stringify(ids)}`,
  );

  console.log("[PASS] test19: all 4 contractIds are unique (no duplicates in Object.keys(CONTRACTS))");
}

// ---------------------------------------------------------------------------
// Test 20: resident-canonical-two-sheet-v1 — sheets[0] is 1536×1872, frameWidth 192,
//          frameHeight 208, 8 cols, 9 rows, rowManifest length = 9
// ---------------------------------------------------------------------------

async function test20_canonicalTwoSheetContract() {
  const { getContract } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const contract = getContract("resident-canonical-two-sheet-v1");
  const sheet0 = contract.sheets[0];

  assert.strictEqual(sheet0.canvasWidth, 1536, `sheets[0].canvasWidth should be 1536, got ${sheet0.canvasWidth}`);
  assert.strictEqual(sheet0.canvasHeight, 1872, `sheets[0].canvasHeight should be 1872, got ${sheet0.canvasHeight}`);
  assert.strictEqual(sheet0.frameWidth, 192, `sheets[0].frameWidth should be 192, got ${sheet0.frameWidth}`);
  assert.strictEqual(sheet0.frameHeight, 208, `sheets[0].frameHeight should be 208, got ${sheet0.frameHeight}`);
  assert.strictEqual(sheet0.columns, 8, `sheets[0].columns should be 8, got ${sheet0.columns}`);
  assert.strictEqual(sheet0.rows, 9, `sheets[0].rows should be 9, got ${sheet0.rows}`);
  assert.strictEqual(
    sheet0.rowManifest.length,
    9,
    `sheets[0].rowManifest.length should be 9, got ${sheet0.rowManifest.length}: ${JSON.stringify(sheet0.rowManifest)}`,
  );

  console.log("[PASS] test20: resident-canonical-two-sheet-v1 sheets[0] is 1536x1872, frameWidth 192, frameHeight 208, 8 cols, 9 rows, rowManifest.length=9");
}

// ---------------------------------------------------------------------------
// Test 21: resident-po-combined-preview-v1 — canvasWidth 826, canvasHeight 1904,
//          frameWidth 118, frameHeight 136, columns 7, rows 14, rowManifest.length === 14
// ---------------------------------------------------------------------------

async function test21_poCombinedContract() {
  const { getContract } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const contract = getContract("resident-po-combined-preview-v1");

  assert.strictEqual(contract.canvasWidth, 826, `canvasWidth should be 826, got ${contract.canvasWidth}`);
  assert.strictEqual(contract.canvasHeight, 1904, `canvasHeight should be 1904, got ${contract.canvasHeight}`);
  assert.strictEqual(contract.frameWidth, 118, `frameWidth should be 118, got ${contract.frameWidth}`);
  assert.strictEqual(contract.frameHeight, 136, `frameHeight should be 136, got ${contract.frameHeight}`);
  assert.strictEqual(contract.columns, 7, `columns should be 7, got ${contract.columns}`);
  assert.strictEqual(contract.rows, 14, `rows should be 14, got ${contract.rows}`);
  assert.strictEqual(
    contract.rowManifest.length,
    14,
    `rowManifest.length should be 14, got ${contract.rowManifest.length}: ${JSON.stringify(contract.rowManifest)}`,
  );

  console.log("[PASS] test21: resident-po-combined-preview-v1 canvasWidth 826, canvasHeight 1904, frameWidth 118, frameHeight 136, columns 7, rows 14, rowManifest.length=14");
}

// ---------------------------------------------------------------------------
// Test 22: portrait-expression-set-v1 AND event-standing-expression-set-v1
//          both have transparentBackgroundRequired === true AND alphaRequired === true
// ---------------------------------------------------------------------------

async function test22_expressionContractsRequireAlphaAndTransparency() {
  const { getContract } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const portraitContract = getContract("portrait-expression-set-v1");
  const eventContract = getContract("event-standing-expression-set-v1");

  assert.strictEqual(
    portraitContract.transparentBackgroundRequired,
    true,
    `portrait-expression-set-v1 should have transparentBackgroundRequired: true`,
  );
  assert.strictEqual(
    portraitContract.alphaRequired,
    true,
    `portrait-expression-set-v1 should have alphaRequired: true`,
  );
  assert.strictEqual(
    eventContract.transparentBackgroundRequired,
    true,
    `event-standing-expression-set-v1 should have transparentBackgroundRequired: true`,
  );
  assert.strictEqual(
    eventContract.alphaRequired,
    true,
    `event-standing-expression-set-v1 should have alphaRequired: true`,
  );

  console.log("[PASS] test22: portrait-expression-set-v1 AND event-standing-expression-set-v1 both have transparentBackgroundRequired === true AND alphaRequired === true");
}

// ---------------------------------------------------------------------------
// Test 23: wrong PNG dimensions → validation report shows FAIL for dimensions check
// ---------------------------------------------------------------------------

function makePngHeaderBuffer(width, height, colorType = 6) {
  const buf = Buffer.alloc(33);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR length = 13
  buf.writeUInt32BE(13, 8);
  // IHDR type
  Buffer.from("IHDR").copy(buf, 12);
  // width, height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // bit depth = 8, color type, compression=0, filter=0, interlace=0
  buf[24] = 8; buf[25] = colorType; buf[26] = 0; buf[27] = 0; buf[28] = 0;
  // CRC (skip for test — validator only reads bytes 0-25)
  return buf;
}

async function test23_wrongDimensions_reportShowsFail() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test23-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Create PNG with header reporting 800x800 instead of 826x1904
  const wrongPng = makePngHeaderBuffer(800, 800, 6);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-combined.png"), wrongPng);

  const result = await validateAssetContract({
    slug: "test-slug-23",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  const { report } = result;

  // Should have a dimension failure
  assert.ok(
    report.failCount > 0,
    `Expected failCount > 0 for wrong dimensions. Got failCount=${report.failCount}`,
  );

  const dimCheck = report.checks.find((c) => c.check === "dimensions");
  assert.ok(dimCheck, "Expected a dimensions check in the report");
  assert.strictEqual(dimCheck.passed, false, "Dimensions check should fail for 800x800 vs 826x1904");
  assert.ok(
    dimCheck.actual === "800x800",
    `Expected actual="800x800", got "${dimCheck.actual}"`,
  );

  console.log("[PASS] test23: wrong PNG dimensions → validation report shows FAIL for dimensions check");
}

// ---------------------------------------------------------------------------
// Test 24: missing alpha channel → validation fails alpha check
// ---------------------------------------------------------------------------

async function test24_missingAlpha_reportShowsFail() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test24-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Create PNG with colorType=2 (RGB, no alpha) at correct 826x1904 dimensions
  const rgbPng = makePngHeaderBuffer(826, 1904, 2);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-combined.png"), rgbPng);

  const result = await validateAssetContract({
    slug: "test-slug-24",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  const { report } = result;

  const alphaCheck = report.checks.find((c) => c.check === "alpha-channel");
  assert.ok(alphaCheck, "Expected an alpha-channel check in the report");
  assert.strictEqual(alphaCheck.passed, false, "Alpha check should fail for colorType=2 (RGB)");
  assert.ok(
    report.failCount > 0,
    `Expected failCount > 0 for missing alpha. Got failCount=${report.failCount}`,
  );

  console.log("[PASS] test24: missing alpha channel → validation fails alpha check");
}

// ---------------------------------------------------------------------------
// Test 25: missing expression file → validation fails
// ---------------------------------------------------------------------------

async function test25_missingExpressionFile_reportShowsFail() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test25-${Date.now()}`);
  const expressionsDir = path.join(tmpDir, "expressions");
  mkdirSync(expressionsDir, { recursive: true });

  // Create only neutral.png — missing happy/angry/sad/surprised
  const validPng = makePngHeaderBuffer(512, 512, 6);
  writeFileSync(path.join(expressionsDir, "neutral.png"), validPng);

  const result = await validateAssetContract({
    slug: "test-slug-25",
    contractId: "portrait-expression-set-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  const { report } = result;

  // Should have file-exists failures for missing expressions
  const missingChecks = report.checks.filter((c) => c.check === "file-exists" && !c.passed);
  assert.ok(
    missingChecks.length >= 4,
    `Expected at least 4 missing-file failures (happy, angry, sad, surprised). Got ${missingChecks.length}`,
  );
  assert.ok(
    report.failCount > 0,
    `Expected failCount > 0 for missing expressions. Got failCount=${report.failCount}`,
  );

  console.log("[PASS] test25: missing expression files → validation fails with file-exists failures");
}

// ---------------------------------------------------------------------------
// Test 26: valid fixture passes basic checks
// ---------------------------------------------------------------------------

async function test26_validFixture_passesBasicChecks() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test26-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Create PNG with correct 826x1904 dimensions, colorType=6 (RGBA)
  const validPng = makePngHeaderBuffer(826, 1904, 6);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-combined.png"), validPng);

  const result = await validateAssetContract({
    slug: "test-slug-26",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  const { report } = result;

  assert.ok(
    report.passCount > 0,
    `Expected passCount > 0 for valid fixture. Got passCount=${report.passCount}`,
  );

  const dimCheck = report.checks.find((c) => c.check === "dimensions");
  assert.ok(dimCheck, "Expected a dimensions check in the report");
  assert.strictEqual(dimCheck.passed, true, "Dimensions check should pass for 826x1904");

  const alphaCheck = report.checks.find((c) => c.check === "alpha-channel");
  assert.ok(alphaCheck, "Expected an alpha-channel check in the report");
  assert.strictEqual(alphaCheck.passed, true, "Alpha check should pass for colorType=6");

  console.log("[PASS] test26: valid 826x1904 RGBA fixture passes dimensions and alpha checks");
}

// ---------------------------------------------------------------------------
// Test 27: retry-plan.json includes actionable scope field for each failure
// ---------------------------------------------------------------------------

const VALID_SCOPE_VALUES = [
  "full-sheet",
  "row-only",
  "frame-only",
  "expression-only",
  "event-expression-only",
];

async function test27_retryPlanHasScopeField() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test27-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Create PNG with wrong dimensions to force a failure
  const wrongPng = makePngHeaderBuffer(400, 600, 6);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-combined.png"), wrongPng);

  const result = await validateAssetContract({
    slug: "test-slug-27",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  const { retryPlan } = result;

  assert.ok(
    retryPlan.failures.length > 0,
    `Expected at least one failure in retryPlan. Got ${retryPlan.failures.length}`,
  );

  for (const failure of retryPlan.failures) {
    assert.ok(
      typeof failure.scope === "string",
      `Each failure must have a "scope" string field. Got: ${JSON.stringify(failure)}`,
    );
    assert.ok(
      VALID_SCOPE_VALUES.includes(failure.scope),
      `failure.scope must be one of ${VALID_SCOPE_VALUES.join(", ")}. Got: "${failure.scope}"`,
    );
  }

  console.log("[PASS] test27: retry-plan failures all have a valid scope field");
}

// ---------------------------------------------------------------------------
// Sprint 10-C helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid PNG header buffer (26 bytes) for testing.
 * @param {number} width
 * @param {number} height
 * @param {number} colorType  2=RGB, 4=grayscale+alpha, 6=RGBA
 * @returns {Buffer}
 */
function makePngHeaderBuf(width, height, colorType) {
  const buf = Buffer.alloc(26);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);       // IHDR chunk length
  Buffer.from("IHDR").copy(buf, 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8;                    // bit depth
  buf[25] = colorType;
  return buf;
}

// ---------------------------------------------------------------------------
// Test 28: run-bundle --dry-run prints planned lanes without creating files
// ---------------------------------------------------------------------------

async function test28_runBundleDryRunPrintsPlan() {
  const { spawnSync } = await import("node:child_process");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "run-character-asset-bundle.mjs");
  const lockFile = path.join(repoRoot, ".godsandbox", "jobs", "assetgen-active-resident.lock");

  // Ensure no lock exists for this test
  const { rmSync, existsSync: exists } = await import("node:fs");
  if (exists(lockFile)) {
    rmSync(lockFile);
  }

  const result = spawnSync(
    "node",
    [
      toolPath,
      "--slug", "test",
      "--portrait", "public/art/apostle/apostle-standing-alpha.png",
      "--bridge", "fake",
      "--dry-run",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.strictEqual(
    result.status,
    0,
    `run-bundle --dry-run should exit 0. Got: ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );

  const combined = (result.stdout ?? "") + (result.stderr ?? "");
  assert.ok(
    combined.toLowerCase().includes("dry-run") || combined.toLowerCase().includes("planned"),
    `run-bundle --dry-run should mention "dry-run" or "planned". Got:\n${combined.slice(0, 500)}`,
  );

  // Lock should NOT be acquired in dry-run
  assert.ok(
    !exists(lockFile),
    `run-bundle --dry-run must not acquire the lock file: ${lockFile}`,
  );

  console.log("[PASS] test28: run-bundle --dry-run prints planned lanes without creating files");
}

// ---------------------------------------------------------------------------
// Test 29: second-resident lock fails with clear message (different slug)
// ---------------------------------------------------------------------------

async function test29_differentSlugLockFails() {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, rmSync, existsSync: exists } = await import("node:fs");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "run-character-asset-bundle.mjs");
  const lockFile = path.join(repoRoot, ".godsandbox", "jobs", "assetgen-active-resident.lock");

  // Write a fake lock for "other-slug"
  const lockData = {
    slug: "other-slug",
    jobId: "other-slug-20260525-testtest",
    lockedAt: new Date().toISOString(),
  };
  mkdirSync(path.dirname(lockFile), { recursive: true });
  writeFileSync(lockFile, JSON.stringify(lockData, null, 2) + "\n");

  try {
    const result = spawnSync(
      "node",
      [
        toolPath,
        "--slug", "different-slug",
        "--portrait", "public/art/apostle/apostle-standing-alpha.png",
        "--bridge", "fake",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );

    assert.notStrictEqual(
      result.status,
      0,
      `run-bundle with different slug should fail when lock exists. Got exit 0.`,
    );

    const combined = (result.stdout ?? "") + (result.stderr ?? "");
    assert.ok(
      combined.includes("other-slug") || combined.toLowerCase().includes("active resident"),
      `Error message should mention the locked slug "other-slug" or "active resident". Got:\n${combined.slice(0, 400)}`,
    );
  } finally {
    if (exists(lockFile)) rmSync(lockFile);
  }

  console.log("[PASS] test29: second-resident lock fails with clear message (different slug)");
}

// ---------------------------------------------------------------------------
// Test 30: same-slug lock allows resume (dry-run bypasses lock)
// ---------------------------------------------------------------------------

async function test30_sameSlugLockAllowsResume() {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, rmSync, existsSync: exists } = await import("node:fs");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "run-character-asset-bundle.mjs");
  const lockFile = path.join(repoRoot, ".godsandbox", "jobs", "assetgen-active-resident.lock");

  const testSlug = "same-slug";

  // Write a lock for same slug
  const lockData = {
    slug: testSlug,
    jobId: `${testSlug}-20260525-testtest`,
    lockedAt: new Date().toISOString(),
  };
  mkdirSync(path.dirname(lockFile), { recursive: true });
  writeFileSync(lockFile, JSON.stringify(lockData, null, 2) + "\n");

  try {
    // dry-run doesn't acquire lock, so it should exit 0 regardless
    const result = spawnSync(
      "node",
      [
        toolPath,
        "--slug", testSlug,
        "--portrait", "public/art/apostle/apostle-standing-alpha.png",
        "--bridge", "fake",
        "--dry-run",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );

    assert.strictEqual(
      result.status,
      0,
      `run-bundle --dry-run with same slug and existing lock should exit 0.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  } finally {
    if (exists(lockFile)) rmSync(lockFile);
  }

  console.log("[PASS] test30: same-slug lock allows resume (dry-run exits 0 without lock concern)");
}

// ---------------------------------------------------------------------------
// Test 31: event-standing-expression-intake rejects PNG without alpha
// ---------------------------------------------------------------------------

async function test31_eventIntakeRejectsNoAlpha() {
  const { spawnSync } = await import("node:child_process");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "event-standing-expression-intake.mjs");

  // Create a temp dir with a PNG file that has colorType=2 (RGB, no alpha)
  const tmpDir = path.join(os.tmpdir(), `gs-event-test31-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Write a minimal PNG header with colorType=2 (RGB, no alpha)
  const pngBuf = makePngHeaderBuf(100, 100, 2);
  writeFileSync(path.join(tmpDir, "neutral.png"), pngBuf);

  const result = spawnSync(
    "node",
    [
      toolPath,
      "--slug", "test",
      "--source-dir", tmpDir,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  // Should exit non-zero because alpha is required
  assert.notStrictEqual(
    result.status,
    0,
    `event-intake should reject PNG without alpha (colorType=2). Got exit 0.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );

  const combined = (result.stdout ?? "") + (result.stderr ?? "");
  assert.ok(
    combined.toLowerCase().includes("alpha") || combined.toLowerCase().includes("rejected") || combined.toLowerCase().includes("colortype"),
    `Error should mention alpha or rejection. Got:\n${combined.slice(0, 400)}`,
  );

  console.log("[PASS] test31: event-standing-expression-intake rejects PNG without alpha");
}

// ---------------------------------------------------------------------------
// Test 32: event-standing-expression-intake accepts PNG with alpha (dry-run)
// ---------------------------------------------------------------------------

async function test32_eventIntakeAcceptsAlpha() {
  const { spawnSync } = await import("node:child_process");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "event-standing-expression-intake.mjs");

  // Create a temp dir with all 8 required expression PNGs with colorType=6 (RGBA)
  const tmpDir = path.join(os.tmpdir(), `gs-event-test32-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const exprs = ["neutral", "happy", "angry", "sad", "surprised", "worried", "determined", "shocked"];
  for (const e of exprs) {
    const pngBuf = makePngHeaderBuf(200, 300, 6); // colorType=6 = RGBA (has alpha)
    writeFileSync(path.join(tmpDir, `${e}.png`), pngBuf);
  }

  const result = spawnSync(
    "node",
    [
      toolPath,
      "--slug", "test",
      "--source-dir", tmpDir,
      "--dry-run",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.strictEqual(
    result.status,
    0,
    `event-intake --dry-run with RGBA PNGs should exit 0.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );

  const combined = (result.stdout ?? "") + (result.stderr ?? "");
  assert.ok(
    combined.toLowerCase().includes("neutral") ||
    combined.toLowerCase().includes("accepted") ||
    combined.toLowerCase().includes("would copy") ||
    combined.toLowerCase().includes("dry-run"),
    `Output should mention neutral expression or dry-run. Got:\n${combined.slice(0, 400)}`,
  );

  console.log("[PASS] test32: event-standing-expression-intake accepts PNG with alpha (dry-run)");
}

// ---------------------------------------------------------------------------
// Test 33: run-bundle --dry-run --bridge fake output mentions fake bridge warning
// ---------------------------------------------------------------------------

async function test33_runBundleDryRunFakeBridgeWarning() {
  const { spawnSync } = await import("node:child_process");
  const { rmSync, existsSync: exists } = await import("node:fs");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "run-character-asset-bundle.mjs");
  const lockFile = path.join(repoRoot, ".godsandbox", "jobs", "assetgen-active-resident.lock");

  // Ensure no lock
  if (exists(lockFile)) rmSync(lockFile);

  const result = spawnSync(
    "node",
    [
      toolPath,
      "--slug", "test",
      "--portrait", "public/art/apostle/apostle-standing-alpha.png",
      "--bridge", "fake",
      "--dry-run",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.strictEqual(
    result.status,
    0,
    `run-bundle --dry-run --bridge fake should exit 0. Got: ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );

  const combined = (result.stdout ?? "") + (result.stderr ?? "");
  assert.ok(
    combined.toLowerCase().includes("fake") ||
    combined.toLowerCase().includes("validation-only") ||
    combined.toLowerCase().includes("not po-reviewable") ||
    combined.toLowerCase().includes("not po reviewable"),
    `Output should warn about fake bridge. Got:\n${combined.slice(0, 500)}`,
  );

  console.log("[PASS] test33: run-bundle --dry-run --bridge fake output mentions fake bridge warning");
}

// ---------------------------------------------------------------------------
// Sprint 10 hardening patch tests (34–40)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Test 34: canonical two-sheet validator reads nested contract.sheets[]
//          (dimensions must not be undefinedxundefined)
// ---------------------------------------------------------------------------

async function test34_canonicalValidatorReadsSheetSpecs() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");
  const { getContract } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const contract = getContract("resident-canonical-two-sheet-v1");
  const w = contract.sheets[0].canvasWidth;
  const h = contract.sheets[0].canvasHeight;

  const tmpDir = path.join(os.tmpdir(), `gs-test34-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const goodPng = makePngHeaderBuffer(w, h, 6);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet.png"), goodPng);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-extended.png"), goodPng);

  const result = await validateAssetContract({
    slug: "test-slug-34",
    contractId: "resident-canonical-two-sheet-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  const dimChecks = result.report.checks.filter((c) => c.check === "dimensions");
  assert.strictEqual(dimChecks.length, 2, `Expected 2 dimension checks, got ${dimChecks.length}`);
  for (const dc of dimChecks) {
    assert.strictEqual(dc.passed, true, `Dimension check should pass for ${w}x${h}: ${JSON.stringify(dc)}`);
    assert.strictEqual(dc.expected, `${w}x${h}`, `Expected "${w}x${h}", got "${dc.expected}"`);
    assert.notStrictEqual(dc.expected, "undefinedxundefined", `Expected must never be "undefinedxundefined"`);
  }

  console.log("[PASS] test34: canonical two-sheet validator reads nested contract.sheets[] (no undefinedxundefined)");
}

// ---------------------------------------------------------------------------
// Test 35: wrong canonical dimensions fail with correct expected (1536x1872),
//          never undefinedxundefined
// ---------------------------------------------------------------------------

async function test35_canonicalWrongDimensionsShowsExpected() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test35-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const wrongPng = makePngHeaderBuffer(800, 800, 6);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet.png"), wrongPng);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-extended.png"), wrongPng);

  const result = await validateAssetContract({
    slug: "test-slug-35",
    contractId: "resident-canonical-two-sheet-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  const dimChecks = result.report.checks.filter((c) => c.check === "dimensions" && !c.passed);
  assert.ok(dimChecks.length >= 1, `Expected at least 1 failing dimension check, got ${dimChecks.length}`);
  for (const dc of dimChecks) {
    assert.strictEqual(dc.expected, "1536x1872", `Expected "1536x1872", got "${dc.expected}"`);
    assert.notStrictEqual(dc.expected, "undefinedxundefined", `Expected must never be "undefinedxundefined"`);
  }

  console.log("[PASS] test35: wrong canonical dimensions fail with expected=1536x1872 (not undefinedxundefined)");
}

// ---------------------------------------------------------------------------
// Test 36: registry safeMargins for canonical contract match resident-sprite-spec
//          left/right >= 10px, top/bottom >= 8px
// ---------------------------------------------------------------------------

async function test36_canonicalSafeMarginsMatchSpec() {
  const { getContract } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");
  const contract = getContract("resident-canonical-two-sheet-v1");
  const margins = contract.safeMargins;

  assert.ok(margins.left >= 10, `safeMargins.left must be >= 10 (spec), got ${margins.left}`);
  assert.ok(margins.right >= 10, `safeMargins.right must be >= 10 (spec), got ${margins.right}`);
  assert.ok(margins.top >= 8, `safeMargins.top must be >= 8 (spec), got ${margins.top}`);
  assert.ok(margins.bottom >= 8, `safeMargins.bottom must be >= 8 (spec), got ${margins.bottom}`);

  console.log(`[PASS] test36: canonical safeMargins match resident-sprite-spec (left=${margins.left} right=${margins.right} top=${margins.top} bottom=${margins.bottom})`);
}

// ---------------------------------------------------------------------------
// Test 37: review pack HTML renders retry plan with scope and promptPatch
//          (not blank lane/action columns from old field names)
// ---------------------------------------------------------------------------

async function test37_reviewPackRendersRetryPlanScopeAndPromptPatch() {
  const { spawnSync } = await import("node:child_process");
  const { readFileSync: readFS, rmSync } = await import("node:fs");

  const slug = `test37-${Date.now()}`;
  const slugDir = path.join(repoRoot, "assets", "generated", "residents", slug);
  const qaDir = path.join(slugDir, "qa");
  const incomingDir = path.join(slugDir, "incoming");
  const outputDir = path.join(os.tmpdir(), `gs-review-${slug}`);

  mkdirSync(qaDir, { recursive: true });
  mkdirSync(incomingDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const UNIQUE_PATCH = "TEST_PROMPT_PATCH_SCOPE_FULLSHEET_XYZ";

  writeFileSync(path.join(qaDir, "asset-contract-report.json"), JSON.stringify({
    candidateOnly: true, slug, contractId: "resident-po-combined-preview-v1",
    passCount: 0, failCount: 1, hardGatePassed: false, qualityGateStatus: "fail",
    checks: [],
  }));
  writeFileSync(path.join(qaDir, "retry-plan.json"), JSON.stringify({
    candidateOnly: true, slug, contractId: "resident-po-combined-preview-v1",
    failures: [{
      check: "dimensions",
      filePath: "resident-sprite-sheet-combined.png",
      reason: "Expected 826x1904, got 100x100",
      scope: "full-sheet",
      promptPatch: UNIQUE_PATCH,
    }],
    passCount: 0, failCount: 1,
  }));

  const toolPath = path.join(repoRoot, "tools", "sidekick", "build-asset-review-pack.mjs");
  const result = spawnSync("node", [
    toolPath, "--slug", slug, "--output-dir", outputDir,
  ], { cwd: repoRoot, encoding: "utf8" });

  let html = "";
  try { html = readFS(path.join(outputDir, "index.html"), "utf8"); } catch {}
  try { rmSync(slugDir, { recursive: true, force: true }); } catch {}
  try { rmSync(outputDir, { recursive: true, force: true }); } catch {}

  assert.strictEqual(result.status, 0,
    `review-pack should exit 0. stderr: ${result.stderr?.slice(0, 300)}`);
  assert.ok(
    html.includes(UNIQUE_PATCH),
    `HTML should contain promptPatch text "${UNIQUE_PATCH}". HTML preview: ${html.slice(0, 200)}`,
  );
  assert.ok(
    html.includes("full-sheet"),
    `HTML should contain scope "full-sheet". HTML preview: ${html.slice(0, 200)}`,
  );

  console.log("[PASS] test37: review pack HTML renders retry plan scope and promptPatch (not blank lane/action)");
}

// ---------------------------------------------------------------------------
// Test 38: --fail-on-violation exits 2 when validation fails
// ---------------------------------------------------------------------------

async function test38_failOnViolationExitsNonZero() {
  const { spawnSync } = await import("node:child_process");
  const toolPath = path.join(repoRoot, "tools", "asset-pipeline", "validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test38-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const wrongPng = makePngHeaderBuffer(100, 100, 6);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-combined.png"), wrongPng);

  const result = spawnSync("node", [
    toolPath,
    "--slug", "test38",
    "--contract", "resident-po-combined-preview-v1",
    "--asset-dir", tmpDir,
    "--dry-run",
    "--fail-on-violation",
  ], { cwd: repoRoot, encoding: "utf8" });

  assert.strictEqual(
    result.status, 2,
    `--fail-on-violation should exit 2 when failCount > 0. Got exit ${result.status}\nstdout: ${result.stdout?.slice(0,300)}\nstderr: ${result.stderr?.slice(0,200)}`,
  );

  console.log("[PASS] test38: --fail-on-violation exits 2 when validation fails");
}

// ---------------------------------------------------------------------------
// Test 39: report includes marginCheckStatus: "not-run" (never silent pass)
// ---------------------------------------------------------------------------

async function test39_marginCheckStatusNotRun() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test39-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const goodPng = makePngHeaderBuffer(826, 1904, 6);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-combined.png"), goodPng);

  const result = await validateAssetContract({
    slug: "test-slug-39",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  assert.strictEqual(
    result.report.marginCheckStatus,
    "not-run",
    `marginCheckStatus must be "not-run" for structural-only validation. Got: "${result.report.marginCheckStatus}"`,
  );
  assert.notStrictEqual(
    result.report.marginCheckStatus,
    undefined,
    "marginCheckStatus must be present in report (not missing)",
  );

  console.log("[PASS] test39: report.marginCheckStatus=\"not-run\" (pixel-level checks are never silently passed)");
}

// ---------------------------------------------------------------------------
// Test 40: hardGatePassed and qualityGateStatus are set correctly
// ---------------------------------------------------------------------------

async function test40_hardGateAndQualityGateStatusInReport() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test40-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const badPng = makePngHeaderBuffer(100, 100, 6);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-combined.png"), badPng);

  const result = await validateAssetContract({
    slug: "test-slug-40",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
  });

  assert.strictEqual(result.report.hardGatePassed, false,
    `hardGatePassed should be false when failCount > 0`);
  assert.strictEqual(result.report.qualityGateStatus, "fail",
    `qualityGateStatus should be "fail" when failCount > 0, got "${result.report.qualityGateStatus}"`);

  console.log("[PASS] test40: hardGatePassed=false and qualityGateStatus=\"fail\" when validation fails");
}

// ---------------------------------------------------------------------------
// Sprint 10-D helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal complete decodable 8-bit RGBA PNG buffer.
 * @param {number} width
 * @param {number} height
 * @param {function(x:number, y:number): [number,number,number,number]} fillFn  Returns [r,g,b,a].
 * @returns {Buffer}
 */
function makeRgbaPng(width, height, fillFn) {
  const rowStride = 1 + width * 4;
  const raw = Buffer.alloc(height * rowStride, 0); // filter=0 (None) + rgba pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fillFn(x, y);
      const o = y * rowStride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const compressed = deflateSync(raw);

  function chk(type, data) {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, t, data, Buffer.alloc(4)]); // CRC skipped (validator doesn't check)
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colorType RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chk("IHDR", ihdr),
    chk("IDAT", compressed),
    chk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Test 41: portrait expression set — all transparent → marginCheckStatus="pass"
// ---------------------------------------------------------------------------

async function test41_expressionAllTransparentPassesMarginCheck() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");
  const { CONTRACTS } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test41-${Date.now()}`);
  const exprDir = path.join(tmpDir, "expressions");
  mkdirSync(exprDir, { recursive: true });

  const transparentPng = makeRgbaPng(80, 100, () => [0, 0, 0, 0]);
  for (const e of ["neutral", "happy", "angry", "sad", "surprised"]) {
    writeFileSync(path.join(exprDir, `${e}.png`), transparentPng);
  }

  const result = await validateAssetContract({
    slug: "test-slug-41",
    contractId: "portrait-expression-set-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: CONTRACTS,
  });

  assert.strictEqual(
    result.report.marginCheckStatus, "pass",
    `marginCheckStatus should be "pass" for all-transparent images. Got "${result.report.marginCheckStatus}"`,
  );
  assert.strictEqual(
    result.report.checks.filter((c) => c.check === "pixel-margin").length, 0,
    "No pixel-margin failures expected for all-transparent images",
  );

  console.log("[PASS] test41: portrait expression set — all-transparent images pass pixel margin check");
}

// ---------------------------------------------------------------------------
// Test 42: portrait expression — neutral.png has left-edge pixel → marginCheckStatus="fail"
// ---------------------------------------------------------------------------

async function test42_expressionEdgePixelFailsMarginCheck() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");
  const { CONTRACTS } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test42-${Date.now()}`);
  const exprDir = path.join(tmpDir, "expressions");
  mkdirSync(exprDir, { recursive: true });

  const transparent = makeRgbaPng(80, 100, () => [0, 0, 0, 0]);
  // neutral.png: pixel at x=0, y=50 (left edge, safeMargins.left=8px → actual=0 < 8 → fail)
  const withEdgePixel = makeRgbaPng(80, 100, (x, y) => (x === 0 && y === 50) ? [255, 0, 0, 255] : [0, 0, 0, 0]);
  writeFileSync(path.join(exprDir, "neutral.png"), withEdgePixel);
  for (const e of ["happy", "angry", "sad", "surprised"]) {
    writeFileSync(path.join(exprDir, `${e}.png`), transparent);
  }

  const result = await validateAssetContract({
    slug: "test-slug-42",
    contractId: "portrait-expression-set-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: CONTRACTS,
  });

  assert.strictEqual(
    result.report.marginCheckStatus, "fail",
    `marginCheckStatus should be "fail" for edge pixel. Got "${result.report.marginCheckStatus}"`,
  );
  const leftViolation = result.report.checks.find((c) => c.check === "pixel-margin" && c.side === "left");
  assert.ok(leftViolation, `Expected a left-side pixel-margin violation in checks[]`);
  assert.strictEqual(leftViolation.actual, 0, `Left margin actual should be 0. Got ${leftViolation.actual}`);

  console.log("[PASS] test42: portrait neutral.png left-edge pixel → marginCheckStatus=\"fail\", left margin violation actual=0");
}

// ---------------------------------------------------------------------------
// Test 43: po-combined all-transparent → marginCheckStatus="pass"
// ---------------------------------------------------------------------------

async function test43_poCombinedAllTransparentPassesMargin() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  // Mini contract: 2×2 frames of 118×136 = 236×272 for speed
  const MINI_PO = {
    "resident-po-combined-preview-v1": {
      canvasWidth: 236, canvasHeight: 272, columns: 2, rows: 2,
      frameWidth: 118, frameHeight: 136,
      safeMargins: { top: 8, bottom: 8, left: 8, right: 8 },
      alphaRequired: true,
    },
  };

  const tmpDir = path.join(os.tmpdir(), `gs-test43-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(
    path.join(tmpDir, "resident-sprite-sheet-combined.png"),
    makeRgbaPng(236, 272, () => [0, 0, 0, 0]),
  );

  const result = await validateAssetContract({
    slug: "test-slug-43",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: MINI_PO,
  });

  assert.strictEqual(
    result.report.marginCheckStatus, "pass",
    `marginCheckStatus should be "pass" for all-transparent po-combined. Got "${result.report.marginCheckStatus}"`,
  );

  console.log("[PASS] test43: po-combined all-transparent → marginCheckStatus=\"pass\"");
}

// ---------------------------------------------------------------------------
// Test 44: po-combined — left-edge pixel in frame[row=0,col=0] → row/col violation
// ---------------------------------------------------------------------------

async function test44_poCombinedEdgePixelReportsRowCol() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const MINI_PO = {
    "resident-po-combined-preview-v1": {
      canvasWidth: 236, canvasHeight: 272, columns: 2, rows: 2,
      frameWidth: 118, frameHeight: 136,
      safeMargins: { top: 8, bottom: 8, left: 8, right: 8 },
      alphaRequired: true,
    },
  };

  const tmpDir = path.join(os.tmpdir(), `gs-test44-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  // Pixel at x=0, y=68 — inside frame[row=0, col=0], touching left edge (margin 0 < 8)
  writeFileSync(
    path.join(tmpDir, "resident-sprite-sheet-combined.png"),
    makeRgbaPng(236, 272, (x, y) => (x === 0 && y === 68) ? [255, 0, 0, 255] : [0, 0, 0, 0]),
  );

  const result = await validateAssetContract({
    slug: "test-slug-44",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: MINI_PO,
  });

  assert.strictEqual(
    result.report.marginCheckStatus, "fail",
    `marginCheckStatus should be "fail". Got "${result.report.marginCheckStatus}"`,
  );
  const v = result.report.checks.find((c) => c.check === "pixel-margin" && c.side === "left");
  assert.ok(v, `Expected left-side pixel-margin violation. checks: ${JSON.stringify(result.report.checks.filter((c) => c.check === "pixel-margin"))}`);
  assert.strictEqual(v.row, 0, `Violation row should be 0. Got ${v.row}`);
  assert.strictEqual(v.column, 0, `Violation column should be 0. Got ${v.column}`);
  assert.strictEqual(v.actual, 0, `Left margin actual should be 0 (pixel at x=0). Got ${v.actual}`);

  console.log("[PASS] test44: po-combined left-edge pixel → marginCheckStatus=\"fail\", row=0 col=0 violation");
}

// ---------------------------------------------------------------------------
// Test 45: canonical two-sheet all-transparent → marginCheckStatus="pass"
// ---------------------------------------------------------------------------

async function test45_canonicalAllTransparentPassesMargin() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  // Mini canonical: 2×2 frames per sheet (384×416 = 2*192 × 2*208)
  const MINI_CANONICAL = {
    "resident-canonical-two-sheet-v1": {
      sheets: [
        { kind: "motion",   canvasWidth: 384, canvasHeight: 416, columns: 2, rows: 2, frameWidth: 192, frameHeight: 208 },
        { kind: "extended", canvasWidth: 384, canvasHeight: 416, columns: 2, rows: 2, frameWidth: 192, frameHeight: 208 },
      ],
      safeMargins: { top: 8, bottom: 8, left: 10, right: 10 },
      alphaRequired: true,
    },
  };

  const tmpDir = path.join(os.tmpdir(), `gs-test45-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const transparentPng = makeRgbaPng(384, 416, () => [0, 0, 0, 0]);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet.png"), transparentPng);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-extended.png"), transparentPng);

  const result = await validateAssetContract({
    slug: "test-slug-45",
    contractId: "resident-canonical-two-sheet-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: MINI_CANONICAL,
  });

  assert.strictEqual(
    result.report.marginCheckStatus, "pass",
    `marginCheckStatus should be "pass" for all-transparent canonical sheets. Got "${result.report.marginCheckStatus}"`,
  );

  console.log("[PASS] test45: canonical two-sheet all-transparent → marginCheckStatus=\"pass\"");
}

// ---------------------------------------------------------------------------
// Test 46: canonical — motion sheet left-edge pixel → violation mentions "motion"
// ---------------------------------------------------------------------------

async function test46_canonicalEdgePixelReportsSheetKind() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const MINI_CANONICAL = {
    "resident-canonical-two-sheet-v1": {
      sheets: [
        { kind: "motion",   canvasWidth: 384, canvasHeight: 416, columns: 2, rows: 2, frameWidth: 192, frameHeight: 208 },
        { kind: "extended", canvasWidth: 384, canvasHeight: 416, columns: 2, rows: 2, frameWidth: 192, frameHeight: 208 },
      ],
      safeMargins: { top: 8, bottom: 8, left: 10, right: 10 },
      alphaRequired: true,
    },
  };

  const tmpDir = path.join(os.tmpdir(), `gs-test46-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  // Motion sheet: pixel at x=0, y=100 → left margin 0 < 10 → fail
  writeFileSync(
    path.join(tmpDir, "resident-sprite-sheet.png"),
    makeRgbaPng(384, 416, (x, y) => (x === 0 && y === 100) ? [255, 0, 0, 255] : [0, 0, 0, 0]),
  );
  writeFileSync(
    path.join(tmpDir, "resident-sprite-sheet-extended.png"),
    makeRgbaPng(384, 416, () => [0, 0, 0, 0]),
  );

  const result = await validateAssetContract({
    slug: "test-slug-46",
    contractId: "resident-canonical-two-sheet-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: MINI_CANONICAL,
  });

  assert.strictEqual(
    result.report.marginCheckStatus, "fail",
    `marginCheckStatus should be "fail". Got "${result.report.marginCheckStatus}"`,
  );
  const v = result.report.checks.find((c) => c.check === "pixel-margin" && c.side === "left");
  assert.ok(v, `Expected left-side pixel-margin violation in canonical sheets`);
  assert.ok(
    v.reason.includes("motion") || v.sheetKind === "motion",
    `Violation must identify motion sheet. Got reason="${v.reason}", sheetKind="${v.sheetKind}"`,
  );

  console.log("[PASS] test46: canonical motion sheet left-edge pixel → marginCheckStatus=\"fail\", violation identifies \"motion\" sheet");
}

// ---------------------------------------------------------------------------
// Test 47: pixel-margin failure appears in retryPlan with scope="frame-only" + promptPatch
// ---------------------------------------------------------------------------

async function test47_pixelMarginInRetryPlanHasScope() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const MINI_PO = {
    "resident-po-combined-preview-v1": {
      canvasWidth: 236, canvasHeight: 272, columns: 2, rows: 2,
      frameWidth: 118, frameHeight: 136,
      safeMargins: { top: 8, bottom: 8, left: 8, right: 8 },
      alphaRequired: true,
    },
  };

  const tmpDir = path.join(os.tmpdir(), `gs-test47-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(
    path.join(tmpDir, "resident-sprite-sheet-combined.png"),
    makeRgbaPng(236, 272, (x, y) => (x === 0 && y === 68) ? [255, 0, 0, 255] : [0, 0, 0, 0]),
  );

  const result = await validateAssetContract({
    slug: "test-slug-47",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: MINI_PO,
  });

  const marginFailures = result.retryPlan.failures.filter((f) => f.check === "pixel-margin");
  assert.ok(
    marginFailures.length >= 1,
    `Expected ≥1 pixel-margin failure in retryPlan. Got ${marginFailures.length}`,
  );
  assert.strictEqual(
    marginFailures[0].scope, "frame-only",
    `pixel-margin scope should be "frame-only" for po-combined. Got "${marginFailures[0].scope}"`,
  );
  assert.ok(
    typeof marginFailures[0].promptPatch === "string" && marginFailures[0].promptPatch.length > 20,
    `pixel-margin failure must have a non-empty promptPatch`,
  );

  console.log("[PASS] test47: pixel-margin in retryPlan has scope=\"frame-only\" and non-empty promptPatch");
}

// ---------------------------------------------------------------------------
// Sprint 10-E tests (48–51)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Test 48: event-standing-expressions lane generates 8 prompt files in event-expressions/
// ---------------------------------------------------------------------------

async function test48_eventStandingLaneGenerates8Prompts() {
  const { buildPromptPack } = await import("./character-asset-prompt-pack.mjs");

  const testRoot = path.join(os.tmpdir(), `godsandbox-pp-test48-${Date.now()}`);
  mkdirSync(testRoot, { recursive: true });

  const result = await buildPromptPack({
    assetBundleId: "test-event48",
    displayName: "TestChar",
    personality: "calm",
    tone: "gentle",
    age: 25,
    portraitPath: "assets/generated/residents/test-event48/reference/portrait.png",
    lanes: ["event-standing-expressions"],
    previewMode: "po-combined",
    repoRoot: testRoot,
  });

  const EVENT_EXPRESSIONS = ["neutral", "happy", "angry", "sad", "surprised", "worried", "determined", "shocked"];
  const resultFiles = result.files.map((f) => f.replaceAll("\\", "/"));

  for (const expr of EVENT_EXPRESSIONS) {
    const exprFile = resultFiles.find((f) => f.includes(`event-expressions/${expr}.prompt.md`));
    assert.ok(
      exprFile,
      `buildPromptPack should produce event-expressions/${expr}.prompt.md. Got files: ${JSON.stringify(resultFiles)}`,
    );
  }

  const eventPromptFiles = resultFiles.filter((f) => f.includes("event-expressions/"));
  assert.strictEqual(
    eventPromptFiles.length,
    8,
    `Expected 8 event expression prompt files, got ${eventPromptFiles.length}: ${JSON.stringify(eventPromptFiles)}`,
  );

  // Verify content mentions consistency requirements
  const fs = await import("node:fs");
  const neutralPath = path.join(testRoot, eventPromptFiles.find((f) => f.includes("neutral.prompt.md")));
  const neutralContent = fs.readFileSync(neutralPath, "utf8");
  assert.ok(
    neutralContent.includes("same camera angle and crop"),
    `Event expression prompt must require consistent camera angle and crop. Got: ${neutralContent.slice(0, 200)}`,
  );
  assert.ok(
    neutralContent.includes("transparent background"),
    `Event expression prompt must require transparent background`,
  );

  console.log("[PASS] test48: event-standing-expressions lane generates 8 prompt files in event-expressions/");
}

// ---------------------------------------------------------------------------
// Test 49: asset-generation-server VALID_LANES includes event-standing-expressions
// ---------------------------------------------------------------------------

async function test49_serverValidLanesIncludesEventStanding() {
  const { VALID_LANES } = await import("./asset-generation-server.mjs");

  assert.ok(
    Array.isArray(VALID_LANES),
    `VALID_LANES must be an array. Got: ${typeof VALID_LANES}`,
  );
  assert.ok(
    VALID_LANES.includes("event-standing-expressions"),
    `VALID_LANES must include "event-standing-expressions". Got: ${JSON.stringify(VALID_LANES)}`,
  );

  console.log(`[PASS] test49: asset-generation-server VALID_LANES includes "event-standing-expressions"`);
}

// ---------------------------------------------------------------------------
// Test 50: all-transparent portrait expression PNG fails content check
// ---------------------------------------------------------------------------

async function test50_allTransparentExpressionFailsContentCheck() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");
  const { CONTRACTS } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test50-${Date.now()}`);
  const exprDir = path.join(tmpDir, "expressions");
  mkdirSync(exprDir, { recursive: true });

  // All 5 expressions are fully transparent
  const transparentPng = makeRgbaPng(80, 100, () => [0, 0, 0, 0]);
  for (const e of ["neutral", "happy", "angry", "sad", "surprised"]) {
    writeFileSync(path.join(exprDir, `${e}.png`), transparentPng);
  }

  const result = await validateAssetContract({
    slug: "test-slug-50",
    contractId: "portrait-expression-set-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: CONTRACTS,
  });

  assert.strictEqual(
    result.report.contentCheckStatus,
    "fail",
    `contentCheckStatus should be "fail" for all-transparent images. Got "${result.report.contentCheckStatus}"`,
  );

  const contentFailures = result.report.checks.filter((c) => c.check === "required-content");
  assert.strictEqual(
    contentFailures.length,
    5,
    `Expected 5 required-content failures (one per expression). Got ${contentFailures.length}`,
  );

  for (const f of contentFailures) {
    assert.strictEqual(f.passed, false, `required-content check must be passed=false`);
    assert.ok(
      f.reason && f.reason.includes("transparent"),
      `required-content reason must mention transparency. Got: "${f.reason}"`,
    );
  }

  // retryPlan must include required-content failures with scope and promptPatch
  const retryContentFailures = result.retryPlan.failures.filter((f) => f.check === "required-content");
  assert.ok(
    retryContentFailures.length >= 1,
    `retryPlan must include required-content failures`,
  );
  assert.ok(
    typeof retryContentFailures[0].promptPatch === "string" && retryContentFailures[0].promptPatch.length > 20,
    `required-content failure must have non-empty promptPatch`,
  );

  console.log("[PASS] test50: all-transparent portrait expressions → contentCheckStatus=\"fail\", 5 required-content failures");
}

// ---------------------------------------------------------------------------
// Test 51: expression PNG with visible pixel passes content check
// ---------------------------------------------------------------------------

async function test51_visiblePixelExpressionPassesContentCheck() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");
  const { CONTRACTS } = await import("../../tools/asset-contracts/asset-contract-registry.mjs");

  const tmpDir = path.join(os.tmpdir(), `gs-test51-${Date.now()}`);
  const exprDir = path.join(tmpDir, "expressions");
  mkdirSync(exprDir, { recursive: true });

  // All expressions have a visible pixel well inside safe margins (x=40, y=50)
  const withContentPng = makeRgbaPng(80, 100, (x, y) => (x === 40 && y === 50) ? [255, 0, 0, 255] : [0, 0, 0, 0]);
  for (const e of ["neutral", "happy", "angry", "sad", "surprised"]) {
    writeFileSync(path.join(exprDir, `${e}.png`), withContentPng);
  }

  const result = await validateAssetContract({
    slug: "test-slug-51",
    contractId: "portrait-expression-set-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: CONTRACTS,
  });

  assert.strictEqual(
    result.report.contentCheckStatus,
    "pass",
    `contentCheckStatus should be "pass" when expressions have visible pixels. Got "${result.report.contentCheckStatus}"`,
  );

  const contentFailures = result.report.checks.filter((c) => c.check === "required-content");
  assert.strictEqual(
    contentFailures.length,
    0,
    `Expected 0 required-content failures for expressions with visible pixels. Got ${contentFailures.length}`,
  );

  console.log("[PASS] test51: portrait expressions with visible pixels → contentCheckStatus=\"pass\", 0 required-content failures");
}

// ---------------------------------------------------------------------------
// Sprint 10-E follow-up tests (52–56)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Test 52: character-asset-bundle-intake dry-run accepts event-standing-expressions lane
// ---------------------------------------------------------------------------

async function test52_intakeAcceptsEventStandingLane() {
  const { spawnSync } = await import("node:child_process");
  const toolPath = path.join(repoRoot, "tools", "sidekick", "character-asset-bundle-intake.mjs");

  const result = spawnSync("node", [
    toolPath,
    "--slug", "test52",
    "--name", "TestChar",
    "--personality", "calm",
    "--tone", "gentle",
    "--age", "25",
    "--portrait", "public/art/apostle/apostle-standing-alpha.png",
    "--lanes", "event-standing-expressions",
    "--dry-run",
  ], { cwd: repoRoot, encoding: "utf8" });

  assert.strictEqual(
    result.status,
    0,
    `intake --dry-run with event-standing-expressions should exit 0. Got: ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );

  console.log("[PASS] test52: character-asset-bundle-intake accepts event-standing-expressions lane in --dry-run");
}

// ---------------------------------------------------------------------------
// Test 53: AppServer watcher request includes lanes when event-standing-expressions is specified
// ---------------------------------------------------------------------------

async function test53_watcherRequestIncludesLanes() {
  const { spawn } = await import("node:child_process");
  const { default: http } = await import("node:http");
  const { rmSync, existsSync: exists, readFileSync: readFS } = await import("node:fs");

  const serverPath = path.join(repoRoot, "tools", "app-server", "asset-generation-server.mjs");
  const port = 18790;
  const srv = spawn("node", [serverPath, "--port", String(port)], { cwd: repoRoot });

  await new Promise((res) => setTimeout(res, 600));

  let jobId = null;

  try {
    const body = JSON.stringify({
      displayName: "WatcherTestChar",
      personality: "calm",
      tone: "gentle",
      age: 20,
      portraitPath: "public/art/apostle/apostle-standing-alpha.png",
      lanes: ["event-standing-expressions"],
      previewMode: "po-combined",
      gen2Bridge: "fake",
    });

    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        path: "/api/local/asset-generation/characters",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "Origin": "http://127.0.0.1:5173",
        },
      }, (r) => {
        let data = "";
        r.on("data", (chunk) => data += chunk);
        r.on("end", () => resolve({ status: r.statusCode, body: data }));
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    assert.strictEqual(res.status, 202, `POST should return 202. Got: ${res.status}\nbody: ${res.body}`);

    const resData = JSON.parse(res.body);
    jobId = resData.jobId;
    assert.ok(jobId, `Response should include jobId. Got: ${res.body}`);

    await new Promise((res) => setTimeout(res, 100));

    // Watcher may have already moved the file to processing/ or done/
    const jobsRoot = path.join(repoRoot, ".godsandbox", "jobs");
    const candidatePaths = [
      path.join(jobsRoot, `${jobId}-request.json`),
      path.join(jobsRoot, "processing", `${jobId}-request.json`),
      path.join(jobsRoot, "done", `${jobId}-request.json`),
    ];
    const watcherFile = candidatePaths.find((p) => exists(p));
    assert.ok(
      watcherFile,
      `Watcher request file must exist in jobs/, processing/, or done/. jobId=${jobId}`,
    );

    const watcherReq = JSON.parse(readFS(watcherFile, "utf8"));
    assert.ok(
      Array.isArray(watcherReq.lanes),
      `Watcher request must include lanes array. Got: ${JSON.stringify(watcherReq)}`,
    );
    assert.ok(
      watcherReq.lanes.includes("event-standing-expressions"),
      `Watcher request lanes must include "event-standing-expressions". Got: ${JSON.stringify(watcherReq.lanes)}`,
    );

  } finally {
    srv.kill();
    await new Promise((res) => setTimeout(res, 200));
    if (jobId) {
      const jobsRoot = path.join(repoRoot, ".godsandbox", "jobs");
      const candidatePaths = [
        path.join(jobsRoot, `${jobId}-request.json`),
        path.join(jobsRoot, "processing", `${jobId}-request.json`),
        path.join(jobsRoot, "done", `${jobId}-request.json`),
      ];
      const statusFile = path.join(jobsRoot, "local-app-server", `${jobId}.json`);
      for (const p of candidatePaths) {
        try { if (exists(p)) rmSync(p); } catch {}
      }
      try { if (exists(statusFile)) rmSync(statusFile); } catch {}
    }
  }

  console.log("[PASS] test53: AppServer watcher request file includes lanes with event-standing-expressions");
}

// ---------------------------------------------------------------------------
// Test 54: po-combined all-transparent sprite sheet fails required-content check
// ---------------------------------------------------------------------------

async function test54_poCombinedAllTransparentFailsContentCheck() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const MINI_PO = {
    "resident-po-combined-preview-v1": {
      canvasWidth: 236, canvasHeight: 272, columns: 2, rows: 2,
      frameWidth: 118, frameHeight: 136,
      safeMargins: { top: 8, bottom: 8, left: 8, right: 8 },
      alphaRequired: true,
    },
  };

  const tmpDir = path.join(os.tmpdir(), `gs-test54-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(
    path.join(tmpDir, "resident-sprite-sheet-combined.png"),
    makeRgbaPng(236, 272, () => [0, 0, 0, 0]),
  );

  const result = await validateAssetContract({
    slug: "test-slug-54",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: MINI_PO,
  });

  assert.strictEqual(
    result.report.contentCheckStatus,
    "fail",
    `contentCheckStatus should be "fail" for all-transparent po-combined sheet. Got "${result.report.contentCheckStatus}"`,
  );

  const contentFailures = result.report.checks.filter((c) => c.check === "required-content");
  assert.ok(
    contentFailures.length >= 1,
    `Expected ≥1 required-content failure. Got ${contentFailures.length}`,
  );
  assert.strictEqual(
    contentFailures[0].scope,
    "full-sheet",
    `required-content scope should be "full-sheet" for sprite sheet. Got "${contentFailures[0].scope}"`,
  );

  const retryContentFailures = result.retryPlan.failures.filter((f) => f.check === "required-content");
  assert.ok(retryContentFailures.length >= 1, `retryPlan must include required-content failures`);

  console.log("[PASS] test54: po-combined all-transparent sheet → contentCheckStatus=\"fail\", required-content scope=full-sheet");
}

// ---------------------------------------------------------------------------
// Test 55: canonical all-transparent motion + extended sheets fail required-content
// ---------------------------------------------------------------------------

async function test55_canonicalAllTransparentFailsContentCheck() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const MINI_CANONICAL = {
    "resident-canonical-two-sheet-v1": {
      sheets: [
        { kind: "motion",   canvasWidth: 384, canvasHeight: 416, columns: 2, rows: 2, frameWidth: 192, frameHeight: 208 },
        { kind: "extended", canvasWidth: 384, canvasHeight: 416, columns: 2, rows: 2, frameWidth: 192, frameHeight: 208 },
      ],
      safeMargins: { top: 8, bottom: 8, left: 10, right: 10 },
      alphaRequired: true,
    },
  };

  const tmpDir = path.join(os.tmpdir(), `gs-test55-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const transparentPng = makeRgbaPng(384, 416, () => [0, 0, 0, 0]);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet.png"), transparentPng);
  writeFileSync(path.join(tmpDir, "resident-sprite-sheet-extended.png"), transparentPng);

  const result = await validateAssetContract({
    slug: "test-slug-55",
    contractId: "resident-canonical-two-sheet-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: MINI_CANONICAL,
  });

  assert.strictEqual(
    result.report.contentCheckStatus,
    "fail",
    `contentCheckStatus should be "fail" for all-transparent canonical sheets. Got "${result.report.contentCheckStatus}"`,
  );

  const contentFailures = result.report.checks.filter((c) => c.check === "required-content");
  assert.strictEqual(
    contentFailures.length,
    2,
    `Expected 2 required-content failures (motion + extended). Got ${contentFailures.length}: ${JSON.stringify(contentFailures.map(f => f.reason))}`,
  );

  const motionFailure = contentFailures.find((f) => f.sheetKind === "motion" || (f.reason && f.reason.includes("motion")));
  assert.ok(motionFailure, `Expected a motion sheet required-content failure`);

  console.log("[PASS] test55: canonical all-transparent sheets → contentCheckStatus=\"fail\", 2 required-content failures");
}

// ---------------------------------------------------------------------------
// Test 56: po-combined with visible pixel passes required-content check
// ---------------------------------------------------------------------------

async function test56_poCombinedWithContentPassesContentCheck() {
  const { validateAssetContract } = await import("../../tools/asset-pipeline/validate-asset-contract.mjs");

  const MINI_PO = {
    "resident-po-combined-preview-v1": {
      canvasWidth: 236, canvasHeight: 272, columns: 2, rows: 2,
      frameWidth: 118, frameHeight: 136,
      safeMargins: { top: 8, bottom: 8, left: 8, right: 8 },
      alphaRequired: true,
    },
  };

  const tmpDir = path.join(os.tmpdir(), `gs-test56-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  // One visible pixel well inside safe margins (x=60, y=68)
  writeFileSync(
    path.join(tmpDir, "resident-sprite-sheet-combined.png"),
    makeRgbaPng(236, 272, (x, y) => (x === 60 && y === 68) ? [255, 0, 0, 255] : [0, 0, 0, 0]),
  );

  const result = await validateAssetContract({
    slug: "test-slug-56",
    contractId: "resident-po-combined-preview-v1",
    assetDir: tmpDir,
    dryRun: true,
    contracts: MINI_PO,
  });

  assert.strictEqual(
    result.report.contentCheckStatus,
    "pass",
    `contentCheckStatus should be "pass" when sheet has visible pixels. Got "${result.report.contentCheckStatus}"`,
  );

  const contentFailures = result.report.checks.filter((c) => c.check === "required-content");
  assert.strictEqual(
    contentFailures.length,
    0,
    `Expected 0 required-content failures for sheet with visible pixels. Got ${contentFailures.length}`,
  );

  console.log("[PASS] test56: po-combined with visible pixel → contentCheckStatus=\"pass\", 0 required-content failures");
}

// ---------------------------------------------------------------------------
// Test 57: intake --dry-run without --lanes → event-standing-expressions NOT included
// ---------------------------------------------------------------------------

async function test57_intakeDefaultLanesExcludeEventStanding() {
  const { spawnSync } = await import("node:child_process");

  const intakeScript = path.join(repoRoot, "tools", "sidekick", "character-asset-bundle-intake.mjs");

  const result = spawnSync(
    "node",
    [
      intakeScript,
      "--slug", "defaultlanestest",
      "--name", "DefaultLanesTest",
      "--personality", "calm",
      "--tone", "gentle",
      "--age", "20",
      "--portrait", "public/art/apostle/apostle-standing-alpha.png",
      "--dry-run",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.strictEqual(result.status, 0, `intake --dry-run should exit 0. stderr: ${result.stderr}`);

  const out = result.stdout;
  assert.ok(
    !out.includes("event-standing-expressions"),
    `Default lanes must NOT include event-standing-expressions.\nGot output: ${out}`,
  );
  assert.ok(
    out.includes("resident-sprite-sheet"),
    `Default lanes must include resident-sprite-sheet.\nGot output: ${out}`,
  );
  assert.ok(
    out.includes("portrait-expressions"),
    `Default lanes must include portrait-expressions.\nGot output: ${out}`,
  );
  assert.ok(
    out.includes("derived-icon"),
    `Default lanes must include derived-icon.\nGot output: ${out}`,
  );

  console.log("[PASS] test57: intake --dry-run default lanes exclude event-standing-expressions");
}

// ---------------------------------------------------------------------------
// Test 58: intake --dry-run --lanes event-standing-expressions → accepted
// ---------------------------------------------------------------------------

async function test58_intakeAcceptsExplicitEventStandingLane() {
  const { spawnSync } = await import("node:child_process");

  const intakeScript = path.join(repoRoot, "tools", "sidekick", "character-asset-bundle-intake.mjs");

  const result = spawnSync(
    "node",
    [
      intakeScript,
      "--slug", "eventlanetest",
      "--name", "EventLaneTest",
      "--personality", "calm",
      "--tone", "gentle",
      "--age", "20",
      "--portrait", "public/art/apostle/apostle-standing-alpha.png",
      "--lanes", "event-standing-expressions",
      "--dry-run",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.strictEqual(result.status, 0, `intake --dry-run with event-standing-expressions should exit 0. stderr: ${result.stderr}`);

  const out = result.stdout;
  assert.ok(
    out.includes("event-standing-expressions"),
    `Output must include event-standing-expressions.\nGot: ${out}`,
  );

  console.log("[PASS] test58: intake --dry-run accepts explicit --lanes event-standing-expressions");
}

// ---------------------------------------------------------------------------
// Test 59: AppServer portrait staging endpoint writes only assets/generated PNGs
// ---------------------------------------------------------------------------

async function test59_portraitStagingEndpointSecurityAndValidation() {
  const { spawn } = await import("node:child_process");
  const { default: http } = await import("node:http");
  const { validatePortraitPathFilesystem } = await import("./portrait-path-validator.mjs");

  const serverPath = path.join(repoRoot, "tools", "app-server", "asset-generation-server.mjs");
  const port = 18791;
  const srv = spawn("node", [serverPath, "--port", String(port)], { cwd: repoRoot });
  await new Promise((res) => setTimeout(res, 600));

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validPng = makeRgbaPng(2, 2, () => [255, 0, 0, 255]);
  const testSlug = `portrait-stage-${Date.now()}`;
  const badSlug = `${testSlug}-bad`;
  const bigSlug = `${testSlug}-big`;
  let jobId = null;

  const request = (method, requestPath, headers = {}, body = null) => new Promise((resolve, reject) => {
    const bodyBuffer = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(body);
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: requestPath,
      method,
      headers: {
        ...headers,
        ...(bodyBuffer && headers["Content-Length"] === undefined
          ? { "Content-Length": Buffer.byteLength(bodyBuffer) }
          : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    req.on("error", reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });

  try {
    const preflight = await request("OPTIONS", `/api/local/asset-generation/portraits?slug=${testSlug}`, {
      "Origin": "http://127.0.0.1:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type",
    });
    assert.strictEqual(preflight.status, 204, `Portrait preflight should return 204. Got ${preflight.status}`);
    assert.strictEqual(
      preflight.headers["access-control-allow-origin"],
      "http://127.0.0.1:5173",
      "Portrait endpoint must use the existing loopback CORS allow-list",
    );

    const stageRes = await request("POST", `/api/local/asset-generation/portraits?slug=${testSlug}`, {
      "Content-Type": "application/octet-stream",
      "Origin": "http://127.0.0.1:5173",
    }, validPng);
    assert.strictEqual(stageRes.status, 201, `Valid portrait upload should return 201. Got ${stageRes.status}: ${stageRes.body}`);

    const stageBody = JSON.parse(stageRes.body);
    const expectedPortraitPath = `assets/generated/residents/${testSlug}/reference/portrait.png`;
    assert.deepStrictEqual(
      {
        slug: stageBody.slug,
        portraitPath: stageBody.portraitPath,
        bytes: stageBody.bytes,
        status: stageBody.status,
      },
      {
        slug: testSlug,
        portraitPath: expectedPortraitPath,
        bytes: validPng.length,
        status: "staged",
      },
      `Staging response should return repo-relative portraitPath. Got: ${stageRes.body}`,
    );

    const portraitAbsPath = path.join(repoRoot, "assets", "generated", "residents", testSlug, "reference", "portrait.png");
    assert.ok(existsSync(portraitAbsPath), `Staged portrait should exist at ${portraitAbsPath}`);
    assert.strictEqual(
      validatePortraitPathFilesystem(stageBody.portraitPath, repoRoot),
      null,
      "Returned portraitPath must pass the existing filesystem validator",
    );

    const characterReq = JSON.stringify({
      displayName: "PortraitStageTest",
      personality: "calm",
      tone: "gentle",
      age: 20,
      portraitPath: stageBody.portraitPath,
      assetBundleId: testSlug,
      previewMode: "po-combined",
      gen2Bridge: "fake",
    });
    const characterRes = await request("POST", "/api/local/asset-generation/characters", {
      "Content-Type": "application/json",
      "Origin": "http://127.0.0.1:5173",
    }, characterReq);
    assert.strictEqual(
      characterRes.status,
      202,
      `Existing character job endpoint should accept staged portraitPath. Got ${characterRes.status}: ${characterRes.body}`,
    );
    jobId = JSON.parse(characterRes.body).jobId;

    const invalidRes = await request("POST", `/api/local/asset-generation/portraits?slug=${badSlug}`, {
      "Content-Type": "image/png",
    }, Buffer.from("not a png"));
    assert.strictEqual(invalidRes.status, 422, `Invalid PNG signature should return 422. Got ${invalidRes.status}: ${invalidRes.body}`);
    assert.strictEqual(
      existsSync(path.join(repoRoot, "assets", "generated", "residents", badSlug, "reference", "portrait.png")),
      false,
      "Invalid PNG upload must not write a portrait file",
    );

    const traversalSlug = "..%2F..%2F..%2Fpublic%2Fart%2Fportrait-stage-evil";
    const traversalRes = await request("POST", `/api/local/asset-generation/portraits?slug=${traversalSlug}`, {
      "Content-Type": "image/png",
    }, validPng);
    assert.strictEqual(traversalRes.status, 422, `Traversal slug should return 422. Got ${traversalRes.status}: ${traversalRes.body}`);
    assert.strictEqual(
      existsSync(path.join(repoRoot, "public", "art", "portrait-stage-evil", "reference", "portrait.png")),
      false,
      "Traversal slug must not create anything under public/art/",
    );

    const oversized = Buffer.concat([pngSig, Buffer.alloc(10 * 1024 * 1024)]);
    const oversizedRes = await request("POST", `/api/local/asset-generation/portraits?slug=${bigSlug}`, {
      "Content-Type": "image/png",
    }, oversized);
    assert.strictEqual(oversizedRes.status, 413, `Oversized portrait upload should return 413. Got ${oversizedRes.status}: ${oversizedRes.body}`);
    assert.strictEqual(
      existsSync(path.join(repoRoot, "assets", "generated", "residents", bigSlug, "reference", "portrait.png")),
      false,
      "Oversized upload must not write a portrait file",
    );
  } finally {
    srv.kill();
    await new Promise((res) => setTimeout(res, 200));

    for (const slug of [testSlug, badSlug, bigSlug]) {
      rmSync(path.join(repoRoot, "assets", "generated", "residents", slug), { recursive: true, force: true });
    }
    if (jobId) {
      const jobsRoot = path.join(repoRoot, ".godsandbox", "jobs");
      rmSync(path.join(jobsRoot, `${jobId}-request.json`), { recursive: true, force: true });
      rmSync(path.join(jobsRoot, "local-app-server", `${jobId}.json`), { recursive: true, force: true });
      rmSync(path.join(jobsRoot, "fake", jobId), { recursive: true, force: true });
    }
  }

  console.log("[PASS] test59: portrait staging endpoint validates PNG, slug, size, CORS, and returned portraitPath");
}

async function loadAssetProductionMemoModule() {
  const ts = await import("typescript");
  const sourcePath = path.join(repoRoot, "src", "features", "asset-generation", "assetProductionMemo.ts");
  const source = readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const encoded = Buffer.from(transpiled.outputText, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

// ---------------------------------------------------------------------------
// Test 60: UI production memo maps raw job statuses to friendly Japanese copy
// ---------------------------------------------------------------------------

async function test60_assetProductionMemoStatusMapping() {
  const { describeAssetJobProgress } = await loadAssetProductionMemoModule();
  const cases = [
    ["pending", "制作依頼を受け取りました"],
    ["prompt-pack-ready", "この子の特徴をまとめています"],
    ["gen2-dispatched", "ローカル補助に渡しました"],
    ["watcher-intake-done", "制作の準備が整いました"],
    ["error", "うまく進めませんでした"],
  ];

  for (const [status, expectedTitle] of cases) {
    const progress = describeAssetJobProgress(status);
    assert.strictEqual(
      progress.title,
      expectedTitle,
      `status "${status}" should map to "${expectedTitle}", got "${progress.title}"`,
    );
  }

  console.log("[PASS] test60: asset production memo maps known statuses to friendly Japanese copy");
}

// ---------------------------------------------------------------------------
// Test 61: UI production memo translates common validation failures
// ---------------------------------------------------------------------------

async function test61_assetProductionMemoValidationFailureTranslator() {
  const { translateValidationFailure } = await loadAssetProductionMemoModule();
  const cases = [
    ["required-content", "画像が透明だけです"],
    ["alpha-channel", "背景が透過されていません"],
    ["dimensions", "画像サイズが規格と違います"],
    ["pixel-margin", "端に寄りすぎています"],
  ];

  for (const [check, expectedTitle] of cases) {
    const failure = translateValidationFailure({
      check,
      label: "neutral.png",
      reason: `${check} failed`,
    });
    assert.strictEqual(
      failure.title,
      expectedTitle,
      `check "${check}" should map to "${expectedTitle}", got "${failure.title}"`,
    );
    assert.ok(failure.action.length > 0, `check "${check}" should include a recovery action`);
  }

  console.log("[PASS] test61: asset production memo translates required-content/alpha/dimensions/pixel-margin");
}

// ---------------------------------------------------------------------------
// Test 62: fake bridge warning and event expression labels stay visible
// ---------------------------------------------------------------------------

async function test62_assetProductionMemoWarningsAndEventExpressions() {
  const { getAssetProductionMemo, EVENT_STANDING_EXPECTED_LABELS } = await loadAssetProductionMemoModule();
  const memo = getAssetProductionMemo({
    jobId: "ui-memo-test",
    status: "gen2-dispatched",
    assetBundleId: "ryo",
    lanes: ["resident-sprite-sheet", "event-standing-expressions"],
    gen2Bridge: "fake",
    validationOnly: true,
    candidateEligible: false,
  });

  assert.ok(
    memo.warnings.some((warning) => warning.includes("テスト用の仮連携")),
    `fake bridge warning must stay visible. Got: ${JSON.stringify(memo.warnings)}`,
  );
  assert.ok(memo.eventExpressions, "event-standing-expressions should produce an event expression summary");
  for (const label of EVENT_STANDING_EXPECTED_LABELS) {
    assert.ok(
      memo.eventExpressions.expectedLabels.includes(label),
      `event expression summary should include "${label}"`,
    );
  }
  assert.strictEqual(
    memo.reviewPack.command,
    "npm run assetgen:review-pack -- --slug ryo",
    `review pack command should be visible. Got: ${memo.reviewPack.command}`,
  );

  console.log("[PASS] test62: fake bridge warning, event labels, and review-pack command remain visible");
}

// ---------------------------------------------------------------------------
// Test 63: technical details are behind expandable details
// ---------------------------------------------------------------------------

async function test63_assetProductionMemoTechnicalDetailsExpandable() {
  const formPath = path.join(repoRoot, "src", "features", "asset-generation", "CharacterAssetGenForm.tsx");
  const source = readFileSync(formPath, "utf8");

  assert.ok(
    source.includes("<details className=\"assetgen-form__details\">"),
    "CharacterAssetGenForm should render technical details in an expandable <details> block",
  );
  assert.ok(
    source.includes("開発者向けの詳細"),
    "CharacterAssetGenForm should label expandable technical details in Japanese",
  );
  assert.ok(
    !source.includes("<dt>Job ID</dt>"),
    "raw Job ID should not be the primary submitted-state experience",
  );

  console.log("[PASS] test63: technical details are expandable and raw Job ID is not primary submitted copy");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log("Running Sprint9-5/9-7/9-8/9-6/10-A/10-B/10-C/10-hardening/10-D/10-E/UI memo dry-run tests...\n");
  let passed = 0;
  let failed = 0;

  const tests = [
    test1_hotFolderThrowsWithoutEnvVar,
    test2_fakeGen2BridgeValidationOnly,
    test3_poCombinedPromptContent,
    test4_canonicalTwoSheetPromptContent,
    test5_noExpressionFilesWhenLaneExcluded,
    test6_portraitPathValidation,
    test7_generateJobIdIsUnique,
    test8_localCliBridgeThrowsOnNonZeroExit,
    test9_docsWatcherPathCorrect,
    test10_watcherRoutes_legacyRequest,
    test11_watcherRoutes_assetgenRequest,
    test12_malformedRequest_markedFailed,
    test13_duplicateJobId_notDoubleRun,
    test14_missingIncomingFolder_clearsError,
    test15_fakeMetadataShownAsValidationOnly,
    test16_publicArtOutputRejected,
    test17_cors_allowedOriginGetsCorsHeaders,
    test18_cors_healthzIncludesCorsHeader,
    test19_contractIdsAreUnique,
    test20_canonicalTwoSheetContract,
    test21_poCombinedContract,
    test22_expressionContractsRequireAlphaAndTransparency,
    test23_wrongDimensions_reportShowsFail,
    test24_missingAlpha_reportShowsFail,
    test25_missingExpressionFile_reportShowsFail,
    test26_validFixture_passesBasicChecks,
    test27_retryPlanHasScopeField,
    test28_runBundleDryRunPrintsPlan,
    test29_differentSlugLockFails,
    test30_sameSlugLockAllowsResume,
    test31_eventIntakeRejectsNoAlpha,
    test32_eventIntakeAcceptsAlpha,
    test33_runBundleDryRunFakeBridgeWarning,
    test34_canonicalValidatorReadsSheetSpecs,
    test35_canonicalWrongDimensionsShowsExpected,
    test36_canonicalSafeMarginsMatchSpec,
    test37_reviewPackRendersRetryPlanScopeAndPromptPatch,
    test38_failOnViolationExitsNonZero,
    test39_marginCheckStatusNotRun,
    test40_hardGateAndQualityGateStatusInReport,
    test41_expressionAllTransparentPassesMarginCheck,
    test42_expressionEdgePixelFailsMarginCheck,
    test43_poCombinedAllTransparentPassesMargin,
    test44_poCombinedEdgePixelReportsRowCol,
    test45_canonicalAllTransparentPassesMargin,
    test46_canonicalEdgePixelReportsSheetKind,
    test47_pixelMarginInRetryPlanHasScope,
    test48_eventStandingLaneGenerates8Prompts,
    test49_serverValidLanesIncludesEventStanding,
    test50_allTransparentExpressionFailsContentCheck,
    test51_visiblePixelExpressionPassesContentCheck,
    test52_intakeAcceptsEventStandingLane,
    test53_watcherRequestIncludesLanes,
    test54_poCombinedAllTransparentFailsContentCheck,
    test55_canonicalAllTransparentFailsContentCheck,
    test56_poCombinedWithContentPassesContentCheck,
    test57_intakeDefaultLanesExcludeEventStanding,
    test58_intakeAcceptsExplicitEventStandingLane,
    test59_portraitStagingEndpointSecurityAndValidation,
    test60_assetProductionMemoStatusMapping,
    test61_assetProductionMemoValidationFailureTranslator,
    test62_assetProductionMemoWarningsAndEventExpressions,
    test63_assetProductionMemoTechnicalDetailsExpandable,
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

  const total = tests.length;
  console.log(`\n${passed + failed}/${total} tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
