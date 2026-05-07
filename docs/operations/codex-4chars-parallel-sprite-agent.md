# Codex 指示書: 4キャラクター並列スプライト生成エージェント

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

もし hatch-pet が使用できない場合は `generation step unavailable` を報告して停止すること。
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

- portrait: ステップ 1 で記録した `portrait ref` のパス
- prompt: `.prompts/resident-sprites/eve.md` の全文を読み込んで hatch-pet に渡す
- 生成仕様（hatch-pet ネイティブ出力そのまま）:
  - Canvas: **1536 × 1872 px**
  - frame: **192 × 208 px**
  - columns: 8 / rows: 9
  - background: transparent alpha（不可なら `#ff00ff` chroma-key）
- 生成後、PNG を以下へ保存:
  ```
  assets/generated/residents/eve/incoming/resident-sprite-sheet.png
  ```

### ステップ 3: Sheet 2（extended-sheet）を hatch-pet で生成

- portrait: ステップ 1 と同じ `portrait ref` のパス
- prompt: `.prompts/resident-sprites/eve-extended.md` の全文を読み込んで hatch-pet に渡す
- Sheet 1 と同一仕様（1536 × 1872, 192 × 208, 8col × 9row）
- Sheet 1 で使ったキャラクターデザインと一致させること
- 生成後、PNG を以下へ保存:
  ```
  assets/generated/residents/eve/incoming/resident-sprite-sheet-extended.png
  ```

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

### ステップ 2: Sheet 1 を hatch-pet で生成

- portrait: 記録した `portrait ref`
- prompt: `.prompts/resident-sprites/garan.md` の全文
- 仕様: 1536 × 1872, 192 × 208, 8col × 9row, transparent / `#ff00ff`
- 保存先:
  ```
  assets/generated/residents/garan/incoming/resident-sprite-sheet.png
  ```

### ステップ 3: Sheet 2 を hatch-pet で生成

- portrait: 同上
- prompt: `.prompts/resident-sprites/garan-extended.md` の全文
- Sheet 1 と同一仕様、Sheet 1 のデザインと一致させること
- 保存先:
  ```
  assets/generated/residents/garan/incoming/resident-sprite-sheet-extended.png
  ```

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

### ステップ 2: Sheet 1 を hatch-pet で生成

- portrait: 記録した `portrait ref`
- prompt: `.prompts/resident-sprites/ryo.md` の全文
- 仕様: 1536 × 1872, 192 × 208, 8col × 9row, transparent / `#ff00ff`
- 保存先:
  ```
  assets/generated/residents/ryo/incoming/resident-sprite-sheet.png
  ```

### ステップ 3: Sheet 2 を hatch-pet で生成

- portrait: 同上
- prompt: `.prompts/resident-sprites/ryo-extended.md` の全文
- Sheet 1 と同一仕様、Sheet 1 のデザインと一致させること
- 保存先:
  ```
  assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png
  ```

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

### ステップ 2: Sheet 1 を hatch-pet で生成

- portrait: 記録した `portrait ref`
- prompt: `.prompts/resident-sprites/suzu.md` の全文
- 仕様: 1536 × 1872, 192 × 208, 8col × 9row, transparent / `#ff00ff`
- 保存先:
  ```
  assets/generated/residents/suzu/incoming/resident-sprite-sheet.png
  ```

### ステップ 3: Sheet 2 を hatch-pet で生成

- portrait: 同上
- prompt: `.prompts/resident-sprites/suzu-extended.md` の全文
- Sheet 1 と同一仕様、Sheet 1 のデザインと一致させること
- 保存先:
  ```
  assets/generated/residents/suzu/incoming/resident-sprite-sheet-extended.png
  ```

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
