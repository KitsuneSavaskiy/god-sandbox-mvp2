export type HistoryChunkType = "events" | "interventions" | "changes";

export type WorldDirectoryLayout = {
  root: string;
  worldFile: string;
  sessionCurrentFile: string;
  charactersDir: string;
  templatesDir: string;
  relationsDir: string;
  currentEventsDir: string;
  historyChunkDir: (type: HistoryChunkType, yearMonth: string) => string;
  historyChunkFile: (type: HistoryChunkType, yearMonth: string, chunkIndex: number) => string;
  effectsDir: string;
  snapshotsDir: (characterId: string) => string;
  passportsDir: (characterId: string) => string;
  worldContextChunksDir: string;
  assetManifestFile: string;
};

export function createWorldDirectoryLayout(worldDirectoryName: string): WorldDirectoryLayout {
  const root = `worlds/${worldDirectoryName}`;
  const historyDirectory = (type: HistoryChunkType, yearMonth: string): string => {
    if (type === "events") {
      return `${root}/events/history/${yearMonth}`;
    }

    return `${root}/${type}/${yearMonth}`;
  };

  return {
    root,
    worldFile: `${root}/world.json`,
    sessionCurrentFile: `${root}/session/current.json`,
    charactersDir: `${root}/characters`,
    templatesDir: `${root}/templates`,
    relationsDir: `${root}/relations`,
    currentEventsDir: `${root}/events/current`,
    historyChunkDir: historyDirectory,
    historyChunkFile: (type, yearMonth, chunkIndex) =>
      `${historyDirectory(type, yearMonth)}/chunk-${String(chunkIndex).padStart(4, "0")}.json`,
    effectsDir: `${root}/effects`,
    snapshotsDir: (characterId) => `${root}/snapshots/${characterId}`,
    passportsDir: (characterId) => `${root}/passports/characters/${characterId}`,
    worldContextChunksDir: `${root}/world-context/chunks`,
    assetManifestFile: `${root}/assets/manifest.json`,
  };
}

export type HistoryChunk<T> = {
  chunkId: string;
  chunkType: HistoryChunkType;
  worldId: string;
  createdAt: string;
  updatedAt: string;
  items: T[];
};

export function createHistoryChunk<T>(input: HistoryChunk<T>): HistoryChunk<T> {
  return {
    ...input,
    items: [...input.items],
  };
}
