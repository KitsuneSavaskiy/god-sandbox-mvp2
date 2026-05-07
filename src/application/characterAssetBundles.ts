import type {
  AssetId,
  Character,
  CharacterAssetBundle,
  CharacterExpressionId,
} from "../domain/models.js";
import type { RuntimeWorldState } from "../state/runtimeState.js";
import {
  DEFAULT_CHARACTER_ASSET_MANIFEST,
} from "../persistence/defaultCharacterAssetManifest.js";
import type {
  AssetManifest,
  AssetMissingReason,
  AssetReadinessStatus,
  SpriteSheetMetadata,
} from "../persistence/assetManifest.js";
import { assertRequiredSpriteSheetMotions } from "../persistence/assetManifest.js";

const expressionIds = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "surprised",
] as const satisfies readonly CharacterExpressionId[];

export const DEFAULT_CHARACTER_ASSET_READ_MODEL_MANIFEST =
  DEFAULT_CHARACTER_ASSET_MANIFEST;

export type ResolvedCharacterAssetRef = {
  assetId: AssetId | null;
  path: string | null;
  ready: boolean;
};

export type ResolvedCharacterSpriteSheetRef = ResolvedCharacterAssetRef & {
  plannedPath: string | null;
  fallbackAssetId?: AssetId;
  fallbackPath: string | null;
  status: AssetReadinessStatus;
  isPlaceholder: boolean;
  missingReason?: AssetMissingReason;
  metadata: SpriteSheetMetadata | null;
};

export type ReadModelValueSource =
  | "user-input"
  | "generated-recognition"
  | "placeholder";

export type CharacterDetailTextField = {
  value: string;
  source: ReadModelValueSource;
  isPlaceholder: boolean;
  needsUserConfirmation: boolean;
};

export type CharacterExpressionSlot = {
  key: CharacterExpressionId;
  assetId?: AssetId;
  fallbackAssetId?: AssetId;
  path: string | null;
  fallbackPath: string | null;
  isPlaceholder: boolean;
  missingReason?: AssetMissingReason;
};

export type CharacterAssetBundleReadModel = {
  characterId: string;
  displayName: string;
  portrait: ResolvedCharacterAssetRef;
  icon: ResolvedCharacterAssetRef;
  spriteSheet: ResolvedCharacterSpriteSheetRef;
  extendedSheet: ResolvedCharacterSpriteSheetRef;
  expressions: Record<CharacterExpressionId, CharacterExpressionSlot>;
  basicSettings: {
    narrativeRole: CharacterDetailTextField;
    speechStyle: CharacterDetailTextField;
    age: CharacterDetailTextField;
    introduction: CharacterDetailTextField;
  };
};

export function selectCharacterAssetBundleReadModel(
  state: RuntimeWorldState,
  characterId: string,
  manifest: AssetManifest = DEFAULT_CHARACTER_ASSET_READ_MODEL_MANIFEST,
): CharacterAssetBundleReadModel {
  const character = state.characters.get(characterId);
  if (!character) {
    throw new Error(`Character record is missing: ${characterId}`);
  }

  return resolveCharacterAssetBundleReadModel(character, manifest);
}

export function selectActiveCharacterAssetBundleReadModels(
  state: RuntimeWorldState,
  manifest: AssetManifest = DEFAULT_CHARACTER_ASSET_READ_MODEL_MANIFEST,
): CharacterAssetBundleReadModel[] {
  return state.session.activeSlots.map((characterId) =>
    selectCharacterAssetBundleReadModel(state, characterId, manifest),
  );
}

export function resolveCharacterAssetBundleReadModel(
  character: Character,
  manifest: AssetManifest = DEFAULT_CHARACTER_ASSET_READ_MODEL_MANIFEST,
): CharacterAssetBundleReadModel {
  const bundle = resolveCharacterAssetBundle(character);

  return {
    characterId: character.id,
    displayName: character.profile.displayName,
    portrait: resolveAssetRef(bundle.portraitAssetId, manifest),
    icon: resolveAssetRef(bundle.iconAssetId, manifest),
    spriteSheet: resolveSpriteSheetRef(
      bundle.spriteSheetAssetId ?? inferSpriteSheetAssetId(bundle.portraitAssetId),
      bundle.portraitAssetId,
      manifest,
    ),
    extendedSheet: resolveSpriteSheetRef(
      inferExtendedSheetAssetId(bundle.portraitAssetId),
      bundle.portraitAssetId,
      manifest,
    ),
    expressions: Object.fromEntries(
      expressionIds.map((expressionId) => [
        expressionId,
        resolveExpressionSlot(
          expressionId,
          bundle.expressions[expressionId],
          bundle.expressions.neutral ?? bundle.portraitAssetId,
          manifest,
        ),
      ]),
    ) as Record<CharacterExpressionId, CharacterExpressionSlot>,
    basicSettings: {
      narrativeRole: asSimpleTextField(character.state.narrativeRole),
      speechStyle: asSimpleTextField(character.profile.speechStyleId),
      age:
        character.profile.age === undefined
          ? asPlaceholderTextField()
          : {
              value: String(character.profile.age),
              source: "user-input",
              isPlaceholder: false,
              needsUserConfirmation: false,
            },
      introduction: resolveIntroductionField(character),
    },
  };
}

function resolveCharacterAssetBundle(character: Character): CharacterAssetBundle {
  const explicitBundle = character.profile.appearance.assetBundle;
  if (explicitBundle) {
    return {
      portraitAssetId: explicitBundle.portraitAssetId,
      iconAssetId: explicitBundle.iconAssetId ?? null,
      spriteSheetAssetId:
        explicitBundle.spriteSheetAssetId ??
        character.profile.appearance.spriteSheetAssetId ??
        null,
      expressions: {
        neutral: explicitBundle.expressions.neutral ?? explicitBundle.portraitAssetId,
        happy: explicitBundle.expressions.happy ?? null,
        angry: explicitBundle.expressions.angry ?? null,
        sad: explicitBundle.expressions.sad ?? null,
        surprised: explicitBundle.expressions.surprised ?? null,
      },
    };
  }

  const variantLookup = new Map<CharacterExpressionId, AssetId>();
  for (const variant of character.profile.appearance.variantAssetIds) {
    const normalized = normalizeExpressionId(variant.emotion);
    if (normalized) {
      variantLookup.set(normalized, variant.assetId);
    }
  }

  return {
    portraitAssetId: character.profile.appearance.primaryAssetId,
    iconAssetId: null,
    spriteSheetAssetId: character.profile.appearance.spriteSheetAssetId ?? null,
    expressions: {
      neutral: character.profile.appearance.primaryAssetId,
      happy: variantLookup.get("happy") ?? null,
      angry: variantLookup.get("angry") ?? null,
      sad: variantLookup.get("sad") ?? null,
      surprised: variantLookup.get("surprised") ?? null,
    },
  };
}

function normalizeExpressionId(value: string): CharacterExpressionId | null {
  switch (value.trim().toLowerCase()) {
    case "neutral":
      return "neutral";
    case "happy":
      return "happy";
    case "angry":
      return "angry";
    case "sad":
    case "sadness":
      return "sad";
    case "surprised":
    case "surprise":
      return "surprised";
    default:
      return null;
  }
}

function resolveAssetRef(
  assetId: AssetId | null | undefined,
  manifest: AssetManifest,
): ResolvedCharacterAssetRef {
  if (!assetId) {
    return {
      assetId: null,
      path: null,
      ready: false,
    };
  }

  const entry = manifest.entries.find((item) => item.id === assetId);
  return {
    assetId,
    path: entry?.relativePath ? `/${entry.relativePath.replace(/^\/+/, "")}` : null,
    ready: Boolean(entry?.relativePath && !entry.isPlaceholder),
  };
}

function resolveSpriteSheetRef(
  assetId: AssetId | null | undefined,
  portraitAssetId: AssetId,
  manifest: AssetManifest,
): ResolvedCharacterSpriteSheetRef {
  const fallback = resolveAssetRef(portraitAssetId, manifest);

  if (!assetId) {
    return {
      assetId: null,
      path: null,
      plannedPath: null,
      ready: false,
      fallbackAssetId: fallback.assetId ?? undefined,
      fallbackPath: fallback.path,
      status: "placeholder",
      isPlaceholder: true,
      missingReason: "not-generated-yet",
      metadata: null,
    };
  }

  const entry = manifest.entries.find((item) => item.id === assetId);
  if (!entry) {
    return {
      assetId,
      path: null,
      plannedPath: null,
      ready: false,
      fallbackAssetId: fallback.assetId ?? undefined,
      fallbackPath: fallback.path,
      status: "missing",
      isPlaceholder: true,
      missingReason: "asset-not-registered",
      metadata: null,
    };
  }

  const path = entry.relativePath ? `/${entry.relativePath.replace(/^\/+/, "")}` : null;
  const plannedPath = entry.plannedRelativePath
    ? `/${entry.plannedRelativePath.replace(/^\/+/, "")}`
    : null;
  const isPlaceholder = Boolean(entry.isPlaceholder || !entry.relativePath);
  let metadata: SpriteSheetMetadata | null = null;

  try {
    metadata = entry.spriteSheet
      ? assertRequiredSpriteSheetMotions(entry.spriteSheet, assetId)
      : null;
  } catch {
    return {
      assetId,
      path: null,
      plannedPath,
      ready: false,
      fallbackAssetId: entry.fallbackAssetId ?? fallback.assetId ?? undefined,
      fallbackPath: fallback.path,
      status: "rejected",
      isPlaceholder: true,
      missingReason: "invalid-metadata",
      metadata: null,
    };
  }

  return {
    assetId,
    path,
    plannedPath,
    ready: Boolean(path && !entry.isPlaceholder),
    fallbackAssetId: entry.fallbackAssetId ?? fallback.assetId ?? undefined,
    fallbackPath: fallback.path,
    status: entry.status ?? (isPlaceholder ? "placeholder" : "ready"),
    isPlaceholder,
    missingReason: isPlaceholder
      ? entry.missingReason ?? "not-generated-yet"
      : undefined,
    metadata,
  };
}

export function isCharacterAnimationReady(
  readModel: Pick<CharacterAssetBundleReadModel, "spriteSheet" | "extendedSheet">,
): boolean {
  return readModel.spriteSheet.ready && readModel.extendedSheet.ready;
}

function resolveExpressionSlot(
  key: CharacterExpressionId,
  assetId: AssetId | null | undefined,
  neutralAssetId: AssetId,
  manifest: AssetManifest,
): CharacterExpressionSlot {
  const inferredAssetId =
    key === "neutral" ? neutralAssetId : inferExpressionAssetId(neutralAssetId, key);
  const candidateAssetId = assetId ?? inferredAssetId;
  const resolved = resolveAssetRef(candidateAssetId, manifest);
  const neutral = resolveAssetRef(neutralAssetId, manifest);

  if (key === "neutral") {
    return {
      key,
      assetId: neutral.assetId ?? undefined,
      path: neutral.path,
      fallbackAssetId: neutral.assetId ?? undefined,
      fallbackPath: neutral.path,
      isPlaceholder: false,
    };
  }

  if (resolved.ready && resolved.assetId) {
    return {
      key,
      assetId: resolved.assetId,
      path: resolved.path,
      fallbackAssetId: neutral.assetId ?? undefined,
      fallbackPath: neutral.path,
      isPlaceholder: false,
    };
  }

  return {
    key,
    assetId: candidateAssetId ?? undefined,
    path: resolved.path,
    fallbackAssetId: neutral.assetId ?? undefined,
    fallbackPath: neutral.path,
    isPlaceholder: true,
    missingReason: assetId ? "asset-not-registered" : "not-generated-yet",
  };
}

function inferExpressionAssetId(
  neutralAssetId: AssetId,
  key: Exclude<CharacterExpressionId, "neutral">,
): AssetId | null {
  const bundleId = neutralAssetId.replace(/-portrait-neutral$/, "");
  if (!bundleId || bundleId === neutralAssetId) {
    return null;
  }

  return `${bundleId}-expression-${key}`;
}

function inferSpriteSheetAssetId(neutralAssetId: AssetId): AssetId | null {
  const bundleId = neutralAssetId.replace(/-portrait-neutral$/, "");
  if (!bundleId || bundleId === neutralAssetId) {
    return null;
  }

  return `${bundleId}-sprite-sheet`;
}

function inferExtendedSheetAssetId(neutralAssetId: AssetId): AssetId | null {
  const bundleId = neutralAssetId.replace(/-portrait-neutral$/, "");
  if (!bundleId || bundleId === neutralAssetId) {
    return null;
  }

  return `${bundleId}-sprite-sheet-extended`;
}

function resolveIntroductionField(character: Character): CharacterDetailTextField {
  const rawValue = character.profile.templateFieldValues.description;
  const rawSource = character.profile.templateFieldValues.descriptionSource;

  if (typeof rawValue !== "string" || !rawValue.trim() || rawValue.trim() === "placeholder") {
    return asPlaceholderTextField();
  }

  if (rawSource === "generated-recognition") {
    return {
      value: rawValue.trim(),
      source: "generated-recognition",
      isPlaceholder: false,
      needsUserConfirmation: true,
    };
  }

  return {
    value: rawValue.trim(),
    source: "user-input",
    isPlaceholder: false,
    needsUserConfirmation: false,
  };
}

function asSimpleTextField(value: unknown): CharacterDetailTextField {
  if (typeof value === "string" && value.trim()) {
    return {
      value: value.trim(),
      source: "user-input",
      isPlaceholder: false,
      needsUserConfirmation: false,
    };
  }

  return asPlaceholderTextField();
}

function asPlaceholderTextField(): CharacterDetailTextField {
  return {
    value: "placeholder",
    source: "placeholder",
    isPlaceholder: true,
    needsUserConfirmation: false,
  };
}
