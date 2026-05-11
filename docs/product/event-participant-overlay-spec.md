# Event Participant Overlay UX Spec

**PBI:** 9e-participant-overlay-ux-spec
**Status:** Draft — PO review required before implementation merge
**Last updated:** 2026-05-11
**Owner:** Claude1 / Product UX Spec lane

---

## 1. Purpose

イベント画面で「どのキャラがこのイベントに関わっているか」を一目で伝える。

`WorldEvent.participantCharacterIds`（最大4名）の参加キャラを、イベント背景画像の左右からサイドイン / サイドアウトする透過立ち絵オーバーレイとして表示する。

背景: #295（outcome 記録）・#296（event art 表示）により、イベント体験の基盤が整った。次は「誰が関わっているか」の視覚的な伝達が最大価値となる。

---

## 2. Display Policy

| 項目 | 方針 |
|---|---|
| event background | `preauthored_event_art`（`eventArt.ts` の既存 mapping） |
| participant layer | `participant_overlay_art`（別レイヤー、背景と合成） |
| キャラ素材 | overlay 専用 neutral-body 画像（`public/art/characters/defaults/{slug}/overlays/event-participant/neutral-body.png`）。既存 portrait は制作時の reference にとどめ、runtime overlay では neutral-body を使う |
| 最大参加人数 | 4名 |
| キャラ焼き込み | **しない**。背景画像とキャラ画像を別レイヤーで合成 |
| キャラ画像 | 背景透過済み（PNG neutral-body） |
| キャラ背景 | 白背景・単色背景・別背景を持たせない |

### レイヤー構造

```
┌──────────────────────────────────────┐
│  event background (z-index: 0)       │
│  preauthored_event_art               │
│                                      │
│  [char left]        [char right]     │  ← participant overlay (z-index: 1)
│  z-index: 10/11    z-index: 10/11   │
│                                      │
│  [intervention buttons] (z-index: 20)│
│  [result modal]        (z-index: 30) │
└──────────────────────────────────────┘
```

---

## 3. Slot Layout

参加人数に応じて、最大4スロットに割り当てる。

```ts
type EventParticipantOverlaySlot =
  | "left-front"
  | "right-front"
  | "left-back"
  | "right-back";
```

### 1名

```
[primary: left-front]
```

### 2名

```
[primary: left-front]   [supporting1: right-front]
```

### 3名

```
[primary: left-front]   [supporting1: right-front]
[supporting2: left-back]
```

### 4名

```
[primary: left-front]   [supporting1: right-front]
[supporting2: left-back] [supporting3: right-back]
```

### スロット位置ガイドライン

| slot | x 位置 | y オフセット | scale | z-index |
|---|---|---|---|---|
| `left-front` | 左端から 5〜10% | 基準 | 1.0 | 11 |
| `right-front` | 右端から 5〜10% | 基準 | 1.0 | 11 |
| `left-back` | 左端から 15〜20% | +10〜15px（奥感） | 0.85 | 10 |
| `right-back` | 右端から 15〜20% | +10〜15px（奥感） | 0.85 | 10 |

- 左右に偏りすぎない
- 同じ側に2名いる場合は front/back・scale・offset で重なりを軽減する
- 介入ボタン・吹き出しを覆わない高さに調整する

---

## 4. Role Presentation

| role | 表示サイズ | 奥行き感 | slot |
|---|---|---|---|
| `primary` | 100%（基準） | 手前（front） | `left-front` |
| `supporting` | 85%（front）/ 75%（back） | front または back | 右 → 左 の順で埋める |

- 名前ラベル・HP・faith 値・relation score・五行内部値は**表示しない**
- アクセシビリティ用に `aria-label` または `title` で表示名を補助する
- hover で名前を表示してもよい（実装判断）

---

## 5. Animation

### 5-1. Side-in（event window open）

| side | 方向 | 効果 |
|---|---|---|
| left-front / left-back | 画面左外 → 定位置 | `translateX(-100%) → 0` |
| right-front / right-back | 画面右外 → 定位置 | `translateX(100%) → 0` |

- duration: 300〜400ms
- easing: `ease-out`（入り方に自然な減速感）
- 複数キャラは同時に side-in する

### 5-2. Side-out（event window close）

| side | 方向 |
|---|---|
| left-front / left-back | 定位置 → 画面左外 |
| right-front / right-back | 定位置 → 画面右外 |

- duration: 200〜300ms（開くより短め）
- easing: `ease-in`

#### Exiting state（実装要件）

event window close を受けてもコンポーネントを即 unmount してはならない。side-out アニメーションの duration（200〜300ms）が完了するまで **exiting 状態を保持**し、アニメーション終了後に DOM から除去する。

```
close イベント受信
  → overlay を "exiting" 状態に移行（side-out CSS 適用）
  → 200〜300ms 後に unmount / DOM 除去
```

`prefers-reduced-motion: reduce` 時はアニメーションなし。即 unmount で可。

### 5-3. `prefers-reduced-motion` 対応

`@media (prefers-reduced-motion: reduce)` では、side-in / side-out のトランスレーション animation を適用しない（透明度のみ、または即座に表示）。

### 5-4. 干渉禁止

- 介入ボタン（watch / help / trial）の操作中にアニメーションが画面をブロックしない
- result modal（outcome 表示）が出た後にキャラが覆わない（z-index で担保）
- resident の移動アニメーション・speech bubble と視覚的に混在しない

---

## 6. Display Timing

| タイミング | 動作 |
|---|---|
| event window open | 参加キャラを side-in で表示 |
| event window close | "exiting" 状態に移行 → side-out アニメーション（200〜300ms）→ unmount |
| templateId 変化（次イベント生成） | overlay を更新（slide-out → slide-in） |
| event art が fallback のとき | participant overlay は通常通り表示 |
| participant portrait が未準備 | fallback silhouette を表示、または非表示 |

---

## 7. ViewModel Design

### 7-1. Slot assignment

```ts
export type EventParticipantOverlaySlot =
  | "left-front"
  | "right-front"
  | "left-back"
  | "right-back";

export type EventParticipantOverlayViewModel = {
  characterId: string;
  displayName: string;
  role: "primary" | "supporting";
  slot: EventParticipantOverlaySlot;
  src: string | null;       // participant overlay neutral-body path（null の場合は fallback を使う）
  fallbackSrc: string;      // fallback silhouette path
  alt: string;
};
```

### 7-2. Slot 割り当てロジック（実装ガイド）

```ts
// Slot assignment order based on participant count
const SLOT_ORDER_BY_COUNT: Record<number, EventParticipantOverlaySlot[]> = {
  1: ["left-front"],
  2: ["left-front", "right-front"],
  3: ["left-front", "right-front", "left-back"],
  4: ["left-front", "right-front", "left-back", "right-back"],
};

// primaryCharacterId always gets the first slot (left-front)
```

### 7-3. Neutral-body ソース

overlay 専用の neutral-body アセットが `ready === true && path != null` の場合にパスを使用する。それ以外は `fallbackSrc`（fallback silhouette）を表示する。

パス規約: `public/art/characters/defaults/{slug}/overlays/event-participant/neutral-body.png`

```ts
const src = assetBundle?.overlayNeutralBody?.ready && assetBundle.overlayNeutralBody.path
  ? assetBundle.overlayNeutralBody.path
  : null;
// overlayNeutralBody フィールドは PBI 9e-assets で CharacterAssetBundle に追加する
```

### 7-4. Fallback silhouette

- assetId: `fallback-event-participant-silhouette`
- proposedPath: `public/art/characters/defaults/_fallback/overlays/event-participant/silhouette.png`
- 実画像は asset 準備 PBI（PBI 9e-assets）で用意する
- MVP 実装時は neutral-body が準備できているキャラのみ表示し、なければ非表示で可

---

## 8. Accessibility

- 各キャラ `<img>` には `alt="[displayName]の立ち絵"` を付ける
- 装飾的な役割ではなく「誰がいるか」の情報を伝えるため、空 alt は使わない
- `aria-hidden="true"` にはしない
- reduced-motion 対応（Section 5-3 参照）

---

## 9. MVP でやらないこと

- イベント背景画像へのキャラ焼き込み
- 画像生成 AI でイベントごとにキャラ入り画像を生成
- キャラのポーズ差分（驚き・喜び等）の生成
- success / failure ごとの立ち絵演出の差分
- faith 値・relation score・五行内部値の表示
- LLM が表示キャラを決めること
- イベント参加者以外のキャラ表示
- キャラ独自の background（白背景・グラデーション等）を overlay に持たせること

---

## 10. Acceptance Criteria for Implementation PBI

| # | 確認項目 |
|---|---|
| 1 | 最大4名の slot 割り当てが正しい（1/2/3/4名それぞれ） |
| 2 | primaryCharacterId が必ず `left-front` slot に割り当てられる |
| 3 | event window open で side-in アニメーションが動作する |
| 4 | event window close で side-out アニメーションが動作する |
| 5 | `prefers-reduced-motion: reduce` 時にアニメーションが発生しない |
| 6 | 介入ボタンが overlay で隠れない |
| 7 | result modal が overlay より前面に表示される（z-index 担保） |
| 8 | neutral-body 未準備キャラは fallback silhouette または非表示になる |
| 9 | event art が fallback でも participant overlay は表示される |
| 10 | templateId 変化（次イベント）で overlay が更新される |
| 11 | UI に faith / relation score / 五行内部値が表示されない |
| 12 | `npm run typecheck && npm run test:domain && npm run build` pass |

---

## 11. Next PBI Candidates

### PBI 9e-assets

- fallback silhouette png を用意する（`public/art/characters/defaults/_fallback/overlays/event-participant/silhouette.png`）
- 7キャラ分の overlay 専用 neutral-body 画像を整備する（`public/art/characters/defaults/{slug}/overlays/event-participant/neutral-body.png`）
- `CharacterAssetBundle` に `overlayNeutralBody` フィールドを追加する

### PBI 9e-ui（実装 PBI）

- `src/features/events/eventParticipantOverlay.ts` — slot 割り当て・ViewModel 組み立て
- `src/features/events/EventParticipantOverlay.tsx` — overlay コンポーネント
- `src/features/events/EventParticipantOverlay.css` — slot 位置・アニメーション CSS
- `src/features/events/EventFirstSandbox.tsx` — overlay をイベント画面に組み込む

---

## 12. References

- `docs/product/event-visual-policy.md` — イベントビジュアル MVP 方針（背景 / overlay の役割分担）
- `docs/product/event-outcome-system-spec.md` — イベント outcome / 参加者データの仕様
- `docs/operations/preauthored-event-art-asset-list.md` — event art asset 一覧
- `src/domain/models.ts` — `WorldEvent`, `CharacterAssetBundle`
- `src/features/events/eventArt.ts` — `EventArtViewModel`（overlay ViewModel の参考）
- `src/features/events/EventFirstSandbox.tsx` — 既存の portrait / assetBundle 参照パターン
