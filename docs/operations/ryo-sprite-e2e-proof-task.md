# 作業名: Ryo resident sprite end-to-end proof

Status: superseded for PO preview.

この文書の `1536x1872 / 2-sheet / incoming` 手順は、RyoのPO確認で使った正本ではない。
現在のRyo以降のPO previewは、Eve/Ryoで実施した1枚combined sheet手順を正本にする。

```txt
.agents/skills/godsandbox-po-preview-sprite-from-portrait/SKILL.md
docs/operations/resident-sprite-po-preview-quality.md
```

対象repo: god-sandbox-mvp2  
担当: 単独Codexスレッド（サイドキック）

## Codex の役割

Codex は GodSandbox ゲームアプリとは別プロセスで動作するサイドキックである。
非技術者はキャラクリエイト画面で 5 項目だけを渡し、Codex がゲームのディレクトリ内の資源を
自律的に生成・配置する。GodSandbox アプリ本体は画像生成 API を呼ばない。

## 非技術者がキャラクリエイト画面に入力するもの（これだけ）

```txt
キャラ名（displayName）: Ryo
性格（personality）:     （任意の値）
口調（tone）:            （任意の値）
年齢（age）:             （任意の値）
１枚絵（portrait）:      public/art/characters/defaults/ryo/portrait.png
```

Codex は以下を非技術者に要求しない。

```txt
slug / characterId / assetBundleId / jobId
prompt ファイルの操作
フォルダへのファイル配置
sprite:check の実行
Codex pet の操作
コマンドライン操作全般
```

## 最初に必ず行うこと

```bash
git switch main
git pull --ff-only
```

次に、正本を読む。

```txt
docs/operations/resident-sprite-spec.md
tools/sidekick/sidekick-intake.mjs
tools/sidekick/tasks/resident-sprite-sheet-candidate.json
```

## Codex の実行禁止事項

```txt
portrait をそのまま incoming へコピーして sprite:check を実行すること
ローカルで手製の PNG を sprite sheet 候補として扱うこと
Codex pet を使わずに sprite sheet を作ること
assets/generated/** を git commit すること
assets/residents/** を git commit すること
public/art/** へ本採用配置すること（PO 確認前）
manifest を ready 化すること
```

---

## ステップ 1: 既存チェック

```bash
npm run sprite:check -- public/art/characters/defaults/eve/sprites/resident-sprite-sheet.png --kind motion
npm run sprite:check -- public/art/characters/defaults/eve/sprites/resident-sprite-sheet-extended.png --kind extended
```

どちらかが exit code 1（fail）の場合: 停止し、spec または check tool の問題として報告する。
両方が exit code 0（pass）の場合: 次へ進む。

**visual audit の warning（`PARTSxN` など）は exit code 0 = pass である。blocker ではない。**

---

## ステップ 2: sidekick:intake を実行する

```bash
npm run sidekick:intake -- --slug ryo --name "Ryo" --personality "明るい" --tone "タメ口" --age 17 --portrait public/art/characters/defaults/ryo/portrait.png
```

このコマンドが自動で行うこと。

```txt
- characterId (chr_ryo) / assetBundleId / jobId を生成する
- .godsandbox/jobs/<jobId>.json を書き出す
- assets/generated/residents/ryo/incoming/ を作成する
- assets/generated/residents/ryo/reference/ryo-portrait-reference-*.png を作成する
- .prompts/resident-sprites/ryo.md が存在しなければ _template.md から自動生成する
```

出力に含まれる以下の値を記録する。

```txt
portrait ref path  （ステップ 3 で使用）
prompt path        （ステップ 3 で使用）
incoming path      （ステップ 3 で使用）
```

intake が exit code 1 の場合: エラーを報告して停止する。

---

## ステップ 3: Codex pet で sprite sheet を生成して incoming に保存する

intake が出力した portrait ref と prompt を使い、Codex pet で sprite sheet を生成する。

生成 PNG の仕様（`docs/operations/resident-sprite-spec.md` 参照）。

```txt
canvas: 1536×1872 px
frame:  192×208 px
columns: 8 / rows: 9
background: transparent alpha
  （alpha が出力できない場合は #ff00ff chroma-key を使う）
```

生成した PNG を以下に保存する。

```txt
assets/generated/residents/ryo/incoming/
```

保存後、ファイルが存在することを確認する。

---

## ステップ 4: sprite:check を実行する

```bash
npm run sprite:check -- ryo
```

blocker 判定。

```txt
blocker（exit code 1）:
  - alpha check fail
  - validate fail
  - visual audit fail

blocker ではない（exit code 0）:
  - visual audit warning（PARTS / TOP / BOT / BOUND）
  - "note: warnings are heuristic hints" の出力
```

blocker が出た場合: 次ステップへ進まず、失敗分類を報告する。

---

## ステップ 5: 箱庭アニメーション確認（sprite:check pass 後のみ）

```txt
idle / walk / emote 行が行順どおりに見えるか
192×208 frame の切り出しが壊れていないか
歩行時に頭・足・胴が欠けないか
途中で線が出ないか
Ryo らしさがあるか
箱庭サイズ感が Eve に近いか
```

---

## 完了報告の形式

```md
# Ryo resident sprite end-to-end proof result

## 非技術者入力
- display name: Ryo
- portrait: public/art/characters/defaults/ryo/portrait.png

## sidekick:intake
- exit code:
- characterId:
- assetBundleId:
- jobId:
- portrait ref:
- prompt: （auto-generated / pre-existing）
- prompt path:
- incoming:

## 既存確認
- Eve sprite:check exit code:
- Eve warning:

## Codex pet 生成
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
- Ryo らしさ:
- 線・見切れ:

## 判定
- proof result: pass / fail
- PO visual review へ進めるか:
- ready 化してよいか: no（PO 確認前は常に no）
- Suzu へ展開してよいか: yes / no / pending

## 失敗分類（失敗した場合）
- A. prompt 不足
- B. resident-sprite-spec.md 不足
- C. sprite:check 不足または誤検出
- D. 生成候補の品質不足
- E. Ryo 立ち絵の収まり問題
- F. 箱庭アニメーション側の切り出し・表示問題
- G. sidekick:intake の不具合
- H. Codex pet 生成の失敗
- I. 手順理解ミス
```

---

## PR 方針

PR に含めてよいもの。

```txt
docs / report
必要な prompt の小修正
必要な spec の小修正
必要な sidekick:intake の小修正
必要な check tool の小修正
```

PR に含めてはいけないもの。

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
Suzu 生成
Ryo ready 化
public/art への本採用配置
manifest ready 化
runtime test 更新
GodSandbox アプリ本体への画像生成 API 追加
assets/generated/** / assets/residents/** の commit
```
