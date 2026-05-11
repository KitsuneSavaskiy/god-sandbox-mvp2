# Participant Overlay Alpha — Image Briefs

**PBI:** 9e-participant-overlay-assets  
**Lane:** Claude2 / Event Participant Overlay Asset Design  
**Last updated:** 2026-05-11  
**Pipeline doc:** see `docs/operations/event-participant-overlay-asset-pipeline.md`

> このファイルは Git 管理するアートプロンプト集です。  
> 個人パス、secret、token、API key、ローカル絶対パスを含めないでください。

---

## 目的

event art（イベント背景イラスト）の上に重ねて表示するキャラクター overlay 素材の制作ブリーフです。  
キャラ別ではなく、4キャラ（Ryo / Suzu / Eve / Garan）共通の要件と prompt 例を記載します。  
キャラ固有の外見詳細は、別途 reference portrait を制作担当に渡してください。

---

## MVP 共通方針

- 透過背景の full body 画像（頭〜足）
- event art の上に重ねても不自然でない、ニュートラルな立ちポーズ
- 既存の portrait / sprite との識別性を保つ
- ドラマチックな成功 / 失敗ポーズは不要
- 以下を含めない: 背景、地面、床、空、室内、その他の小道具（キャラデザイン固有のものを除く）
- 以下を含めない: UI、テキスト、名前、数値、faith 値、internal parameter
- 以下を含めない: ホラー演出、流血、重大な怪我

---

## 共通ブリーフ

### 日本語シーンブリーフ

cozy sandbox ゲームのイベント参加キャラとして、event art の上に重ねて表示するための全身立ち絵。  
穏やかな表情で、ニュートラルまたは軽くイベントに参加しているような自然なポーズ。  
背景は完全透明とし、キャラの体だけを残す。

### English image prompt

```
Create a transparent-background full-body character overlay for a cozy sandbox game.
Only the character body should be visible — no background, no ground, no floor, no room, no sky.
No props or scene elements unless they are part of the character's established design.
Keep the character identity consistent with the reference portrait provided.
Neutral to gentle standing pose, soft expression, suitable for layering over event illustrations.
PNG with alpha channel.
Aspect: portrait (tall), character occupies 78–92% of canvas height.
Transparent padding at top and bottom (4–10% each).
No hard edges or color halos around the character outline.
```

### Negative prompt

```
no background, no white backdrop, no colored backdrop, no gradient backdrop,
no ground shadow, no floor, no room, no sky, no props (unless character-design-native),
no text, no UI, no numbers, no faith value, no HP, no score,
no matting, no color halo, no fringing, no extra characters,
no horror, no blood, no severe injury, no dramatic battle pose,
no cropped body (must show head to feet)
```

---

## 品質要件（制作担当への確認事項）

| 項目 | 要件 |
|---|---|
| フォーマット | PNG（alpha channel あり） |
| 解像度 | 1024 × 1536 px 推奨（最小 768 × 1152 px） |
| body の高さ比 | canvas height の 78〜92% |
| 上下透過余白 | 各 4〜10% |
| 四隅 | 透明 |
| 背景色縁取り | なし（matting / halo 不可） |
| ゴミピクセル | 体の輪郭外に最小限 |
| ファイルサイズ | PNG で 1MB 未満を目安（品質優先で PO 判断可能） |

---

## キャラ別 reference 参照先（制作依頼時に添付）

| キャラ | reference portrait パス |
|---|---|
| Ryo | `public/art/characters/defaults/ryo/portrait.png` |
| Suzu | `public/art/characters/defaults/suzu/portrait.png` |
| Eve | `public/art/characters/defaults/eve/portrait.png` |
| Garan | `public/art/characters/defaults/garan/portrait.png` |

制作依頼時は上記 portrait を reference として渡し、外見の識別性を保つよう指示してください。

---

## 制作・採用フロー

```
1. このブリーフ + reference portrait を制作担当へ渡す（手動）
2. 制作担当が neutral-body.png を作成（α透過済み）
3. α品質チェック（docs/operations/event-participant-overlay-asset-pipeline.md 参照）
4. PO が確認・承認
5. PO 承認後の別 PBI で public/art/characters/defaults/{slug}/overlays/event-participant/ へ配置
```

画像生成 API の呼び出し、`public/art/` への直接配置はこの PBI では行いません。

---

## 配置先パス（PO承認後の別 PBI で使用）

```
public/art/characters/defaults/ryo/overlays/event-participant/neutral-body.png
public/art/characters/defaults/suzu/overlays/event-participant/neutral-body.png
public/art/characters/defaults/eve/overlays/event-participant/neutral-body.png
public/art/characters/defaults/garan/overlays/event-participant/neutral-body.png
public/art/characters/defaults/_fallback/overlays/event-participant/silhouette.png
```
