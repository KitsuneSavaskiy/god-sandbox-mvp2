# PBI-ART-APOSTLE-ALPHA-SPRITE-SHEET-001

## 目的

過去の GodSandbox で使っていた使徒sprite sheetを、GodSandbox mvp2で扱いやすい透明背景PNGとして整理する。

このPBIではUI実装には入らず、使徒の立ち絵alpha PNG、sprite sheet alpha PNG、簡単なmanifestだけを追加する。

## 追加アセット

| 用途 | ファイル | 内容 |
| --- | --- | --- |
| 立ち絵 | `/art/apostle/apostle-standing-alpha.png` | alpha handoff sheetの最初の待機フレームを切り出した使徒立ち絵 |
| sprite sheet | `/art/apostle/apostle-sprite-sheet-alpha.png` | 96pxセル、6列、8行の透明背景sprite sheet |
| manifest | `/art/apostle/apostle-asset-manifest.json` | frame size、行列、motion mapを記録するmanifest |

## source note

過去リポジトリ内の `tutorial-guide-apostle-sheet.png` は確認済みだが、alpha channelを持たないRGB画像だった。

今回の正本出力には、ローカルhandoff済みの透明背景sprite sheetを使った。個人PCの絶対パスはGit管理に含めない。

## sprite sheet仕様

| 項目 | 値 |
| --- | --- |
| frame width | 96px |
| frame height | 96px |
| columns | 6 |
| rows | 8 |
| total size | 576px x 768px |
| format | PNG RGBA |
| background | transparent alpha |

## motion map

| motion | row | frames | 備考 |
| --- | ---: | ---: | --- |
| `idle` | 0 | 6 | 待機 |
| `flyRight` | 1 | 6 | 右方向移動 |
| `flyLeft` | 2 | 6 | 左方向移動 |
| `run` | 3 | 6 | 小走り |
| `fall` | 4 | 6 | 転ぶ、起き上がる |
| `guidePoint` | 5 | 6 | 案内、指差し |
| `emotions` | 6 | 6 | joy、angry、sad、surprised、proud、embarrassed |
| `bless` | 7 | 6 | 祝福演出 |

Line 3などの実装側が `runRight` / `runLeft` を必要とする場合、現時点では `flyRight` / `flyLeft` を移動用motionとして扱う。

## alpha検査結果

| ファイル | サイズ | pixel format | alpha最小値 | 透明pixel | 半透明pixel | green-ish opaque pixel |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `apostle-standing-alpha.png` | 181 x 181 | `Format32bppArgb` | 0 | 19,852 | 0 | 84 |
| `apostle-sprite-sheet-alpha.png` | 576 x 768 | `Format32bppArgb` | 0 | 272,654 | 25,089 | 67 |

green残りsampleは、青い狐火や衣装の差し色を誤検出しない範囲で確認した。背景として大量に残っている緑は見当たらない。

## 今回やらないこと

- UI実装
- Domain改修
- Passport schema変更
- package変更
- CI変更
- 新規画像生成
- アプリ内からの画像生成API連携
