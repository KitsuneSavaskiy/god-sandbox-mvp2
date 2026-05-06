# 作業名: 全キャラクター resident sprite 生成スプリント

対象キャラクター: **Eve / Garan / Ryo / Suzu**（4キャラ同時進行）  
担当: Codex サイドキック（hatch-pet スキル使用）

## 背景

Ryo の e2e proof（`docs/operations/ryo-sprite-e2e-proof-task.md`）が pass し、
hatch-pet を使った生成パイプラインが確立した。
同じ手順を残り3キャラ（Eve / Garan / Suzu）に展開し、
全4キャラの sprite sheet 候補を揃える。

## 対象キャラクター一覧

| slug | portrait | prompt | 生成済み |
|---|---|---|---|
| eve   | `public/art/characters/defaults/eve/portrait.png`   | `.prompts/resident-sprites/eve.md`   | 旧規格あり（再生成対象）|
| garan | `public/art/characters/defaults/garan/portrait.png` | `.prompts/resident-sprites/garan.md` | なし |
| ryo   | `public/art/characters/defaults/ryo/portrait.png`   | `.prompts/resident-sprites/ryo.md`   | 候補あり（proof pass） |
| suzu  | `public/art/characters/defaults/suzu/portrait.png`  | `.prompts/resident-sprites/suzu.md`  | なし |

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

## 各キャラクターの手順

各キャラクターについて以下のステップを独立して実行する。
キャラクター間の依存はないため並行実行可。

### ステップ 1: Eve 前提確認（最初の1回のみ）

```bash
npm run sprite:check -- public/art/characters/defaults/eve/sprites/resident-sprite-sheet.png
```

exit code 0 を確認してから次へ進む。

### ステップ 2: sidekick:intake 実行（キャラクターごと）

```bash
# Eve
npm run sidekick:intake -- --slug eve --name "Eve" --personality "穏やか" --tone "丁寧" --age 20 --portrait public/art/characters/defaults/eve/portrait.png

# Garan
npm run sidekick:intake -- --slug garan --name "Garan" --personality "落ち着いた" --tone "標準語" --age 22 --portrait public/art/characters/defaults/garan/portrait.png

# Ryo（再実行不要、proof 済み）

# Suzu
npm run sidekick:intake -- --slug suzu --name "Suzu" --personality "元気" --tone "タメ口" --age 16 --portrait public/art/characters/defaults/suzu/portrait.png
```

各コマンドから以下を記録する:
- portrait ref path
- prompt path
- incoming path

### ステップ 3: hatch-pet で sprite sheet を生成

intake が出力した portrait ref と prompt を使い、hatch-pet スキルで sprite sheet を生成する。

#### 生成仕様

現行 GodSandbox resident 規格（hatch-pet → 変換後）:

```txt
canvas: 576 × 1056 px
frame:  96 × 96 px
columns: 6 / rows: 11
background: transparent alpha（不可なら #ff00ff chroma-key）
```

#### motion 行順（GodSandbox 規格）

```txt
row 0:  idle
row 1:  walk-up
row 2:  walk-down
row 3:  walk-left
row 4:  walk-right
row 5:  walk-forward
row 6:  walk-back
row 7:  emote-happy
row 8:  emote-angry
row 9:  emote-sad
row 10: emote-surprised
```

#### hatch-pet → GodSandbox 行マッピング（参考）

| GodSandbox 行 | motion | hatch-pet 対応 |
|---|---|---|
| 0 | idle | idle（そのまま） |
| 1 | walk-up | なし → 追加生成 |
| 2 | walk-down | なし → 追加生成 |
| 3 | walk-left | running-left（近似） |
| 4 | walk-right | running-right（近似） |
| 5 | walk-forward | なし → 追加生成 |
| 6 | walk-back | なし → 追加生成 |
| 7 | emote-happy | なし → 追加生成 |
| 8 | emote-angry | なし → 追加生成 |
| 9 | emote-sad | failed（近似） |
| 10 | emote-surprised | なし → 追加生成 |

#### 保存先（キャラクターごと）

```txt
assets/generated/residents/eve/incoming/
assets/generated/residents/garan/incoming/
assets/generated/residents/ryo/incoming/   （Ryo は proof 済みにつき任意）
assets/generated/residents/suzu/incoming/
```

hatch-pet が使用できない場合: `generation step unavailable` を報告して停止する。  
手製・合成・placeholder 画像で代替しないこと。

### ステップ 4: sprite:check（キャラクターごと）

```bash
npm run sprite:check -- eve
npm run sprite:check -- garan
npm run sprite:check -- suzu
```

exit code 1 は blocker。exit code 0 かつ warning は pass。

### ステップ 5: 箱庭アニメーション目視確認（キャラクターごと）

contact sheet（visual audit が出力する SVG）を確認:
- idle / walk / emote 各行が row 順に見えるか
- 96×96 frame に頭・胴・足が収まっているか
- キャラクターらしさがあるか（portrait の特徴を保持しているか）
- Eve のサイズ感に近いか

---

## 完了報告の形式（キャラクターごと）

```md
# [キャラ名] resident sprite proof result

## sidekick:intake
- exit code:
- characterId:
- jobId:
- portrait ref:
- prompt:
- incoming:

## hatch-pet 生成
- portrait ref 使用:
- prompt 使用:
- 生成 PNG 保存先:
- ファイル確認: yes / no

## sprite:check
- exit code:
- alpha: pass / fail
- validate: pass / fail
- visual audit: pass / fail
- warning codes:
- blocker:

## 箱庭アニメーション確認
- idle:
- walk:
- emote:
- frame 切り出し:
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
2シート構成への移行（設計中）
```
