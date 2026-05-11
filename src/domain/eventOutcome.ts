import { stableHash } from "./events.js";
import type {
  Character,
  EventJudgement,
  EventOutcomeKind,
  EventOutcomeRecord,
  InterventionKind,
  InterventionRecord,
  WorldEvent,
} from "./models.js";

// Threshold overrides for specific templates. Default is 11.
const TEMPLATE_THRESHOLDS: Partial<Record<string, number>> = {
  "legendary-big-fish": 13,
};

export function resolveTemplateThreshold(templateId: string): number {
  return TEMPLATE_THRESHOLDS[templateId] ?? 11;
}

export function rollD20(seed: string): number {
  return 1 + (stableHash(seed) % 20);
}

function resolveModifier(interventionType: InterventionKind, character: Character): number {
  const status = character.state.status;
  let modifier = 0;

  if (interventionType === "watch" && status.insight >= 60) {
    modifier += 2;
  }
  if (interventionType === "help" && (status.empathy >= 60 || status.harmony >= 60)) {
    modifier += 1;
  }
  if (interventionType === "trial" && status.courage >= 60) {
    modifier += 2;
  }
  if (status.stress >= 70) {
    modifier -= 1;
  }

  return modifier;
}

export function resolveEventJudgement(input: {
  seed: string;
  eventId: string;
  interventionType: InterventionKind;
  character: Character;
  threshold?: number;
}): EventJudgement {
  const roll = rollD20(`${input.seed}:${input.eventId}:${input.interventionType}`);
  const modifier = resolveModifier(input.interventionType, input.character);
  const total = roll + modifier;
  const threshold = input.threshold ?? 11;
  const outcome: EventOutcomeKind = total >= threshold ? "success" : "failure";

  return {
    formula: "1d20 + modifier",
    roll,
    modifier,
    total,
    threshold,
    outcome,
  };
}

const OUTCOME_SUMMARIES: Record<string, { success: string; failure: string }> = {
  "moving-stone": {
    success: "石が動く前の気配に気づいた。",
    failure: "石はまた別の場所に移っていた。",
  },
  "shrine-prayer-wish": {
    success: "願いを言葉にできた。",
    failure: "願いはまとまらなかったが、気持ちは残った。",
  },
  "strange-grass-found": {
    success: "草の扱い方が分かった。",
    failure: "草の匂いで少しふらついた。",
  },
  "shared-nap-place": {
    success: "2人は穏やかに同じ時間を過ごした。",
    failure: "片方が先に起きて、少し気まずくなった。",
  },
  "mysterious-footprints": {
    success: "足あとがどこへ向かうか分かった。",
    failure: "足あとは途中で消えていた。",
  },
  "legendary-big-fish": {
    success: "大きな魚の姿をはっきり見た。",
    failure: "水面が揺れ、魚影は消えた。",
  },
  "shrine-fox-offering": {
    success: "祠の気配が少し濃くなった。",
    failure: "油揚げはいつのまにか消えていた。",
  },
};

const GENERIC_OUTCOME_SUMMARY = {
  success: "介入が功を奏した。",
  failure: "介入は届かなかった。",
};

export function resolveEventOutcome(input: {
  event: WorldEvent;
  intervention: InterventionRecord;
  primaryCharacter: Character;
  seed: string;
}): EventOutcomeRecord {
  const threshold = resolveTemplateThreshold(input.event.templateId);

  const judgement = resolveEventJudgement({
    seed: input.seed,
    eventId: input.event.id,
    interventionType: input.intervention.type,
    character: input.primaryCharacter,
    threshold,
  });

  const summaries = OUTCOME_SUMMARIES[input.event.templateId] ?? GENERIC_OUTCOME_SUMMARY;
  const summary = summaries[judgement.outcome];

  const appliedEffectLabels: string[] = [judgement.outcome];

  if (input.event.templateId === "shrine-fox-offering") {
    appliedEffectLabels.push(
      judgement.outcome === "success" ? "offeringCollected" : "offeringNotCollected",
    );
  }

  return {
    eventId: input.event.id,
    interventionId: input.intervention.id,
    templateId: input.event.templateId,
    outcome: judgement.outcome,
    judgement,
    summary,
    appliedEffectLabels,
  };
}

export function resolveFaithTriggerByOutcome(
  interventionType: InterventionKind,
  outcome: EventOutcomeKind,
) {
  if (outcome === "success") {
    return (`${interventionType}_success`) as `${InterventionKind}_success`;
  }
  return (`${interventionType}_failure`) as `${InterventionKind}_failure`;
}
