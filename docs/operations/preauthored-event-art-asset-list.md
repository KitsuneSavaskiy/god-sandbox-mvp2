# Preauthored Event Art — Asset List

**PBI:** 9c-assets  
**Lane:** Claude2 / Event Art Asset Planning  
**Last updated:** 2026-05-11  
**Visual policy:** see `docs/product/event-visual-policy.md`

---

## MVP 方針

MVPでは、イベントごとに事前作成した固定 event art（`preauthored_event_art`）を表示する。  
イベント画像の都度生成は行わない。

- `eventPhase = started` の画像 1 枚を MVP 必須とする
- `success` / `failure` 画像は **optional / future** とする
- 固有キャラ（Ryo / Suzu 等）の外見再現は MVP 必須にしない
- art がない templateId には fallback を使う

---

## Asset ID / Path 規則

| 項目 | 規則 |
|---|---|
| assetId | `event-art-{templateId}-{phase}` |
| proposedPath | `public/art/events/{templateId}/{phase}.svg`（MVP）/ 将来 PO 承認の本画像（PNG 等）に置き換え可能 |
| phase 種別 | `started`（MVP必須）/ `success`（future）/ `failure`（future） |
| fallbackAssetId | `event-art-fallback-generic` |
| fallback path | `public/art/events/_fallback/generic-event.svg`（MVP）|

---

## 7 イベント Asset 一覧

### started（MVP 必須）

| templateId | displayName | assetId | proposedPath | visualSourceKind | eventPhase | notes |
|---|---|---|---|---|---|---|
| `moving-stone` | 謎の動く石 | `event-art-moving-stone-started` | `public/art/events/moving-stone/started.svg` | preauthored_event_art | started | |
| `shrine-prayer-wish` | お参りと願い | `event-art-shrine-prayer-wish-started` | `public/art/events/shrine-prayer-wish/started.svg` | preauthored_event_art | started | |
| `strange-grass-found` | 変な草を拾う | `event-art-strange-grass-found-started` | `public/art/events/strange-grass-found/started.svg` | preauthored_event_art | started | |
| `shared-nap-place` | 同じ場所で昼寝 | `event-art-shared-nap-place-started` | `public/art/events/shared-nap-place/started.svg` | preauthored_event_art | started | 2人イベント |
| `mysterious-footprints` | 謎の足あと | `event-art-mysterious-footprints-started` | `public/art/events/mysterious-footprints/started.svg` | preauthored_event_art | started | |
| `legendary-big-fish` | 伝説の大きな魚 | `event-art-legendary-big-fish-started` | `public/art/events/legendary-big-fish/started.svg` | preauthored_event_art | started | rare (threshold 13) |
| `shrine-fox-offering` | 祠の油揚げ | `event-art-shrine-fox-offering-started` | `public/art/events/shrine-fox-offering/started.svg` | preauthored_event_art | started | 蓄積型 |

### success / failure（optional / future）

| templateId | assetId | proposedPath | eventPhase | notes |
|---|---|---|---|---|
| `moving-stone` | `event-art-moving-stone-success` | `public/art/events/moving-stone/success.png` | success | future |
| `moving-stone` | `event-art-moving-stone-failure` | `public/art/events/moving-stone/failure.png` | failure | future |
| `shrine-prayer-wish` | `event-art-shrine-prayer-wish-success` | `public/art/events/shrine-prayer-wish/success.png` | success | future |
| `shrine-prayer-wish` | `event-art-shrine-prayer-wish-failure` | `public/art/events/shrine-prayer-wish/failure.png` | failure | future |
| `strange-grass-found` | `event-art-strange-grass-found-success` | `public/art/events/strange-grass-found/success.png` | success | future |
| `strange-grass-found` | `event-art-strange-grass-found-failure` | `public/art/events/strange-grass-found/failure.png` | failure | future |
| `shared-nap-place` | `event-art-shared-nap-place-success` | `public/art/events/shared-nap-place/success.png` | success | future |
| `shared-nap-place` | `event-art-shared-nap-place-failure` | `public/art/events/shared-nap-place/failure.png` | failure | future |
| `mysterious-footprints` | `event-art-mysterious-footprints-success` | `public/art/events/mysterious-footprints/success.png` | success | future |
| `mysterious-footprints` | `event-art-mysterious-footprints-failure` | `public/art/events/mysterious-footprints/failure.png` | failure | future |
| `legendary-big-fish` | `event-art-legendary-big-fish-success` | `public/art/events/legendary-big-fish/success.png` | success | future |
| `legendary-big-fish` | `event-art-legendary-big-fish-failure` | `public/art/events/legendary-big-fish/failure.png` | failure | future |
| `shrine-fox-offering` | `event-art-shrine-fox-offering-success` | `public/art/events/shrine-fox-offering/success.png` | success | future |
| `shrine-fox-offering` | `event-art-shrine-fox-offering-failure` | `public/art/events/shrine-fox-offering/failure.png` | failure | future |

---

## Fallback Asset

個別 event art が未準備の templateId には fallback を使う。

| assetId | proposedPath | visualSourceKind | 用途 |
|---|---|---|---|
| `event-art-fallback-generic` | `public/art/events/_fallback/generic-event.svg` | fallback | 個別 art 未準備時の汎用表示 |

MVPでは `.svg` を使用。将来 PO 承認の本画像（PNG 等）に置き換える場合は proposedPath の拡張子を変更する。

---

## templateId → assetId マッピング（MVP参照用）

UI 実装時は `templateId` から `started` assetId を引くだけでよい。

```ts
// MVP: templateId → started art のマッピング例
const EVENT_ART_MAP: Record<string, string> = {
  "moving-stone":          "event-art-moving-stone-started",
  "shrine-prayer-wish":    "event-art-shrine-prayer-wish-started",
  "strange-grass-found":   "event-art-strange-grass-found-started",
  "shared-nap-place":      "event-art-shared-nap-place-started",
  "mysterious-footprints": "event-art-mysterious-footprints-started",
  "legendary-big-fish":    "event-art-legendary-big-fish-started",
  "shrine-fox-offering":   "event-art-shrine-fox-offering-started",
};
const FALLBACK_ART_ID = "event-art-fallback-generic";
```

このマッピングの実装は PBI 9c-ui に委ねる。このファイルはあくまで asset 計画 docs。

---

## 実画像の状態

| 状態 | 内容 |
|---|---|
| 配置済み（SVG） | 全 7 event の started SVG（`public/art/events/{templateId}/started.svg`）、fallback SVG（`public/art/events/_fallback/generic-event.svg`） |
| 未制作 | success / failure 画像、PO承認済みの本画像（PNG 等） |
| 本画像への置き換え手順 | `docs/art-prompts/event-images/preauthored-event-art-briefs.md` を参照し PO 確認後に別 PBI で配置 |
| 採用フロー | PO 確認後に別 PBI で `public/art/events/` へ配置し、proposedPath の拡張子を更新 |

---

## 次 PBI との関係

| PBI | 内容 |
|---|---|
| **9c-assets（本 PBI）** | asset list と制作ブリーフ（このファイル） |
| 9c-visual-policy | MVP 方針の正本（Claude1 担当） |
| 9c-ui | EventFirstSandbox / event panel に templateId → event art 表示を実装 |
| 9d-generated-art | `tools/sidekick/event-image-request.mjs` を使った generated_event_art フロー検証 |
