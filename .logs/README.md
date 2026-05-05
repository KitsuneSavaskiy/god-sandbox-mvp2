# Local QA Log Templates

このフォルダは、PO確認や手元QAの短い記録に使うためのテンプレート置き場です。

注意:

- 個人PCの絶対パスを書かない。
- secret、API key、tokenを書かない。
- `assets/generated/**` や `manifests/residents.json` の中身を貼らない。
- 必要な場合だけ、PBI scopeとして明示してPRに含める。

## Eve sprite PoC 確認ログテンプレート

```md
# Eve sprite PoC 確認ログ

## 基本情報

- 対象キャラ: Eve
- 生成方法: Codex pet
- incomingファイル名:
- 確認日:
- 確認者:

## 1. incoming取り込み

- 実行コマンド:
  - `tools\asset-pipeline\import-resident-sprite-source.bat eve`
- 取り込み先:
  - `assets/generated/residents/eve/incoming/`
- Git管理外であること:
  - OK / 要確認

## 2. alpha確認

- alpha channel:
  - あり / なし / 要確認
- 透明背景:
  - OK / 要確認
- 四角い背景:
  - 出ていない / 出ている / 要確認
- 白い縁:
  - 目立たない / 目立つ / 要確認
- alpha化候補を作ったか:
  - なし / あり
- メモ:

## 3. validator結果

- 実行コマンド:
  - `tools\asset-pipeline\validate-resident-sprite-sheet.bat eve`
- PNG:
  - OK / NG
- 画像サイズ `576x1056`:
  - OK / NG
- `96x96` frame、6列、11行:
  - OK / NG
- メモ:

## 4. processor結果

- 実行コマンド:
  - `tools\asset-pipeline\process-resident-sprite-sheet.bat eve`
- 出力先:
  - `assets/residents/eve/sprites/`
- manifest draft:
  - 作成できた / 作成できない / 対象外
- 正本assetへ自動昇格していないこと:
  - OK / 要確認
- メモ:

## 5. 箱庭表示確認

- Eveだけready spriteとして表示:
  - OK / 要確認
- 背景が透明:
  - OK / 要確認
- 四角い背景が出ていない:
  - OK / 要確認
- idle / walk系motion:
  - OK / 要確認
- Garan / Ryo / Suzu fallback:
  - OK / 要確認
- 箱庭上にキャラ名、場所、状態ラベルが戻っていない:
  - OK / 要確認
- 390px / 360px:
  - OK / 要確認

## PO判断

- 採用可 / 修正して再確認 / 不採用
- 理由:
- follow-up:
```
