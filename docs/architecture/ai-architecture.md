# GodSandbox AI Architecture

## 設計原則

### LLM is narrator, not authority

LLM はナレーター（語り手）であり、ゲーム状態の決定権を持たない。

```
LLM が生成してよいもの:
- リョウの台詞・感情表現
- 神の介入に対する短文リアクション
- イベント説明文・世界観ナレーション
- UIに表示する候補テキスト

deterministic なゲームロジック側が決定するもの:
- HP・信仰値・恐怖値・好感度の増減
- アイテム取得・クエスト達成
- NPCの状態変更
- セーブデータ更新
- 課金・報酬・実績
```

`state_change_request` フィールドは常に `null` であり、スキーマ検証で強制される。

### Runtime AI と Development Support AI の分離

```
Runtime AI Architecture:
  ゲーム実行中に使う AI。
  プレイヤー入力、神アクション、NPC反応、ナラティブ生成を扱う。
  本番セキュリティ境界・スキーマ検証・ガードレールが必要。

Development Support AI:
  開発者が Claude / Codex を使うための文脈。
  .claude/CLAUDE.md、CLAUDE.md など。
  本番セキュリティ境界ではない。
```

---

## レイヤー構成

```
Runtime Production Layers
├── 1. State Authority Layer
├── 2. Prompt Registry Layer
├── 3. Schema / Contract Layer
├── 4. Narrative Service Layer
├── 5. Memory / Lore Context Layer
├── 6. Safety Guardrail Layer
├── 7. Evaluation Layer
└── 8. Observability / Cost Layer

Development Support Layer
└── 9. .claude / AI Coding Context Layer
```

---

## Layer 1: State Authority

`src/ai/` 内のいかなるコードも、ゲーム状態（`RuntimeWorldState`）を直接変更しない。
AI サービスは **提案テキスト** を返すだけで、状態更新は `runtimeCommands.ts` を経由した
アプリ層が行う。

```ts
// 許可: テキストを返す
function buildRyoReactionPrompt(input: RyoReactionInput): string

// 禁止: 状態を変更する
function applyFaithChange(state: RuntimeWorldState): RuntimeWorldState  // ← ai/ に置かない
```

---

## Layer 2: Prompt Registry

`src/ai/prompts/registry.ts`

全プロンプトは `PromptId` と `PromptVersion` で管理する。コードに直書きしない。

```
promptId: ryo_reaction   version: v1   schema: ryo_reaction_output_v1
promptId: world_observation  ...
promptId: divine_event   ...
```

---

## Layer 3: Schema / Contract

`src/ai/schemas/ryo_reaction.ts`

LLM 出力は必ずスキーマ検証を通過してから UI や下流処理に渡す。
スキーマ検証失敗時は fallback 台詞を返す。

```ts
type RyoReactionOutput = {
  expression: RyoExpression;   // 8値のうちのひとつ
  line: string;                // 42文字以内
  intensity: number;           // 0.0 - 1.0
  tags: string[];
  state_change_request: null;  // 常に null
};
```

### Single Source of Truth 設計

TypeScript ファイル（`ryo_reaction.ts`）が **canonical** であり、
JSON Schema (`ryo_reaction.schema.json`) の内容を `RYO_REACTION_SCHEMA_FOR_LLM` 定数として export する。

```
src/ai/schemas/ryo_reaction.ts
  └─ export RYO_REACTION_SCHEMA_FOR_LLM   ← TypeScript が canonical
        ↓ import
src/ai/prompts/ryo_reaction.ts
  └─ プロンプトテキストにスキーマを内包   ← 外部 LLM がそのまま受け取る
        ↓ 検証
src/ai/schemas/ryo_reaction.ts
  └─ validateRyoReactionOutput()           ← ランタイムが同じルールで検証
```

**この設計を採用した理由:**

箱庭が生成したプロンプトをユーザーが外部 LLM（ChatGPT / Codex）にコピーするとき、
スキーマも一緒に届く必要がある。別ファイルをアップロードさせるのは UX 上の摩擦になる。
プロンプトにスキーマを内包することで、ユーザーはプロンプトテキストだけを貼り付ければよい。

`ryo_reaction.schema.json` は TypeScript の定数から生成される公開アーティファクトであり、
外部ツール（バリデーター、ドキュメントサイト）向けに提供するが、
ランタイムの動作は TypeScript の実装に依存する。

---

## Layer 4: Narrative Service

`src/ai/services/ryo_reaction_service.ts`

現在の世界状態から LLM へ渡すプロンプトを構築する。
GodSandbox MVP2 では API キーをゲーム内に持たず、Manual Handoff（PO が ChatGPT/Codex に手動で貼り付け）を採用している。

### parseAndTraceRyoReactionOutput

トレース付きパース経路。Layer 8 Observability と連携し、パース段階ごとに `schemaValid` / `outputGuardPassed` を記録する。

```
JSON parse失敗   → schemaValid=false, outputGuardPassed=false
schema検証失敗   → schemaValid=false, outputGuardPassed=false
output guard失敗 → schemaValid=true,  outputGuardPassed=false
全検証通過       → schemaValid=true,  outputGuardPassed=true
```

`parseRyoReactionOutput()` はトレースなしの pure parser であり、テスト・純粋検証用として残す。
Runtime / UI からは `parseAndTraceRyoReactionOutput()` を使うこと。

### src/domain/dialogue.ts との関係

`src/domain/dialogue.ts` は Sprint 9-2 以前から存在する「複数キャラクター対話候補」生成系統であり、
`src/ai/` の 9 層構造の外側にある。
この系統は **Layer 1（State Authority）の原則**（AI はテキストを提案するだけ、状態変更しない）を守っているが、
Layer 2〜8 の Registry / Schema / Guardrail / Trace を経由しない。

| 項目 | `src/domain/dialogue.ts` | `src/ai/ryo_reaction` |
|---|---|---|
| 対象 | 複数キャラ対話候補 | Ryo 単体リアクション |
| 出力スキーマ | なし（テキスト行） | `RyoReactionOutput`（JSON Schema） |
| ガードレール | `validateDialogue`（文字数 / 直接呼びかけ / 内部値 / generatedContentSafety） | L6 `output_guard.ts` |
| Trace | なし | L8 `trace_logger.ts` |
| 将来方針 | Sprint 10 以降に L2–L8 へ移行予定 | 現在の 9 層準拠実装 |

---

## Layer 5: Memory / Lore Context

`src/ai/services/world_state_summary.ts`

```
保持する情報:
- リョウの現在感情（natural language、数値なし）
- 信仰段階（faithBand、数値なし）
- 直近 3〜5 件の神アクション summary
- 世界状態タグ
- 現在のイベント状況タグ

除外する情報:
- 信仰値の生数値
- スコア
- 五行内部値
```

本格 RAG を導入する条件: Lore 文書増加 / NPC 多数化 / 過去イベント履歴検索が必要になったとき。

---

## Layer 6: Safety Guardrail

`src/ai/security/output_guard.ts`

```
input_guard:
  - システムプロンプト上書き試行の検出
  - 異常な長さ

output_guard:
  - JSON スキーマ破損
  - UI 文字数超過（42文字）
  - リョウの口調逸脱
  - 禁止タグ（死亡・寿命・勲章）
  - state_change_request が null でない

tool_guard:
  - AI がアクセスできる操作を最小権限に制限
  - セーブデータ変更・ファイル操作・課金処理は禁止
```

既存 `validateGeneratedNarrativeCandidate`（`generatedContentSafety.ts`）を基盤として拡張する。

---

## Layer 7: Evaluation

`src/ai/evaluation/`

Golden scenario で継続的にナラティブ品質を守る。LLM の精度評価ではなく、
**キャラクター性・世界観・UI 品質の保護** が目的。

```
必須基準:
  JSON schema valid:      100%
  expression valid:       100%
  no state mutation:      100%
  no prompt leakage:      100%
  line 文字数制限:         95% 以上

品質基準:
  ryo voice consistency:  80% 以上
  emotion alignment:      85% 以上
```

対応表情 8 種: `normal` / `joy` / `sadness` / `tense` / `bless` / `divine` / `watch` / `test`

---

## Layer 8: Observability

`src/ai/observability/trace_logger.ts`

```ts
type PromptTrace = {
  traceId: string;
  feature: string;
  promptId: PromptId;
  promptVersion: PromptVersion;
  model?: string;
  divineAction: string;
  expression: string;
  worldStateHash: string;
  latencyMs?: number;
  costEstimate?: number;
  schemaValid: boolean;
  outputGuardPassed: boolean;
  acceptedByPlayer?: boolean;
  createdAt: string;
};
```

---

## Layer 9: Development Support (.claude)

`CLAUDE.md` の「AI 実装ルール」セクションを参照。

**重要**: CLAUDE.md は開発支援 AI へのコンテキスト提供であり、本番セキュリティ境界ではない。
本番ガードレール・スキーマ検証は必ず `src/ai/security/` と `src/ai/schemas/` に実装する。

---

## Sprint 9-2 スコープ

### Must

| # | 成果物 | 場所 |
|---|--------|------|
| 1 | Prompt Registry | `src/ai/prompts/registry.ts` |
| 2 | Ryo Reaction Prompt Builder | `src/ai/prompts/ryo_reaction.ts` |
| 3 | Ryo Reaction Output Schema + Validator | `src/ai/schemas/ryo_reaction.ts` |
| 4 | World State Summary | `src/ai/services/world_state_summary.ts` |
| 5 | Ryo Reaction Service | `src/ai/services/ryo_reaction_service.ts` |
| 6 | Output Guard | `src/ai/security/output_guard.ts` |
| 7 | Trace Logger | `src/ai/observability/trace_logger.ts` |
| 8 | Golden Scenarios 20件 | `src/ai/evaluation/golden_scenarios/ryo_reaction_golden.ts` |
| 9 | Eval Runner | `src/ai/evaluation/ryo_reaction_eval.ts` |
| 10 | AI 実装ルール | `CLAUDE.md` |

### Won't（今Sprint）

- 本格 RAG
- Semantic Cache
- 自己修正 Agent
- Autonomous Runtime Agent
- AI によるゲーム状態の直接更新

---

## Definition of Done（Sprint 9-2）

```
- ryo_reaction prompt v1 が存在する
- prompt registry から promptId で取得できる
- ryo_reaction schema で出力検証できる
- 8 表情すべてに対応したゴールデンシナリオが存在する（最低 20 件）
- eval runner で 20 件を実行できる
- JSON schema valid 率 100%
- no direct state mutation 100%
- UI 文字数制限違反 5% 以下
- traceId / promptVersion / schemaValid / outputGuardPassed が記録される
- schema 失敗時に fallback 台詞が返る
- CLAUDE.md に AI 開発ルールが記載される
```
