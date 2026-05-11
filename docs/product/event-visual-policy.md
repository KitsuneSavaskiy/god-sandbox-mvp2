# Event Visual Policy

**PBI:** 9c-visual-policy
**Status:** Draft — PO review required before implementation merge
**Last updated:** 2026-05-11
**Owner:** Claude1 / Product Policy lane

---

## 1. Purpose

GodSandbox のイベントに関して、イベントの「発生源」と「ビジュアル素材の調達方法」を分類し、MVP で採用する方針を明文化する。

---

## 2. Event Source Classification

イベントの発生源を以下の2種に分類する。

```ts
type EventSourceKind =
  | "authored_template"
  | "llm_generated";
```

### authored_template

- ゲームロジック側が `EventTemplate` として定義したイベント
- `src/domain/events.ts` の `EVENT_TEMPLATES` に基づいて生成される
- outcome / judgement / visual mapping を安全にテスト・検証できる
- **MVP 対象**

### llm_generated

- 将来、LLM がセッション文脈から提案するイベント
- **MVP では対象外**
- 採用要件（いずれも必須）:
  - domain validation（`src/ai/schemas/` を通す）
  - safety guard（`src/ai/security/output_guard.ts` を通す）
  - LLM が許可されたイベントスキーマ内のみ生成できる制限
  - LLM はゲーム状態を直接変更しない（CLAUDE.md 絶対ルール）
  - fallback visual の準備
  - PO review flow for generated event content

---

## 3. Visual Source Classification

イベントに表示するビジュアル素材の調達方法を以下の3種に分類する。

```ts
type EventVisualSourceKind =
  | "preauthored_event_art"
  | "generated_event_art"
  | "fallback";
```

### preauthored_event_art

- 事前に制作された固定のイベントイラスト
- `templateId` からファイルパスを静的に参照できる
- PO が確認・承認済みの素材を `public/art/events/` に配置する
- **MVP 対象**

### generated_event_art

- `#292` のイベント画像 request CLI（`tools/sidekick/event-image-request.mjs`）を入口にする将来フロー
- CLI はリクエスト JSON と prompt.md を生成するが、画像生成 API には接続しない
- 生成画像の `public/art/` への昇格は PO 確認後の別 PBI で行う
- **MVP では対象外。PO 確認後に別 PBI で昇格**
- 詳細は `docs/operations/event-image-sidekick-flow.md` を参照

### fallback

- 個別の event art が未準備の場合に表示する汎用素材
- assetId: `event-art-fallback-generic`
- proposedPath: `public/art/events/_fallback/generic-event.png`
- UI 実装時の安全弁として必ず用意する
- **実画像の配置は asset 準備 PBI（PBI 9c-assets）で行う**

---

## 4. MVP Decision

MVP では以下の組み合わせのみを採用する。

```txt
event source:    authored_template
visual source:   preauthored_event_art
```

MVP の対象イベント（7件）:

| templateId | displayName | visual phase |
|---|---|---|
| `moving-stone` | 謎の動く石 | `event_started` |
| `shrine-prayer-wish` | お参りと願い | `event_started` |
| `strange-grass-found` | 変な草を拾う | `event_started` |
| `shared-nap-place` | 同じ場所で昼寝 | `event_started` |
| `mysterious-footprints` | 謎の足あと | `event_started` |
| `legendary-big-fish` | 伝説の大きな魚 | `event_started` |
| `shrine-fox-offering` | 祠の油揚げ | `event_started` |

**MVP では `event_started` 用の1枚を表示する。** success / failure ごとの画像差分は必須にしない。

参照: `docs/product/event-outcome-system-spec.md` — イベント outcome とサイコロ判定の仕様

---

## 5. MVP でやらないこと

以下は明示的に MVP スコープ外とする。

- 参加キャラの立ち絵を含めたイベント画像の都度生成
- LLM によるイベント内容の生成
- LLM による outcome / judgement の決定（ゲームロジックが deterministic に決める）
- 生成画像の自動採用・自動昇格
- `public/art/` への画像の自動配置
- success / failure ごとの画像差分（必須化しない）
- キャラ固有の外見をイベント画像に毎回反映すること
- LLM-generated event の runtime 接続

---

## 6. Future Expansion Order

将来の拡張を以下の順番で推奨する。

```txt
Step 1: authored_template + preauthored_event_art    ← MVP（現在）
Step 2: authored_template + generated_event_art
Step 3: llm_generated + fallback
Step 4: llm_generated + generated_event_art
```

### Step 2 に進む条件

- preauthored_event_art が全 7 イベント分揃っている
- generated_event_art の PO review flow が整備されている
- `#292` CLI と `public/art/` 昇格フローが検証済み

### Step 3 以降に進む条件

Step 2 の条件に加えて:

- domain validation（allowed event schema）が実装されている
- safety guard / output_guard が LLM-generated event に対して有効
- LLM がゲーム状態を直接変更しないことをテストで担保できている
- fallback visual が常に表示できる
- PO review flow for generated event content が整備されている

---

## 7. Next PBI Candidates

### PBI 9c-assets

- 7イベントの preauthored event art asset list を作る
- assetId / templateId / proposedPath / fallback を整理する
- 制作ブリーフ（English image prompt / scene brief）を用意する
- 詳細: `docs/operations/preauthored-event-art-asset-list.md`（PBI 9c-assets で作成）

### PBI 9c-ui

- `EventFirstSandbox` またはイベントパネルで、`templateId` → `preauthored_event_art` の表示を実装する
- event art が未準備の場合は fallback を表示する
- `src/features/**` のみ変更する

### PBI 9d-generated-art

- `#292` の event image request CLI を使って generated_event_art フローを検証する
- PO 確認後に `public/art/events/` への昇格フローを整備する
- 詳細は `docs/operations/event-image-sidekick-flow.md` を参照

---

## 8. Security & Invariants

- **ビジュアル素材を表示するだけで、ゲーム状態は変更しない**
- **UI には faith / 五行内部値・relation score の数値を表示しない**（既存 invariant の継続）
- **event art のパスは `public/art/events/` 配下に限定する**（repo 外参照禁止）
- **LLM は event source / visual source を直接決定しない**
- generated_event_art を採用する際は必ず PO が確認する

---

## 9. References

- `docs/product/event-outcome-system-spec.md` — イベント outcome / サイコロ判定仕様
- `docs/operations/event-image-sidekick-flow.md` — event image request CLI の使い方
- `docs/art-prompts/event-images/event-image-request-template.md` — 画像生成依頼テンプレート
- `src/domain/models.ts` — `EventTemplate`, `WorldEvent`
- `src/domain/events.ts` — `EVENT_TEMPLATES`
- `tools/sidekick/event-image-request.mjs` — event image request CLI（`#292` 実装）
