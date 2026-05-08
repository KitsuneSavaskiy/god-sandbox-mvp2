# MVP 実装計画書

状態: 管理対象の正本ドキュメント

この文書は GodSandbox MVP を Codex が安全に段階実装するための PBI 分解と
実装順序を定義する。各 PBI はそれ単独で PR を出せる粒度に設計している。

実装前に必ず読むこと：
- `docs/product/spec-integration-matrix.md`（仕様参照フローと既存コード差分）
- `docs/architecture/system-spec.md`（ドメインモデル・レイヤー定義）
- `docs/product/core-experience-spec.md`（体験原則・MVP 縦切り）

---

## PBI 一覧と依存関係

| PBI | 名称 | 前提 PBI |
|---|---|---|
| 1 | Faith domain model + migration | なし |
| 2 | Faith change application | PBI 1 |
| 3 | VoiceProfile storage / resolver | なし |
| 4a | Observed dialogue PO preview | PBI 1, 3 |
| 4b | Observed dialogue runtime | PBI 1, 3, 4a |
| 5 | PassportOutsideWorldPayload 生成 | PBI 1, 3 |
| 6 | Passport confirm + JSON viewer UI | PBI 5 |
| 7 | WorldPrinciple template tagging | PBI 1 |
| 8 | MVP acceptance tests | PBI 1〜7 |

PBI 1 と PBI 3 は互いに依存せず並行着手可能。
PBI 4a と PBI 4b は直列。4a の `DialogueCandidate` 型と `buildDialogueWorldDigest` が 4b の前提となる。
PBI 7 は PBI 2〜6 と独立しており、任意の順序で着手できる。

---

## PBI 1: Faith domain model + migration

**目的:** `CharacterStatusBlock` に `faith` フィールドを追加し、既存データとの後方互換を確保する。

**仕様参照:** `docs/product/faith-system-spec.md §1〜2, §6 テスト1・6`

**変更対象ファイル:**
- `src/domain/models.ts` — CharacterStatusBlock に faith 追加
- `src/domain/character.ts` — DEFAULT_CHARACTER_STATUS に faith: 30 追加
- `src/application/runtimeBootstrap.ts` — Eve/Garan/Ryo/Suzu の seed に faith: 30 追加
- `src/domain/runtime.test.ts` — 境界値 unit テスト追加

**触らない範囲:**
- `src/persistence/migrations.ts`（後述の注意を参照）
- UI コンポーネント（faith を表示しない）
- Passport 生成（PBI 5）
- 他 status フィールドの変化ロジック

> **注意：migrations.ts は使わない**
> 現行 `src/persistence/migrations.ts` の `MigrationContext` は `{ worldId: string }` のみを持つ。
> migration 関数は `(context: MigrationContext) => MigrationContext` のシグネチャで、
> character status データにはアクセスできない。
> そのため、`faith` フィールドの後方互換補完は **persistence ロードまたは bootstrap 側** で行う。
>
> **実装方針（案B）：** persistence ロード時に読み込んだキャラクターの status を
> `normalizeCharacterStatus(status)` で正規化し、`faith` が `undefined` の場合は `30` を補完する。
> この関数は `src/domain/character.ts` に追加する。

**実装手順:**
1. `src/domain/models.ts` の `CharacterStatusBlock` に `faith: number` を追加
2. `FaithBand` 型と `resolveFaithBand(faith: number): FaithBand` 関数を追加
3. `src/domain/character.ts` の `DEFAULT_CHARACTER_STATUS` に `faith: 30` を追加
4. `src/domain/character.ts` に `normalizeCharacterStatus(raw: Partial<CharacterStatusBlock>): CharacterStatusBlock` を追加（`faith: raw.faith ?? 30`）
5. persistence ロード処理（または `runtimeBootstrap.ts` の seed 読み込み）で `normalizeCharacterStatus` を呼ぶ
6. `src/domain/runtime.test.ts` に境界値テストを追加

**整数丸めルール:** `Math.trunc`（本 PBI では適用なし、PBI 2 から適用）

**Done 条件:**
- [ ] `CharacterStatusBlock.faith` が型チェックを通過する
- [ ] `npm run typecheck` エラーゼロ
- [ ] seed データ読み込みで `faith === 30` を確認できる
- [ ] 旧形式データをロードしても `faith` が 30 で補完される
- [ ] `resolveFaithBand` の境界値テスト全通過（0, 19, 20, 39, 40, 59, 60, 79, 80, 100）
- [ ] `npm run test:domain && npm run build` が成功

---

## PBI 2: Faith change application

**目的:** 介入後に `faith` を正しく変化させ、personality 修正と playerMemo 補正を適用する。

**仕様参照:** `docs/product/faith-system-spec.md §3〜4, §6 テスト2・3・7〜13`

**変更対象ファイル:**
- `src/domain/models.ts` — `FaithChangeTrigger` 型、`FaithChangeRecord` 型の追加
- `src/domain/interventions.ts` — `applyFaithChange` 関数の追加
- `src/application/runtimeCommands.ts` — 介入適用コマンドに faith ChangeSet 記録を追加
- `src/domain/runtime.test.ts` — personality 修正・playerMemo 補正の unit テスト追加

**触らない範囲:**
- UI（faith 数値を UI に出さない）
- Passport（PBI 5）
- 他 status フィールドの変化ロジック

**実装手順:**
1. `FaithChangeTrigger` 型を `src/domain/models.ts` に追加
2. `applyFaithChange(currentFaith, trigger): number` を `src/domain/interventions.ts` に追加（上限 100・下限 0 クランプ）
3. `applyFaithChangeWithPersonality(character, trigger, currentMemoGroup?, previousMemoGroup?): number` を application 層に追加（personality 修正・playerMemo 補正含む）
4. 介入適用コマンドで faith ChangeSet を記録
5. unit test 追加

**整数丸めルール:** 修正適用後の delta を `Math.trunc`（ゼロ方向切り捨て）。
`-2 × 0.7 = -1.4 → Math.trunc(-1.4) = -1`（減少量は 1）。
`5 × 1.5 = 7.5 → Math.trunc(7.5) = 7`。

**playerMemo 補正方向:** 常に「信仰度を上向きに」。
正の delta は +1（例: +4 → +5）。負の delta は +1 して減少緩和（例: -4 → -3）。
矛盾メモが続く場合は -1。2 回目以降の介入から適用。

**Done 条件:**
- [ ] `applyFaithChange` の全トリガーテスト通過（help/watch/trial の成功・失敗）
- [ ] 上限 100・下限 0 クランプテスト通過
- [ ] `sensitivity/boldness/curiosity/discipline` personality 修正の各テスト通過
- [ ] playerMemo 補正の 2 回目以降適用テスト通過
- [ ] `npm run typecheck && npm run test:domain && npm run build` が成功

---

## PBI 3: VoiceProfile storage / resolver

**目的:** キャラクターの「この子らしい話し方」を保持・解決する仕組みを実装する。

**仕様参照:** `docs/product/character-voice-profile-spec.md §2〜6`

**変更対象ファイル:**
- `src/domain/models.ts` — `VoiceProfile` 型、`SandboxDialogueExample` 型、`PassportDialogueExample` 型の追加
- `src/application/runtimeBootstrap.ts` — Eve/Garan/Ryo/Suzu の VoiceProfile seed データ追加
- `src/domain/character.ts`（または新規 `src/domain/voiceProfile.ts`） — `resolveVoiceProfile(character)` 関数
- `src/domain/runtime.test.ts` — VoiceProfile unit テスト追加

**触らない範囲:**
- Passport 出力（PBI 5）
- 発話生成 UI（PBI 4）

**重要な分離:**
- 内部 `VoiceProfile.doNotSay`（箱庭内発話用。「あなた」禁止含む）← PBI 3 の実装対象
- `PassportVoiceProfile.sandboxDoNotSay`（箱庭内制約の Passport 出力版）← PBI 5 で対応
- `PassportVoiceProfile.outsideWorldDoNotSay`（Passport 後の制約。「あなた」は含めない）← PBI 5 で対応
- `DEFAULT_DO_NOT_SAY_SANDBOX` と `ALLOWED_GOD_INDIRECT_REFERENCES` の定数を実装（`character-voice-profile-spec.md §4` 参照）

**Done 条件:**
- [ ] Garan / Ryo / Suzu / Eve の VoiceProfile が `resolveVoiceProfile` で返る
- [ ] `doNotSay` に「あなた」「画面」「セーブ」が含まれる
- [ ] `sandboxDialogueExamples` に `god_indirect_reaction` が 1 件以上
- [ ] `passportDialogueExamples` に `first_encounter` が 1 件以上
- [ ] unit test（`mvp-test-scenarios.md §2.4`）通過
- [ ] `npm run typecheck && npm run test:domain && npm run build` が成功

---

## PBI 4a: Observed dialogue authoring preview

**目的:** PO が箱庭内発話の UI・頻度・距離感・キャラらしさを確認できるようにする。
ソースモードは `authored_fixture`（B: 人手 fixture）と `external_llm_handoff`（C: 外部 LLM 手動渡し）の 2 通りを持つ。
ゲーム本体は外部 LLM API を直接呼ばない（不変条件 A、`llm-batch-handoff-spec.md §1` 参照）。

**前提分類（詳細は `observed-dialogue-spec.md §9` 参照）:**
- **B: PO 確認でも LLM を使わない** → `authored_fixture` モードのみ。UI/頻度/距離感を確認できるが、LLM 生成品質の判断には使えない。
- **C: PO 確認で外部 LLM を使う** → `external_llm_handoff` モード。ゲーム側が Digest/Prompt を作り PO が手動で外部 LLM へ渡す。候補は `needs_review` → review → adopt。

**仕様参照:** `docs/product/observed-dialogue-spec.md §9`, `docs/architecture/llm-batch-handoff-spec.md §2`

**変更対象ファイル:**
- `src/domain/models.ts` — `DialogueCandidateSource`, `DialogueWorldDigest`, `DialogueCandidate`, `DialogueReviewStatus` 型の追加
- `src/domain/dialogue.ts`（新規） — `buildDialogueWorldDigest(session): DialogueWorldDigest`, `buildDialoguePromptPack(digest): DialoguePromptPack` 関数
- `src/domain/runtime.test.ts` — PO preview unit テスト追加

**ソースモード別の役割:**

| モード | シナリオ | PO が LLM を使うか | 確認できること |
|---|---|---|---|
| `authored_fixture` | B | 使わない | UI・頻度・Type A/B/C・doNotSay・faithBand 距離感 |
| `external_llm_handoff` | C | 外部で手動 | 上記 + LLM がその子らしい発話を作れるか |

**`DialogueCandidate.reviewStatus` の取りうる値:**
`"needs_review" | "accepted" | "rejected" | "needs_rewrite"`

`external_llm_handoff` 候補は必ず `"needs_review"` で入り、PO 審査後に `"accepted"` へ昇格する。`"needs_review"` のまま player-facing UI に出してはならない。`WorldEvent / ChangeSet / InterventionResult / Passport` を候補が上書きしてはならない。

**PO の確認ステップ（2 段階）:**
1. `authored_fixture`（B）で UI・頻度・距離感を確認する
2. `external_llm_handoff`（C）で実際の LLM 候補を見て「うちの子に愛着がわくか」を判断する

LLM 候補を見ていない段階では発話体験の最終判断を完了扱いにしない。

**触らない範囲:**
- 外部 LLM API 直接呼び出し（アプリ本体は呼ばない）
- UI 発話表示・吹き出し（PBI 4b）
- Passport 発話例（PBI 5）

**Done 条件:**
- [ ] `buildDialogueWorldDigest` が session から `DialogueWorldDigest` を返す
- [ ] `DialogueCandidateSource` が `"authored_fixture" | "external_llm_handoff"` を取りうる
- [ ] `authored_fixture` モードで Type A / B / C の fixture 候補が生成できる
- [ ] `external_llm_handoff` 候補は `reviewStatus: "needs_review"` で入り、PO 承認前に UI に出ない
- [ ] unit test（`mvp-test-scenarios.md §2.3-a`）通過
- [ ] `npm run typecheck && npm run test:domain && npm run build` が成功

---

## PBI 4b: Observed dialogue runtime

**目的:** 箱庭内で「生活音のような会話」を生成し表示する。

**仕様参照:** `docs/product/observed-dialogue-spec.md`

**変更対象ファイル:**
- `src/domain/models.ts` — `DialogueTrigger` 型の追加
- `src/domain/dialogue.ts` — `resolveDialogueTriggerRate`, `validateDialogue`, `generateDialogue` 関数
- `src/application/runtimeCommands.ts` — イベント・介入後に発話生成を呼び出す処理を追加
- UI コンポーネント — 吹き出し表示（3〜5 秒後フェードアウト、同時最大 2 件）
- `src/domain/runtime.test.ts` — dialogue unit テスト追加

**発話タイプ別文字数（generateDialogue の制約として実装）:**
- Type A（daily）: 5〜30 文字
- Type B（relationship）: 10〜30 文字
- Type C（god_indirect_reaction）: 10〜35 文字
- 表示上限: 40 文字（`validateDialogue` で検証）

**発話トリガー確率（`resolveDialogueTriggerRate` が返す値）:**

「任意発話発生率」（何らかの発話が起きる確率）：
- `event_started` / `event_resolved` / `intervention_applied`: 0.8 以上
- `proximity_enter`: 0.4
- `idle_timer`: 0.2

「Type C（god_indirect_reaction）発話率」（Type C が選ばれる追加確率）：
- `event_resolved` / `intervention_applied` トリガー時: 0.5
- それ以外のトリガー: 0（Type C は発生しない）

**両者は独立した確率**。例: `intervention_applied` 時は、まず 0.8 の確率で何らかの発話が起きる。その後、 0.5 の確率で Type C（god_indirect_reaction）が選ばれる。

**触らない範囲:**
- AI 生成連携（Level 2 は後回し）
- Passport 発話例（PBI 5）

**Done 条件:**
- [ ] `validateDialogue` が 41 文字以上・禁止表現を含む発話を拒否する
- [ ] `resolveDialogueTriggerRate` が確率テーブルの値を返す
- [ ] `disbelieves` バンドで「神様が助けてくれた」が出ない
- [ ] null 発話でゲームが止まらない（fallback: 空配列で継続）
- [ ] 同時発話 2 件制限テスト通過
- [ ] unit / negative test（`mvp-test-scenarios.md §2.3-b`）通過
- [ ] `npm run typecheck && npm run test:domain && npm run build` が成功

---

## PBI 5: PassportOutsideWorldPayload 生成

**目的:** CharacterSnapshot から CharacterPassport.display（PassportOutsideWorldPayload）を生成する。

**仕様参照:** `docs/product/passport-outside-world-spec.md §2〜3, §5`

**変更対象ファイル:**
- `src/domain/models.ts` — `PassportOutsideWorldPayload` 型とその子型を追加
- `src/domain/snapshots.ts` — `issueCharacterPassport` を拡張して display に payload を詰める
- `src/domain/passport.ts`（新規） — `generatePassportDisplay(snapshot): PassportOutsideWorldPayload` 関数
- `src/domain/runtime.test.ts` — Passport 生成 integration テスト追加

**生成する型（`passport-outside-world-spec.md §2` に従う）:**
- `PassportCharacterProfile`（id, name, personalitySummary, age?, assetRef）
- `PassportLifeMemory`（memorySummary, totalInterventions, keyEvents, relationSummaries）
- `PassportGodRelationship`（faithBand, currentFaith, faithVisibility, faithChangeSummary, interpretationOfGod, firstEncounterOutsideWorld）
- `PassportVoiceProfile`（firstPerson, speechPatterns, sandboxDoNotSay, outsideWorldDoNotSay, doNotInvent, continuityRules, sandboxDialogueExamples, passportDialogueExamples）
- `ExternalAiPromptBlock`（systemPrompt, firstEncounterLines, importantConstraints）
- `PassportCharacterAssetRef`（portraitAssetId, portraitPath?, spriteSheetAssetId?, spriteSheetPath?）

**`totalInterventions` の導出方法（MVP）:**
`CharacterSnapshot.recentEvents` の件数を `totalInterventions` の近似値とする。
将来 `CharacterSnapshot` に `interventionCount: number` を追加した時点で差し替え可能。

**禁止事項（厳守）:**
- `display` に `wood / fire / earth / metal / water` フィールドを含めない
- `display` に陰陽五行の内部値を含めない
- `currentFaith` の数値を UI に強調表示しない（JSON 内部には含めてよい）

**触らない範囲:**
- CharacterPassport の外部契約（snapshotId / schemaVersion / fileNameToken / exportHints）
- AI 生成 narrative（fallback テキストを使う）

**Done 条件:**
- [ ] `passport.display.godRelationship.faithBand` が正しく解決される
- [ ] `passport.display.externalAiPromptBlock.systemPrompt.length > 50`
- [ ] `passport.display.lifeMemory.keyEvents.length >= 1`
- [ ] `passport.display.voiceProfile.doNotInvent` が含まれる
- [ ] `JSON.stringify(passport)` に `"wood":` 等が含まれない（negative test）
- [ ] `passport.display.lifeMemory.memorySummary` に status 数値が含まれない
- [ ] integration test（`mvp-test-scenarios.md §3.2`）通過
- [ ] `npm run typecheck && npm run test:domain && npm run build` が成功

---

## PBI 6: Passport confirm + JSON viewer UI

**目的:** Level 1 確認画面と Level 3 JSON ビューアを実装する。

**仕様参照:** `docs/product/ai-literacy-tutorial-spec.md Level 1, Level 3`

**変更対象ファイル:**
- 新規 UI コンポーネント: `PassportConfirmScreen`（Level 1）
- 新規 UI コンポーネント: `PassportJsonViewer`（Level 3）
- `src/persistence/`（または該当する LocalStorage 操作モジュール） — `passportConfirmSeen` フラグの保存・読み取り

**Level 1 確認画面の要件:**
- Passport ボタン初回タップ時のみ表示（`passportConfirmSeen` フラグで管理）
- 「含まれるもの」「含まれないもの」リストを表示
  - 含まれないもの: 陰陽五行の内部値、アカウント情報、GodSandbox 固有パラメータ
  - 信仰度の数値は「含まれないもの」に入れない（faithBand として含まれる）
- 「この時点では外部 AI には送られません。コピーして貼り付けた場合だけ読まれます。」
- キャンセルでゲーム状態が変わらない

**Level 3 JSON ビューアの要件（任意操作）:**
- 開かなくてもゲームが進む
- 各フィールドのホバー/タップで日本語ラベルを表示
- `faithBand` に日本語説明付き
- `externalAiPromptBlock.systemPrompt` のコピーボタン
- 「外部 AI で新しい会話を開き、最初のメッセージとして貼り付けると、{name} として話してくれます」の手順説明

**禁止ワード（UI テキストに使ってはならない）:**
「API」「プロンプト」「トークン」「モデル」「自動的に生成」「システムプロンプト」

**Done 条件:**
- [ ] 確認画面キャンセルでゲーム状態が変わらない（unit test）
- [ ] `passportConfirmSeen` が LocalStorage に保存される
- [ ] 2 回目の Passport 発行で確認画面がスキップされる
- [ ] JSON ビューアが開かなくてもゲームが進む
- [ ] 確認画面・ビューアのテキストに禁止ワードが含まれない（negative test）
- [ ] `faithBand` フィールドに日本語説明が表示される
- [ ] `mvp-test-scenarios.md §6` に記載の UI スナップショットテストの意図を確認（`npm run test:ui` が整備されてから実行）
- [ ] `npm run typecheck && npm run build` が成功（PBI 6 は UI のみ変更のため `test:domain` 不要）

---

## PBI 7: WorldPrinciple template tagging

**目的:** 既存イベントテンプレートに五行タグを付与し、faith-aware なイベント選択を実現する。

**仕様参照:** `docs/product/world-principle-engine-spec.md`

**変更対象ファイル:**
- `src/domain/models.ts` — `FivePhase`, `YinYangPolarity`, `EventTemplatePrincipleProfile` 型の追加
- `src/domain/worldPrinciple.ts`（新規） — `resolveImplicitPhase`, `resolvePolarity`, `calcEventWeight`, `getPrincipleRelation` 関数
- `src/domain/events.ts` — EventTemplate 型に `principleProfile?` を追加し、`calcEventWeight` を `generateWorldEvent` の重み付けに統合（既存 `stableHash` RNG を活用）
- イベントテンプレートデータ — 既存テンプレートに `principleProfile` を付与
- `src/domain/runtime.test.ts` — 五行 unit テスト追加

**イベントテンプレートへの付与例（`world-principle-engine-spec.md §10` 参照）:**
- 日常会話・散歩 → wood / yin / circulate
- 口論・摩擦 → fire / yang / restrain
- 共同作業成功 → earth / balanced / bind
- 試練単独 → metal / yang / reveal
- 悲しみ・落ち込み → water / yin / separate

**seeded RNG:** `src/domain/events.ts` の既存 `stableHash` を再利用する。seed = `SandboxSession.id` + イベント生成回数。

**禁止事項（厳守）:**
- 五行値を Passport / UI / イベントログに出力しない
- `calcEventWeight` の結果を UI に表示しない

**Done 条件:**
- [ ] `resolveImplicitPhase` の 5 種類パス（wood/fire/earth/metal/water）が正しく返る
- [ ] `getPrincipleRelation` の 25 組合せが正しく返る
- [ ] `calcEventWeight` nourish > neutral のテスト通過
- [ ] `principleProfile` なしのテンプレートで `weight = 1.0` が返る（クラッシュなし）
- [ ] 同一 seed で同一イベント列（決定論性テスト）
- [ ] `JSON.stringify(passport.display)` に `"wood":` 等が含まれない（negative test）
- [ ] tie-breaking テスト: ambition=70/empathy=70/vitality=70 で wood が優先して返る
- [ ] `npm run typecheck && npm run test:domain && npm run build` が成功

---

## PBI 8: MVP acceptance tests

**目的:** E2E シナリオを完走させ、PO による「生きている感」目視確認を通過する。

**仕様参照:** `docs/product/mvp-test-scenarios.md §4〜8`

**変更対象ファイル:**
- `src/domain/runtime.test.ts` — E2E シナリオ 1/2 の追加
- UI: Negative tests 用のテスト ID 付与（必要に応じて）

**確認コマンド:**

```bash
npm run typecheck        # 型エラーゼロ
npm run test:domain      # Unit + Integration テスト全通過
npm run build            # ビルド成功
```

**Done 条件:**
- [ ] E2E シナリオ 1（Garan 1 キャラ + watch/help/trial + Passport 発行）全 Assert 通過
- [ ] E2E シナリオ 2（関係性発話確認）全 Assert 通過
- [ ] Negative tests（faith UI 非表示、箱庭内直接呼びかけ禁止、五行 Passport 非出力）全通過
- [ ] PO による「生きている感」目視確認（`mvp-test-scenarios.md §8` チェックリスト全 □ チェック）
- [ ] `npm run typecheck && npm run test:domain && npm run build` が成功

---

## 補足：テストフレームワークの選択

現行 `src/domain/runtime.test.ts` は Jest ではなくカスタム assertions を使用している。
`mvp-test-scenarios.md` の `describe` / `it` / `expect` 形式は仕様の意図を示す記述であり、実装時は次のどちらかを選択すること：

- **既存カスタム形式に合わせる:** `deepEqual`, `equal`, `ok`, `throws` を使って実装
- **Jest を導入する:** `npm install --save-dev jest @types/jest ts-jest` 等で導入し、`npm run test:domain` スクリプトを更新

選択後、`mvp-test-scenarios.md` に実際のテスト形式を追記すること。
