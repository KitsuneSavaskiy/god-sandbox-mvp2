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

## Gitに入れないもの

次はGit管理しません。

- `assets/generated/**`
- `assets/residents/**`
- `manifests/residents.json`
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
- 個人PCの絶対パス、secret、API key、token が入っていない。
