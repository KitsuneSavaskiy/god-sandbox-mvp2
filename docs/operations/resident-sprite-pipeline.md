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
5. alpha確認scriptで、透明背景向けのalpha channelと透明ピクセル数を確認する。
6. alpha channelがない場合、またはalpha channelがあっても透明ピクセルが0件の場合は、明示コマンドでalpha化候補を `tmp` に作るか、背景除去し直して目視確認する。
7. validatorで画像サイズ、行列、余白、ラベル混入を検査する。
8. 必要なら processorで `192x208` frame、8列、9行として切り出し可能なローカル作業用出力を作る。
9. visual audit で contact sheet を作り、split / crop / row mixing の疑いがないか人間が確認する。
10. デフォルト同梱素材または公式採用 asset として採用できる画像だけを `public/art/characters/defaults/<characterId>/sprites/resident-sprite-sheet.png` へ置く。
11. `src/persistence/defaultCharacterAssetManifest.ts` と `src/persistence/defaultResidentSpriteManifest.ts` の該当entryを ready に更新する。
12. read modelで `ready: true` として参照できることをdomain testで確認する。

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

## alpha確認とalpha化候補

ChatGPT UIやCodex petで生成したPNGは、validatorへ進める前にalpha channelを確認する。

Windows:

```bat
tools\asset-pipeline\check-resident-sprite-alpha.bat eve
```

macOS / Linux / Node直接実行:

```bash
node tools/asset-pipeline/check-resident-sprite-alpha.mjs eve
```

この確認では画像を変更しない。
PNGが `1536x1872` pxで、alpha channelを持ち、透明ピクセルが1件以上あるかを確認する。
alpha channelがあっても透明ピクセルが0件の場合は、背景透過されていない可能性があるため、validatorへ進めない。

alpha channelがない場合は、明示コマンドでalpha化候補を作る。

Windows:

```bat
tools\asset-pipeline\normalize-resident-sprite-alpha.bat eve
```

macOS / Linux / Node直接実行:

```bash
node tools/asset-pipeline/normalize-resident-sprite-alpha.mjs eve
```

特定のPNGを指定する場合:

```bash
node tools/asset-pipeline/normalize-resident-sprite-alpha.mjs eve assets/generated/residents/eve/incoming/resident-eve-sprite-source.png
```

normalizerは左上ピクセルを背景色の基準にし、近い色を透明化する最小処理である。
緑背景、白背景、単色背景の候補作成を想定する。
複雑な背景や、キャラ本体に背景と近い色が多い画像では失敗することがある。

出力先はGit管理外の `tmp` である。

```txt
assets/generated/residents/<characterId>/tmp/resident-<id>-sprite-alpha-candidate-<timestamp>.png
```

元画像は上書きしない。
alpha化後も `1536x1872` pxを維持する。
出力後は必ず目視確認する。

normalizerは次をしない。

- 採用済みassetへコピーしない。
- `public/art/**` へコピーしない。
- `src/persistence/**` を更新しない。
- manifestをready化しない。
- OpenAI Images APIや画像生成APIを呼ばない。

alpha化候補に問題がなければ、その候補PNGをincomingへ置き、次にvalidatorへ進める。

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
- 画像全体が `1536x1872` px であること。
- `192x208` frame、8列、9行として扱えるサイズであること。

このscriptは採用済みassetへコピーしない。
manifestも書き換えない。
incoming画像を採用済み扱いにしない。

検査が通っても、透明背景、文字混入、別人化、立ち絵縮小だけになっていないかは人間が目視確認する。

## 採用候補への処理

検査が通ったPNGは、次のprocessorでローカル作業用のsprite出力、manifest draft、visual audit 出力を作れる。

Windows:

```bat
tools\asset-pipeline\process-resident-sprite-sheet.bat ryo
```

macOS / Linux / Node直接実行:

```bash
node tools/asset-pipeline/process-resident-sprite-sheet.mjs ryo
```

特定のPNGを指定する場合:

```bash
node tools/asset-pipeline/process-resident-sprite-sheet.mjs ryo assets/generated/residents/ryo/incoming/resident-ryo-sprite-source.png
```

processorの入力は `assets/generated/residents/<characterId>/incoming/` のPNGである。
processorは `1536x1872` px、`192x208` frame、8列、9行として扱えることを確認する。
processorは同時に visual audit を実行し、contact sheet と report を出力する。

出力先は、Git管理外のローカル作業フォルダである。

```txt
assets/residents/<characterId>/sprites/resident-sprite-sheet.png
assets/residents/<characterId>/sprites/resident-sprite-sheet.frames.json
assets/residents/<characterId>/sprites/resident-sprite-manifest.draft.json
assets/residents/<characterId>/sprites/resident-sprite-sheet.visual-audit.svg
assets/residents/<characterId>/sprites/resident-sprite-sheet.visual-audit.json
```

`resident-sprite-sheet.frames.json` は、192x208セルで切り出せる位置を示すslice mapである。
依存追加なしの最小processorなので、フレームごとのPNG分割までは行わない。

`resident-sprite-manifest.draft.json` はローカル作業用のmanifest draftである。
これは `manifests/residents.json` ではなく、正本manifestでもない。

`resident-sprite-sheet.visual-audit.svg` は、row label、frame 境界、source 名、hash、warning を載せた contact sheet である。
`resident-sprite-sheet.visual-audit.json` は、heuristic warning と frame ごとの監査結果である。

processorは次をしない。

- 採用済みassetへコピーしない。
- `public/art/**` へコピーしない。
- `src/persistence/**` のdefault manifestを更新しない。
- manifestをready化しない。
- OpenAI Images APIや画像生成APIを呼ばない。

処理後に表示される「これは採用候補であり、まだ正本ではありません」という注意を維持する。

## Eve sprite PoC のPO確認チェックリスト

Eve 1名分のsprite sheet PoCでは、次の順で確認する。
これはPOが見た目と採用可否を判断しやすくするための確認順であり、4名全員完成をSprint8の必須Doneにするものではない。

1. alpha確認
   - PNGにalpha channelがある。
   - 透明ピクセル数が1件以上ある。
   - 背景が透明に見える。
   - 白、緑、checkerboard、単色背景が画像に焼き込まれていない。
   - Eveの周囲に白い縁や不透明な四角い背景が出ていない。
2. alpha化候補確認
   - alpha channelがない場合だけ、Git管理外の `tmp` などへalpha化候補を出す。
   - 元画像は上書きしない。
   - alpha化候補は目視確認してから次へ進める。
3. validator確認
   - PNGとして読める。
   - 画像全体が `1536x1872` px である。
   - `192x208` frame、8列、9行として扱える。
4. processor確認
   - `assets/residents/eve/sprites/` のローカル作業先へ出力できる。
   - manifest draftは作れるが、正本manifestとして扱わない。
   - `public/art/**` や `src/persistence/**` は自動更新されない。
5. 箱庭表示確認
   - Eve が visual audit と PO 確認を通った場合だけ ready sprite として表示される。
   - Eveの背景が透明で、四角い背景が出ていない。
   - idle / walk系motionが小さい箱庭キャラとして読める。
   - Garan / Ryo / Suzu はfallbackのまま壊れていない。
   - 箱庭上にキャラ名、場所、状態ラベルが戻っていない。

PoCで見る主な成功条件は、Eve 1名で `prompt -> incoming -> alpha確認 -> validator -> processor -> 採用判断 -> 箱庭表示` の流れを確認できることである。
Sprint8では、4キャラ x 11motion の完成を必須にしない。

## Eve sprite PoC 実行手順

この手順は、**APIキー不要・従量課金なしのサブスク前提ローカルasset pipeline** で Eve 1名のsprite sheetを確認するためのrunbookです。
POは上から順番に見れば、どこまで進んだかを確認できます。

### 0. 作業フォルダを作る

repository root で次を実行します。

```bat
tools\asset-pipeline\setup-resident-asset-folders.bat eve
```

このコマンドはローカル作業フォルダを作るだけです。
`assets/generated/**`、`assets/residents/**`、`manifests/residents.json` はGit管理外です。

### 1. Codex petで生成したPNGをincomingへ取り込む

ChatGPTなどの別画面で生成したEve sprite sheet PNGを選びます。

```bat
tools\asset-pipeline\import-resident-sprite-source.bat eve
```

保存先を覚える必要はありません。
scriptが `assets/generated/residents/eve/incoming/` へコピーします。
コピー後のファイル名は、たとえば次の形になります。

```text
resident-eve-sprite-source-<timestamp>.png
```

### 2. alpha確認をする

Line 2のalpha確認scriptで、PNGにalpha channelがあるか確認します。
script名はLine 2のPRで確定します。

確認すること:

- alpha channelがある。
- 透明背景に見える。
- 白、緑、checkerboard、単色背景が焼き込まれていない。
- Eveの周囲に白い縁や四角い背景が出ていない。

alpha channelがない場合は、Line 2のalpha化scriptで `tmp` などのGit管理外フォルダへ候補PNGを出します。
元画像は上書きしません。
alpha化候補は、必ず目視確認してから次へ進めます。

### 3. validatorを実行する

```bat
tools\asset-pipeline\validate-resident-sprite-sheet.bat eve
```

確認すること:

- PNGとして読める。
- 画像全体が `1536x1872` px である。
- `192x208` frame、8列、9行として扱える。

validatorは採用済みassetへコピーしません。
manifestも書き換えません。

### 4. processorを実行する

```bat
tools\asset-pipeline\process-resident-sprite-sheet.bat eve
```

出力先:

```text
assets/residents/eve/sprites/
```

この出力はローカル作業用です。
まだ正本assetではありません。
`public/art/**` や `src/persistence/**` は自動更新されません。

processor は visual audit も出力します。
contact sheet と report を見て、frame split や crop の疑いがないか人間が確認します。

### 5. 箱庭で表示を確認する

Line 2が Eve を ready に戻すのは、visual audit と PO 確認が終わった場合だけです。
それまでは Eve も fallback 表示に戻します。

確認すること:

- Eveだけready spriteとして表示される。
- Eveの背景が透明で、四角い背景が出ていない。
- idle / walk系motionが小さい箱庭キャラとして読める。
- Garan / Ryo / Suzu はfallbackのまま壊れていない。
- 箱庭上にキャラ名、場所、状態ラベルが戻っていない。

確認結果は `.logs/README.md` のテンプレートを使って記録できます。

## 検査観点

- PNGである。
- 透明背景にalpha channelがある。
- frame sizeが `192x208` として扱える。
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

- frame size: `192x208`
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
