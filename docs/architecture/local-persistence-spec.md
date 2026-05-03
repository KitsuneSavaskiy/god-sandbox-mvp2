# Local Persistence Spec

Status: canonical managed document

This document defines how `god-sandbox-mvp2` stores its authoritative data on the local filesystem.

## Goals

- Keep the world local and lightweight.
- Avoid a single giant JSON file.
- Keep data human-inspectable when possible.
- Make migration practical from the beginning.
- Keep React UI away from direct filesystem mutation.

## Persistence rules

- MVP uses local filesystem storage only.
- There is no DBMS.
- The world directory is the application source of truth.
- Persistence is accessed through the `persistence` layer only.
- The application layer orchestrates reads, writes, autosave, and migration.
- Autosave is guaranteed after event completion.
- Explicit save actions such as character edit confirmation, snapshot creation, and passport export may also write files immediately.

## World layout

The canonical save root is a world directory.

```text
worlds/
  <world-slug>--<world-id>/
    world.json
    session/
      current.json
    characters/
      <character-slug>--<character-id>.json
    templates/
      <template-slug>--<template-id>.json
    relations/
      <character-a-id>__<character-b-id>.json
    events/
      current/
        <event-id>.json
      history/
        2026-05/
          chunk-0001.json
          chunk-0002.json
    interventions/
      2026-05/
        chunk-0001.json
    changes/
      2026-05/
        chunk-0001.json
    effects/
      <effect-id>.json
    snapshots/
      <character-id>/
        <snapshot-id>.json
    passports/
      characters/
        <character-id>/
          <passport-file-token>.json
      squads/
    world-context/
      chunks/
        <chunk-id>.json
    assets/
      manifest.json
      characters/
        <character-id>/
          <asset-slug>--<asset-id>.png
          <asset-slug>--<asset-id>.json
```

## Why this layout

- `world.json` stores high-level metadata and versioning.
- `session/current.json` stores the current gameplay projection.
- `characters/` stores each character independently so editing one character does not rewrite the whole world.
- `relations/` stores pairwise relation records independently.
- `events/`, `interventions/`, and `changes/` are chunked by month and sequence to avoid one huge history file.
- `events/current/` isolates currently active event state from long-term history.
- `world-context/chunks/` stores world-side context that prompt builders and exports can reference without flattening everything into one document.
- `assets/manifest.json` is the canonical asset registry.

## Canonical IDs and filenames

- IDs are the canonical references.
- Filenames are human-readable helpers and must include the ID.
- The system must never depend on filename-only matching.

Recommended filename pattern:

```text
<human-readable-slug>--<stable-id>.<ext>
```

Examples:

```text
aki--chr_01JABC123.json
happy-front--ast_01JXYZ456.png
aki-passport--psp_01JPPP789.json
```

Rules:

- Save data references asset IDs, character IDs, world IDs, and passport IDs.
- The filename may include a readable name token, but the ID is the canonical key.
- Exported passport filenames must include a passport-specific stable token.

## world.json

`world.json` is the top-level metadata file.

```ts
interface WorldMetaFile {
  worldId: string;
  worldName: string;
  playerDisplayName: string;
  saveVersion: number;
  createdAt: string;
  updatedAt: string;
  currentSessionPath: string;
  activeCharacterIds: [string, string, string, string];
}
```

Rules:

- `saveVersion` is mandatory.
- `world.json` is not a dump of the whole world.
- `activeCharacterIds` is duplicated here for quick load hints, but `session/current.json` remains the detailed runtime projection.

## Session projection

`session/current.json` holds the current gameplay state only.

- It does not replace historical event, intervention, or change records.
- It is a materialized projection for fast startup and gameplay reads.
- It can be rebuilt from source records if repair or migration requires it.

## History chunk format

Chunk files are append-friendly bounded files.

Example shape:

```ts
interface HistoryChunk<T> {
  chunkId: string;
  chunkType: "events" | "interventions" | "changes";
  worldId: string;
  createdAt: string;
  updatedAt: string;
  items: T[];
}
```

Rules:

- Chunk size should stay bounded by item count and file size.
- The persistence layer may roll to a new chunk when either threshold is hit.
- Chunking is logical, not spatial terrain chunking.
- The design is inspired by Minecraft's world-file pragmatism: many bounded files instead of one monolith.

## Asset registry

`assets/manifest.json` is the authoritative registry for media assets.

```ts
interface AssetManifestEntry {
  id: string;
  ownerCharacterId?: string;
  kind: "appearance-source" | "appearance-variant" | "sprite-sheet" | "video-source";
  relativePath: string;
  contentHash?: string;
  generatedFromAssetIds?: string[];
}
```

Rules:

- Asset IDs are canonical.
- Save data and passports reference asset IDs, not naked filenames.
- Sprite sheets and future video-linked assets are registered as generated derivatives.

## Migration strategy

Migration support is mandatory from the beginning.

Rules:

- Every world has `saveVersion`.
- The application must keep a stepwise migration registry.
- Migrations run in order from the stored version to the current version.
- Each migration must be idempotent when rerun on the same version boundary.
- A backup copy or restore checkpoint should be created before destructive migration steps.

Recommended migration flow:

1. Read `world.json`.
2. Compare `saveVersion` with app-supported version.
3. If upgrade is needed, create a backup marker.
4. Run registered migrations in order.
5. Rewrite touched files through the persistence layer.
6. Update `saveVersion`.
7. Rebuild any materialized projections if necessary.

## Application boundary

- React components never open, write, rename, or delete files directly.
- UI dispatches intents to application services.
- Application services call persistence gateways.
- Persistence gateways own directory creation, file naming, chunk rollover, and atomic write strategy.
