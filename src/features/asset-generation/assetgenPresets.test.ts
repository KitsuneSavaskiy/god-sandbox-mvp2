import {
  ASSETGEN_PRESETS,
  DEFAULT_PRESET_ID,
  JOB_STATUS_LABELS,
  ORDERED_JOB_STEPS,
  labelForStatus,
  lanesForPreset,
  stepIndexForStatus,
} from "./assetgenPresets.js";

function testPresetSimpleExcludesEventStanding() {
  const lanes = lanesForPreset("simple");
  if (lanes.includes("event-standing-expressions")) {
    throw new Error(`"simple" preset must not include event-standing-expressions. Got: ${lanes.join(",")}`);
  }
  if (!lanes.includes("resident-sprite-sheet")) throw new Error("simple preset must include resident-sprite-sheet");
  if (!lanes.includes("portrait-expressions")) throw new Error("simple preset must include portrait-expressions");
  if (!lanes.includes("derived-icon")) throw new Error("simple preset must include derived-icon");
}

function testPresetFullIncludesEventStanding() {
  const lanes = lanesForPreset("full");
  if (!lanes.includes("event-standing-expressions")) {
    throw new Error(`"full" preset must include event-standing-expressions. Got: ${lanes.join(",")}`);
  }
  if (!lanes.includes("resident-sprite-sheet")) throw new Error("full preset must include resident-sprite-sheet");
  if (!lanes.includes("portrait-expressions")) throw new Error("full preset must include portrait-expressions");
  if (!lanes.includes("derived-icon")) throw new Error("full preset must include derived-icon");
}

function testPresetExpressionsOnlyIncludesEventStanding() {
  const lanes = lanesForPreset("expressions-only");
  if (!lanes.includes("event-standing-expressions")) {
    throw new Error(`"expressions-only" must include event-standing-expressions. Got: ${lanes.join(",")}`);
  }
  if (!lanes.includes("portrait-expressions")) {
    throw new Error(`"expressions-only" must include portrait-expressions.`);
  }
  if (lanes.includes("resident-sprite-sheet")) {
    throw new Error(`"expressions-only" must not include resident-sprite-sheet.`);
  }
}

function testDefaultPresetIsSimple() {
  if (DEFAULT_PRESET_ID !== "simple") {
    throw new Error(`DEFAULT_PRESET_ID must be "simple". Got: ${DEFAULT_PRESET_ID}`);
  }
  const defaultLanes = lanesForPreset(DEFAULT_PRESET_ID);
  if (defaultLanes.includes("event-standing-expressions")) {
    throw new Error("Default preset lanes must not include event-standing-expressions");
  }
}

function testUnknownPresetFallsBackToSimple() {
  const lanes = lanesForPreset("nonexistent-preset-xyz");
  if (lanes.includes("event-standing-expressions")) {
    throw new Error("Unknown preset fallback must not include event-standing-expressions");
  }
  if (!lanes.includes("resident-sprite-sheet")) {
    throw new Error("Unknown preset fallback must use simple preset lanes");
  }
}

function testLanesForPresetReturnsNewArray() {
  const a = lanesForPreset("simple");
  const b = lanesForPreset("simple");
  a.push("injected");
  if (b.includes("injected")) throw new Error("lanesForPreset must return a new array each time");
}

function testStatusLabelsCoversRequiredStatuses() {
  const required = [
    "pending",
    "prompt-pack-ready",
    "gen2-dispatched",
    "watcher-intake-done",
    "error",
  ];
  for (const s of required) {
    if (!JOB_STATUS_LABELS[s]) {
      throw new Error(`JOB_STATUS_LABELS must define label for "${s}"`);
    }
  }
}

function testLabelForStatusReturnsJapaneseCopy() {
  const label = labelForStatus("pending");
  if (!/[぀-ゟ゠-ヿ一-鿿]/.test(label)) {
    throw new Error(`labelForStatus("pending") must return Japanese. Got: "${label}"`);
  }
}

function testLabelForStatusFallsBackToStatusString() {
  const unknown = "totally-unknown-status";
  const label = labelForStatus(unknown);
  if (label !== unknown) {
    throw new Error(`labelForStatus must fall back to status string for unknown. Got: "${label}"`);
  }
}

function testOrderedJobStepsCoversKnownStatuses() {
  const stepIds = ORDERED_JOB_STEPS.map((s) => s.id);
  if (!stepIds.includes("pending")) throw new Error("ORDERED_JOB_STEPS must include pending");
  if (!stepIds.includes("gen2-dispatched")) throw new Error("ORDERED_JOB_STEPS must include gen2-dispatched");
}

function testStepIndexForStatus() {
  const pendingIdx = stepIndexForStatus("pending");
  const dispatchedIdx = stepIndexForStatus("gen2-dispatched");
  if (pendingIdx === -1) throw new Error("stepIndexForStatus must find pending");
  if (dispatchedIdx <= pendingIdx) {
    throw new Error("gen2-dispatched must come after pending");
  }
  if (stepIndexForStatus("nonexistent") !== -1) {
    throw new Error("stepIndexForStatus must return -1 for unknown status");
  }
}

function testPresetsInternalLaneNamesNotExposedAsLabels() {
  for (const preset of ASSETGEN_PRESETS) {
    if (preset.label === preset.lanes.join(",")) {
      throw new Error(`Preset "${preset.id}" label must differ from lane names`);
    }
    const hasRawLaneName = preset.label.includes("resident-sprite-sheet")
      || preset.label.includes("portrait-expressions")
      || preset.label.includes("event-standing-expressions")
      || preset.label.includes("derived-icon");
    if (hasRawLaneName) {
      throw new Error(`Preset "${preset.id}" label must not contain raw lane names. Got: "${preset.label}"`);
    }
  }
}

const tests: [string, () => void][] = [
  ["simple preset excludes event-standing-expressions", testPresetSimpleExcludesEventStanding],
  ["full preset includes event-standing-expressions", testPresetFullIncludesEventStanding],
  ["expressions-only preset includes event-standing-expressions", testPresetExpressionsOnlyIncludesEventStanding],
  ["default preset is simple and excludes event-standing", testDefaultPresetIsSimple],
  ["unknown preset falls back to simple lanes", testUnknownPresetFallsBackToSimple],
  ["lanesForPreset returns a new array each time", testLanesForPresetReturnsNewArray],
  ["JOB_STATUS_LABELS covers required statuses", testStatusLabelsCoversRequiredStatuses],
  ["labelForStatus returns Japanese copy for known statuses", testLabelForStatusReturnsJapaneseCopy],
  ["labelForStatus falls back to status string for unknown", testLabelForStatusFallsBackToStatusString],
  ["ORDERED_JOB_STEPS covers known statuses", testOrderedJobStepsCoversKnownStatuses],
  ["stepIndexForStatus returns correct order", testStepIndexForStatus],
  ["preset labels do not expose raw lane names", testPresetsInternalLaneNamesNotExposedAsLabels],
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
console.log(`\n${tests.length}/${tests.length} preset tests passed`);
