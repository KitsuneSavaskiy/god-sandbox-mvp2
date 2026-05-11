# Event Participant Overlay Asset Pipeline

**PBI:** 9e-participant-overlay-assets  
**Lane:** Claude2 / Event Participant Overlay Asset Design  
**Last updated:** 2026-05-11  
**Art brief:** see `docs/art-prompts/event-images/participant-overlay-alpha-briefs.md`  
**Related:** `docs/operations/preauthored-event-art-asset-list.md`

---

## 目的

イベントに関わるキャラ（最大4名）を、event art の上に別レイヤーとして重ねて表示する。  
キャラ素材は背景透過の body-only image とし、event art と不自然に重複しないようにする。

---

## 1. Asset Kind 分類

```ts
type ParticipantOverlayAssetKind =
  | "transparent_body"      // MVP推奨
  | "transparent_bust"      // future: 半身のみ、狭いUI向け
  | "fallback_silhouette";  // 個別素材未準備時の汎用シルエット
```

### MVP推奨: `transparent_body`

- 背景は完全透過（alpha channel 必須）
- キャラの体のみ（頭〜足）を含む
- キャラ周囲に白背景・イベント背景・単色背景を含めない
- 地面・床・空・室内背景を含めない

---

## 2. ファイル配置

### 本素材（キャラ別）

```
public/art/characters/defaults/{characterSlug}/overlays/event-participant/neutral-body.png
public/art/characters/defaults/{characterSlug}/overlays/event-participant/neutral-body.webp  （future optional）
```

対象キャラ（MVP時点）:

| characterSlug | displayName |
|---|---|
| `ryo` | Ryo |
| `suzu` | Suzu |
| `eve` | Eve |
| `garan` | Garan |

### Fallback シルエット

```
public/art/characters/defaults/_fallback/overlays/event-participant/silhouette.png
```

個別 body 素材が未準備のキャラに使用する。  
人物の外形のみを塗りつぶした、汎用シルエット画像。

### フォーマット

| フォーマット | 方針 |
|---|---|
| PNG | MVPで推奨。alpha channel が扱いやすく、body-only の確認がしやすい |
| WebP | 将来 optional。ファイルサイズ削減が必要な場合に PO 判断で追加 |

---

## 3. assetId 規則

```
{characterSlug}-event-participant-neutral-body
{characterSlug}-event-participant-bust   （future）
fallback-event-participant-silhouette
```

例:

| characterSlug | assetId |
|---|---|
| `ryo` | `ryo-event-participant-neutral-body` |
| `suzu` | `suzu-event-participant-neutral-body` |
| `eve` | `eve-event-participant-neutral-body` |
| `garan` | `garan-event-participant-neutral-body` |
| fallback | `fallback-event-participant-silhouette` |

---

## 4. 画像要件

### 必須

- 背景は完全透明（alpha channel あり）
- 頭〜足が全て見える（体が途中で切れない）
- 髪・衣装・手足・その他キャラ固有の要素が切れない
- キャラ体の外側に背景色の縁取り（matting / halo）を残さない
- event background を含めない
- 地面・床・空・室内背景を含めない

### キャラ表現

- 既存の portrait / sprite と識別性を保つ（別キャラに見えない）
- 既存 portrait / sprite と大きく矛盾しない外見
- ニュートラル〜穏やかな立ちポーズ
- ドラマチックな成功/失敗ポーズは MVP 不要

### 含めないもの

- UI 要素、名前テキスト、数値
- faith 値・internal parameter・HP・スコア
- ホラー演出、流血、重大な怪我
- 複数キャラを1枚に同梱（1ファイル = 1キャラ）

### 影

- 基本なし
- 入れる場合は薄い drop shadow 相当の透過影のみ（地面影は不可）

---

## 5. 推奨サイズ

### canvas

| 項目 | 値 |
|---|---|
| 推奨解像度（大） | 1024 × 1536 px（portrait aspect, 2:3） |
| 推奨解像度（小） | 768 × 1152 px |
| aspect ratio | portrait（縦長） |

### visible body

| 項目 | 値 |
|---|---|
| body が占める高さ | canvas height の 78〜92% |
| 上下の透過余白 | 各 4〜10% |
| 横の透過余白 | 体の輪郭が切れない最小限 |

### runtime 表示サイズ

MVPのUIでは縮小表示するため、高解像度すぎる必要はない。

```css
/* 参考: runtime 表示時の clamp 案 */
max-height: clamp(180px, 34vh, 360px);
```

---

## 6. α品質チェック（受け入れ確認）

画像を受け取った際に確認する項目:

### 必須確認

- [ ] alpha channel がある（PNG で確認）
- [ ] 四隅のピクセルが透明
- [ ] 透明ピクセルが十分ある（概ね面積の 40% 以上が透明）
- [ ] キャラ輪郭が切れていない（頭・手足・衣装端）
- [ ] 背景色のマッティング（白縁・色縁）が残っていない
- [ ] 体の輪郭外にゴミピクセルが少ない
- [ ] ファイルサイズが過大でない（目安: PNG で 1MB 未満。品質優先で PO 判断可能）

### 表示確認

- [ ] event art の上に重ねたとき不自然でない
- [ ] event art の背景色と素材の縁が混合していない
- [ ] 複数の event art に重ねても違和感がない

### 将来のチェックコマンド案（MVP では未実装）

```bash
npm run participant-overlay:check -- ryo
```

確認観点: alpha channel 有無、四隅透過、ファイルサイズ、解像度。  
今回は実装しない。別 PBI で CLI または CI チェックとして追加予定。

---

## 7. #292 CLI との関係

| 項目 | 内容 |
|---|---|
| #292 CLI の用途 | event illustration（背景付きのイベントシーン画像）の request 作成 |
| participant overlay の位置づけ | event art とは別の独立した asset pipeline |
| 合成タイミング | runtime で別レイヤーとして重ねる（event art にキャラを焼き込まない） |
| CLI との将来的な連携 | 将来、CLI の `--participant` に overlay reference を渡すことは可能。MVP では不要 |

participant overlay は event art と**同一ファイルに焼き込まない**。  
UI 側が event art レイヤー + overlay レイヤーをそれぞれ `<img>` / CSS で重ねる実装を想定する。

---

## 8. Fallback 方針

| 状況 | 使用するasset |
|---|---|
| キャラの `neutral-body.png` が未配置 | `fallback-event-participant-silhouette` |
| fallback 自体も未配置 | overlay 非表示（event art のみ表示） |

fallback silhouette はキャラを特定しない汎用シルエット（性別・種族不問）。

---

## 9. 実素材の状態

| 状態 | 内容 |
|---|---|
| 未制作 | 全キャラの `neutral-body.png`、fallback `silhouette.png` |
| 制作ブリーフ | `docs/art-prompts/event-images/participant-overlay-alpha-briefs.md` を参照 |
| 採用フロー | PO 確認後に別 PBI で `public/art/characters/defaults/{slug}/overlays/event-participant/` へ配置 |

---

## 10. 次 PBI との関係

| PBI | 内容 |
|---|---|
| **9e-participant-overlay-assets（本 PBI）** | asset 設計・ブリーフ docs（このファイル） |
| 9e-ui（future） | EventFirstSandbox でoverlay を event art の上に重ねて表示する実装 |
| 9e-overlay-check（future） | `participant-overlay:check` CLI / CI チェック実装 |
