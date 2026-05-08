import { cloneCharacter } from "./character.js";
import { generatePassportDisplay } from "./passport.js";
import type {
  Character,
  CharacterPassport,
  CharacterRelation,
  CharacterSnapshot,
  WorldEvent,
} from "./models.js";

export type IssueCharacterSnapshotInput = {
  id: string;
  character: Character;
  relations: CharacterRelation[];
  recentEvents: WorldEvent[];
  sourceWorldId: string;
  sourceSessionId: "default";
  sourceEventId?: string;
  worldContextRefs: string[];
  now: string;
  annotationTags?: string[];
  memo?: string;
};

export function issueCharacterSnapshot(
  input: IssueCharacterSnapshotInput,
): CharacterSnapshot {
  return {
    id: input.id,
    characterId: input.character.id,
    createdAt: input.now,
    sourceWorldId: input.sourceWorldId,
    sourceSessionId: input.sourceSessionId,
    sourceEventId: input.sourceEventId,
    character: cloneCharacter(input.character),
    relations: structuredClone(input.relations) as CharacterRelation[],
    recentEvents: input.recentEvents.map((event) => ({
      id: event.id,
      summary: event.summary,
      status: event.status,
      createdAt: event.createdAt,
    })),
    worldContextRefs: [...input.worldContextRefs],
    annotations: {
      tags: input.annotationTags ?? [],
      memo: input.memo,
      updatedAt: input.memo || input.annotationTags?.length ? input.now : undefined,
    },
  };
}

export type IssueCharacterPassportInput = {
  id: string;
  snapshot: CharacterSnapshot;
  schemaVersion: number;
  fileNameToken: string;
  now: string;
};

export function issueCharacterPassport(
  input: IssueCharacterPassportInput,
): CharacterPassport {
  const character = input.snapshot.character;
  const referencedAssetIds = collectReferencedAssetIds(character);

  return {
    id: input.id,
    snapshotId: input.snapshot.id,
    schemaVersion: input.schemaVersion,
    createdAt: input.now,
    fileNameToken: input.fileNameToken,
    display: generatePassportDisplay(input.snapshot),
    exportHints: {
      referencedCharacterFileId: character.id,
      referencedAssetIds,
      sourceWorldId: input.snapshot.sourceWorldId,
    },
  };
}

function collectReferencedAssetIds(character: Character): string[] {
  const assetIds = new Set<string>([
    character.profile.appearance.primaryAssetId,
    ...character.profile.appearance.variantAssetIds.map((variant) => variant.assetId),
  ]);

  if (character.profile.appearance.spriteSheetAssetId) {
    assetIds.add(character.profile.appearance.spriteSheetAssetId);
  }

  const bundle = character.profile.appearance.assetBundle;
  if (bundle) {
    assetIds.add(bundle.portraitAssetId);
    if (bundle.iconAssetId) {
      assetIds.add(bundle.iconAssetId);
    }
    if (bundle.spriteSheetAssetId) {
      assetIds.add(bundle.spriteSheetAssetId);
    }
    for (const assetId of Object.values(bundle.expressions)) {
      if (assetId) {
        assetIds.add(assetId);
      }
    }
  }

  return [...assetIds];
}
