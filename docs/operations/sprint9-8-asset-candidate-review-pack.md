# Sprint9-8: Asset Candidate Review Pack

## 概要

`tools/sidekick/build-asset-review-pack.mjs` は、`assets/generated/residents/<slug>/incoming/` を読み込み、
PO がブラウザで開いてキャラクターアセット候補を確認できる **スタンドアロン HTML レビューパック** を生成するローカル専用ツールです。

**新規アートを生成しません。`public/art/` への書き込みを行いません。外部 API を呼びません。**

---

## 入出力フォルダ構造

### 入力（読み取り）

```
assets/generated/residents/<slug>/
  incoming/
    sprites/
      resident-sprite-sheet-combined.png   (あるいは main / extended)
    expressions/
      neutral.png
      happy.png
      angry.png
      sad.png
      surprised.png
    icons/
      icon-candidate.png
    expression-manifest.candidate.json     (任意)
    icon-source-report.json                (任意)
  lane-state.json                          (任意)
  prompt-pack/
    character-identity.json                (任意、displayName などのメタデータ)
```

### 出力（書き込み）

```
assets/generated/residents/<slug>/review-pack/
  index.html               ブラウザで開くレビューページ（外部リソース不使用）
  review-summary.json      機械可読サマリー（candidateOnly: true 固定）
  missing-assets.json      見つからなかった期待ファイル一覧
  po-review-checklist.md   PO が手動で記入するチェックリスト
```

> `assets/generated/` は `.gitignore` で除外されています。生成ファイルはコミットしません。

---

## 生成方法

```bash
npm run assetgen:review-pack -- --slug <slug>
```

### オプション

| フラグ | 説明 | デフォルト |
|--------|------|----------|
| `--slug <slug>` | 対象キャラクターのスラッグ（必須） | — |
| `--incoming-dir <path>` | 入力ディレクトリのオーバーライド | `assets/generated/residents/<slug>/incoming/` |
| `--output-dir <path>` | 出力ディレクトリのオーバーライド | `assets/generated/residents/<slug>/review-pack/` |
| `--dry-run` | ファイルを書かずに何が書かれるかを表示 | — |
| `--help` | ヘルプを表示 | — |

### 例

```bash
# dry-run で確認
npm run assetgen:review-pack -- --slug ryo --dry-run

# 実際に生成
npm run assetgen:review-pack -- --slug ryo

# ブラウザで開く（macOS）
open assets/generated/residents/ryo/review-pack/index.html
```

---

## HTML の安全性

- **外部ネットワークリソースなし** — CDN リンク・Google Fonts・外部スクリプトを含みません
- すべての CSS はインラインで埋め込まれています
- PNG 画像は `data:image/png;base64,…` URI としてインラインに変換されます（ファイルが単体で動作）
- `<script>` ブロックは含まれません

---

## review-summary.json の構造

```json
{
  "slug": "<slug>",
  "candidateOnly": true,
  "readyPromotionAllowed": false,
  "generatedAt": "<ISO timestamp>",
  "lanes": { "<lane>": { "status": "...", "updatedAt": "..." } },
  "presentAssets": ["expressions/neutral.png", ...],
  "missingAssets": ["sprites/resident-sprite-sheet-combined.png", ...],
  "validationOnlyBridge": false
}
```

- `candidateOnly` は常に `true`
- `readyPromotionAllowed` は常に `false`
- `validationOnlyBridge` は `icon-source-report.json` または `expression-manifest.candidate.json` の `candidateEligible: false` から判定

---

## このツールが行わないこと（安全境界）

| 操作 | 実施しない理由 |
|------|--------------|
| 新規アート生成 | アセット生成は別パイプライン（hatch-pet / GEN2）の責務 |
| `public/art/**` への書き込み | PO 承認後の昇格は別 PBI のフロー経由 |
| 外部 API 呼び出し | `assetgen:guard` で禁止パターンを CI 検証済み |
| ready マニフェストの更新 | 候補状態の変更は行わない |
| ゲーム状態の変更 | このツールはファイル I/O のみ |

セキュリティガード（`assertOutputBoundary`）は `public/art/` および `src/` への出力を拒否します。

---

## PO レビューワークフロー

1. アセットインテークパイプラインが `assets/generated/residents/<slug>/incoming/` にファイルを配置する
2. `npm run assetgen:review-pack -- --slug <slug>` を実行してレビューパックを生成
3. `assets/generated/residents/<slug>/review-pack/index.html` をブラウザで開く
4. `po-review-checklist.md` を確認しながらスプライトシート・表情差分・アイコンを目視検査
5. チェックリストに記入（採用OK または 要修正）
6. **採用OK の場合のみ**、別 PBI の ready promotion フローで `public/art/` へ昇格する

> `index.html` を開くだけで確認できます。ローカルサーバーは不要です（画像は base64 インライン）。

---

## バリデーション

```bash
npm run typecheck
npm run build
npm run test:domain
npm run assetgen:test    # Sprint9-8 の新規テストを含む
npm run assetgen:guard

# clear error（クラッシュでない）が出ることを確認
npm run assetgen:review-pack -- --slug nonexistent --dry-run
```
