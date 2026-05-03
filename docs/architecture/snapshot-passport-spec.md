# Snapshot And Passport Spec

Status: canonical managed document

This document fixes how character snapshots and passports are captured, annotated, regenerated, and exported.

## Core policy

- Snapshot capture and passport export are separate steps.
- Snapshot is the fixed in-world capture.
- Passport is the derived display or export artifact built from a snapshot.
- Passport is a stable GodSandbox file format, not a rigid live contract for every external game.

## Snapshot rules

- A snapshot is captured for one character at a chosen moment.
- The captured moment is fixed.
- Tags and memo annotations may be added later without changing the captured source payload.
- The system must be able to regenerate the snapshot payload later from canonical world data when needed.

Recommended snapshot shape:

```ts
interface CharacterSnapshot {
  id: string;
  characterId: string;
  createdAt: string;
  sourceWorldId: string;
  sourceSessionId: string;
  sourceEventId?: string;
  character: Character;
  relations: CharacterRelation[];
  recentEvents: Pick<WorldEvent, "id" | "summary" | "status" | "createdAt">[];
  worldContextRefs: string[];
  annotations: {
    tags: string[];
    memo?: string;
    updatedAt?: string;
  };
}
```

## Snapshot content minimum

Snapshots must carry enough context for downstream role-play or prompt-driven external use.

Minimum content:

- character profile
- current character state
- recent relation context
- recent event context
- world-context references
- asset references by canonical ID
- speech-style reference

Rules:

- Character speech style should resolve from character-side data files.
- World context should resolve from world or chunk files.
- Prompt builders and export tools may read both sources together instead of flattening everything into one record.

## Snapshot regeneration and future import compatibility

- Snapshot regeneration is allowed and expected.
- Regeneration must preserve snapshot identity or record traceable provenance to the original capture.
- The format should remain friendly to future import of externally evolved character state.
- MVP does not need full round-trip import yet, but IDs and provenance fields must not block it.

## Passport rules

- Passport issuance happens only on explicit user action.
- The user may export from any eligible snapshot at any time.
- Single-character passports are the primary MVP case.
- Squad-level passports may be added later without invalidating the single-character model.

Recommended passport shape:

```ts
interface CharacterPassport {
  id: string;
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
  fileNameToken: string;
  display: Record<string, unknown>;
  exportHints: {
    referencedCharacterFileId: string;
    referencedAssetIds: string[];
    sourceWorldId: string;
  };
}
```

## Passport file naming

- Passport filenames must remain human-readable.
- Passport filenames must also include a stable token that downstream tools can match reliably.
- Filenames are not the canonical identifier by themselves.

Recommended pattern:

```text
<character-slug>--<passport-file-token>.json
```

## External use policy

- External games are free to interpret a passport loosely.
- GodSandbox does not promise one strict runtime schema for every external consumer.
- The passport is stable enough for file-based exchange and prompt-driven role-play workflows.
- Asset matching should rely on canonical IDs carried in the passport, not only display filenames.

## Annotation and export boundary

- Later snapshot annotations do not rewrite the original capture payload.
- A newly exported passport may include the latest annotations that belong to that snapshot.
- Export tools must clearly distinguish:
  - fixed capture data
  - later user annotations
  - derived display formatting
