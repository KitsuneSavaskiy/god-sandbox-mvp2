export type CharacterId = string;
export type AssetId = string;
export type SpeechStyleId = string;
export type RelationId = string;
export type SessionId = "default";
export type InterventionKind = "watch" | "help" | "trial";
export type EventStatus = "pending" | "active" | "resolved" | "expired" | "chained";

export type TemplateFieldType =
  | "text"
  | "textarea"
  | "number"
  | "single-select"
  | "multi-select"
  | "asset-picker";

export type CharacterTemplateFieldDefinition = {
  id: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  options?: string[];
  defaultValue?: unknown;
};

export type PersonalityVector = {
  kindness?: number;
  boldness?: number;
  curiosity?: number;
  patience?: number;
  sociability?: number;
  mischief?: number;
  discipline?: number;
  sensitivity?: number;
};

export type AppearanceVariant = {
  id: string;
  emotion: string;
  assetId: AssetId;
};

export type CharacterExpressionId =
  | "neutral"
  | "happy"
  | "angry"
  | "sad"
  | "surprised";

export type CharacterExpressionAssetRefs = Record<CharacterExpressionId, AssetId | null>;

export type CharacterAssetBundle = {
  portraitAssetId: AssetId;
  iconAssetId: AssetId | null;
  spriteSheetAssetId: AssetId | null;
  expressions: CharacterExpressionAssetRefs;
};

export type CharacterAppearance = {
  primaryAssetId: AssetId;
  variantAssetIds: AppearanceVariant[];
  spriteSheetAssetId?: AssetId;
  assetBundle?: CharacterAssetBundle;
  styleMetadata?: {
    artStyleId?: string;
    sourceImageKind?: "expression-sheet" | "sprite-sheet" | "portrait";
    supportsVideoLinkedUpdates?: boolean;
  };
};

export type CharacterProfile = {
  displayName: string;
  gender?: string;
  age?: number;
  personality: PersonalityVector;
  speechStyleId?: SpeechStyleId;
  appearance: CharacterAppearance;
  templateFieldValues: Record<string, unknown>;
};

export type CharacterStatusBlock = {
  vitality: number;
  empathy: number;
  insight: number;
  courage: number;
  stress: number;
  trustfulness: number;
  ambition: number;
  harmony: number;
  faith: number;
  [key: string]: number;
};

export type FaithBand =
  | "disbelieves"
  | "uncertain"
  | "senses_presence"
  | "believes"
  | "devoted";

export type CharacterState = {
  status: CharacterStatusBlock;
  narrativeRole?: string;
  ongoingEffectIds: string[];
  recentEventIds: string[];
};

export type Character = {
  id: CharacterId;
  templateId?: string;
  profile: CharacterProfile;
  state: CharacterState;
  createdAt: string;
  updatedAt: string;
};

export type CharacterTemplate = {
  id: string;
  name: string;
  description?: string;
  editableFields: CharacterTemplateFieldDefinition[];
  defaultProfilePatch: Partial<CharacterProfile>;
  defaultStatePatch?: Partial<CharacterState>;
};

export type CharacterRelation = {
  id: RelationId;
  characterAId: CharacterId;
  characterBId: CharacterId;
  score: number;
  derivedFromEventIds: string[];
  lastRecomputedAt: string;
};

export type SandboxSession = {
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
};

export type WorldEvent = {
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
};

export type OngoingEffectInstance = {
  id: string;
  sourceEventId: string;
  sourceInterventionId: string;
  targetCharacterIds: CharacterId[];
  effectType: string;
  remainingTriggers?: number;
  remainingEventCount?: number;
  expiresAtEventId?: string;
  payload: Record<string, unknown>;
};

export type InterventionRecord = {
  id: string;
  eventId: string;
  type: InterventionKind;
  resourceCost: number;
  godPointsBeforeApply: number;
  godPointsAfterApply: number;
  playerReason?: string;
  playerMemo?: string;
  changeSetIds: string[];
  createdAt: string;
};

export type ChangeSetKind =
  | "status-delta"
  | "personality-delta"
  | "relation-delta"
  | "appearance-update"
  | "speech-style-update"
  | "narrative-role-update"
  | "ongoing-effect-created";

export type ChangeSet = {
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
};

export type CharacterSnapshot = {
  id: string;
  characterId: CharacterId;
  createdAt: string;
  sourceWorldId: string;
  sourceSessionId: SessionId;
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
};

export type CharacterPassport = {
  id: string;
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
  fileNameToken: string;
  display: Record<string, unknown>;
  exportHints: {
    referencedCharacterFileId: CharacterId;
    referencedAssetIds: AssetId[];
    sourceWorldId: string;
  };
};
