# 住民sprite sheet生成パイプライン

状態: Sprint8 運用メモ

## 方針

- アプリ内からCodex petや外部AI APIを直接呼ばない。
- 生成は外部補助として、ユーザーまたは開発者が別ブラウザで行う。
- MVPでは、ChatGPTなどのサブスク画面にpromptと参照画像を手動で渡す運用を主軸にする。
- GodSandbox本体はAPI key、従量課金API、画像生成API呼び出しを必須にしない。
- GodSandbox側は prompt、保存先、命名規則、asset manifest、read modelだけを持つ。
- 立ち絵を縮小しただけの画像をsprite sheetとして登録しない。
- 住民sprite sheetは、ドット絵風の小さい箱庭キャラとして生成する。

## APIキー不要・従量課金なしのサブスク前提ローカルasset pipeline

このpipelineは、アプリ内課金やAPI連携ではなく、外部の生成画面とローカル作業を分けて扱う。
ChatGPT などのサブスク画面を人間が別ブラウザで使い、GodSandbox 本体は API key や従量課金 API 呼び出しを前提にしない。

1. `.prompts/resident-sprites/<characterId>.md` を開く。
2. ChatGPTなどのサブスク画面を別ブラウザで開く。
3. 参照用の立ち絵とpromptを手動で渡し、sprite sheet PNGを生成する。
4. 生成画像を `assets/generated/residents/<characterId>/incoming/` に保存する。
5. Codexまたはローカルscriptで、画像サイズ、透明背景、行列、余白、ラベル混入を検査する。
6. 必要なら `96x96` frame、6列、11行として切り出し可能か確認する。
7. デフォルト同梱素材または公式採用 asset として採用できる画像だけを `public/art/characters/defaults/<characterId>/sprites/resident-sprite-sheet.png` へ置く。
8. `src/persistence/defaultCharacterAssetManifest.ts` の該当entryを placeholder から採用済みassetへ更新する。
9. read modelで `ready: true` として参照できることをdomain testで確認する。

未検査のincoming画像、作業中tmp画像、rejected画像、user-uploads画像はGit管理へ入れない。
Git管理するのはprompt、デフォルト同梱素材または公式採用 asset のmanifest、採用済みsprite sheetだけにする。

フォルダ作成は `tools/asset-pipeline/setup-resident-asset-folders.bat` または `.ps1` を使う。
空フォルダ維持のための `.gitkeep` は置かない。

## 作業フォルダとGit管理の境界

ローカル作業では、次のようなフォルダを使う。

```txt
assets/generated/residents/<characterId>/incoming/
assets/generated/residents/<characterId>/tmp/
assets/generated/residents/<characterId>/rejected/
assets/residents/<characterId>/sprites/
manifests/residents.json
```

これらは作業用であり、Git 管理対象にしない。
`manifests/residents.json` は、ローカルで候補素材を並べるための placeholder であり、正本manifestではない。

採用済みassetは、次の場所で扱う。

- 画像本体: `public/art/characters/defaults/<characterId>/sprites/resident-sprite-sheet.png`
- 既定素材の参照: `src/persistence/**` の default manifest / read model

Line 1 の運用docsでは、manifestの中身や read model の仕様を決めない。
採用済みassetの登録内容は、別PBIで `src/persistence/**` 側に明示する。

## 採用前のPNG検査

ChatGPT UIなどで生成した画像は、まず `assets/generated/residents/<characterId>/incoming/` に保存する。

採用前に、次のコマンドでPNGと画像サイズを確認する。

Windows:

```bat
tools\asset-pipeline\validate-resident-sprite-sheet.bat ryo
```

macOS / Linux / Node直接実行:

```bash
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs ryo
```

全住民のincomingフォルダをまとめて見る場合:

```bash
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs --all
```

この検査で見ること:

- PNGファイルであること。
- 画像全体が `576x1056` px であること。
- `96x96` frame、6列、11行として扱えるサイズであること。

このscriptは採用済みassetへコピーしない。
manifestも書き換えない。
incoming画像を採用済み扱いにしない。

検査が通っても、透明背景、文字混入、別人化、立ち絵縮小だけになっていないかは人間が目視確認する。

## 検査観点

- PNGである。
- 透明背景にalpha channelがある。
- frame sizeが `96x96` として扱える。
- columnsが `6`、rowsが `11` として扱える。
- 行ごとのmotion keyがこの文書の仕様と一致する。
- 文字、番号、UI枠、背景が画像内に焼き込まれていない。
- 立ち絵を縮小して貼っただけではない。
- 4名の公式loreを画像から勝手に断定していない。

## 保存先

生成したPNGは次の場所に置く。

```txt
public/art/characters/defaults/eve/sprites/resident-sprite-sheet.png
public/art/characters/defaults/garan/sprites/resident-sprite-sheet.png
public/art/characters/defaults/ryo/sprites/resident-sprite-sheet.png
public/art/characters/defaults/suzu/sprites/resident-sprite-sheet.png
```

## prompt

各キャラの生成promptは次に保存する。

```txt
.prompts/resident-sprites/eve.md
.prompts/resident-sprites/garan.md
.prompts/resident-sprites/ryo.md
.prompts/resident-sprites/suzu.md
```

## Git管理ルール

生成直後の素材は、まだ採用済みではありません。
`incoming` / `tmp` / `rejected` / `user-uploads` は Git 管理外にします。

デフォルト4名や公式採用 asset として同梱する素材は Git 管理してよいです。
ただし、プレイヤーがアップロードした新キャラ画像や、そのユーザー固有の sprite / portrait / expression は Git 管理しません。

Git 管理するのは、次に限定します。

- `.prompts/resident-sprites/**` の prompt
- デフォルト同梱素材または公式採用 asset を参照する `src/persistence/**` の default manifest / read model
- デフォルト同梱素材または公式採用 asset の `resident-sprite-sheet.png`

`manifests/residents.json` はローカル作業用 placeholder なので、この一覧には含めない。

詳しい扱いは `docs/operations/asset-pipeline-git-rules.md` を参照します。

## sprite sheet仕様

- frame size: `96x96`
- columns: `6`
- rows: `11`
- background: transparent PNG
- style: ドット絵風の小さい箱庭キャラ
- motion key:
  - `idle`
  - `walk-up`
  - `walk-down`
  - `walk-left`
  - `walk-right`
  - `walk-forward`
  - `walk-back`
  - `emote-happy`
  - `emote-angry`
  - `emote-sad`
  - `emote-surprised`

## 未生成時の扱い

- manifestには `*-sprite-sheet` の参照枠を置く。
- 実PNGが未生成の間は `isPlaceholder: true` とする。
- `missingReason` は `not-generated-yet` とする。
- UIは `portrait` または `icon` fallbackを使う。
- 未生成sprite sheetを、本物のsprite sheetとして読み込まない。

## manifest登録時の方針

生成画像を採用した場合だけ、manifest entryに `relativePath` を入れる。
未生成または検査未完了の間は `plannedRelativePath` のみを持たせ、`isPlaceholder: true` を維持する。

採用前:

```ts
{
  id: "ryo-sprite-sheet",
  kind: "sprite-sheet",
  plannedRelativePath: "art/characters/defaults/ryo/sprites/resident-sprite-sheet.png",
  isPlaceholder: true,
  missingReason: "not-generated-yet"
}
```

採用後:

```ts
{
  id: "ryo-sprite-sheet",
  kind: "sprite-sheet",
  relativePath: "art/characters/defaults/ryo/sprites/resident-sprite-sheet.png",
  isPlaceholder: false
}
```

採用後も、Passport schemaやキャラクターloreは変更しない。
