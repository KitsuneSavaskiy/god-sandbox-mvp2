# 仕様統合マトリクス（Spec Integration Matrix）

状態: 管理対象の正本ドキュメント

Codex が複数の仕様書を参照して実装する際に、優先順位・接続関係・禁止事項を
一箇所で確認できるようにするための参照表である。

---

## 1. 正本優先順位

| 優先度 | ドキュメント | 正本として扱う範囲 |
|---|---|---|
| 1 | `docs/product/godsandbox-user-flow.md` | ユーザー導線・UI フロー |
| 2 | `docs/product/core-experience-spec.md` | プロダクト体験原則・MVP 縦切り |
| 3 | `docs/architecture/system-spec.md` | ドメインモデル・レイヤー定義 |
| 4 | 各 product spec（faith, voice, dialogue 等） | 個別機能の実装ルール |
| 5 | 各 architecture spec（event, passport 等） | アプリケーション層の連携 |

矛盾発見時のルール：
- 上位と下位が矛盾する場合は上位を優先する
- 同優先度で矛盾する場合は、PO が両ファイルを同一 PR で更新してからマージする

---

## 2. ドメインモデル拡張マッピング

`src/domain/models.ts` の型に対して、各 product spec が追加・拡張するフィールドの一覧。

| `system-spec.md` の型 / 実装ファイル | 拡張元の仕様 | 追加・変更 |
|---|---|---|
| `CharacterStatusBlock` (`models.ts`) | `faith-system-spec.md §2` | `faith: number` を追加（0–100、初期値 30） |
| `CharacterProfile.speechStyleId` (`models.ts`) | `character-voice-profile-spec.md §2` | string → `VoiceProfile` resolver で解決する |
| `CharacterPassport.display` (`models.ts`) | `passport-outside-world-spec.md §2` | `Record<string,unknown>` → `PassportOutsideWorldPayload` として型付けする |
| `WorldEvent.templateId` (`models.ts`) | `world-principle-engine-spec.md §7` | EventTemplate に `principleProfile?` フィールドを追加する |
| `InterventionRecord.playerMemo` (`models.ts`) | `faith-system-spec.md §3` | playerMemo 一貫性補正の判定材料として使う |

**重要：** `CharacterStatusBlock` には現状 `faith` フィールドが存在しない（`src/domain/models.ts` で確認済み）。PBI 1 で追加が必要。

---

## 3. 実装時の仕様参照フロー（Codex 向け）

### faith を実装するとき

1. `docs/architecture/system-spec.md` → CharacterStatusBlock の定義と 4 レイヤー構成を確認
2. `docs/product/faith-system-spec.md` → 初期値・変化ルール・personality 修正・関数シグネチャ
3. `src/domain/character.ts` → DEFAULT_CHARACTER_STATUS に `faith: 30` を追加
4. `src/domain/character.ts` → `normalizeCharacterStatus(raw)` を追加（`faith: raw.faith ?? 30` で旧データ補完）
   **注意:** `src/persistence/migrations.ts` の `MigrationContext` は `{ worldId: string }` のみで character status にアクセスできない。faith 補完は migrations.ts ではなく persistence ロードまたは bootstrap 側で行う（詳細は `docs/product/mvp-implementation-plan.md PBI 1` を参照）。
5. `src/application/runtimeBootstrap.ts` → seed データ（Eve/Garan/Ryo/Suzu）に `faith: 30` を追加
6. `docs/product/mvp-test-scenarios.md §2.1` → unit テストの実装
7. `docs/product/mvp-test-scenarios.md §4` → E2E での検証

### VoiceProfile を実装するとき

1. `docs/product/character-voice-profile-spec.md` → VoiceProfile 型・doNotSay・doNotInvent・continuityRules
2. `src/domain/models.ts` → CharacterProfile.speechStyleId を確認（現状 string alias のみ）
3. `docs/product/observed-dialogue-spec.md` → 発話生成ルールと VoiceProfile の関係
4. `src/application/runtimeBootstrap.ts` → デフォルト住民の VoiceProfile seed データを追加
5. `docs/product/mvp-test-scenarios.md §2.4` → unit テスト

### Passport を生成するとき

1. `src/domain/models.ts` → CharacterPassport の外部契約（snapshotId / display / exportHints）
2. `docs/product/passport-outside-world-spec.md` → PassportOutsideWorldPayload の内容
3. `src/domain/snapshots.ts` → issueCharacterPassport の既存実装を確認
4. `docs/product/faith-system-spec.md §5` → PassportGodRelationship の生成
5. `docs/product/character-voice-profile-spec.md §2` → PassportVoiceProfile の生成
6. `docs/product/ai-literacy-tutorial-spec.md` → 確認画面・JSON ビューアの UI 要件

### イベントを選択するとき

1. `docs/architecture/event-and-intervention-spec.md` → WorldEvent / InterventionRecord の契約
2. `src/domain/events.ts` → 現行のイベント生成ロジック（`stableHash` RNG あり）
3. `docs/product/world-principle-engine-spec.md §7` → EventTemplate.principleProfile
4. `docs/product/world-principle-engine-spec.md §8` → calcEventWeight と seed 付き RNG
5. `docs/product/observed-dialogue-spec.md §3` → 発話トリガーと確率

### AI 生成物をインポートするとき

1. `docs/product/core-experience-spec.md §3 原則2` → incoming→confirm→adopt パイプライン
2. `docs/product/ai-literacy-tutorial-spec.md Level 2` → 候補確認フロー
3. `docs/product/character-voice-profile-spec.md §6` → 発話サンプルの品質基準

---

## 4. データの流れ（禁止事項付き）

```
キャラクター作成 5 項目（名前・性格・口調・年齢・1枚絵）
  ↓
CharacterProfile（domain layer, src/domain/models.ts）
  ├─ speechStyleId → VoiceProfile（doNotSay / doNotInvent / continuityRules）
  └─ appearance → portraitAssetId / spriteSheetAssetId

CharacterState.status（runtime, 非表示）
  ├─ faith → resolveFaithBand → 発話トーン（間接的に UI へ）
  ├─ faith → [禁止] 箱庭 UI・イベント画面に直接数値表示しない
  └─ implicitPhase → calcEventWeight（イベント選択の重み、UI に出ない）

CharacterSnapshot（src/domain/snapshots.ts）
  ↓ issueCharacterPassport()
CharacterPassport（src/domain/models.ts）
  ├─ snapshotId / schemaVersion / fileNameToken（外部契約）
  ├─ display: PassportOutsideWorldPayload
  │   ├─ character（name, age?, personalitySummary）
  │   ├─ lifeMemory（memorySummary, totalInterventions, keyEvents, relationSummaries）
  │   ├─ godRelationship（faithBand, currentFaith は JSON 内部のみ）
  │   ├─ voiceProfile（sandboxDoNotSay, outsideWorldDoNotSay, doNotInvent, continuityRules 含む）
  │   └─ externalAiPromptBlock（systemPrompt, firstEncounterLines）
  └─ exportHints（referencedAssetIds）

[禁止] display に wood / fire / earth / metal / water フィールドを含めない
[禁止] display に陰陽五行の内部値を含めない
[禁止] currentFaith の数値を強調表示する UI コンポーネントを作らない
```

---

## 5. VoiceProfile の箱庭内 / Passport 後の差分

| 項目 | 箱庭内 | Passport 後（外の世界） |
|---|---|---|
| ユーザーへの直接呼びかけ「あなた」 | 禁止 | 許可（外へ来た子として） |
| 神への言及 | faithBand 相応の間接言及のみ許可 | 制限なし（外で神と直接向き合う） |
| ゲーム UI 認識表現 | 禁止 | 不要（外の世界では関係なし） |

根拠：`docs/product/character-voice-profile-spec.md §4`、`docs/product/passport-outside-world-spec.md §1`

---

## 6. EventTemplate 定義の所在

MVP では `world-principle-engine-spec.md §7` に EventTemplate 型を仮定している。
現行コード（`src/domain/events.ts`）にはテンプレートカタログが存在しないため、PBI 7 で新規定義が必要。

正式な型は `docs/architecture/event-and-intervention-spec.md` が整備されるまで以下を最小定義として使う：

```ts
// world-principle-engine-spec.md §7 に準拠した最小 EventTemplate 型
type EventTemplate = {
  id: string;
  name: string;
  principleProfile?: EventTemplatePrincipleProfile;
  // 詳細フィールドは event-and-intervention-spec.md が定める
};
```

---

## 7. 現行コードと仕様の差分まとめ（実装前に把握すること）

| 仕様上の定義 | 現行コードの状態 | 必要な作業 |
|---|---|---|
| `CharacterStatusBlock.faith` | 存在しない（8 次元のみ） | PBI 1 で追加 |
| VoiceProfile 型 | 未実装（speechStyleId は string のみ） | PBI 3 で新規作成 |
| EventTemplate カタログ | 未存在（イベント生成はロジックベース） | PBI 7 で新規作成 |
| `CharacterPassport.display` の型 | `Record<string,unknown>` | PBI 5 で PassportOutsideWorldPayload として型付け |
| テストフレームワーク | カスタム assertions（deepEqual 等） | Jest 導入か既存形式への準拠を決定 |
| seeded RNG | `src/domain/events.ts` の `stableHash` あり | PBI 7 で再利用可能 |
