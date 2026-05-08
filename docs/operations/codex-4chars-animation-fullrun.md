# Codex 指示書: 4 キャラクター アニメーション フルラン

Status: current PO previewでは実行しない。canonical 2-sheet gate用の旧手順。

Eve/RyoのPO確認では、このfullrunよりも1キャラずつCodex petで作り、
1枚combined sheetを`PO確認 -> 局所修正 -> 再確認`で仕上げる手順の方が要件に合った。

現在のPO previewでは次を正本にする。

```txt
.agents/skills/godsandbox-po-preview-sprite-from-portrait/SKILL.md
docs/operations/resident-sprite-po-preview-quality.md
```

この文書は、将来2-sheet生成が安定した後のcanonical ready gateとしてだけ参照する。

## この指示書の使い方

Codex スレッドで以下を先頭に置いて実行する。

```txt
Use @hatch-pet.
Read docs/operations/codex-4chars-animation-fullrun.md and execute it exactly.
Do not create local handmade or synthetic sprite candidates.
If hatch-pet or image generation is unavailable, stop with `generation step unavailable`.
Do not call hatch-pet helper scripts directly. Use `npm run sidekick:resident:hatch-pet`.
Raw Image Gen output is evidence only and must not be copied to incoming.
```

---

## あなたの役割

4 キャラクター（Eve / Garan / Ryo / Suzu）について、1 枚絵から箱庭アニメーションまでを実装してテストする。

P0 blocker 対応中は、4 キャラ fullrun を再開しない。
PR #249 merge後は、まずRyo proofのみ再開可。
Eve / Garan / Suzu は、Ryo proof が pass するまで開始禁止。

再開後も、4 キャラを同時に開始してはいけない。
生成対象は常に 1 キャラだけにし、次の順で進める。

```txt
1. Ryo proof
2. Eve
3. Garan
4. Suzu
```

各キャラは `sidekick:intake`、motion wrapper、extended wrapper、`sprite:check`、contact sheet確認まで完了してから次のキャラへ進む。
途中で blocker が出た場合、以降のキャラへ進まず停止する。

---

## ステップ 0: hatch-pet スキルを確認する（Agent 起動前に必ず実行）

`Use @hatch-pet` はこのスレッドの先頭で宣言済みであること。
Skill フォルダの存在を確認してから次へ進む。

```powershell
Test-Path "$env:USERPROFILE\.codex\skills\hatch-pet\SKILL.md"
```

`True` が返れば次へ進む。`False` または Skill が存在しない場合は `hatch-pet activation failed` を報告して停止する。

---

## resident hatch-pet wrapper 手順（Sheet 生成共通）

各 Sheet は必ず wrapper 経由で扱う。
各 Agent が `prepare_pet_run.py`、`record_imagegen_result.py`、`finalize_pet_run.py` を直接呼んではいけない。

**手順 A: dry-run で row manifest を確認**

```bash
npm run sidekick:resident:hatch-pet -- --slug <slug> --sheet motion --portrait <portrait ref パス> --prompt .prompts/resident-sprites/<slug>.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug <slug> --sheet extended --portrait <portrait ref パス> --prompt .prompts/resident-sprites/<slug>-extended.md --dry-run
```

**手順 B: Codex pet で生成する**

Codex pet が画像生成を行う。GodSandbox アプリやローカル Python から画像生成 API を呼ばない。
raw Image Gen output は evidence として run folder に残すだけで、candidate ではない。

**手順 C: hatch-pet final output を wrapper に検査させる**

wrapper は `.hatch-pet-runs/<slug>-<motion|extended>/final/spritesheet.png` だけを final として見る。
non-dry-runでは `.hatch-pet-runs/<slug>-<motion|extended>/pet_request.json` が必須。
final が `1536x1872` でない、Sheet 2 row manifest が違う、alpha または `#ff00ff` chroma-key がない場合は fail し、incoming へコピーしない。
`#ff00ff` の場合は wrapper が透明 alpha へ変換してから incoming へ置く。

```bash
npm run sidekick:resident:hatch-pet -- --slug <slug> --sheet motion --portrait <portrait ref パス> --prompt .prompts/resident-sprites/<slug>.md
npm run sidekick:resident:hatch-pet -- --slug <slug> --sheet extended --portrait <portrait ref パス> --prompt .prompts/resident-sprites/<slug>-extended.md
```

**手順 D: 両 Sheet が揃った場合だけ sprite:check**

wrapper は motion / extended の両方が incoming に揃ったときだけ `npm run sprite:check -- <slug>` を実行する。
Sheet 1 だけでは pass 扱いにしない。

---

## 共通禁止事項（全ステップに適用）

```
portrait をそのまま incoming へコピーして sprite:check を通さないこと
ローカルで手製・合成・プレースホルダー PNG を sprite sheet 候補として使わないこと
hatch-pet を使わずに sprite sheet を作らないこと
prepare_pet_run.py / record_imagegen_result.py / finalize_pet_run.py を直接呼ばないこと
raw Image Gen output を incoming へ置かないこと
1536x1872 以外の PNG を incoming へ置かないこと
assets/generated/** / assets/residents/** / .hatch-pet-runs/** を git commit しないこと
PO visual OK 前に manifest を ready 化しないこと
public/art/** へ配置したファイルを PO visual OK 前に git commit しないこと
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
row 0: idle      row 1: walk-right  row 2: walk-left  row 3: waving
row 4: jumping   row 5: failed     row 6: waiting   row 7: running  row 8: review
```

**Sheet 2（resident-sprite-sheet-extended.png）行順:**
```
row 0: walk-up   row 1: walk-down   row 2: walk-forward  row 3: walk-back
row 4: emote-happy  row 5: emote-angry  row 6: emote-sad  row 7: emote-surprised
row 8: (spare — transparent またはrow 7の複製)
```

---

## Step 1: Ryo proof

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

### R-2: Sheet 1 を wrapper で検査・配置

```bash
npm run sidekick:resident:hatch-pet -- --slug ryo --sheet motion --portrait <R-1 の portrait ref> --prompt .prompts/resident-sprites/ryo.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug ryo --sheet motion --portrait <R-1 の portrait ref> --prompt .prompts/resident-sprites/ryo.md
```

### R-3: Sheet 2 を wrapper で検査・配置

```bash
npm run sidekick:resident:hatch-pet -- --slug ryo --sheet extended --portrait <R-1 の portrait ref> --prompt .prompts/resident-sprites/ryo-extended.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug ryo --sheet extended --portrait <R-1 の portrait ref> --prompt .prompts/resident-sprites/ryo-extended.md
```

### R-4: sprite:check

```bash
npm run sprite:check -- ryo
```

---

## Step 2: Eve

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

### E-2: Sheet 1 を wrapper で検査・配置

```bash
npm run sidekick:resident:hatch-pet -- --slug eve --sheet motion --portrait <E-1 の portrait ref> --prompt .prompts/resident-sprites/eve.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug eve --sheet motion --portrait <E-1 の portrait ref> --prompt .prompts/resident-sprites/eve.md
```

### E-3: Sheet 2 を wrapper で検査・配置

```bash
npm run sidekick:resident:hatch-pet -- --slug eve --sheet extended --portrait <E-1 の portrait ref> --prompt .prompts/resident-sprites/eve-extended.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug eve --sheet extended --portrait <E-1 の portrait ref> --prompt .prompts/resident-sprites/eve-extended.md
```

### E-4: sprite:check

```bash
npm run sprite:check -- eve
```

exit code 0（warning のみ含む）→ pass。exit code 1 → **このキャラクターの blocker** として内容を全文報告し、以降のキャラへ進まず停止する。

---

## Step 3: Garan

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

### G-2: Sheet 1 を wrapper で検査・配置

```bash
npm run sidekick:resident:hatch-pet -- --slug garan --sheet motion --portrait <G-1 の portrait ref> --prompt .prompts/resident-sprites/garan.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug garan --sheet motion --portrait <G-1 の portrait ref> --prompt .prompts/resident-sprites/garan.md
```

### G-3: Sheet 2 を wrapper で検査・配置

```bash
npm run sidekick:resident:hatch-pet -- --slug garan --sheet extended --portrait <G-1 の portrait ref> --prompt .prompts/resident-sprites/garan-extended.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug garan --sheet extended --portrait <G-1 の portrait ref> --prompt .prompts/resident-sprites/garan-extended.md
```

### G-4: sprite:check

```bash
npm run sprite:check -- garan
```

---

## Step 4: Suzu

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

### S-2: Sheet 1 を wrapper で検査・配置

```bash
npm run sidekick:resident:hatch-pet -- --slug suzu --sheet motion --portrait <S-1 の portrait ref> --prompt .prompts/resident-sprites/suzu.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug suzu --sheet motion --portrait <S-1 の portrait ref> --prompt .prompts/resident-sprites/suzu.md
```

### S-3: Sheet 2 を wrapper で検査・配置

```bash
npm run sidekick:resident:hatch-pet -- --slug suzu --sheet extended --portrait <S-1 の portrait ref> --prompt .prompts/resident-sprites/suzu-extended.md --dry-run
npm run sidekick:resident:hatch-pet -- --slug suzu --sheet extended --portrait <S-1 の portrait ref> --prompt .prompts/resident-sprites/suzu-extended.md
```

### S-4: sprite:check

```bash
npm run sprite:check -- suzu
```

---

## テストフェーズ（4キャラを順番にすべて完了後）

Ryo → Eve → Garan → Suzu の順に、各キャラが exit code 0 で完了してから以下を実行する。

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

### A-2: manifest は placeholder のまま維持

この fullrun では、local preview が通っても manifest を `ready` に変更しない。

理由:

- 2-sheet ready の正本は `src/persistence/defaultCharacterAssetManifest.ts` 側で管理する
- `src/persistence/defaultResidentSpriteManifest.ts` は旧互換の橋渡しである
- PO visual OK 前に ready を上げると採用事故になる

この段階で許されるのは preview 用の public 配置までであり、採用更新ではない。

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
- manifest ready 化: 実施しない
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
| `SKILL.md` が存在しない / hatch-pet Skill が無効 | `hatch-pet activation failed` を報告して**全作業停止** |
| `$imagegen` が利用不可（画像生成 Skill が無効） | `generation step unavailable` を報告して**全作業停止** |
| sprite:check exit code 1（サイズ・アルファ不一致など） | エラー内容を全文報告して停止。**以降のキャラクターへ進まない** |
| 生成サイズが 1536×1872 以外（例: 1136×1385） | raw evidence として記録。wrapper が fail し、incoming へコピーしない |
| Sheet 2 row manifest が Sheet 1 の標準行になっている | wrapper が生成前または配置前に fail。以降のキャラへ進まない |
| typecheck/build エラー | エラー内容を全文報告して停止 |
| manifest 変更でブラウザエラー | コンソールエラー全文を報告 |

ブロッカーがある場合は PO への確認依頼を行わず、原因と対処案のみを報告する。
