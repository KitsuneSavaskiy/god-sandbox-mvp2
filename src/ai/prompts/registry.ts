export type PromptId = "ryo_reaction";

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
};

export function getPromptEntry(id: PromptId): PromptRegistryEntry {
  return PROMPT_REGISTRY[id];
}
