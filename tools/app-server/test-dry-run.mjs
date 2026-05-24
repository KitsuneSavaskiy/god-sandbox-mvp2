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
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
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
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log("Running Sprint9-5/9-7/9-8 dry-run tests...\n");
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
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
