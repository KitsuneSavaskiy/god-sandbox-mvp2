# Codex 指示書: 4 キャラクター アニメーション フルラン

## この指示書の使い方

Codex スレッドで以下を先頭に置いて実行する。

```txt
Use @hatch-pet.
Read docs/operations/codex-4chars-animation-fullrun.md and execute it exactly.
Do not create local handmade or synthetic sprite candidates.
If hatch-pet or image generation is unavailable, stop with `generation step unavailable`.
```

---

## あなたの役割

4 キャラクター（Eve / Garan / Ryo / Suzu）について、1 枚絵から箱庭アニメーションまでを実装してテストする。

このスレッド内に **Agent 1〜4 を同時に定義し、すべてを並列で開始** する。
1 キャラクターが終わるのを待たずに 4 つすべてを起動すること。

---

## ステップ 0: hatch-pet スキルを確認する（Agent 起動前に必ず実行）

`Use @hatch-pet` はこのスレッドの先頭で宣言済みであること。
Skill フォルダの存在を確認してから次へ進む。

```powershell
Test-Path "$env:USERPROFILE\.codex\skills\hatch-pet\SKILL.md"
```

`True` が返れば次へ進む。`False` または Skill が存在しない場合は `hatch-pet activation failed` を報告して停止する。

---

## hatch-pet 生成手順（Sheet 生成共通）

各 Sheet の生成は以下の手順で行う。`$SkillDir` はすべての PowerShell ブロックで共通。

```powershell
$SkillDir = "$env:USERPROFILE\.codex\skills\hatch-pet"
```

**手順 A: run folder 作成**

```powershell
python "$SkillDir\scripts\prepare_pet_run.py" `
  --pet-name  "<キャラ名>" `
  --pet-id    "<slug>-<sheet1|sheet2>" `
  --display-name "<キャラ名>" `
  --description  "<キャラ> <Sheet 1|Sheet 2> resident sprite." `
  --reference "<portrait ref パス>" `
  --output-dir ".hatch-pet-runs/<slug>-<sheet1|sheet2>" `
  --force
```

**手順 B: prompt を渡す**

`.prompts/resident-sprites/<slug>.md`（Sheet 1）または `<slug>-extended.md`（Sheet 2）の全文を読み込み、hatch-pet に渡す。
hatch-pet は受け取った prompt を `$imagegen`（Codex の画像生成 Skill）へ委譲して生成する。
画像生成はローカル Python では行わない。

**手順 C: ジョブ状態確認**

```powershell
python "$SkillDir\scripts\pet_job_status.py" --run-dir ".hatch-pet-runs/<slug>-<sheet1|sheet2>"
```

**手順 D: 生成結果を記録**

```powershell
python "$SkillDir\scripts\record_imagegen_result.py" `
  --run-dir ".hatch-pet-runs/<slug>-<sheet1|sheet2>" `
  --job-id  "<job-id>" `
  --source  "<生成された ig_*.png>"
```

**手順 E: run 完了**

```powershell
python "$SkillDir\scripts\finalize_pet_run.py" --run-dir ".hatch-pet-runs/<slug>-<sheet1|sheet2>"
```

生成完了後、PNG を `assets/generated/residents/<slug>/incoming/` へ保存する。

---

## 共通禁止事項（全エージェントに適用）

```
portrait をそのまま incoming へコピーして sprite:check を通すこと
ローカルで手製・合成・プレースホルダー PNG を sprite sheet 候補として使うこと
hatch-pet を使わずに sprite sheet を作ること
assets/generated/** を git commit すること
manifest を ready 化したファイルを git commit すること
public/art/** へ配置したファイルを git commit すること
```

代替画像で誤魔化さないこと。

---

## 入力素材（すでに存在する）

| キャラ | 1 枚絵 | 名前 | 性格 | 口調 | 年齢 |
|---|---|---|---|---|---|
| Eve   | `public/art/characters/defaults/eve/portrait.png`   | Eve   | 穏やか     | 丁寧     | 20 |
| Garan | `public/art/characters/defaults/garan/portrait.png` | Garan | 落ち着いた | 標準語   | 22 |
| Ryo   | `public/art/characters/defaults/ryo/portrait.png`   | Ryo   | 明るい     | タメ口   | 17 |
| Suzu  | `public/art/characters/defaults/suzu/portrait.png`  | Suzu  | 元気       | タメ口   | 16 |

---

## スプライト仕様（生成目標）

```
canvas: 1536 × 1872 px
frame:  192 × 208 px（非正方形）
columns: 8 / rows: 9
background: transparent alpha（不可なら #ff00ff chroma-key）
```

**Sheet 1（resident-sprite-sheet.png）行順:**
```
row 0: idle      row 1: run-right  row 2: run-left  row 3: waving
row 4: jumping   row 5: failed     row 6: waiting   row 7: running  row 8: review
```

**Sheet 2（resident-sprite-sheet-extended.png）行順:**
```
row 0: walk-up   row 1: walk-down   row 2: walk-forward  row 3: walk-back
row 4: emote-happy  row 5: emote-angry  row 6: emote-sad  row 7: emote-surprised
row 8: (spare — transparent またはrow 7の複製)
```

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
- `portrait ref:` の値
- `incoming:` の値（例: `assets/generated/residents/eve/incoming/`）
- `prompt (Sheet 1):` のパス（例: `.prompts/resident-sprites/eve.md`）
- `prompt (Sheet 2):` のパス（例: `.prompts/resident-sprites/eve-extended.md`）

### E-2: Sheet 1 を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `eve-sheet1` |
| `--reference` | E-1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/eve-sheet1` |
| prompt | `.prompts/resident-sprites/eve.md` の全文 |
| 保存先 | `assets/generated/residents/eve/incoming/resident-sprite-sheet.png` |

### E-3: Sheet 2 を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。Sheet 1 のデザインと一致させること。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `eve-sheet2` |
| `--reference` | E-1 と同じ `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/eve-sheet2` |
| prompt | `.prompts/resident-sprites/eve-extended.md` の全文 |
| 保存先 | `assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png` |

### E-4: sprite:check

```bash
npm run sprite:check -- eve
```

exit code 0（warning のみ含む）→ pass。exit code 1 → blocker として報告し停止。

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

記録: `portrait ref:` / `incoming:` / `prompt (Sheet 1):` / `prompt (Sheet 2):`

### G-2: Sheet 1 を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `garan-sheet1` |
| `--reference` | G-1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/garan-sheet1` |
| prompt | `.prompts/resident-sprites/garan.md` の全文 |
| 保存先 | `assets/generated/residents/garan/incoming/resident-sprite-sheet.png` |

### G-3: Sheet 2 を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。Sheet 1 のデザインと一致させること。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `garan-sheet2` |
| `--reference` | G-1 と同じ `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/garan-sheet2` |
| prompt | `.prompts/resident-sprites/garan-extended.md` の全文 |
| 保存先 | `assets/generated/residents/garan/incoming/resident-sprite-sheet-extended.png` |

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

記録: `portrait ref:` / `incoming:` / `prompt (Sheet 1):` / `prompt (Sheet 2):`

### R-2: Sheet 1 を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `ryo-sheet1` |
| `--reference` | R-1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/ryo-sheet1` |
| prompt | `.prompts/resident-sprites/ryo.md` の全文 |
| 保存先 | `assets/generated/residents/ryo/incoming/resident-sprite-sheet.png` |

### R-3: Sheet 2 を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。Sheet 1 のデザインと一致させること。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `ryo-sheet2` |
| `--reference` | R-1 と同じ `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/ryo-sheet2` |
| prompt | `.prompts/resident-sprites/ryo-extended.md` の全文 |
| 保存先 | `assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png` |

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

記録: `portrait ref:` / `incoming:` / `prompt (Sheet 1):` / `prompt (Sheet 2):`

### S-2: Sheet 1 を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `suzu-sheet1` |
| `--reference` | S-1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/suzu-sheet1` |
| prompt | `.prompts/resident-sprites/suzu.md` の全文 |
| 保存先 | `assets/generated/residents/suzu/incoming/resident-sprite-sheet.png` |

### S-3: Sheet 2 を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。Sheet 1 のデザインと一致させること。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `suzu-sheet2` |
| `--reference` | S-1 と同じ `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/suzu-sheet2` |
| prompt | `.prompts/resident-sprites/suzu-extended.md` の全文 |
| 保存先 | `assets/generated/residents/suzu/incoming/resident-sprite-sheet-extended.png` |

### S-4: sprite:check

```bash
npm run sprite:check -- suzu
```

---

## テストフェーズ（Agent 1〜4 すべて完了後）

Agent がすべて exit code 0 で完了してから以下を実行する。

### T-1: 型安全性チェック

```bash
npm run typecheck
```

エラーがある場合は全文を報告して停止する。

### T-2: ビルド確認

```bash
npm run build
```

エラーがある場合は全文を報告して停止する。

### T-3: スプライト寸法検証

```bash
npm run sprite:check -- eve
npm run sprite:check -- garan
npm run sprite:check -- ryo
npm run sprite:check -- suzu
```

各キャラクターの両シートが 1536 × 1872 / 192 × 208 / 8col × 9row であることを確認する。

---

## アニメーション有効化（T-1〜T-3 全 pass 後）

**PO 確認前に git commit しないこと。以下の変更はローカルのみ。**

### A-1: スプライトをプレビュー位置へコピー

```bash
mkdir -p public/art/characters/defaults/eve/sprites
cp assets/generated/residents/eve/incoming/resident-sprite-sheet.png \
   public/art/characters/defaults/eve/sprites/resident-sprite-sheet.png
cp assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png \
   public/art/characters/defaults/eve/sprites/resident-sprite-sheet-extended.png

mkdir -p public/art/characters/defaults/garan/sprites
cp assets/generated/residents/garan/incoming/resident-sprite-sheet.png \
   public/art/characters/defaults/garan/sprites/resident-sprite-sheet.png
cp assets/generated/residents/garan/incoming/resident-sprite-sheet-extended.png \
   public/art/characters/defaults/garan/sprites/resident-sprite-sheet-extended.png

mkdir -p public/art/characters/defaults/ryo/sprites
cp assets/generated/residents/ryo/incoming/resident-sprite-sheet.png \
   public/art/characters/defaults/ryo/sprites/resident-sprite-sheet.png
cp assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png \
   public/art/characters/defaults/ryo/sprites/resident-sprite-sheet-extended.png

mkdir -p public/art/characters/defaults/suzu/sprites
cp assets/generated/residents/suzu/incoming/resident-sprite-sheet.png \
   public/art/characters/defaults/suzu/sprites/resident-sprite-sheet.png
cp assets/generated/residents/suzu/incoming/resident-sprite-sheet-extended.png \
   public/art/characters/defaults/suzu/sprites/resident-sprite-sheet-extended.png
```

### A-2: manifest を ready 化（ローカルのみ）

`src/persistence/defaultResidentSpriteManifest.ts` を開き、全 4 キャラクターの第 3 引数を `"ready"` に変更する:

```typescript
// 変更前（例）
createDefaultResidentSpriteManifestEntry("chr_eve",   "eve"),
createDefaultResidentSpriteManifestEntry("chr_garan", "garan"),
createDefaultResidentSpriteManifestEntry("chr_ryo",   "ryo"),
createDefaultResidentSpriteManifestEntry("chr_suzu",  "suzu"),

// 変更後
createDefaultResidentSpriteManifestEntry("chr_eve",   "eve",   "ready"),
createDefaultResidentSpriteManifestEntry("chr_garan", "garan", "ready"),
createDefaultResidentSpriteManifestEntry("chr_ryo",   "ryo",   "ready"),
createDefaultResidentSpriteManifestEntry("chr_suzu",  "suzu",  "ready"),
```

### A-3: 開発サーバーを起動

```bash
npm run dev
```

---

## ブラウザ確認チェックリスト（PO または Codex が目視確認）

`http://localhost:5173/sandbox` を開いて以下を確認する。

| 確認項目 | 期待する動作 |
|---|---|
| 全 4 キャラ表示 | ポートレートと同程度の小さいキャラとしてサンドボックス内に表示される |
| idle アニメーション | 各キャラが呼吸/点滅サイクルで動く |
| ランダム移動 | 5〜7 秒おきに上下左右・前後へ移動し walk-* モーションに切り替わる |
| emote 同期 | joy=walk、surprise/anger/sadness=対応 emote-* モーションに切り替わる |
| イベント窓を開く | 「イベント詳細を見る」クリックで全住民アニメーションが一時停止する |
| イベント窓を閉じる | 「結果を受け取る」後にアニメーションが再開する |
| キャラクタークリック | 住民クリックでキャラクター詳細画面が開く |

---

## 完了報告フォーマット

```md
## 生成結果

| キャラ | Sheet 1 | Sheet 2 | sprite:check | ブロッカー |
|---|---|---|---|---|
| Eve   | done/fail | done/fail | pass/fail | - |
| Garan | done/fail | done/fail | pass/fail | - |
| Ryo   | done/fail | done/fail | pass/fail | - |
| Suzu  | done/fail | done/fail | pass/fail | - |

## テスト結果

| テスト | 結果 | 備考 |
|---|---|---|
| typecheck | pass/fail | - |
| build | pass/fail | - |
| sprite:check × 4 | pass/fail | - |

## アニメーション有効化

- スプライトコピー: 完了 / 失敗
- manifest ready 化: 完了 / 失敗
- npm run dev: 起動済み / 失敗

## PO への確認依頼

全テストが pass の場合のみ記載する。

`http://localhost:5173/sandbox` で以下の contact sheet および PNG をご確認ください:
- assets/generated/residents/*/audit/ （visual audit 出力）
- assets/generated/residents/*/incoming/ （生成 PNG）

採用可否判断をお願いします。
採用の場合は public/art/ および manifest の git commit を PO 承認後に行います。
```

---

## ブロッカー発生時の対処

| 状況 | 対処 |
|---|---|
| `SKILL.md` が存在しない / hatch-pet Skill が無効 | `hatch-pet activation failed` を報告して全エージェント停止 |
| `$imagegen` が利用不可（画像生成 Skill が無効） | `generation step unavailable` を報告して停止 |
| sprite:check exit code 1 | エラー内容を全文報告して停止。再生成が必要 |
| typecheck/build エラー | エラー内容を全文報告して停止 |
| manifest 変更でブラウザエラー | コンソールエラー全文を報告 |

ブロッカーがある場合は PO への確認依頼を行わず、原因と対処案のみを報告する。
