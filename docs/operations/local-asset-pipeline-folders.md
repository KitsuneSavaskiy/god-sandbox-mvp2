# ローカルasset pipelineフォルダ作成手順

状態: Sprint8 運用手順

## 目的

非技術者でも、ChatGPT UIで生成した住民画像を置く場所を迷わないようにする手順です。

この手順は、ローカル作業フォルダを作るだけです。
GodSandbox本体から画像生成APIを呼びません。
API key入力UIも作りません。

## 作成されるフォルダ

Windows向け補助scriptを実行すると、次のローカル作業フォルダが作られます。

```text
assets/generated/residents/<id>/incoming/
assets/generated/residents/<id>/tmp/
assets/generated/residents/<id>/rejected/
assets/residents/<id>/sprites/
manifests/residents.json
```

`<id>` は住民IDです。
初期状態では `eve`、`garan`、`ryo`、`suzu` を作ります。

`manifests/residents.json` はローカル作業用のplaceholderです。
manifestの正式な中身やschemaは Line 2 が決めます。
Line 1 はファイルを置く場所だけを用意します。

## Codex job queueとの関係

将来の Codex Sidekick / Codex automation / Codex CLI へ制作依頼を渡す場合は、次のローカルjob queueを使う方針です。

```text
.godsandbox/jobs/pending/
.godsandbox/jobs/running/
.godsandbox/jobs/done/
.godsandbox/jobs/failed/
```

`.godsandbox/jobs/**` の実jobはGit管理しません。
source画像の場所、ローカル生成物の場所、作業メモが入りうるためです。

Git管理してよいのは、次のようなdocs配下のsampleだけです。

```text
docs/operations/examples/codex-jobs/*.json
```

job queueの詳しい意味は `docs/operations/codex-job-queue.md` を見てください。

## 1コマンドで作る

repository root で次を実行します。

```bat
tools\asset-pipeline\setup-resident-asset-folders.bat
```

PowerShellから実行する場合:

```powershell
.\tools\asset-pipeline\setup-resident-asset-folders.ps1
```

別の住民IDで作る場合:

```powershell
.\tools\asset-pipeline\setup-resident-asset-folders.ps1 miko_fox village-child
```

住民IDに使える文字は、英数字、`-`、`_` です。

## ChatGPT UIで生成してincomingへ保存する

1. `.prompts/resident-sprites/<id>.md` を開きます。
2. ChatGPTなどのサブスク画面を別ブラウザで開きます。
3. 参照用の立ち絵とpromptを手動で渡します。
4. 生成された画像を `assets/generated/residents/<id>/incoming/` に保存します。
5. 切り出しや確認が必要な場合は `tmp/` で作業します。
6. 使わない画像は `rejected/` に移します。
7. 公式採用する画像だけ、後続PBIで定義されるmanifest仕様に従って登録します。

## PNGを選ぶだけでincomingへ取り込む

保存先フォルダを覚えなくても、Windows向け補助scriptでPNGを取り込めます。

repository root で次を実行します。

```bat
tools\asset-pipeline\import-resident-sprite-source.bat ryo
```

PowerShellから実行する場合:

```powershell
.\tools\asset-pipeline\import-resident-sprite-source.ps1 ryo
```

実行するとファイル選択画面が開きます。
ユーザーは、取り込みたいPNGだけを選びます。
保存先の `assets/generated/residents/<id>/incoming/` を手入力する必要はありません。

コピー後のファイル名は、住民IDと時刻から作られます。

```text
assets/generated/residents/ryo/incoming/resident-ryo-sprite-source-<timestamp>.png
```

この取り込み先はGit管理外です。
scriptは、採用済みassetへのコピー、validator実行、processor実行、manifest更新を行いません。

ファイル選択画面を使えない環境では、PowerShell版にPNGの場所を渡せます。

```powershell
.\tools\asset-pipeline\import-resident-sprite-source.ps1 ryo -SourcePath <png-file>
```

`<png-file>` には個人PCの絶対パスをdocsやPR本文へ書かないでください。

## incoming画像を検査する

生成したPNGを採用する前に、まずalpha channelと透明ピクセル数を確認します。

```bat
tools\asset-pipeline\check-resident-sprite-alpha.bat ryo
```

alpha channelがない場合、またはalpha channelがあっても透明ピクセルが0件の場合は、明示コマンドでalpha化候補を作るか、背景除去し直します。

```bat
tools\asset-pipeline\normalize-resident-sprite-alpha.bat ryo
```

alpha化候補は、次のGit管理外フォルダへ出力されます。

```text
assets/generated/residents/<id>/tmp/
```

元画像は上書きしません。
これは候補なので、必ず目視確認してください。

alpha確認が通ったら、次にPNGサイズを検査します。

```bat
tools\asset-pipeline\validate-resident-sprite-sheet.bat ryo
```

`ryo` の部分は、検査したい住民IDに変えます。

この検査は、PNGかどうか、画像サイズが `576x1056` px かどうかを確認します。
採用済みフォルダへのコピーはしません。
manifestも書き換えません。
検査後も、画像を採用するかどうかは人間が確認して決めます。

## 採用候補として処理する

検査が通ったPNGは、次のprocessorでローカル作業用spriteにできます。

```bat
tools\asset-pipeline\process-resident-sprite-sheet.bat ryo
```

`ryo` の部分は、処理したい住民IDに変えます。

processorは `assets/generated/residents/<id>/incoming/` からPNGを読み、次のGit管理外フォルダへ出力します。

```text
assets/residents/<id>/sprites/
```

作られる主なファイルは次の5つです。

- `resident-sprite-sheet.png`
- `resident-sprite-sheet.frames.json`
- `resident-sprite-manifest.draft.json`
- `resident-sprite-sheet.visual-audit.svg`
- `resident-sprite-sheet.visual-audit.json`

これは採用候補であり、まだ正本ではありません。
`public/art/**` へはコピーしません。
`manifests/residents.json` も書き換えません。
`visual-audit.svg` は row label、frame 境界、warning を見やすく並べた contact sheet です。
正式採用する場合は、visual audit と sandbox 表示を人間が確認してから行います。

## Gitに入れないもの

次はGit管理しません。

- `assets/generated/**`
- `assets/residents/**`
- `manifests/residents.json`
- `.godsandbox/jobs/**`
- `narrative/generated/**`
- `incoming`
- `tmp`
- `rejected`
- `user-uploads`
- プレイヤーがアップロードした新キャラ画像
- ユーザー固有の portrait / sprite / expression

これらはローカル作業用です。
PRに含めません。

## Git管理してよいもの

Git管理してよいものは、次に限定します。

- `.prompts/**` の生成用prompt
- GodSandboxが最初から同梱するデフォルト画像
- 公式採用assetとしてレビュー済みのmanifest / sprite
- 採用理由や検査結果を書いた短いMarkdown

詳しくは `docs/operations/asset-pipeline-git-rules.md` を見てください。

## 空フォルダの扱い

空フォルダ維持のために `.gitkeep` は置きません。
必要なフォルダは `tools/asset-pipeline/setup-resident-asset-folders.bat` または `.ps1` で作ります。

## PR前チェック

PR前に次を確認します。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
```

見ること:

- `assets/generated/**` が差分に入っていない。
- `assets/residents/**` が差分に入っていない。
- `manifests/residents.json` が差分に入っていない。
- `manifests/residents.json` の中身をLine 1で正本仕様として扱っていない。
- `.godsandbox/jobs/**` の実jobが差分に入っていない。
- `narrative/generated/**` の生成候補が差分に入っていない。
- 個人PCの絶対パス、secret、API key、token が入っていない。
