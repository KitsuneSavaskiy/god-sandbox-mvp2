# ローカルasset pipelineフォルダ作成手順

状態: Sprint9 運用手順

## 目的

この文書は、developer や sidekick のローカル作業フォルダをそろえるための手順です。

- 非技術者はこの手順を直接使わない。
- 非技術者が渡すのは、キャラ名、1枚絵、性格、口調、年齢の5項目だけにする。
- `slug` や保存先パスは、ゲームまたは Codex sidekick が内部で扱う。

## 作成されるフォルダ

```text
assets/generated/residents/<slug>/incoming/
assets/generated/residents/<slug>/tmp/
assets/generated/residents/<slug>/rejected/
assets/generated/residents/<slug>/reference/
assets/residents/<slug>/sprites/
manifests/residents.json
```

`manifests/residents.json` はローカル整理用の placeholder です。
2-sheet ready 判定の正本ではありません。

## sidekick / job queue との関係

ゲームがキャラクリエイト画面の入力を受け取ると、Codex sidekick 用の job を置く想定です。

```text
.godsandbox/jobs/pending/
.godsandbox/jobs/running/
.godsandbox/jobs/done/
.godsandbox/jobs/failed/
```

実 job は Git 管理しません。

## フォルダを作る

repository root で実行:

```bat
tools\asset-pipeline\setup-resident-asset-folders.bat
```

PowerShell:

```powershell
.\tools\asset-pipeline\setup-resident-asset-folders.ps1
```

特定 slug を手動で作る場合:

```powershell
.\tools\asset-pipeline\setup-resident-asset-folders.ps1 ryo suzu
```

## incoming への取り込み

手動診断で PNG を取り込みたい場合:

```bat
tools\asset-pipeline\import-resident-sprite-source.bat ryo
```

PowerShell:

```powershell
.\tools\asset-pipeline\import-resident-sprite-source.ps1 ryo
```

これは developer 用の補助手順です。
本来の主経路では、Codex sidekick が `reference/` と `incoming/` を自動で扱います。

## 検査の基本

ready gate として使うのは次だけです。

```bash
npm run sprite:check -- ryo
```

このコマンドは次の 2 枚が両方あることを前提に検査します。

```text
assets/generated/residents/ryo/incoming/resident-sprite-sheet.png
assets/generated/residents/ryo/incoming/resident-sprite-sheet-extended.png
```

個別sheetの診断だけをしたい時:

```bash
npm run sprite:check -- ryo motion
npm run sprite:check -- ryo extended
```

public 配下の 1 ファイルだけを調べたい時:

```bash
npm run sprite:check -- public/art/characters/defaults/ryo/sprites/resident-sprite-sheet.png --kind motion
npm run sprite:check -- public/art/characters/defaults/ryo/sprites/resident-sprite-sheet-extended.png --kind extended
```

下位 validator は補助です。ready 判定には使いません。

```bash
node tools/asset-pipeline/check-resident-sprite-alpha.mjs <png-or-slug>
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs <png-or-slug>
```

## processor の扱い

processor はローカル作業物を出すだけです。

```bat
tools\asset-pipeline\process-resident-sprite-sheet.bat ryo
```

出力先:

```text
assets/residents/<slug>/sprites/
```

ここに出るものは候補です。
`public/art/**` へ本採用したことにはなりません。

## Git に入れないもの

- `assets/generated/**`
- `assets/residents/**`
- `manifests/residents.json`
- `.godsandbox/jobs/**`
- `.godsandbox/portraits/**`
- `.hatch-pet-runs/**`
- `narrative/generated/**`
- `incoming`
- `tmp`
- `rejected`

## PR 前チェック

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
```

見ること:

- generated output が入っていない
- `.hatch-pet-runs/**` が入っていない
- 実 job JSON が入っていない
- 個人PCの絶対パスが入っていない
- `sprite:check` の結果を single-sheet pass と誤読していない
