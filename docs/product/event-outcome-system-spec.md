# Event Outcome System Spec

**PBI:** 9a-spec  
**Status:** Draft — PO review required before implementation merge  
**Last updated:** 2026-05-10  
**Owner:** Claude / Event Design + Spec lane  
**Implementation owner:** Codex / PBI 9a-core

---

## 1. Purpose

GodSandbox のイベントを「発生するだけ」から「介入によって結末が変わる体験」へ進める。

現行の `applyIntervention()` は watch/help/trial ごとの固定 status delta と faith 変化を全参加者へ適用するが、イベント別の成功/失敗結末はない。  
本仕様では **1d20 + modifier** の判定を導入し、**success / failure の2択**でイベント結末を決める。

---

## 2. Design Constraints

```txt
採用する:
- 1d20 + modifier の判定思想（過去repo JudgementResult の簡略版）
- roll / modifier / total の内部記録
- 介入種別によって成功率が変わる
- 結末が success/failure で変わる（summary・status delta・worldStatusTags）

採用しない:
- fumble / critical / greatSuccess などの多段階分岐（Sprint 9 外）
- 寿命・死亡に直結する重い設計
- 複雑なイベント分岐ツリー
- LLM による状態決定（ゲームロジックが deterministic に決める）
- faith / 五行内部値の UI 露出
```

---

## 3. Core Rules

1. イベントは任意タイミングで発生する
2. 発生時に `event_started` ダイアログが出る
3. 神が `watch` / `help` / `trial` のいずれかで介入する
4. 内部で **1d20 + modifier** を振る（seed は deterministic）
5. 結末は **success / failure の2択** で決まる
6. 結末に応じて:
   - `event.structuredPayload.outcome` が `"success"` または `"failure"` になる
   - `event.structuredPayload.judgement` に判定詳細が記録される
   - status delta / relation delta / worldStatusTags が適用される
   - 蓄積型イベントのみ chained event が発生しうる
7. キャラ発話は `event_started` / `intervention_applied` / `event_resolved` に反応する
8. **LLM は結末を決めない**。domain logic が deterministic に決める

---

## 4. Type Definitions

### 4-1. Core outcome types

```ts
export type EventOutcomeKind = "success" | "failure";

export type EventJudgement = {
  formula: "1d20 + modifier";
  roll: number;         // 1〜20
  modifier: number;
  total: number;
  threshold: number;    // default 11
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
```

### 4-2. WorldEvent への格納

MVP 初期実装では `WorldEvent` に直接フィールドを増やすのではなく、既存の `structuredPayload` に格納する。これにより既存型・既存UIへの影響を最小化する。

```ts
structuredPayload: {
  outcome?: "success" | "failure";
  judgement?: EventJudgement;
  outcomeSummary?: string;
  // イベント固有フィールド（例）:
  positionKey?: string;              // moving-stone
  grassIdentified?: boolean;         // strange-grass-found
  offeringCollected?: boolean;       // shrine-fox-offering
  offeringCount?: number;            // shrine-fox-offering（内部カウント）
}
```

`WorldEvent.status` は介入後に `"resolved"` になる（既存の `EventStatus` を使う）。

---

## 5. Dice Resolution

### 5-1. rollD20 — deterministic

```ts
function rollD20(seed: string): number
// 同じ seed に対して常に同じ値を返す
// 結果は 1〜20
```

`stableHash(seed) % 20 + 1` で実装する。  
seed は `"${sessionId}:${eventId}:${interventionType}"` を推奨。

### 5-2. resolveEventJudgement

```ts
function resolveEventJudgement(input: {
  seed: string;
  eventId: string;
  interventionType: InterventionKind;
  character: Character;          // primaryCharacter
  threshold?: number;            // default 11
}): EventJudgement
```

判定式:

```
total = roll + modifier
outcome = total >= threshold ? "success" : "failure"
```

### 5-3. Modifier rules

MVP では以下だけ。複雑化しない。

| 条件 | modifier |
|---|---|
| `watch` かつ `insight >= 60` | +2 |
| `help` かつ `empathy >= 60` または `harmony >= 60` | +1 |
| `trial` かつ `courage >= 60` | +2 |
| `stress >= 70`（介入種別問わず） | -1 |

**Could（Sprint 9 では任意）:**  
`principleProfile` と character の implicit phase が合う場合に +1 する。  
実装難易度が上がるため、Sprint 9 では Must 対象外。

---

## 6. Effect Application

### 6-1. 適用順序

1. `resolveEventJudgement()` で outcome を決める
2. templateId ごとの `EventOutcomeEffect` を参照する
3. status delta / relation delta / worldStatusTags を適用する
4. `structuredPayload` に outcome / judgement / outcomeSummary を書く
5. event.status を `"resolved"` にする
6. 既存の faith delta（`FAITH_DELTA_BY_TRIGGER`）は維持する

### 6-2. faith との関係

faith delta は現行の `FAITH_DELTA_BY_TRIGGER` に委譲する。  
`success` なら既存の `watch_success` / `help_success` / `trial_success` を適用。  
`failure` なら `watch_failure` / `help_failure` / `trial_failure` を適用。  
これにより既存 faith system を壊さずに成功/失敗を反映できる。

---

## 7. Event Matrix

7イベントの詳細は `docs/artifacts/event-outcome-matrix.html` を正本とする。  
以下はサマリ。

| templateId | displayName | participants | threshold | chained |
|---|---|---|---|---|
| `moving-stone` | 謎の動く石 | 1 | 11 | なし |
| `shrine-prayer-wish` | お参りと願い | 1 | 11 | なし |
| `strange-grass-found` | 変な草を拾う | 1 | 11 | なし |
| `shared-nap-place` | 同じ場所で昼寝 | 2 | 11 | なし |
| `mysterious-footprints` | 謎の足あと | 1 | 11 | なし |
| `legendary-big-fish` | 伝説の大きな魚 | 1 | 13（rare） | なし |
| `shrine-fox-offering` | 祠の油揚げ | 1 | 11 | `fox-shrine-visitor`（3回成功後） |

---

## 8. Special Event: shrine-fox-offering（油揚げ蓄積）

このイベントだけは蓄積型。

- `success` ごとに `structuredPayload.offeringCount` を +1 する
- `offeringCount >= 3` になったとき `chained event: fox-shrine-visitor` を発生させる
- `failure` では count は増えない
- count の数値は UI に強調表示しない。「祠に気配が濃くなっている」等の自然言語で表す

Sprint 9 では最低限として:

- `shrine-fox-offering` template の追加
- success / failure summary の返却
- `structuredPayload.offeringCollected = true/false`

`fox-shrine-visitor` chained event の発生ロジックと UI は次 PBI に委譲してよい。  
ただし型・コードコメントで将来の chain 接続を示すこと。

---

## 9. Dialogue Triggers

| trigger | 発生タイミング | LLM 使用 |
|---|---|---|
| `event_started` | イベント発生時 | 既存 runtime に委譲 |
| `intervention_applied` | 神が介入した直後 | 既存 runtime に委譲 |
| `event_resolved` | outcome 決定後 | 既存 runtime に委譲 |

Sprint 9 では新しい dialogue trigger を追加しない。  
既存 `event_started` / `intervention_applied` trigger が outcome 情報を参照できるよう、`structuredPayload` に outcome を入れれば十分。

---

## 10. Security & Invariants

- **LLM は outcome を決定しない**。domain logic が deterministic に決める
- **faith / 五行内部値は UI に露出しない**（既存 output_guard が保護）
- **modifier の計算に faithBand や relation score を直接使わない**（CharacterStatusBlock の公開フィールドのみ参照）
- `resolveEventJudgement()` は pure function にする（副作用なし）

---

## 11. Acceptance Criteria for PBI 9a-core

| # | テスト内容 |
|---|---|
| 1 | `rollD20(seed)` が同じ seed で同じ値を返す |
| 2 | `rollD20(seed)` の結果が 1〜20 |
| 3 | total >= threshold のとき outcome が `"success"` |
| 4 | total < threshold のとき outcome が `"failure"` |
| 5 | watch / help / trial の modifier が正しく適用される |
| 6 | stress >= 70 のとき modifier が -1 される |
| 7 | 7 templateId が `EVENT_TEMPLATES` に存在する |
| 8 | 各 template が `principleProfile` を持つ |
| 9 | 各 template が `summaryTemplate` を持つ |
| 10 | 介入後の `structuredPayload.outcome` が `"success"` または `"failure"` |
| 11 | `judgement.roll` が 1〜20 |
| 12 | `judgement.total` が `roll + modifier` と一致 |
| 13 | `shrine-fox-offering` template が存在し、success/failure summary が返る |
| 14 | faith / 信仰度 の数値が sandbox UI テキストに出ない（既存テスト継続） |
| 15 | `npm run typecheck && npm run test:domain && npm run test:ai && npm run build` pass |

---

## 12. Out of Scope (Sprint 9)

- fumble / critical / greatSuccess の多段階分岐
- fox-shrine-visitor chained event の発生ロジック
- 新しい dialogue trigger の追加
- UI 表示の変更
- EventFirstSandbox の変更
- LLM 連携の変更
- Passport の変更
- semantic cache / RAG / autonomous agent

---

## 13. References

- `docs/artifacts/event-outcome-matrix.html` — 7イベント詳細マトリクス（正本）
- `src/domain/models.ts` — `EventTemplate`, `WorldEvent`, `CharacterStatusBlock`
- `src/domain/events.ts` — `EVENT_TEMPLATES`, `createWorldEvent`
- `src/domain/interventions.ts` — `applyIntervention`, `STATUS_DELTA_BY_INTERVENTION`
- `docs/product/faith-system-spec.md` — faith システム仕様（変更しない）
