# GodSandbox System Spec

Status: canonical managed document

Source hierarchy:

1. `docs/product/godsandbox-user-flow.md`
2. `docs/architecture/system-spec.md`
3. `docs/architecture/event-and-intervention-spec.md`
4. `docs/architecture/snapshot-passport-spec.md`
5. `docs/architecture/local-persistence-spec.md`
6. `docs/architecture/ui-state-model.md`
7. `docs/architecture/testing-strategy.md`

This document fixes the major gameplay, state, and architecture decisions for `god-sandbox-mvp2`.

## Product-wide decisions

- `activeSlots` is always a four-entry occupied array.
- `roster` is the complete owned character set.
- There is no archive, hidden, or retired character state in MVP.
- One user owns one local sandbox session.
- Login is not account authentication. It only captures the player display name used inside the game.
- The application is local-first in a strong sense: the canonical source of truth is the local world directory.
- React UI must not manipulate save files directly.
- The application uses four layers: `domain`, `application`, `ui`, and `persistence`.
- `domain` must stay React-free and be implemented as pure TypeScript modules.
- `application` owns event generation, intervention application, snapshot issuance, passport issuance, and migration orchestration.
- The canonical intervention enum is `watch | help | trial`.
- `selectedCharacter` is not a primary gameplay state. `focusedEvent` is.

## Canonical domain model

### CharacterTemplate

The template system is dynamic and field-driven so template authors can define which editable inputs exist.

```ts
type TemplateFieldType =
  | "text"
  | "textarea"
  | "number"
  | "single-select"
  | "multi-select"
  | "asset-picker";

interface CharacterTemplateFieldDefinition {
  id: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  options?: string[];
  defaultValue?: unknown;
}

interface CharacterTemplate {
  id: string;
  name: string;
  description?: string;
  editableFields: CharacterTemplateFieldDefinition[];
  defaultProfilePatch: Partial<CharacterProfile>;
  defaultStatePatch?: Partial<CharacterState>;
}
```

Rules:

- Template field names and available inputs are variable.
- Initial four-character setup and new character creation both use the same template model and editor flow.
- Characters remain re-editable after creation.

### Character

`Character` is split into `profile` and `state`.
`profile` holds descriptive, player-edited data.
`state` holds gameplay-evolving values.

```ts
type CharacterId = string;
type AssetId = string;
type SpeechStyleId = string;

interface PersonalityVector {
  kindness?: number;
  boldness?: number;
  curiosity?: number;
  patience?: number;
  sociability?: number;
  mischief?: number;
  discipline?: number;
  sensitivity?: number;
}

interface AppearanceVariant {
  id: string;
  emotion: string;
  assetId: AssetId;
}

interface CharacterAppearance {
  primaryAssetId: AssetId;
  variantAssetIds: AppearanceVariant[];
  spriteSheetAssetId?: AssetId;
  styleMetadata?: {
    artStyleId?: string;
    sourceImageKind?: "expression-sheet" | "sprite-sheet" | "portrait";
    supportsVideoLinkedUpdates?: boolean;
  };
}

interface CharacterProfile {
  displayName: string;
  gender?: string;
  age?: number;
  personality: PersonalityVector;
  speechStyleId?: SpeechStyleId;
  appearance: CharacterAppearance;
  templateFieldValues: Record<string, unknown>;
}

interface CharacterStatusBlock {
  vitality: number;
  empathy: number;
  insight: number;
  courage: number;
  stress: number;
  trustfulness: number;
  ambition: number;
  harmony: number;
  [key: string]: number;
}

interface CharacterState {
  status: CharacterStatusBlock;
  narrativeRole?: string;
  ongoingEffectIds: string[];
  recentEventIds: string[];
}

interface Character {
  id: CharacterId;
  templateId?: string;
  profile: CharacterProfile;
  state: CharacterState;
  createdAt: string;
  updatedAt: string;
}
```

Rules:

- `traits` does not exist in the MVP model.
- Numerical status values are the primary mutable gameplay stats.
- Image selection is required.
- Personality, speech style, and age are optional inputs.
- Appearance is not just a single image reference. The canonical appearance model supports:
  - a primary asset ID
  - expression variants
  - generated sprite sheet references
  - style metadata for future animation and video-linked updates
- Asset IDs are the canonical reference. Filenames are secondary.

### Relation table

Relations are stored independently from characters.

```ts
type RelationId = string;

interface CharacterRelation {
  id: RelationId;
  characterAId: CharacterId;
  characterBId: CharacterId;
  score: number;
  derivedFromEventIds: string[];
  lastRecomputedAt: string;
}
```

Rules:

- Relations are bidirectional.
- Relation values use a single score.
- Relation changes are recomputed from event and intervention history, while current scores are also materialized for fast reads.

### SandboxSession

```ts
type SessionId = "default";

interface SandboxSession {
  id: SessionId;
  playerDisplayName: string;
  rosterCharacterIds: CharacterId[];
  activeSlots: [CharacterId, CharacterId, CharacterId, CharacterId];
  pendingActivationCharacterIds: CharacterId[];
  currentEventId: string;
  godPoints: number;
  worldStatusTags: string[];
  saveVersion: number;
  lastAutosavedAt?: string;
}
```

Rules:

- `activeSlots` is always fully occupied.
- `activeSlots` order has no gameplay meaning.
- `pendingActivationCharacterIds` tracks newly added roster characters that are not yet placed in the active four.
- New character addition never breaks the active four requirement.
- `currentEventId` always points to exactly one current event record.
- If an event resolves, expires, or chains forward, the application must commit the next current event before the session save is considered complete.
- Session state stores only current state, not the full historical log.
- Autosave happens after event completion.

### WorldEvent

Event generation is hybrid:

- weighted by relationships, personality vectors, and world or situation tags
- sourced from event templates and structured generation rules
- optionally rendered with deterministic text templates or richer structured renderers

```ts
type EventStatus = "pending" | "active" | "resolved" | "expired" | "chained";

interface WorldEvent {
  id: string;
  templateId: string;
  status: EventStatus;
  primaryCharacterId: CharacterId;
  participantCharacterIds: CharacterId[];
  situationTags: string[];
  summary: string;
  structuredPayload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  chainedFromEventId?: string;
}
```

Rules:

- The generator is not fully random.
- `primaryCharacterId` is required in addition to `participantCharacterIds`.
- The UI presents the primary character as the lead and other participants as supporting characters.
- Events may remain unresolved or transition into expired or chained states.
- `currentEventId` always points to exactly one focused event in session state.

### OngoingEffectInstance

Some intervention results are immediate and some remain active over time.

```ts
interface OngoingEffectInstance {
  id: string;
  sourceEventId: string;
  sourceInterventionId: string;
  targetCharacterIds: CharacterId[];
  effectType: string;
  remainingTriggers?: number;
  remainingEventCount?: number;
  expiresAtEventId?: string;
  payload: Record<string, unknown>;
}
```

### InterventionRecord

```ts
type InterventionKind = "watch" | "help" | "trial";

interface InterventionRecord {
  id: string;
  eventId: string;
  type: InterventionKind;
  resourceCost: number;
  playerReason?: string;
  playerMemo?: string;
  changeSetIds: string[];
  createdAt: string;
}
```

Rules:

- A player may intervene multiple times on the same event.
- `watch` costs no god points.
- `help` and `trial` consume finite god-point resources.
- Intervention history is stored as independent records, not embedded directly into `WorldEvent`.
- Player reasoning and memo fields are first-class because they influence preferred story direction and prompt generation.

### ChangeSet

Changes are stored as append-only difference events.

```ts
type ChangeSetKind =
  | "status-delta"
  | "personality-delta"
  | "relation-delta"
  | "appearance-update"
  | "speech-style-update"
  | "narrative-role-update"
  | "ongoing-effect-created";

interface ChangeSet {
  id: string;
  eventId: string;
  interventionId?: string;
  targetCharacterId: CharacterId;
  kind: ChangeSetKind;
  patch: Record<string, unknown>;
  postApplySnapshot: {
    status?: CharacterStatusBlock;
    profilePatch?: Partial<CharacterProfile>;
    narrativeRole?: string;
  };
  originDescription?: string;
  createdAt: string;
}
```

Rules:

- `ChangeSet` is type-safe and classified by kind.
- The system stores both the delta and a post-apply snapshot.
- Appearance changes may record:
  - updated asset IDs
  - linked sprite sheet regeneration
  - origin event references
  - optional video-generation linkage metadata
- Narrative role change is free text.

### Snapshot

Snapshots are fixed captures that remain reproducible later.
Annotation metadata may be added after capture.

```ts
interface CharacterSnapshot {
  id: string;
  characterId: CharacterId;
  createdAt: string;
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

Rules:

- Snapshot content is the fixed record of that moment.
- Tags and notes may be added later as annotations.
- Snapshot data must contain enough context for downstream role-playing in external tools.
- The snapshot must include:
  - character state
  - relevant relations
  - recent event context
  - world-context references
- Snapshots are reproducible and may be regenerated later from the same world state when needed.
- Snapshot identity and provenance should remain stable enough to support future external-game import flows.

### Passport

Passport is a versioned export and display document derived from a snapshot.
It is stable as a GodSandbox file format, but it is not a live remote API contract for external games.

```ts
interface CharacterPassport {
  id: string;
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
  fileNameToken: string;
  display: Record<string, unknown>;
  exportHints?: {
    referencedCharacterFileId: CharacterId;
    referencedAssetIds: AssetId[];
  };
}
```

Rules:

- Passport issuance is explicit user action.
- Users may export a passport at any time from an eligible snapshot.
- Passport is usually single-character based.
- Four-character squad passport support may be added later.
- External games are free to interpret the saved passport loosely.
- File naming must include a stable string derived from the passport so external tools can match files reliably.

## Character lifecycle rules

- The same UI and application flow is used for:
  - initial four-character setup
  - adding a new character later
  - editing an existing character
- Initial four characters may stay partially defaulted.
- Image selection is mandatory before a character can be saved.
- After a character is added to `roster`, it does not need to replace an active character immediately.
- The second tutorial for new character addition is mandatory only the first time that route is used.

## Event generation and content rendering

- Event generation is template-driven and context-weighted, not purely random and not purely free-form.
- Deterministic text rendering is used where stability matters.
- Richer narrative wording may be produced in parallel by player-operated external Codex or similar tooling.
- The app itself does not call external AI APIs.
- In-app data generation stops at:
  - prompt generation
  - export file generation
  - deterministic structured content rendering

## External AI and prompt/export policy

- External AI remains app-external support only.
- API-key-based direct integration is out of scope.
- Character speech style data lives in the character data files.
- World context lives in world or chunk files.
- Prompt packs and export data should assume those files are read together, rather than flattening every detail into one giant document.
