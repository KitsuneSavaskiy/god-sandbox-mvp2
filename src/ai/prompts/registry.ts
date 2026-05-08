export type PromptId = "ryo_reaction" | "world_observation" | "divine_event";

export type PromptVersion = "v1";

export type PromptRegistryEntry = {
  id: PromptId;
  version: PromptVersion;
  purpose: string;
  outputSchemaId: string;
  maxOutputCharsJa: number;
};

export const PROMPT_REGISTRY: Record<PromptId, PromptRegistryEntry> = {
  ryo_reaction: {
    id: "ryo_reaction",
    version: "v1",
    purpose: "神の介入に対するリョウの短文リアクション生成",
    outputSchemaId: "ryo_reaction_output_v1",
    maxOutputCharsJa: 42,
  },
  world_observation: {
    id: "world_observation",
    version: "v1",
    purpose: "箱庭世界の状況観察ナレーション生成",
    outputSchemaId: "world_observation_output_v1",
    maxOutputCharsJa: 80,
  },
  divine_event: {
    id: "divine_event",
    version: "v1",
    purpose: "神の行為に対する世界の応答テキスト生成",
    outputSchemaId: "divine_event_output_v1",
    maxOutputCharsJa: 60,
  },
};

export function getPromptEntry(id: PromptId): PromptRegistryEntry {
  return PROMPT_REGISTRY[id];
}
