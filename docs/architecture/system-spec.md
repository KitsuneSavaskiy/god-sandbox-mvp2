# GodSandbox システム仕様

状態: 管理対象の正本ドキュメント

参照階層:

1. `docs/product/godsandbox-user-flow.md`
2. `docs/architecture/system-spec.md`
3. `docs/architecture/event-and-intervention-spec.md`
4. `docs/architecture/snapshot-passport-spec.md`
5. `docs/architecture/local-persistence-spec.md`
6. `docs/architecture/ui-state-model.md`
7. `docs/architecture/character-detail-asset-spec.md`
8. `docs/architecture/testing-strategy.md`

この文書は `god-sandbox-mvp2` の主要なゲーム仕様、状態仕様、アーキテクチャ方針を固定する。

## 全体方針

- `activeSlots` は常に4枠すべて埋まっている。
- `roster` は所有キャラクターの全集合である。
- MVP に archive、hidden、retired の状態は持たない。
- 1ユーザーにつき1つのローカル sandbox session を持つ。
- ログインはアカウント認証ではなく、ゲーム内表示名の取得だけに使う。
- アプリは強い意味で local-first とし、正本データはローカル world directory に置く。
- React UI は save file を直接操作しない。
- レイヤーは `domain`、`application`、`ui`、`persistence` の4層で分ける。
- `domain` は React 非依存の pure TypeScript module とする。
- `application` はイベント生成、介入適用、snapshot 発行、passport 発行、migration 制御を持つ。
- 介入 enum の正本は `watch | help | trial` とする。
- `selectedCharacter` は主な gameplay state にしない。主状態は `focusedEvent` とする。

## 正本ドメインモデル

### CharacterTemplate

template は動的な field 定義を持ち、template 作成者が編集可能な入力欄を決められるようにする。

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

ルール:

- template field 名と入力欄は可変でよい。
- 初回4名設定と後続の新キャラクター作成は同じ template model と editor flow を使う。
- 作成後もキャラクターは再編集可能である。

### Character

`Character` は `profile` と `state` に分ける。
`profile` は説明的でプレイヤーが編集する値を持ち、`state` はゲーム進行で変化する値を持つ。

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

ルール:

- MVP の model に `traits` は置かない。
- 可変の gameplay stat は数値 status を中心に表現する。
- 画像選択は必須である。
- personality、speech style、age は任意入力でよい。
- appearance は単一画像参照だけではなく、次を扱える正本構造にする。
  - primary asset ID
  - 表情差分
  - 生成済み sprite sheet 参照
  - 将来の animation や動画連動更新に備える style metadata
- asset の正本参照は asset ID であり、filename は副次情報である。
- UI が詳細画面で使う表示用参照束は `docs/architecture/character-detail-asset-spec.md` の `CharacterAssetBundle` に従う。
- `CharacterAssetBundle` は `Character` 正本そのものではなく、asset registry と profile から解決される表示用契約である。

### Relation table

relation は character 本体とは独立して保存する。

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

ルール:

- relation は双方向である。
- relation 値は単一 score を使う。
- 現在値は高速参照のため materialize してよいが、変化の正本は event / intervention 履歴から再計算できるようにする。

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

ルール:

- `activeSlots` は常に4名で埋まる。
- `activeSlots` の順番に gameplay 上の意味は持たせない。
- `pendingActivationCharacterIds` は `roster` に追加済みだが active な4名へまだ配置していないキャラクターを表す。
- 新キャラクター追加で active な4名の必須条件を壊さない。
- `currentEventId` は常に1件の current event record を指す。
- event が resolved / expired / chained へ進むときは、session save 完了前に次の current event を commit する。
- session は現在状態だけを持ち、全履歴そのものは持たない。
- autosave は event 完了ごとに行う。

### WorldEvent

event 生成はハイブリッド方式とする。

- relation、personality vector、world / situation tag による重み付けを使う
- event template と structured rule を起点にする
- deterministic な text template と richer な structured renderer の両方を許す

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

ルール:

- generator は完全ランダムにしない。
- `primaryCharacterId` は `participantCharacterIds` と別に必須で持つ。
- UI では primary character を主役、他の参加者を脇役として扱う。
- event は未解決のまま残ったり、expired / chained へ遷移したりできる。
- session 上の `currentEventId` は常に1件の focused event を指す。

### OngoingEffectInstance

介入結果には即時反映されるものと、継続効果として残るものがある。

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

ルール:

- 同じ event に複数回介入できる。
- `watch` は god point を消費しない。
- `help` と `trial` は有限の god point を消費する。
- intervention 履歴は `WorldEvent` に埋め込まず、独立 record として保存する。
- `playerReason` と `playerMemo` は、物語の誘導や prompt 生成に使える第一級データとして扱う。

### ChangeSet

変化は append-only の差分イベントとして積む。

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

ルール:

- `ChangeSet` は kind ごとに型安全に分類する。
- 差分だけでなく post-apply snapshot も保持する。
- 見た目変化では次の情報を記録してよい。
  - 更新された asset ID
  - sprite sheet 再生成の情報
  - event 由来情報
  - 動画生成連動を見据えた metadata
- 物語上の立場変化は自由文でよい。

### Snapshot

snapshot は固定時点の記録であり、後から再生成可能である。
annotation metadata は capture 後に追記できる。

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

ルール:

- snapshot の capture 内容自体は固定記録とする。
- tag や note は annotation として後から付けられる。
- 外部 role-play に十分な context を含める必要がある。
- 最低限次を含める。
  - character state
  - relevant relation
  - recent event context
  - world-context reference
- snapshot は同じ world state から後で再生成できるようにする。
- snapshot の identity と provenance は、将来の外部ゲーム連携や import 互換を妨げない形で安定させる。

### Passport

passport は snapshot から派生する versioned export / display document である。
GodSandbox の保存形式としては安定させるが、外部ゲーム向けの live API contract にはしない。

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

ルール:

- passport 発行は明示的なユーザー操作で行う。
- 任意の eligible snapshot からいつでも export できる。
- MVP は単体キャラクター passport を基本とする。
- 将来的に4人編成 passport を追加してもよい。
- 外部ゲームは passport を緩やかに解釈してよい。
- file naming には downstream tool が照合できる stable token を必ず含める。

## キャラクターライフサイクルのルール

- 同じ UI / application flow を次のすべてで使う。
  - 初回4名設定
  - 後からの新キャラクター追加
  - 既存キャラクターの再編集
- 初期4名は一部 default のまま開始してよい。
- 画像選択なしでは save できない。
- `roster` に追加された後も、すぐに active な4名へ入れ替える必要はない。
- 新キャラクター追加時の第2 tutorial は初回だけ必須とする。

## イベント生成とコンテンツ描画

- event 生成は template-driven かつ context-weighted であり、純ランダムにも完全自由文にも寄せない。
- 安定性が必要な箇所では deterministic な text rendering を使う。
- より豊かな narrative wording は、プレイヤーが並行起動する外部 Codex 等で補助生成してよい。
- アプリ本体は外部 AI API を直接呼ばない。
- アプリ内のデータ生成責務は次までに留める。
  - prompt 生成
  - export file 生成
  - deterministic な structured content rendering

## 外部AIと prompt / export 方針

- 外部 AI は今後もアプリ外補助に留める。
- API key を使う直接連携は対象外とする。
- character の speech style data は character data file に持たせる。
- world context は world / chunk file に持たせる。
- prompt pack や export data は、必要な file を読み合わせる前提とし、全情報を1つの巨大 document に flatten しない。
