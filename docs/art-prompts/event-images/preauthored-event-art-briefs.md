# Preauthored Event Art — Image Briefs

**PBI:** 9c-assets  
**Lane:** Claude2 / Event Art Asset Planning  
**Last updated:** 2026-05-11  
**Asset list:** see `docs/operations/preauthored-event-art-asset-list.md`

> このファイルは Git 管理するアートプロンプト集です。  
> 個人パス、secret、token、API key、ローカル絶対パスを含めないでください。

---

## MVP 共通方針

- キャラの個別立ち絵を必須にしない。イベントを象徴する場面として描く
- キャラを入れる場合は「generic resident silhouette」または「small cozy resident figure」程度
- Ryo / Suzu 等の固有キャラ外見の再現は MVP 必須にしない
- 以下を描かない: UI、ボタン、数値、faith 値、internal parameter、HP、スコア
- 以下を描かない: 死亡、流血、ホラー、重大な怪我、悲劇的な結末
- スタイル方向: cozy sandbox、穏やかな水彩または soft illustration

---

## #292 CLI との関係

`tools/sidekick/event-image-request.mjs` は **generated_event_art** フローの将来入口です。
今回の **preauthored_event_art** 制作では CLI 実行は必須ではありません。
このPBIでは CLI 生成物（request.json / prompt.md / reference-manifest.json）を PR に含めません。

必要になった場合のみ別 PBI で CLI を使います。生成画像を採用する場合は別 PBI で `public/art/events/` へ昇格します。

---

## 1. moving-stone — 謎の動く石

**assetId:** `event-art-moving-stone-started`  
**proposedPath:** `public/art/events/moving-stone/started.png`  
**composition:** landscape  
**eventPhase:** started

### 日本語シーンブリーフ

広場の片隅に、昨日と少し違う場所に置かれた石。  
誰が動かしたのか、なぜ動いたのかは分からない。  
地面に小さな跡が残っており、朝の光が静かに差し込んでいる。

### English image prompt

A small stone resting in a slightly different spot than before, surrounded by a faint trail on the soft ground. Morning light filters through trees. Cozy sandbox scene, no characters required. Watercolor-style, peaceful, mysterious but not scary.

### Must include
- 石（小〜中サイズ、自然な形）
- 地面の跡または変位の痕跡
- 穏やかな光（朝または午後）

### Must avoid
- 大きなキャラクター（あっても遠景の小さなシルエット）
- ホラー演出
- UI 要素、数値

### Negative prompt
no UI, no text, no numbers, no faith values, no horror, no blood, no dark atmosphere

---

## 2. shrine-prayer-wish — お参りと願い

**assetId:** `event-art-shrine-prayer-wish-started`  
**proposedPath:** `public/art/events/shrine-prayer-wish/started.png`  
**composition:** portrait  
**eventPhase:** started

### 日本語シーンブリーフ

小さな祠の前。煙か光が空気に溶けるように漂い、誰かの願いが届きそうな気配。  
宗教的に重すぎず、GodSandbox の世界観に合った穏やかな神秘感。  
数値や信仰 UI は出さない。

### English image prompt

A small stone shrine with a soft glow or wisps of light drifting upward. The atmosphere is calm and mystical. No religious symbols. Cozy sandbox world. Watercolor-style, gentle, hopeful mood.

### Must include
- 小さな祠（石造り、シンプル）
- 光または煙の柔らかい演出

### Must avoid
- 宗教的に重いシンボル（十字架、鳥居の強調等）
- 数値、faith ゲージ
- ダーク・ホラー演出

### Negative prompt
no UI, no numbers, no faith meter, no religious icons, no dark atmosphere, no horror

---

## 3. strange-grass-found — 変な草を拾う

**assetId:** `event-art-strange-grass-found-started`  
**proposedPath:** `public/art/events/strange-grass-found/started.png`  
**composition:** portrait  
**eventPhase:** started

### 日本語シーンブリーフ

草地に、見慣れない草がひっそりと生えている。  
危険には見えないが、なんとなく光っているような、不思議でかわいい佇まい。  
誰かが拾おうとしているシーンでも、草だけのクローズアップでもよい。

### English image prompt

A curious, softly glowing plant growing among ordinary grass. The plant looks unusual but friendly and cute, not dangerous. Close-up or with a tiny resident silhouette reaching toward it. Watercolor-style, whimsical, cozy.

### Must include
- 変わった草（光る / 変色 / 葉の形が特徴的）
- 穏やかで不思議な雰囲気

### Must avoid
- 毒々しい・危険な演出
- ホラー

### Negative prompt
no UI, no numbers, no horror, no dangerous-looking plants, no dark colors

---

## 4. shared-nap-place — 同じ場所で昼寝

**assetId:** `event-art-shared-nap-place-started`  
**proposedPath:** `public/art/events/shared-nap-place/started.png`  
**composition:** landscape  
**eventPhase:** started

### 日本語シーンブリーフ

木陰や柔らかい草地に、2つの小さな存在が同じ場所で昼寝している気配。  
固有キャラの外見再現は必須にせず、generic な小さな人影 or シルエットでよい。  
穏やかで温かい午後の空気。

### English image prompt

A peaceful shaded spot under a tree, with two small cozy resident figures napping side by side. The figures are generic silhouettes, not specific characters. Soft afternoon light, calm grassy scene. Watercolor-style, warm and quiet.

### Must include
- 木陰または柔らかな草地
- 2つの小さな人影 or シルエット（generic）

### Must avoid
- 固有キャラの顔・特徴的な髪色の強調
- UI 要素

### Negative prompt
no UI, no numbers, no character names, no text, no specific character designs required

---

## 5. mysterious-footprints — 謎の足あと

**assetId:** `event-art-mysterious-footprints-started`  
**proposedPath:** `public/art/events/mysterious-footprints/started.png`  
**composition:** landscape  
**eventPhase:** started

### 日本語シーンブリーフ

広場の柔らかい地面に、謎の足あとが続いている。  
人のものでも動物のものでも不明な、調査したくなるような痕跡。  
怖くなく、探偵ごっこのようなわくわく感。

### English image prompt

Mysterious footprints crossing a soft dirt path or grassy clearing. The tracks are unusual in shape — could be animal or unknown. Morning light, cozy sandbox world. The scene invites curiosity, not fear. Watercolor-style.

### Must include
- 足あと（地面の泥・草・砂のいずれか）
- 不明な形状（動物か人かはっきりしない）

### Must avoid
- ホラー演出
- 血痕
- 怖い生物

### Negative prompt
no UI, no numbers, no horror, no blood, no scary creatures

---

## 6. legendary-big-fish — 伝説の大きな魚

**assetId:** `event-art-legendary-big-fish-started`  
**proposedPath:** `public/art/events/legendary-big-fish/started.png`  
**composition:** landscape  
**eventPhase:** started

### 日本語シーンブリーフ

池か川に、巨大な魚の影がゆっくり動くのを誰かが目撃した瞬間。  
捕獲ではなく「見た / 見失った」体験。  
幻想的で穏やか。rare イベントらしい非日常感があるが重くない。

### English image prompt

A large mysterious fish shadow moving slowly beneath the surface of a calm pond or river. The fish is massive but gentle-looking, more legendary than threatening. A tiny resident silhouette on the bank, watching in wonder. Watercolor-style, dreamy, serene.

### Must include
- 大きな魚の影（水中）
- 水面の静かな反射
- 幻想感（光・揺らぎ）

### Must avoid
- 捕食・恐怖演出
- ホラー

### Negative prompt
no UI, no numbers, no horror, no violence, no fishing gear required

---

## 7. shrine-fox-offering — 祠の油揚げ

**assetId:** `event-art-shrine-fox-offering-started`  
**proposedPath:** `public/art/events/shrine-fox-offering/started.png`  
**composition:** portrait  
**eventPhase:** started

### 日本語シーンブリーフ

小さな祠の前に、油揚げが置かれている。  
きつねの気配は暗示程度（足あと / 尻尾のシルエット / 視線）にとどめる。  
油揚げの枚数を強調しない。カウンターや数値は描かない。  
蓄積型イベントだが、数を見せる必要はない。

### English image prompt

A small shrine with a piece of tofu skin (abura-age) placed as an offering. A faint fox silhouette or tail hint in the shadows, barely visible. The mood is cozy and slightly magical. No counting, no numbers. Watercolor-style, warm tones.

### Must include
- 小さな祠
- 油揚げ（供え物として置かれている）
- きつねの気配（暗示のみ）

### Must avoid
- 油揚げの枚数を前面に出す
- 数値、カウンター表示
- きつねを明確に描きすぎる（暗示でよい）

### Negative prompt
no UI, no numbers, no offering count display, no horror, no explicit fox character required

---

## Fallback

| assetId | proposedPath |
|---|---|
| `event-art-fallback-generic` | `public/art/events/_fallback/generic-event.png` |

### English image prompt

A cozy, peaceful outdoor scene in a small sandbox village. Soft light, no specific characters or events depicted. Suitable as a neutral background for any event. Watercolor-style.

### Negative prompt
no UI, no numbers, no text, no horror, no specific character designs
