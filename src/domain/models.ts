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

export type FaithChangeTrigger =
  | "watch_success"
  | "watch_failure"
  | "help_success"
  | "help_failure"
  | "trial_success"
  | "trial_failure"
  | "player_memo_bonus"
  | "player_memo_penalty";

export type FaithChangeRecord = {
  characterId: CharacterId;
  previousFaith: number;
  newFaith: number;
  delta: number;
  trigger: FaithChangeTrigger;
  interventionId: string;
};

export type FivePhase = "wood" | "fire" | "earth" | "metal" | "water";
export type YinYangPolarity = "yang" | "yin" | "balanced";
export type EventPrincipleRole =
  | "nourish"
  | "restrain"
  | "circulate"
  | "reveal"
  | "bind"
  | "separate";

export type EventTemplatePrincipleProfile = {
  dominantPhase: FivePhase;
  polarity: YinYangPolarity;
  principleRole: EventPrincipleRole;
};

export type EventTemplate = {
  id: string;
  name: string;
  situationTags: string[];
  summaryTemplate: string;
  principleProfile?: EventTemplatePrincipleProfile;
};

export type VoiceSentenceLength = "short" | "medium" | "long";
export type VoiceEmotionalExpression = "reserved" | "natural" | "expressive";
export type VoicePoliteness = "casual" | "polite" | "formal";
export type VoiceSilenceUsage = "frequent" | "occasional" | "rare";

export type SandboxDialogueExample = {
  type: "daily" | "relationship" | "god_indirect_reaction";
  context?: string;
  text: string;
};

export type PassportDialogueExample = {
  type: "first_encounter" | "memory_reference" | "general";
  faithBandContext: FaithBand;
  text: string;
};

export type VoiceProfile = {
  firstPerson: string;
  secondPersonToCharacters: string;
  sentenceLength: VoiceSentenceLength;
  emotionalExpression: VoiceEmotionalExpression;
  politeness: VoicePoliteness;
  speechPatterns: string[];
  silenceUsage: VoiceSilenceUsage;
  sandboxDialogueExamples: SandboxDialogueExample[];
  passportDialogueExamples: PassportDialogueExample[];
  doNotSay: string[];
  doNotInvent: string[];
  continuityRules: string[];
};

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

export type EventOutcomeKind = "success" | "failure";

export type EventJudgement = {
  formula: "1d20 + modifier";
  roll: number;
  modifier: number;
  total: number;
  threshold: number;
  outcome: EventOutcomeKind;
};

export type EventOutcomeRecord = {
  eventId: string;
  interventionId: string;
  templateId: string;
  outcome: EventOutcomeKind;
  judgement: EventJudgement;
  summary: string;
  appliedEffectLabels: string[];
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

export type DialogueReviewStatus =
  | "needs_review"
  | "accepted"
  | "rejected"
  | "needs_rewrite";

export type DialogueCandidateSource =
  | "authored_fixture"
  | "external_llm_handoff";

export type DialogueCandidate = {
  id: string;
  characterId: string;
  text: string;
  type: "daily" | "relationship" | "god_indirect_reaction";
  source: DialogueCandidateSource;
  reviewStatus: DialogueReviewStatus;
  faithBandContext?: FaithBand;
  targetCharacterId?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export type DialogueTrigger =
  | "event_started"
  | "event_resolved"
  | "intervention_applied"
  | "proximity_enter"
  | "idle_timer"
  | "phase_change";

export type DialogueValidationResult =
  | { ok: true }
  | { ok: false; violations: string[] };

export type ConversationLogEntry = {
  id: string;
  speakerCharacterId: CharacterId;
  speakerDisplayName: string;
  text: string;
  dialogueType: "daily" | "relationship" | "god_indirect_reaction";
  trigger: DialogueTrigger;
  createdAt: string;
};

export type DialogueWorldDigest = {
  sessionId: string;
  generatedAt: string;
  activeCharacters: {
    characterId: string;
    name: string;
    faithBand: FaithBand;
    visibleStateSummary: string;
    voiceProfileSummary: {
      firstPerson: string;
      speechPatterns: string[];
      doNotSay: string[];
    };
  }[];
  relationSummaries: string[];
  recentEventSummary: string[];
  currentSituationTag: string[];
};

export type DialoguePromptPack = {
  digestId: string;
  generatedAt: string;
  promptText: string;
};

export type PassportCharacterAssetRef = {
  portraitAssetId: AssetId;
  portraitPath?: string;
  spriteSheetAssetId?: AssetId;
  spriteSheetPath?: string;
};

export type PassportCharacterProfile = {
  id: CharacterId;
  name: string;
  age?: number;
  personalitySummary: string;
  assetRef: PassportCharacterAssetRef;
};

export type PassportKeyEvent = {
  eventId: string;
  title: string;
  interventionType?: "watch" | "help" | "trial";
  outcome: "resolved" | "failed" | "ongoing";
  characterReflection: string;
};

export type PassportRelationSummary = {
  withCharacterId: CharacterId;
  withCharacterName?: string;
  relationDescription: string;
};

export type PassportLifeMemory = {
  totalInterventions: number;
  memorySummary: string;
  keyEvents: PassportKeyEvent[];
  relationSummaries: PassportRelationSummary[];
};

export type PassportGodRelationship = {
  faithBand: FaithBand;
  currentFaith: number;
  faithVisibility: string;
  faithChangeSummary: string;
  interpretationOfGod: string;
  firstEncounterOutsideWorld?: string;
};

export type PassportVoiceProfile = {
  firstPerson: string;
  speechPatterns: string[];
  sentenceLength: VoiceSentenceLength;
  emotionalExpression: VoiceEmotionalExpression;
  sandboxDoNotSay: string[];
  outsideWorldDoNotSay: string[];
  doNotInvent: string[];
  continuityRules: string[];
  sandboxDialogueExamples: SandboxDialogueExample[];
  passportDialogueExamples: PassportDialogueExample[];
};

export type InstructionReceptivityRule = {
  faithBand: FaithBand;
  generalStance: string;
  complianceLevel: "high" | "moderate" | "cautious" | "skeptical";
  refusalExample: string;
};

export type ExternalAiPromptBlock = {
  systemPrompt: string;
  firstEncounterLines: string[];
  instructionReceptivity: InstructionReceptivityRule;
  importantConstraints: string[];
};

export type PassportOutsideWorldPayload = {
  character: PassportCharacterProfile;
  lifeMemory: PassportLifeMemory;
  godRelationship: PassportGodRelationship;
  voiceProfile: PassportVoiceProfile;
  externalAiPromptBlock: ExternalAiPromptBlock;
};

export type CharacterPassport = {
  id: string;
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
  fileNameToken: string;
  display: PassportOutsideWorldPayload;
  exportHints: {
    referencedCharacterFileId: CharacterId;
    referencedAssetIds: AssetId[];
    sourceWorldId: string;
  };
};
