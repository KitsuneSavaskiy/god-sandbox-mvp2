# Codex 指示書: 4キャラクター スプライト生成・アニメーション検証（フルパイプライン）

## あなたの役割

あなたはオーケストレーターです。
このスレッド内に **Agent 1〜4 を同時並行で定義し、すべてを同時に開始** してください。
1 キャラクターが終わるのを待たずに 4 つすべてを起動すること。

各エージェントは完全に独立しており、互いに依存しません。

---

## 共通禁止事項（全エージェントに適用）

```
portrait をそのまま incoming へコピーして sprite:check を通すこと
ローカルで手製・合成・プレースホルダー PNG を sprite sheet 候補として使うこと
hatch-pet を使わずに sprite sheet を作ること
assets/generated/** を git commit すること
public/art/** へ本採用配置すること（PO 確認前）
manifest を ready 化すること
```

hatch-pet が使用できない場合は `generation step unavailable` を報告して即座に停止すること。
決して代替画像で誤魔化さないこと。

---

## Agent 1: Eve

### E-1: sidekick:intake

```bash
npm run sidekick:intake -- \
  --slug eve \
  --name "Eve" \
  --personality "穏やか" \
  --tone "丁寧" \
  --age 20 \
  --portrait public/art/characters/defaults/eve/portrait.png
```

出力から記録する:
- `portrait ref:` の値（例: `assets/generated/residents/eve/reference/eve-portrait-reference-XXXXXX.png`）
- `incoming:` の値（例: `assets/generated/residents/eve/incoming/`）
- `prompt (Sheet 1):` `.prompts/resident-sprites/eve.md`
- `prompt (Sheet 2):` `.prompts/resident-sprites/eve-extended.md`

### E-2: Sheet 1（motion-sheet）を hatch-pet で生成

- **portrait**: E-1 で記録した `portrait ref` のパス
- **prompt**: `.prompts/resident-sprites/eve.md` の全文を読み込み hatch-pet に渡す
- **仕様**: Canvas 1536 × 1872 px / frame 192 × 208 px / 8 col × 9 row / transparent alpha または `#ff00ff`
- **保存先**: `assets/generated/residents/eve/incoming/resident-sprite-sheet.png`

### E-3: Sheet 2（extended-sheet）を hatch-pet で生成

- **portrait**: E-1 と同じ `portrait ref`
- **prompt**: `.prompts/resident-sprites/eve-extended.md` の全文
- **仕様**: Sheet 1 と同一（Sheet 1 のデザインと一致させること）
- **保存先**: `assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png`

### E-4: sprite:check

```bash
npm run sprite:check -- eve
```

exit code 0（warning のみ含む）→ pass / exit code 1 → blocker として報告し停止

---

## Agent 2: Garan

### G-1: sidekick:intake

```bash
npm run sidekick:intake -- \
  --slug garan \
  --name "Garan" \
  --personality "落ち着いた" \
  --tone "標準語" \
  --age 22 \
  --portrait public/art/characters/defaults/garan/portrait.png
```

記録: `portrait ref:` / `incoming:`

### G-2: Sheet 1

- portrait: G-1 の `portrait ref`
- prompt: `.prompts/resident-sprites/garan.md` の全文
- 仕様: 1536 × 1872 / 192 × 208 / 8col × 9row / transparent or `#ff00ff`
- 保存先: `assets/generated/residents/garan/incoming/resident-sprite-sheet.png`

### G-3: Sheet 2

- portrait: G-1 と同じ
- prompt: `.prompts/resident-sprites/garan-extended.md` の全文
- 保存先: `assets/generated/residents/garan/incoming/resident-sprite-sheet-extended.png`

### G-4: sprite:check

```bash
npm run sprite:check -- garan
```

---

## Agent 3: Ryo

### R-1: sidekick:intake

```bash
npm run sidekick:intake -- \
  --slug ryo \
  --name "Ryo" \
  --personality "明るい" \
  --tone "タメ口" \
  --age 17 \
  --portrait public/art/characters/defaults/ryo/portrait.png
```

記録: `portrait ref:` / `incoming:`

### R-2: Sheet 1

- portrait: R-1 の `portrait ref`
- prompt: `.prompts/resident-sprites/ryo.md` の全文
- 保存先: `assets/generated/residents/ryo/incoming/resident-sprite-sheet.png`

### R-3: Sheet 2

- portrait: R-1 と同じ
- prompt: `.prompts/resident-sprites/ryo-extended.md` の全文
- 保存先: `assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png`

### R-4: sprite:check

```bash
npm run sprite:check -- ryo
```

---

## Agent 4: Suzu

### S-1: sidekick:intake

```bash
npm run sidekick:intake -- \
  --slug suzu \
  --name "Suzu" \
  --personality "元気" \
  --tone "タメ口" \
  --age 16 \
  --portrait public/art/characters/defaults/suzu/portrait.png
```

記録: `portrait ref:` / `incoming:`

### S-2: Sheet 1

- portrait: S-1 の `portrait ref`
- prompt: `.prompts/resident-sprites/suzu.md` の全文
- 保存先: `assets/generated/residents/suzu/incoming/resident-sprite-sheet.png`

### S-3: Sheet 2

- portrait: S-1 と同じ
- prompt: `.prompts/resident-sprites/suzu-extended.md` の全文
- 保存先: `assets/generated/residents/suzu/incoming/resident-sprite-sheet-extended.png`

### S-4: sprite:check

```bash
npm run sprite:check -- suzu
```

---

## テストフェーズ（全 Agent 完了後）

Agent 1〜4 すべての sprite:check が exit code 0 で完了したあとに実行する。

### テスト 1: 型安全性チェック

```bash
npm run typecheck
```

exit code 0 → pass。エラーがある場合は内容をすべて報告して停止すること。

### テスト 2: スプライトシート寸法検証（8 枚一括）

```bash
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs eve
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs garan
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs ryo
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs suzu
```

`incoming/` フォルダ内の両シート（Sheet 1 + Sheet 2）が 1536 × 1872 px / 192 × 208 / 8col × 9row であることを検証する。

### テスト 3: ビジュアルフレーム監査（4 キャラ）

```bash
node tools/asset-pipeline/audit-resident-sprite-visuals.mjs eve
node tools/asset-pipeline/audit-resident-sprite-visuals.mjs garan
node tools/asset-pipeline/audit-resident-sprite-visuals.mjs ryo
node tools/asset-pipeline/audit-resident-sprite-visuals.mjs suzu
```

各キャラクターの contact sheet が `assets/generated/residents/<slug>/audit/` に出力される。
警告（safe margin 不足等）は記録するが blocker にはならない。
エラー（キャラ消失・全フレーム空等）は blocker として報告する。

### テスト 4: アルファチャンネル検証（4 キャラ）

```bash
node tools/asset-pipeline/check-resident-sprite-alpha.mjs eve
node tools/asset-pipeline/check-resident-sprite-alpha.mjs garan
node tools/asset-pipeline/check-resident-sprite-alpha.mjs ryo
node tools/asset-pipeline/check-resident-sprite-alpha.mjs suzu
```

---

## サンドボックス表示仕様

スプライトはサンドボックス内でポートレート図と同じサイズに縮小して表示される。
生成サイズ（192×208 px / 8col / 9row）は変わらない。縮小は CSS が自動で行う。

```
生成サイズ: 1536×1872 px（192×208 frame × 8col × 9row）
表示サイズ: CSS zoom により portrait figure 幅に合わせて自動縮小
  → clamp(78px, 8vw, 124px) / 192px の比率でズームされる
  → 1200px 幅では約 0.5× 表示（≈ 96×104 px）
```

スプライトが表示されると:
- 住民は 5〜7 秒おきに上下左右・前後へランダム移動する（`walk-*` モーション）
- emote バブルに応じてスプライトモーションが切り替わる
  - `anger` → `emote-angry` / `sadness` → `emote-sad` / `surprise` → `emote-surprised`
  - `talk-request` / `event-alert` → `walk-forward`
  - `joy`（デフォルト）→ 移動方向のモーションを維持
- イベント子画面が開いている間は全住民の CSS アニメーションが一時停止する
- キャラクタークリックでキャラクター詳細画面が開く

---

## アニメーション動作確認（テスト 1〜4 全 pass 後）

**この手順は PO またはエンジニアが手動で実施する。Codex が単独で完了させることはできない。**

ただし、Codex はこのセクションの手順を PO へ提示すること。

### ローカルプレビュー手順

1. **開発サーバーを起動する**
   ```bash
   npm run dev
   ```

2. **スプライトをプレビュー位置へコピーする（コミットしないこと）**

   各キャラクターについて以下を実行する（Eve の例）:

   ```bash
   # sprites フォルダが存在しない場合は作成する
   mkdir -p public/art/characters/defaults/eve/sprites

   # Sheet 1 をプレビュー位置へコピー（git commit 禁止）
   cp assets/generated/residents/eve/incoming/resident-sprite-sheet.png \
      public/art/characters/defaults/eve/sprites/resident-sprite-sheet.png

   # Sheet 2 をプレビュー位置へコピー（git commit 禁止）
   cp assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png \
      public/art/characters/defaults/eve/sprites/resident-sprite-sheet-extended.png
   ```

   garan / ryo / suzu も同様に実施する。

3. **manifest を一時的に ready 化する（コミットしないこと）**

   `src/persistence/defaultResidentSpriteManifest.ts` を開き、
   対象キャラクターのエントリの第 3 引数を `"ready"` に変更する。

   例（Eve と Garan を ready 化する場合）:
   ```typescript
   // 変更前
   createDefaultResidentSpriteManifestEntry("chr_eve", "eve"),
   createDefaultResidentSpriteManifestEntry("chr_garan", "garan"),

   // 変更後
   createDefaultResidentSpriteManifestEntry("chr_eve", "eve", "ready"),
   createDefaultResidentSpriteManifestEntry("chr_garan", "garan", "ready"),
   ```

4. **ブラウザで `http://localhost:5173/sandbox` を開いてアニメーションを確認する**

   以下を目視確認する:

   | 確認項目 | 期待する動作 |
   |---|---|
   | スプライト表示サイズ | ポートレートと同程度の小さいキャラとして表示される |
   | idle アニメーション | キャラがフレーム内に収まり idle サイクルが動く |
   | ランダム移動 | 5〜7 秒おきに上下左右・前後へ移動し walk-* モーションに切り替わる |
   | emote 同期 | joy バブル=walk、surprise/anger/sadness バブル=対応 emote-* に切り替わる |
   | イベント窓を開く | 「イベント詳細を見る」クリックで全住民アニメーションが停止する |
   | イベント窓を閉じる | 「結果を受け取る」後に住民の移動とアニメーションが再開する |
   | クリック動作 | 住民クリックでキャラクター詳細画面が開く |

5. **確認後、一時ファイルを元に戻す（コミットしないこと）**

   ```bash
   git checkout -- public/art/characters/defaults/
   git checkout -- src/persistence/defaultResidentSpriteManifest.ts
   ```

---

## 全体完了報告

### 生成結果

| キャラ | Sheet 1 生成 | Sheet 2 生成 | sprite:check | blockers |
|---|---|---|---|---|
| Eve   | done / fail | done / fail | pass / fail | なし or 内容 |
| Garan | done / fail | done / fail | pass / fail | なし or 内容 |
| Ryo   | done / fail | done / fail | pass / fail | なし or 内容 |
| Suzu  | done / fail | done / fail | pass / fail | なし or 内容 |

### テスト結果

| テスト | 結果 | 備考 |
|---|---|---|
| typecheck | pass / fail | - |
| 寸法検証 Eve | pass / fail | Sheet 1 / Sheet 2 |
| 寸法検証 Garan | pass / fail | Sheet 1 / Sheet 2 |
| 寸法検証 Ryo | pass / fail | Sheet 1 / Sheet 2 |
| 寸法検証 Suzu | pass / fail | Sheet 1 / Sheet 2 |
| ビジュアル監査 Eve | pass / warn / fail | warnings を列挙 |
| ビジュアル監査 Garan | pass / warn / fail | warnings を列挙 |
| ビジュアル監査 Ryo | pass / warn / fail | warnings を列挙 |
| ビジュアル監査 Suzu | pass / warn / fail | warnings を列挙 |
| アルファ検証 Eve | pass / fail | - |
| アルファ検証 Garan | pass / fail | - |
| アルファ検証 Ryo | pass / fail | - |
| アルファ検証 Suzu | pass / fail | - |

### PO への提示内容

**blocker が 1 件でもある場合は PO に提示せず、原因と対処案を報告すること。**

全テスト pass（warning のみ許容）の場合、以下を PO に提示する:

```
PO へ: 自動テストが全項目 pass しました。以下の PNG をご確認ください。

Sheet 1（motion-sheet）— 各キャラクターの動作アニメーション
  assets/generated/residents/eve/incoming/resident-sprite-sheet.png
  assets/generated/residents/garan/incoming/resident-sprite-sheet.png
  assets/generated/residents/ryo/incoming/resident-sprite-sheet.png
  assets/generated/residents/suzu/incoming/resident-sprite-sheet.png

Sheet 2（extended-sheet）— 方向移動・感情エモート
  assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png
  assets/generated/residents/garan/incoming/resident-sprite-sheet-extended.png
  assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png
  assets/generated/residents/suzu/incoming/resident-sprite-sheet-extended.png

ビジュアル監査 contact sheet（フレーム単位の目視確認用）
  assets/generated/residents/eve/audit/
  assets/generated/residents/garan/audit/
  assets/generated/residents/ryo/audit/
  assets/generated/residents/suzu/audit/

ローカルアニメーション確認: 上記「アニメーション動作確認」セクションの手順を参照してください。

採用可否判断をお願いします。
```
