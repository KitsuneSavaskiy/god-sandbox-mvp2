import type {
  ChangeSet,
  Character,
  CharacterPassport,
  CharacterRelation,
  CharacterSnapshot,
  InterventionRecord,
  SandboxSession,
  WorldEvent,
} from "../domain/models.js";
import type { AssetManifest } from "./assetManifest.js";
import type { HistoryChunk } from "./layout.js";

export type WorldMetaFile = {
  worldId: string;
  worldName: string;
  playerDisplayName: string;
  saveVersion: number;
  createdAt: string;
  updatedAt: string;
  currentSessionPath: string;
  activeCharacterIds: [string, string, string, string];
};

export type WorldPersistencePort = {
  readWorldMeta: () => Promise<WorldMetaFile>;
  writeWorldMeta: (world: WorldMetaFile) => Promise<void>;
  readCurrentSession: () => Promise<SandboxSession>;
  writeCurrentSession: (session: SandboxSession) => Promise<void>;
  readCharacter: (characterId: string) => Promise<Character>;
  writeCharacter: (character: Character) => Promise<void>;
  readRelations: () => Promise<CharacterRelation[]>;
  writeRelation: (relation: CharacterRelation) => Promise<void>;
  appendEventChunk: (chunk: HistoryChunk<WorldEvent>) => Promise<void>;
  writeCurrentEvent: (event: WorldEvent) => Promise<void>;
  appendInterventionChunk: (chunk: HistoryChunk<InterventionRecord>) => Promise<void>;
  appendChangeChunk: (chunk: HistoryChunk<ChangeSet>) => Promise<void>;
  writeSnapshot: (snapshot: CharacterSnapshot) => Promise<void>;
  writePassport: (passport: CharacterPassport) => Promise<void>;
  readAssetManifest: () => Promise<AssetManifest>;
  writeAssetManifest: (manifest: AssetManifest) => Promise<void>;
};
