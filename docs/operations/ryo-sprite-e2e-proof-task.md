# 作業名: Ryo resident sprite end-to-end proof（#233 マージ後版）

対象repo: god-sandbox-mvp2  
担当: 単独Codexスレッド

## 目的

`npm run sidekick:intake` が正しく動くことを確認し、Ryo の resident sprite sheet 生成から箱庭アニメーション確認までの通し試験を行う。

今回の目的は、#233 で入った intake CLI / task recipe / spec 修正が、実際の Ryo フローで機能するかを確認すること。

## 最初に必ず行うこと

main を最新化する。

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

`.prompts/resident-sprites/ryo.md` は `sidekick:intake` が自動生成するため、Codex が事前に開く必要はない。

## Codex が実行してよいこと・してはいけないこと

### してよいこと

```txt
npm run sidekick:intake -- --slug ryo --portrait public/art/characters/defaults/ryo/portrait.png
npm run sprite:check -- ryo  （オペレーターが PNG を置いた後）
npm run sprite:check -- public/art/characters/defaults/eve/sprites/resident-sprite-sheet.png
```

### してはいけないこと

```txt
portrait を incoming フォルダへコピーして sprite:check を実行すること
任意の PNG を sprite sheet 候補として扱うこと
外部 UI を使わずに sprite sheet を作ること
assets/generated/** を git commit すること
assets/residents/** を git commit すること
public/art/** へ本採用配置すること
manifest を ready 化すること
```

## ステップ 1: 既存チェック

以下を実行する。

```bash
npm run sprite:check -- public/art/characters/defaults/eve/sprites/resident-sprite-sheet.png
```

Eve が fail した場合は停止し、spec または check tool の問題として報告する。  
Eve が pass した場合（warning は pass と同じ）、次へ進む。

**重要: visual audit の warning（`PARTSxN`）は heuristic ヒントであり、exit code 0 = pass である。warning が出ても次へ進む。**

## ステップ 2: sidekick:intake を実行する

```bash
npm run sidekick:intake -- --slug ryo --portrait public/art/characters/defaults/ryo/portrait.png
```

確認すること。

```txt
characterId が chr_ryo であること
assetBundleId が ryo-default-resident-v1 であること
jobId が ryo-sprite-<timestamp> 形式であること
.godsandbox/jobs/<jobId>.json が作成されていること
assets/generated/residents/ryo/incoming/ が作成されていること
assets/generated/residents/ryo/reference/ryo-portrait-reference-*.png が作成されていること
Operator next steps が出力されていること
```

intake が fail した場合は、エラーメッセージを報告して停止する。

## ステップ 3: generation step — Codex は停止して報告する

Codex は画像を生成できない。

intake が成功した時点で、Codex は以下を報告して**停止する**。

```txt
generation step unavailable

sidekick:intake は正常終了した。
次は、オペレーターが以下を行う必要がある。

  1. Codex pet または承認済みの外部画像生成 UI を開く
  2. intake が出力した portrait reference をアップロードする:
     assets/generated/residents/ryo/reference/ryo-portrait-reference-*.png
  3. intake が出力した prompt path の内容を貼り付ける:
     .prompts/resident-sprites/ryo.md
     （intake が自動生成済み。非技術者はこのファイルを作成・編集しない）
  4. sprite sheet を生成して PNG をダウンロードする
  5. 生成した PNG を以下に置く:
     assets/generated/residents/ryo/incoming/
  6. 連絡を受けたら npm run sprite:check -- ryo を実行する
```

portrait を incoming へコピーして sprite:check を実行してはならない。  
代替の sprite sheet を作ってはならない。  
このステップを「generation step unavailable」以外の理由で fail と記録してはならない。

## ステップ 4: sprite:check（オペレーターが PNG を置いた後）

オペレーターから「PNG を置いた」という連絡を受けた後に実行する。

```bash
npm run sprite:check -- ryo
```

blocker 判定。

```txt
以下は blocker:
  - alpha check fail（exit code 1）
  - validate fail（exit code 1）
  - visual audit fail（exit code 1）

以下は blocker ではない:
  - visual audit warning（exit code 0、PARTS / TOP / BOT / BOUND）
  - "note: warnings are heuristic hints" の出力
```

blocker が出た場合は、ready 化へ進まず失敗分類を報告する。

## 完了報告の形式

```md
# Ryo resident sprite end-to-end proof result

## 入力
- display name: Ryo
- portrait source:
- prompt: .prompts/resident-sprites/ryo.md
- spec: docs/operations/resident-sprite-spec.md

## sidekick:intake
- exit code:
- characterId:
- assetBundleId:
- jobId:
- job path:
- portrait ref:
- incoming:
- prompt: （auto-generated / already existed）
- prompt path:
- Operator next steps 出力: yes / no

## generation step
- 実行者: Codex（実行不可）/ オペレーター（実行）
- 状態: generation step unavailable / 完了
- 使用 UI: （オペレーターが記入）

## 既存確認
- Eve sprite:check: pass / fail
- Eve warning: PARTSxN（pass 扱い）

## Ryo sprite:check（PNG 配置後）
- exit code:
- alpha:
- validate:
- visual audit:
- warning codes:
- blocker:

## 箱庭アニメーション確認（sprite:check pass 後のみ）
- idle:
- walk:
- emote:
- frame 切り出し:
- サイズ感:
- Ryo らしさ:
- 線・見切れ:
- click 導線:

## 判定
- proof result: pass / fail / generation step unavailable
- PO visual review へ進めるか:
- ready 化してよいか: no
- Suzu へ展開してよいか: yes / no / pending

## 失敗分類（失敗した場合）
- A. prompt 不足
- B. resident-sprite-spec.md 不足
- C. sprite:check 不足または誤検出
- D. 生成候補の品質不足
- E. Ryo 立ち絵の収まり問題
- F. 箱庭アニメーション側の切り出し・表示問題
- G. sidekick:intake の不具合
- H. 手順理解ミス

## 修正が必要な場合
- sidekick:intake 修正:
- prompt 修正:
- spec 修正:
- check tool 修正:
- 次にやること:
```

## PR 方針

このタスクで PR を作る場合、候補生成・検査・report に閉じる。

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

本採用 ready 化は、PO visual OK 後の別 PR にする。

## 今回やらないこと

```txt
Suzu 生成
Ryo ready 化
public/art への本採用配置
manifest ready 化
runtime test 更新
API 接続
画像生成 API の GodSandbox 本体への追加
generated output commit
assets/generated/** commit
assets/residents/** commit
```
