# 住民sprite sheet生成パイプライン

状態: Sprint8 運用メモ

## 方針

- アプリ内からCodex petや外部AI APIを直接呼ばない。
- 生成は外部補助として、ユーザーまたは開発者が別ブラウザで行う。
- GodSandbox側は prompt、保存先、命名規則、asset manifest、read modelだけを持つ。
- 立ち絵を縮小しただけの画像をsprite sheetとして登録しない。
- 住民sprite sheetは、ドット絵風の小さい箱庭キャラとして生成する。

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
`incoming` / `tmp` / `rejected` は Git 管理外にします。

Git 管理するのは、次に限定します。

- `.prompts/resident-sprites/**` の prompt
- 採用済みの manifest / read model
- 採用済みの `resident-sprite-sheet.png`

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
