# Codex 指示書: 4キャラクター スプライト生成・アニメーション検証（フルパイプライン）

> P0 superseded: この手順は現在そのまま実行しない。
> 直接 `prepare_pet_run.py` / `record_imagegen_result.py` / `finalize_pet_run.py` を呼ぶ旧手順を含むため、
> `docs/operations/codex-4chars-animation-fullrun.md` と
> `docs/operations/resident-hatch-pet-wrapper.md` の wrapper 手順を正本にする。

## この指示書の使い方

Codex スレッドで以下を先頭に置いて実行する。

```txt
Use @hatch-pet.
Read docs/operations/codex-4chars-sprite-full-pipeline.md and execute it exactly.
Do not create local handmade or synthetic sprite candidates.
If hatch-pet or image generation is unavailable, stop with `generation step unavailable`.
```

---

## あなたの役割

あなたはオーケストレーターです。
このスレッド内に **Agent 1〜4 を同時並行で定義し、すべてを同時に開始** してください。
1 キャラクターが終わるのを待たずに 4 つすべてを起動すること。

各エージェントは完全に独立しており、互いに依存しません。

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
  --description  "<キャラ> <Sheet 1|Sheet 2> resident sprite. Canvas MUST be exactly 1536x1872px. Frame 192x208px. 8 columns, 9 rows. Transparent alpha or #ff00ff chroma-key background." `
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
public/art/** へ本採用配置すること（PO 確認前）
manifest を ready 化すること
```

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

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `eve-sheet1` |
| `--reference` | E-1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/eve-sheet1` |
| prompt | `.prompts/resident-sprites/eve.md` の全文 |
| 保存先 | `assets/generated/residents/eve/incoming/resident-sprite-sheet.png` |

### E-3: Sheet 2（extended-sheet）を hatch-pet で生成

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

exit code 0（warning のみ含む）→ pass。exit code 1 → **このキャラクターの blocker** として内容を全文報告し、**このエージェントのみを停止する**。他のキャラクターのエージェントは継続する

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

### G-2: Sheet 1（motion-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `garan-sheet1` |
| `--reference` | G-1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/garan-sheet1` |
| prompt | `.prompts/resident-sprites/garan.md` の全文 |
| 保存先 | `assets/generated/residents/garan/incoming/resident-sprite-sheet.png` |

### G-3: Sheet 2（extended-sheet）を hatch-pet で生成

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

記録: `portrait ref:` / `incoming:`

### R-2: Sheet 1（motion-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `ryo-sheet1` |
| `--reference` | R-1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/ryo-sheet1` |
| prompt | `.prompts/resident-sprites/ryo.md` の全文 |
| 保存先 | `assets/generated/residents/ryo/incoming/resident-sprite-sheet.png` |

### R-3: Sheet 2（extended-sheet）を hatch-pet で生成

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

記録: `portrait ref:` / `incoming:`

### S-2: Sheet 1（motion-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `suzu-sheet1` |
| `--reference` | S-1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/suzu-sheet1` |
| prompt | `.prompts/resident-sprites/suzu.md` の全文 |
| 保存先 | `assets/generated/residents/suzu/incoming/resident-sprite-sheet.png` |

### S-3: Sheet 2（extended-sheet）を hatch-pet で生成

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

## テストフェーズ（全 Agent 完了後）

Agent 1〜4 すべての sprite:check が exit code 0 で完了したあとに実行する。

### テスト 1: 型安全性チェック

```bash
npm run typecheck
```

exit code 0 → pass。エラーがある場合は内容をすべて報告して停止すること。

### テスト 2: sprite:check（4 キャラ）

```bash
npm run sprite:check -- eve
npm run sprite:check -- garan
npm run sprite:check -- ryo
npm run sprite:check -- suzu
```

`incoming/` フォルダ内の両シート（Sheet 1 + Sheet 2）が 1536 × 1872 px / 192 × 208 / 8col × 9row であることを、alpha / grid / visual audit をまとめて検証する。
contact sheet は `assets/residents/<slug>/sprites/` に出力される。
警告（safe margin 不足等）は記録するが blocker にはならない。
エラー（キャラ消失・全フレーム空等）は blocker として報告する。

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

3. **manifest は placeholder のまま維持する**

   local preview の段階では `ready` を上げない。

   - 2-sheet ready の正本は `src/persistence/defaultCharacterAssetManifest.ts`
   - `src/persistence/defaultResidentSpriteManifest.ts` は旧互換の橋渡し
   - PO visual OK 前の ready 化は禁止

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

5. **確認後、一時ファイルを手動で片付ける（コミットしないこと）**

   preview 用にコピーした `public/art/characters/defaults/*/sprites/` だけを確認して片付ける。
   既存のローカル変更がある可能性があるため、`git checkout --` でまとめて戻さない。

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
