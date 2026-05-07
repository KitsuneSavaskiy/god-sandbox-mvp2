import type { PersonalityVector } from "../../domain/models.js";
import {
  DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS,
  buildAmbientResidentEmoteWeights,
  getNextAmbientEmoteResidentIndex,
  selectWeightedAmbientResidentEmote,
} from "./ambientResidentEmotes.js";

type TestAssert = {
  equal(actual: unknown, expected: unknown): void;
  ok(value: unknown, message?: string): asserts value;
};

const assert: TestAssert = {
  equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, but got ${String(actual)}.`);
    }
  },
  ok(value: unknown, message?: string): asserts value {
    if (!value) {
      throw new Error(message ?? "Expected value to be truthy.");
    }
  },
};

function testBuildAmbientResidentEmoteWeightsUsesBaseWeightsWhenPersonalityIsEmpty(): void {
  const weights = buildAmbientResidentEmoteWeights({});

  assert.equal(weights.happy, DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS.happy);
  assert.equal(weights.angry, DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS.angry);
  assert.equal(weights.sad, DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS.sad);
  assert.equal(weights.surprised, DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS.surprised);
}

function testBuildAmbientResidentEmoteWeightsAppliesPersonalityBias(): void {
  const outgoingCurious: PersonalityVector = {
    sociability: 90,
    curiosity: 95,
    sensitivity: 20,
  };
  const patientSensitive: PersonalityVector = {
    patience: 95,
    sensitivity: 95,
  };
  const patientSteady: PersonalityVector = {
    patience: 95,
    sensitivity: 20,
  };

  const outgoingWeights = buildAmbientResidentEmoteWeights(outgoingCurious);
  const sensitiveWeights = buildAmbientResidentEmoteWeights(patientSensitive);
  const steadyWeights = buildAmbientResidentEmoteWeights(patientSteady);

  assert.ok(
    outgoingWeights.happy > DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS.happy,
    "Expected sociable and curious personality to favor happy emotes.",
  );
  assert.ok(
    outgoingWeights.surprised > DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS.surprised,
    "Expected curious personality to favor surprised emotes.",
  );
  assert.ok(
    sensitiveWeights.sad > DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS.sad,
    "Expected sensitive personality to favor sad emotes.",
  );
  assert.ok(
    steadyWeights.angry < DEFAULT_AMBIENT_RESIDENT_EMOTE_WEIGHTS.angry,
    "Expected patient personality to dampen angry emotes.",
  );
}

function testSelectWeightedAmbientResidentEmoteUsesDeterministicRanges(): void {
  const weights = {
    happy: 1,
    angry: 2,
    sad: 3,
    surprised: 4,
  };

  assert.equal(selectWeightedAmbientResidentEmote(weights, 0), "happy");
  assert.equal(selectWeightedAmbientResidentEmote(weights, 0.11), "angry");
  assert.equal(selectWeightedAmbientResidentEmote(weights, 0.45), "sad");
  assert.equal(selectWeightedAmbientResidentEmote(weights, 0.95), "surprised");
}

function testSelectWeightedAmbientResidentEmoteFallsBackFromInvalidWeights(): void {
  const weights = {
    happy: -1,
    angry: Number.NaN,
    sad: Number.NEGATIVE_INFINITY,
    surprised: -5,
  };

  assert.equal(selectWeightedAmbientResidentEmote(weights, 0), "happy");
}

function testGetNextAmbientEmoteResidentIndexWalksResidentsInOrder(): void {
  assert.equal(getNextAmbientEmoteResidentIndex(null, 4), 0);
  assert.equal(getNextAmbientEmoteResidentIndex(0, 4), 1);
  assert.equal(getNextAmbientEmoteResidentIndex(2, 4), 3);
  assert.equal(getNextAmbientEmoteResidentIndex(3, 4), 0);
  assert.equal(getNextAmbientEmoteResidentIndex(10, 0), null);
}

const tests: Array<[string, () => void]> = [
  [
    "buildAmbientResidentEmoteWeights uses base weights when personality is empty",
    testBuildAmbientResidentEmoteWeightsUsesBaseWeightsWhenPersonalityIsEmpty,
  ],
  [
    "buildAmbientResidentEmoteWeights applies personality bias",
    testBuildAmbientResidentEmoteWeightsAppliesPersonalityBias,
  ],
  [
    "selectWeightedAmbientResidentEmote uses deterministic ranges",
    testSelectWeightedAmbientResidentEmoteUsesDeterministicRanges,
  ],
  [
    "selectWeightedAmbientResidentEmote falls back from invalid weights",
    testSelectWeightedAmbientResidentEmoteFallsBackFromInvalidWeights,
  ],
  [
    "getNextAmbientEmoteResidentIndex walks residents in order",
    testGetNextAmbientEmoteResidentIndexWalksResidentsInOrder,
  ],
];

for (const [label, test] of tests) {
  test();
  console.log(`ok - ${label}`);
}
