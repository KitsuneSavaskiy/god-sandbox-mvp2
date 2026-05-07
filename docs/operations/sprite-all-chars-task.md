# 作業名: 全キャラクター resident sprite 生成スプリント（2-sheet 対応）

対象キャラクター: **Eve / Garan / Ryo / Suzu**（4キャラ同時進行）  
担当: Codex サイドキック（hatch-pet スキル使用）

## 背景

hatch-pet ネイティブ出力（1536 × 1872, 192 × 208 frame, 8col × 9row）を GodSandbox 規格とする 2-sheet アーキテクチャが確立した。
各キャラクターに Sheet 1（motion-sheet）と Sheet 2（extended-sheet）の2枚を生成し、箱庭アニメーションで使用する。

## 対象キャラクター一覧

| slug | portrait | prompt (Sheet 1) | prompt (Sheet 2) | 生成済み |
|---|---|---|---|---|
| eve   | `public/art/characters/defaults/eve/portrait.png`   | `.prompts/resident-sprites/eve.md`   | `.prompts/resident-sprites/eve-extended.md`   | なし |
| garan | `public/art/characters/defaults/garan/portrait.png` | `.prompts/resident-sprites/garan.md` | `.prompts/resident-sprites/garan-extended.md` | なし |
| ryo   | `public/art/characters/defaults/ryo/portrait.png`   | `.prompts/resident-sprites/ryo.md`   | `.prompts/resident-sprites/ryo-extended.md`   | なし |
| suzu  | `public/art/characters/defaults/suzu/portrait.png`  | `.prompts/resident-sprites/suzu.md`  | `.prompts/resident-sprites/suzu-extended.md`  | なし |

> 並列実行の詳細手順は `docs/operations/codex-4chars-sprite-full-pipeline.md` を参照。

## Codex の実行禁止事項

```txt
portrait をそのまま incoming へコピーして sprite:check を実行すること
ローカルで手製の PNG を sprite sheet 候補として扱うこと
hatch-pet を使わずに sprite sheet を作ること
assets/generated/** を git commit すること
assets/residents/** を git commit すること
public/art/** へ本採用配置すること（PO 確認前）
manifest を ready 化すること
```

---

## この指示書の使い方

Codex スレッドで以下を先頭に置いて実行する。

```txt
Use @hatch-pet.
Read docs/operations/sprite-all-chars-task.md and execute it exactly.
Do not create local handmade or synthetic sprite candidates.
If hatch-pet or image generation is unavailable, stop with `generation step unavailable`.
```

---

## ステップ 0: hatch-pet スキルを確認する（生成ステップ前に必ず実行）

`Use @hatch-pet` はこのスレッドの先頭で宣言済みであること。
Skill フォルダの存在を確認してから次へ進む。

```powershell
Test-Path "$env:USERPROFILE\.codex\skills\hatch-pet\SKILL.md"
```

`True` が返れば次へ進む。`False` または Skill が存在しない場合は `hatch-pet activation failed` を報告して停止する。

---

## hatch-pet 生成手順（Sheet 生成共通）

各 Sheet の生成は以下の手順で行う。

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

## 各キャラクターの手順

各キャラクターについて以下のステップを独立して実行する。
キャラクター間の依存はないため並行実行可。

### ステップ 1: sidekick:intake 実行（キャラクターごと）

```bash
# Eve
npm run sidekick:intake -- --slug eve --name "Eve" --personality "穏やか" --tone "丁寧" --age 20 --portrait public/art/characters/defaults/eve/portrait.png

# Garan
npm run sidekick:intake -- --slug garan --name "Garan" --personality "落ち着いた" --tone "標準語" --age 22 --portrait public/art/characters/defaults/garan/portrait.png

# Ryo
npm run sidekick:intake -- --slug ryo --name "Ryo" --personality "明るい" --tone "タメ口" --age 17 --portrait public/art/characters/defaults/ryo/portrait.png

# Suzu
npm run sidekick:intake -- --slug suzu --name "Suzu" --personality "元気" --tone "タメ口" --age 16 --portrait public/art/characters/defaults/suzu/portrait.png
```

各コマンドから以下を記録する:
- `portrait ref:` のパス
- `prompt (Sheet 1):` のパス
- `prompt (Sheet 2):` のパス
- `incoming:` のパス

### ステップ 2: hatch-pet で Sheet 1（motion-sheet）を生成

intake が出力した portrait ref と Sheet 1 prompt を使い、hatch-pet スキルで生成する。

#### Sheet 1 仕様

```txt
canvas: 1536 × 1872 px
frame:  192 × 208 px（非正方形）
columns: 8 / rows: 9
background: transparent alpha（不可なら #ff00ff chroma-key）
```

#### Sheet 1 motion 行順

```txt
row 0: idle
row 1: run-right
row 2: run-left
row 3: waving
row 4: jumping
row 5: failed
row 6: waiting
row 7: running
row 8: review
```

#### 保存先（Sheet 1）

```txt
assets/generated/residents/eve/incoming/resident-sprite-sheet.png
assets/generated/residents/garan/incoming/resident-sprite-sheet.png
assets/generated/residents/ryo/incoming/resident-sprite-sheet.png
assets/generated/residents/suzu/incoming/resident-sprite-sheet.png
```

hatch-pet が使用できない場合: `generation step unavailable` を報告して停止する。  
手製・合成・placeholder 画像で代替しないこと。

### ステップ 3: hatch-pet で Sheet 2（extended-sheet）を生成

同じ portrait ref と Sheet 2 prompt を使い、hatch-pet スキルで生成する。
Sheet 1 のデザインと一致させること。

#### Sheet 2 仕様

Sheet 1 と同一（1536 × 1872 / 192 × 208 / 8col × 9row）

#### Sheet 2 motion 行順

```txt
row 0: walk-up
row 1: walk-down
row 2: walk-forward
row 3: walk-back
row 4: emote-happy
row 5: emote-angry
row 6: emote-sad
row 7: emote-surprised
row 8: (spare)
```

#### 保存先（Sheet 2）

```txt
assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png
assets/generated/residents/garan/incoming/resident-sprite-sheet-extended.png
assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png
assets/generated/residents/suzu/incoming/resident-sprite-sheet-extended.png
```

### ステップ 4: sprite:check（キャラクターごと）

```bash
npm run sprite:check -- eve
npm run sprite:check -- garan
npm run sprite:check -- ryo
npm run sprite:check -- suzu
```

exit code 1 は blocker。exit code 0 かつ warning は pass。

### ステップ 5: 箱庭アニメーション目視確認（キャラクターごと）

contact sheet（visual audit が出力する SVG）を確認:
- Sheet 1: idle / run / wave / jump 各行が row 順に見えるか
- Sheet 2: walk 方向 / emote 各行が row 順に見えるか
- 192 × 208 frame に頭・胴・足が収まっているか
- キャラクターらしさがあるか（portrait の特徴を保持しているか）

---

## 完了報告の形式（キャラクターごと）

```md
# [キャラ名] resident sprite proof result

## sidekick:intake
- exit code:
- characterId:
- jobId:
- portrait ref:
- prompt (Sheet 1):
- prompt (Sheet 2):
- incoming:

## hatch-pet 生成
- portrait ref 使用:
- Sheet 1 prompt 使用:
- Sheet 2 prompt 使用:
- Sheet 1 PNG 保存先:
- Sheet 2 PNG 保存先:
- ファイル確認: yes / no

## sprite:check
- exit code:
- alpha: pass / fail
- validate: pass / fail
- visual audit: pass / fail
- warning codes:
- blocker:

## 箱庭アニメーション確認
- Sheet 1 idle / run:
- Sheet 2 walk / emote:
- frame 切り出し（192×208）:
- サイズ感:
- キャラクターらしさ:
- 線・見切れ:

## 判定
- proof result: pass / fail
- PO visual review へ進めるか:
- ready 化してよいか: no（PO 確認前は常に no）
```

---

## PR 方針

PR に含めてよいもの:

```txt
docs / report
必要な prompt の小修正
必要な spec の小修正
必要な check tool の小修正
```

PR に含めてはいけないもの:

```txt
assets/generated/**
assets/residents/**
dist/**
public/art/** の本採用配置
manifest ready 化
runtime test 更新
```

## 今回やらないこと

```txt
各キャラの ready 化・本採用配置
manifest ready 化
runtime test 更新
GodSandbox アプリ本体への画像生成 API 追加
```
