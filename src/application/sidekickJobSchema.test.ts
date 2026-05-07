import {
  formatSidekickJobValidationIssues,
  validateSidekickJob,
} from "./sidekickJobSchema.js";

type TestAssert = {
  equal(actual: unknown, expected: unknown): void;
  ok(value: unknown): asserts value;
};

const assert: TestAssert = {
  equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, but got ${String(actual)}.`);
    }
  },
  ok(value: unknown): asserts value {
    if (!value) {
      throw new Error("Expected value to be truthy.");
    }
  },
};

const baseJob = {
  jobVersion: "godsandbox-sidekick-job/v0",
  jobId: "job_eve_asset_001",
  createdAt: "2026-05-06T00:00:00.000Z",
  characterId: "chr_eve",
  assetBundleId: "eve",
  worldDirectoryName: "spring-village",
  characterProfile: {
    displayName: "Eve",
    personality: "穏やか",
    tone: "丁寧",
    age: 20,
    portraitRef: "assets/generated/residents/eve/reference/eve-portrait-reference-20260506000000.png",
  },
};

function validate(input: unknown) {
  return validateSidekickJob(input);
}

function testValidCharacterAssetBundleJob(): void {
  const result = validate({
    ...baseJob,
    jobType: "character-asset-bundle",
    requestedOutputs: {
      residentSpriteSheet: true,
      portraitExpressions: true,
      derivedIcon: true,
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.job.characterId, "chr_eve");
    assert.equal(result.job.assetBundleId, "eve");
    assert.equal(result.job.jobType, "character-asset-bundle");
  }
}

function testValidCharacterNarrativePackJob(): void {
  const result = validate({
    ...baseJob,
    jobId: "job_eve_narrative_001",
    jobType: "character-narrative-pack",
    requestedOutputs: {
      voiceProfile: true,
      dialogueLines: true,
      commentBubbles: true,
      eventSeeds: true,
      interventionResponses: true,
      storyLogCandidates: true,
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.job.jobType, "character-narrative-pack");
  }
}

function testMissingRequiredFieldsAreRejected(): void {
  const result = validate({
    jobVersion: "godsandbox-sidekick-job/v0",
    jobType: "character-asset-bundle",
    createdAt: "2026-05-06T00:00:00.000Z",
    characterId: "chr_eve",
    assetBundleId: "eve",
    worldDirectoryName: "spring-village",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "jobId"));
  }
}

function testUnknownJobTypeIsRejected(): void {
  const result = validate({
    ...baseJob,
    jobType: "resident-sprite-generation",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === "unsupported-job-type"));
  }
}

function testCharacterIdAndAssetBundleIdConfusionIsRejected(): void {
  const invalidCharacterId = validate({
    ...baseJob,
    characterId: "eve",
    jobType: "character-asset-bundle",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  });
  const invalidAssetBundleId = validate({
    ...baseJob,
    assetBundleId: "chr_eve",
    jobType: "character-asset-bundle",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  });
  const mismatchedAssetBundleId = validate({
    ...baseJob,
    assetBundleId: "foo",
    jobType: "character-asset-bundle",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  });

  assert.equal(invalidCharacterId.ok, false);
  assert.equal(invalidAssetBundleId.ok, false);
  assert.equal(mismatchedAssetBundleId.ok, false);

  if (!invalidCharacterId.ok) {
    assert.ok(invalidCharacterId.issues.some((issue) => issue.path === "characterId"));
  }

  if (!invalidAssetBundleId.ok) {
    assert.ok(invalidAssetBundleId.issues.some((issue) => issue.path === "assetBundleId"));
  }

  if (!mismatchedAssetBundleId.ok) {
    assert.ok(mismatchedAssetBundleId.issues.some((issue) => issue.path === "assetBundleId"));
  }
}

function testSecretLookingValuesAreRejectedAndRedacted(): void {
  const secretValue = ["sk", "thisShouldNotAppearInValidationMessage123456"].join("-");
  const result = validate({
    ...baseJob,
    jobType: "character-narrative-pack",
    requestedOutputs: {
      voiceProfile: true,
    },
    notes: [secretValue],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    const messages = formatSidekickJobValidationIssues(result.issues).join("\n");
    assert.ok(result.issues.some((issue) => issue.code === "unsafe-content"));
    assert.equal(messages.includes(secretValue), false);
  }
}

function testGithubOauthTokenLikeValuesAreRejectedAndRedacted(): void {
  for (const prefix of ["gho", "ghu", "ghs", "ghr"]) {
    const tokenValue = [prefix, "thisShouldNotAppearInValidationMessage123456"].join("_");
    const result = validate({
      ...baseJob,
      jobType: "character-narrative-pack",
      requestedOutputs: {
        voiceProfile: true,
      },
      input: {
        sidekickRef: tokenValue,
      },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      const messages = formatSidekickJobValidationIssues(result.issues).join("\n");
      assert.ok(result.issues.some((issue) => issue.code === "unsafe-content"));
      assert.equal(messages.includes(tokenValue), false);
    }
  }
}

function testPersonalPathValuesAreRejectedAndRedacted(): void {
  const personalPath = ["C:", "Users", "sample", "Desktop", "source.png"].join("\\");
  const result = validate({
    ...baseJob,
    jobType: "character-asset-bundle",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
    input: {
      sourceImageRef: personalPath,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    const messages = formatSidekickJobValidationIssues(result.issues).join("\n");
    assert.ok(result.issues.some((issue) => issue.code === "unsafe-content"));
    assert.equal(messages.includes(personalPath), false);
    assert.equal(messages.includes("Users\\sample"), false);
  }
}

function testInvalidWorldDirectoryNameIsRejected(): void {
  const result = validate({
    ...baseJob,
    worldDirectoryName: "../spring-village",
    jobType: "character-asset-bundle",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "worldDirectoryName"));
  }
}

function testRequestedOutputFalseValueIsRejected(): void {
  const result = validate({
    ...baseJob,
    jobType: "character-asset-bundle",
    requestedOutputs: {
      residentSpriteSheet: false,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.code === "invalid-requested-output" &&
          issue.path === "requestedOutputs.residentSpriteSheet",
      ),
    );
  }
}

function testRequestedOutputStringValueIsRejected(): void {
  const result = validate({
    ...baseJob,
    jobType: "character-asset-bundle",
    requestedOutputs: {
      residentSpriteSheet: "yes",
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.code === "invalid-requested-output" &&
          issue.path === "requestedOutputs.residentSpriteSheet",
      ),
    );
  }
}

function testRequestedOutputsAreCheckedByJobType(): void {
  const result = validate({
    ...baseJob,
    jobType: "character-narrative-pack",
    requestedOutputs: {
      residentSpriteSheet: true,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === "invalid-requested-output"));
  }
}

const tests: Array<[string, () => void]> = [
  ["valid character asset bundle job", testValidCharacterAssetBundleJob],
  ["valid character narrative pack job", testValidCharacterNarrativePackJob],
  ["missing required fields are rejected", testMissingRequiredFieldsAreRejected],
  ["unknown job type is rejected", testUnknownJobTypeIsRejected],
  ["characterId and assetBundleId confusion is rejected", testCharacterIdAndAssetBundleIdConfusionIsRejected],
  ["secret-looking values are rejected and redacted", testSecretLookingValuesAreRejectedAndRedacted],
  ["GitHub OAuth token-like values are rejected and redacted", testGithubOauthTokenLikeValuesAreRejectedAndRedacted],
  ["personal path values are rejected and redacted", testPersonalPathValuesAreRejectedAndRedacted],
  ["invalid worldDirectoryName is rejected", testInvalidWorldDirectoryNameIsRejected],
  ["requested output false value is rejected", testRequestedOutputFalseValueIsRejected],
  ["requested output string value is rejected", testRequestedOutputStringValueIsRejected],
  ["requested outputs are checked by job type", testRequestedOutputsAreCheckedByJobType],
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
