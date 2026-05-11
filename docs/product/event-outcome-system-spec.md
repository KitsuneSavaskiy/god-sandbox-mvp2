# Event Outcome System Spec

**PBI:** 9a-spec
**Status:** Draft — PO review required before implementation merge
**Last updated:** 2026-05-11
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
6. 結末に応じて（Sprint 9a-core の範囲）:
   - `event.structuredPayload.outcome` / `judgement` / `outcomeSummary` を記録する
   - `event.status` は `"resolved"` になる
   - イベントテンプレート別の status delta / relation delta / worldStatusTags 適用は次 PBI で扱う
   - 蓄積型イベントの chained event 発生は次 PBI で扱う
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
  offeringCollected?: boolean;       // shrine-fox-offering: このイベント1件の成否のみ記録
  // offeringCount は Sprint 9 では実装しない（後述 Section 8 参照）
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
`stableHash` は UTF-16 code unit を用いた deterministic な文字列ハッシュ（暗号用途ではない）。外部ライブラリ不要で実装環境に依存しない。
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

### 6-1. 既存 intervention delta との関係

現行 `applyIntervention()` は `STATUS_DELTA_BY_INTERVENTION`（watch/help/trial 固定値）を全参加者へ適用する。
**Sprint 9a-core ではこの既存 delta を維持する。** イベント別 outcome delta は追加実装であり、既存 delta を置き換えない。

Sprint 9a-core での適用範囲:

- **維持:** 既存の `STATUS_DELTA_BY_INTERVENTION`（watch → insight+1 等）
- **維持:** 既存の `FAITH_DELTA_BY_TRIGGER`（success/failure 切り替えを利用）
- **追加:** `structuredPayload` への outcome / judgement / outcomeSummary の書き込み
- **保留（次 PBI）:** event テンプレート別の status delta / relation delta / worldStatusTags の適用

**実装者へ:** まず outcome resolver を domain 純粋関数として追加し、`structuredPayload` への記録だけを行う最小接続で十分。イベント別の追加 status delta 適用は次 PBI で行う。

### 6-2. 適用順序（Sprint 9a-core）

1. `resolveEventJudgement()` で outcome を決める
2. 既存 `STATUS_DELTA_BY_INTERVENTION` を適用する（変更なし）
3. `structuredPayload` に outcome / judgement / outcomeSummary を書く
4. event.status を `"resolved"` にする
5. faith delta: `success` なら `watch_success` / `help_success` / `trial_success`、`failure` なら `watch_failure` / `help_failure` / `trial_failure` を `FAITH_DELTA_BY_TRIGGER` 経由で適用する

### 6-3. faith との関係

faith delta は現行の `FAITH_DELTA_BY_TRIGGER` に委譲する。
outcome が `success` / `failure` どちらになるかで既存トリガーを切り替えるだけでよい。
これにより既存 faith system を壊さずに成功/失敗を反映できる。

---

## 7. Event Matrix

**本 Markdown 仕様が正本。** `docs/artifacts/event-outcome-matrix.html` は PO 向け補助資料として置くが、実装判断で迷う場合は本ファイルを優先する。

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

このイベントは将来的に蓄積型にする設計だが、**Sprint 9 では最小実装に留める**。

### Sprint 9 実装スコープ（Must）

- `shrine-fox-offering` template の追加
- success / failure summary の返却
- `structuredPayload.offeringCollected = true / false`（このイベント1件の成否のみ）

### Sprint 9 実装スコープ外（Out of Scope）

- `offeringCount` の複数イベントをまたいだ永続蓄積
- `fox-shrine-visitor` chained event の発生ロジックと UI

**理由:** `WorldEvent.structuredPayload` は1件のイベント固有状態であり、複数イベントをまたぐカウント保存には不適切。
蓄積値の永続先候補（`SandboxSession.worldStatusTags` の内部タグ、または将来の world-level state）は次 PBI で設計する。

### 将来仕様（次 PBI で実装）

- success ごとに通算 count +1（保存先は次 PBI で決定）
- count >= 3 で `chained event: fox-shrine-visitor` を発生させる
- count の数値は UI に強調表示しない。「祠に気配が濃くなっている」等の自然言語で表す

型・コードコメントで将来の chain 接続が可能であることを示しておくこと。

---

## 9. Dialogue Triggers

| trigger | 発生タイミング | Sprint 9 実装 |
|---|---|---|
| `event_started` | イベント発生時 | 既存 runtime に委譲（変更なし） |
| `intervention_applied` | 神が介入した直後 | 既存 runtime に委譲（変更なし） |
| `event_resolved` | outcome 決定後 | **Sprint 9 では runtime 接続しない** |

**Sprint 9a-core では新しい dialogue trigger の runtime 接続を行わない。**

`event_resolved` は `DialogueTrigger` 型として既に存在するが、Sprint 9 では fixture/runtime への接続は実装しない。
`structuredPayload.outcomeSummary` に outcome 文を書いておくことで、後続 PBI が `event_resolved` dialogue を実装できる状態にする。

**出力ガード:** `event_resolved` を次 PBI で接続する際も、LLM 出力は `output_guard` / `schemas` を通すこと（既存の dialogue runtime と同じ扱い）。

---

## 10. Security & Invariants

- **LLM は outcome を決定しない**。domain logic が deterministic に決める
- **LLM 出力の faith / 五行内部値露出は `output_guard` / `schemas` で防ぐ**（既存の dialogue runtime と同様）
- **sandbox UI での faith 数値非表示は `createVisibleChangePatchForSandboxUi` と既存テストで担保する**（output_guard の役割外）
- **modifier の計算に faithBand や relation score を直接使わない**（`CharacterStatusBlock` の公開フィールドのみ参照）
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
| 13 | `shrine-fox-offering` template が存在し、success/failure summary が返る（offeringCount 蓄積は対象外） |
| 14 | faith / 信仰度 の数値が sandbox UI テキストに出ない（既存テスト継続） |
| 15 | `npm run typecheck && npm run test:domain && npm run test:ai && npm run build` pass |

---

## 12. Out of Scope (Sprint 9)

- fumble / critical / greatSuccess の多段階分岐
- fox-shrine-visitor chained event の発生ロジック
- **offeringCount の複数イベントをまたぐ永続蓄積**（保存先設計は次 PBI）
- **イベントテンプレート別の追加 status delta / relation delta / worldStatusTags 適用**（次 PBI）
- `event_resolved` dialogue の runtime 接続（次 PBI）
- 新しい dialogue trigger 型の追加
- UI 表示の変更
- EventFirstSandbox の変更
- LLM 連携の変更
- Passport の変更
- semantic cache / RAG / autonomous agent

---

## 13. References

- `docs/artifacts/event-outcome-matrix.html` — 7イベント詳細マトリクス（PO向け補助資料。正本は本ファイル）
- `src/domain/models.ts` — `EventTemplate`, `WorldEvent`, `CharacterStatusBlock`
- `src/domain/events.ts` — `EVENT_TEMPLATES`, `createWorldEvent`
- `src/domain/interventions.ts` — `applyIntervention`, `STATUS_DELTA_BY_INTERVENTION`
- `docs/product/faith-system-spec.md` — faith システム仕様（変更しない）
- `docs/product/event-visual-policy.md` — イベントビジュアル MVP 方針（authored_template / preauthored_event_art）
