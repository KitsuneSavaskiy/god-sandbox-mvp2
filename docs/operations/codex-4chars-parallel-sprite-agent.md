# Codex 指示書: 4キャラクター並列スプライト生成エージェント

## この指示書の使い方

Codex スレッドで以下を先頭に置いて実行する。

```txt
Use @hatch-pet.
Read docs/operations/codex-4chars-parallel-sprite-agent.md and execute it exactly.
Do not create local handmade or synthetic sprite candidates.
If hatch-pet or image generation is unavailable, stop with `generation step unavailable`.
```

---

## ステップ 0: hatch-pet スキルを確認する（サブエージェント起動前に必ず実行）

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

## あなたの役割

あなたはオーケストレーターです。
以下の 4 つのサブエージェントタスクを **同時並行** で実行してください。
1 キャラクターが終わるのを待たずに、4 つすべてを同時に開始してください。

各サブエージェントは独立しており、互いに依存しません。

---

## 共通禁止事項（4 エージェント全員に適用）

```
portrait をそのまま incoming へコピーして sprite:check を通すこと
ローカルで手製・合成・プレースホルダー PNG を sprite sheet 候補として使うこと
hatch-pet を使わずに sprite sheet を作ること
assets/generated/** を git commit すること
assets/residents/** を git commit すること
public/art/** へ本採用配置すること（PO 確認前）
manifest を ready 化すること
```

決して代替画像で誤魔化さないこと。

---

## サブエージェント 1: Eve

### ステップ 1: sidekick:intake を実行

```bash
npm run sidekick:intake -- \
  --slug eve \
  --name "Eve" \
  --personality "穏やか" \
  --tone "丁寧" \
  --age 20 \
  --portrait public/art/characters/defaults/eve/portrait.png
```

出力から以下を記録する:
- `portrait ref:` の値（例: `assets/generated/residents/eve/reference/eve-portrait-reference-XXXXXX.png`）
- `incoming:` の値（例: `assets/generated/residents/eve/incoming/`）
- `prompt (Sheet 1):` の値（`.prompts/resident-sprites/eve.md`）
- `prompt (Sheet 2):` の値（`.prompts/resident-sprites/eve-extended.md`）

### ステップ 2: Sheet 1（motion-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `eve-sheet1` |
| `--reference` | ステップ 1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/eve-sheet1` |
| prompt | `.prompts/resident-sprites/eve.md` の全文 |
| 保存先 | `assets/generated/residents/eve/incoming/resident-sprite-sheet.png` |

### ステップ 3: Sheet 2（extended-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。Sheet 1 のデザインと一致させること。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `eve-sheet2` |
| `--reference` | ステップ 1 と同じ `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/eve-sheet2` |
| prompt | `.prompts/resident-sprites/eve-extended.md` の全文 |
| 保存先 | `assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png` |

### ステップ 4: sprite:check を実行

```bash
npm run sprite:check -- eve
```

- exit code 0 かつ warning のみ → pass
- exit code 1 → blocker、理由を報告して停止

### 完了報告（Eve）

```
## Eve 完了報告
- portrait ref: [記録した値]
- Sheet 1 PNG: assets/generated/residents/eve/incoming/resident-sprite-sheet.png
- Sheet 2 PNG: assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png
- sprite:check exit code: [0 or 1]
- warnings: [警告コードを列挙]
- blockers: [なし or 内容]
- PO visual review へ進めるか: [yes / no]
```

---

## サブエージェント 2: Garan

### ステップ 1: sidekick:intake を実行

```bash
npm run sidekick:intake -- \
  --slug garan \
  --name "Garan" \
  --personality "落ち着いた" \
  --tone "標準語" \
  --age 22 \
  --portrait public/art/characters/defaults/garan/portrait.png
```

出力から以下を記録する:
- `portrait ref:`
- `incoming:`
- `prompt (Sheet 1):`
- `prompt (Sheet 2):`

### ステップ 2: Sheet 1（motion-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `garan-sheet1` |
| `--reference` | ステップ 1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/garan-sheet1` |
| prompt | `.prompts/resident-sprites/garan.md` の全文 |
| 保存先 | `assets/generated/residents/garan/incoming/resident-sprite-sheet.png` |

### ステップ 3: Sheet 2（extended-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。Sheet 1 のデザインと一致させること。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `garan-sheet2` |
| `--reference` | ステップ 1 と同じ `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/garan-sheet2` |
| prompt | `.prompts/resident-sprites/garan-extended.md` の全文 |
| 保存先 | `assets/generated/residents/garan/incoming/resident-sprite-sheet-extended.png` |

### ステップ 4: sprite:check を実行

```bash
npm run sprite:check -- garan
```

### 完了報告（Garan）

```
## Garan 完了報告
- portrait ref: [記録した値]
- Sheet 1 PNG: assets/generated/residents/garan/incoming/resident-sprite-sheet.png
- Sheet 2 PNG: assets/generated/residents/garan/incoming/resident-sprite-sheet-extended.png
- sprite:check exit code: [0 or 1]
- warnings: [警告コードを列挙]
- blockers: [なし or 内容]
- PO visual review へ進めるか: [yes / no]
```

---

## サブエージェント 3: Ryo

### ステップ 1: sidekick:intake を実行

```bash
npm run sidekick:intake -- \
  --slug ryo \
  --name "Ryo" \
  --personality "明るい" \
  --tone "タメ口" \
  --age 17 \
  --portrait public/art/characters/defaults/ryo/portrait.png
```

出力から以下を記録する:
- `portrait ref:`
- `incoming:`
- `prompt (Sheet 1):`
- `prompt (Sheet 2):`

### ステップ 2: Sheet 1（motion-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `ryo-sheet1` |
| `--reference` | ステップ 1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/ryo-sheet1` |
| prompt | `.prompts/resident-sprites/ryo.md` の全文 |
| 保存先 | `assets/generated/residents/ryo/incoming/resident-sprite-sheet.png` |

### ステップ 3: Sheet 2（extended-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。Sheet 1 のデザインと一致させること。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `ryo-sheet2` |
| `--reference` | ステップ 1 と同じ `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/ryo-sheet2` |
| prompt | `.prompts/resident-sprites/ryo-extended.md` の全文 |
| 保存先 | `assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png` |

### ステップ 4: sprite:check を実行

```bash
npm run sprite:check -- ryo
```

### 完了報告（Ryo）

```
## Ryo 完了報告
- portrait ref: [記録した値]
- Sheet 1 PNG: assets/generated/residents/ryo/incoming/resident-sprite-sheet.png
- Sheet 2 PNG: assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png
- sprite:check exit code: [0 or 1]
- warnings: [警告コードを列挙]
- blockers: [なし or 内容]
- PO visual review へ進めるか: [yes / no]
```

---

## サブエージェント 4: Suzu

### ステップ 1: sidekick:intake を実行

```bash
npm run sidekick:intake -- \
  --slug suzu \
  --name "Suzu" \
  --personality "元気" \
  --tone "タメ口" \
  --age 16 \
  --portrait public/art/characters/defaults/suzu/portrait.png
```

出力から以下を記録する:
- `portrait ref:`
- `incoming:`
- `prompt (Sheet 1):`
- `prompt (Sheet 2):`

### ステップ 2: Sheet 1（motion-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `suzu-sheet1` |
| `--reference` | ステップ 1 で記録した `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/suzu-sheet1` |
| prompt | `.prompts/resident-sprites/suzu.md` の全文 |
| 保存先 | `assets/generated/residents/suzu/incoming/resident-sprite-sheet.png` |

### ステップ 3: Sheet 2（extended-sheet）を hatch-pet で生成

「hatch-pet 生成手順（Sheet 生成共通）」に従い以下のパラメーターで実行する。Sheet 1 のデザインと一致させること。

| パラメーター | 値 |
|---|---|
| `--pet-id` | `suzu-sheet2` |
| `--reference` | ステップ 1 と同じ `portrait ref` |
| `--output-dir` | `.hatch-pet-runs/suzu-sheet2` |
| prompt | `.prompts/resident-sprites/suzu-extended.md` の全文 |
| 保存先 | `assets/generated/residents/suzu/incoming/resident-sprite-sheet-extended.png` |

### ステップ 4: sprite:check を実行

```bash
npm run sprite:check -- suzu
```

### 完了報告（Suzu）

```
## Suzu 完了報告
- portrait ref: [記録した値]
- Sheet 1 PNG: assets/generated/residents/suzu/incoming/resident-sprite-sheet.png
- Sheet 2 PNG: assets/generated/residents/suzu/incoming/resident-sprite-sheet-extended.png
- sprite:check exit code: [0 or 1]
- warnings: [警告コードを列挙]
- blockers: [なし or 内容]
- PO visual review へ進めるか: [yes / no]
```

---

## オーケストレーター: 全体完了報告

4 キャラすべての完了報告を集約して以下の表を埋めること:

| キャラ | Sheet 1 生成 | Sheet 2 生成 | sprite:check | blockers | PO review 可 |
|---|---|---|---|---|---|
| Eve   | done / fail | done / fail | pass / fail | - | yes / no |
| Garan | done / fail | done / fail | pass / fail | - | yes / no |
| Ryo   | done / fail | done / fail | pass / fail | - | yes / no |
| Suzu  | done / fail | done / fail | pass / fail | - | yes / no |

blocker が 1 件でもある場合は PO に提示せず、原因と対処案を報告すること。
