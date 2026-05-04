import { DEFAULT_CHARACTER_STATUS } from "../../domain/character.js";
import type {
  Character,
  CharacterId,
  CharacterTemplate,
  PersonalityVector,
} from "../../domain/models.js";

export type CharacterDraft = {
  id?: CharacterId;
  displayName: string;
  imageAssetId: string;
  personalityNote: string;
  speechStyleId: string;
  age: string;
};

export type CharacterDraftValidation = {
  valid: boolean;
  messages: string[];
};

export function createEmptyCharacterDraft(template: CharacterTemplate): CharacterDraft {
  const fieldValues = createDefaultFieldValues(template);

  return {
    displayName: "",
    imageAssetId: fieldValues.imageAssetId ?? "",
    personalityNote: fieldValues.personalityNote ?? "",
    speechStyleId: fieldValues.speechStyleId ?? "",
    age: fieldValues.age ?? "",
  };
}

export function createCharacterDraftFromCharacter(
  character: Character,
  template: CharacterTemplate,
): CharacterDraft {
  const fieldValues = createDefaultFieldValues(template);
  const savedValues = character.profile.templateFieldValues;

  return {
    id: character.id,
    displayName: character.profile.displayName,
    imageAssetId: character.profile.appearance.primaryAssetId,
    personalityNote: asString(savedValues.personalityNote ?? fieldValues.personalityNote),
    speechStyleId: character.profile.speechStyleId ?? asString(savedValues.speechStyleId ?? fieldValues.speechStyleId),
    age: character.profile.age === undefined ? asString(savedValues.age ?? fieldValues.age) : String(character.profile.age),
  };
}

export function validateCharacterDraft(draft: CharacterDraft): CharacterDraftValidation {
  const messages: string[] = [];

  if (!draft.displayName.trim()) {
    messages.push("名前は必須です。");
  }

  if (!draft.imageAssetId.trim()) {
    messages.push("見た目画像は必須です。");
  }

  if (draft.age.trim()) {
    const parsedAge = Number(draft.age);
    if (!Number.isFinite(parsedAge) || parsedAge < 0) {
      messages.push("年齢は0以上の数値で入力してください。");
    }
  }

  return {
    valid: messages.length === 0,
    messages,
  };
}

export function createCharacterFromDraft(
  draft: CharacterDraft,
  template: CharacterTemplate,
  id: CharacterId,
  now: string,
): Character {
  return applyDraftToCharacter(
    {
      id,
      templateId: template.id,
      profile: {
        displayName: draft.displayName.trim(),
        personality: createPersonalityVector(draft.personalityNote),
        speechStyleId: optionalText(draft.speechStyleId),
        age: optionalNumber(draft.age),
        appearance: {
          primaryAssetId: draft.imageAssetId.trim(),
          variantAssetIds: [],
        },
        templateFieldValues: {},
      },
      state: {
        status: { ...DEFAULT_CHARACTER_STATUS },
        ongoingEffectIds: [],
        recentEventIds: [],
      },
      createdAt: now,
      updatedAt: now,
    },
    draft,
    template,
    now,
  );
}

export function applyDraftToCharacter(
  character: Character,
  draft: CharacterDraft,
  template: CharacterTemplate,
  now: string,
): Character {
  return {
    ...character,
    templateId: template.id,
    profile: {
      ...character.profile,
      displayName: draft.displayName.trim(),
      personality: createPersonalityVector(draft.personalityNote),
      speechStyleId: optionalText(draft.speechStyleId),
      age: optionalNumber(draft.age),
      appearance: {
        ...character.profile.appearance,
        primaryAssetId: draft.imageAssetId.trim(),
      },
      templateFieldValues: {
        ...character.profile.templateFieldValues,
        imageAssetId: draft.imageAssetId.trim(),
        personalityNote: draft.personalityNote.trim(),
        speechStyleId: draft.speechStyleId.trim(),
        age: optionalNumber(draft.age) ?? "",
      },
    },
    updatedAt: now,
  };
}

function createDefaultFieldValues(template: CharacterTemplate): Record<string, string> {
  return Object.fromEntries(
    template.editableFields.map((field) => [field.id, asString(field.defaultValue)]),
  );
}

function createPersonalityVector(personalityNote: string): PersonalityVector {
  if (!personalityNote.trim()) {
    return {};
  }

  return {
    curiosity: 55,
    sensitivity: 55,
  };
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}
