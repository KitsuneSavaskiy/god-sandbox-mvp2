# Sprint9-6: Character Create UI — Local Asset Generation Server

## 概要

GodSandbox のゲーム画面から、非技術者（PO・オペレーター）が  
キャラ名・性格・口調・年齢・立ち絵を入力するだけで、Local AppServer へ  
Sprite Sheet・表情差分の自動生成ジョブを依頼できるようにします。

GodSandbox Web app は画像生成 API を直接呼びません。  
通信先は `http://127.0.0.1:8787` の Local AppServer（PR #318）のみです。

---

## アーキテクチャ

```
[ブラウザ UI /assetgen]
        │ (CharacterAssetGenForm)
        ▼
[src/application/localAssetGenerationClient.ts]
        │ GET /healthz (起動確認)
        │ POST /api/local/asset-generation/characters
        ▼
[LocalAppServer 127.0.0.1:8787]  ← 同一PCのloopback専用
        │
        ├─ .godsandbox/jobs/<jobId>-request.json  (watcher handoff)
        └─ .godsandbox/jobs/local-app-server/<jobId>.json  (status)
```

---

## 使い方

### 1. AppServer を起動する

```bash
npm run assetgen:server
```

デフォルトで `http://127.0.0.1:8787` で起動します。

### 2. 開発サーバーを起動してブラウザで開く

```bash
npm run dev
# → http://127.0.0.1:5173/assetgen
```

または `/assetgen` を直接アドレスバーに入力。

### 3. フォームに入力する

| フィールド | 説明 |
|-----------|------|
| 表示名 | キャラクターの名前 |
| 性格 | 例: 明るい・世話好き |
| 口調 | 例: タメ口 |
| 年齢 | 0以上の整数 |
| 立ち絵パス (repo相対) | 例: `assets/generated/residents/ryo/reference/portrait.png` |
| アセットバンドルID | 省略可。英数字・ハイフン・アンダースコア |
| プレビューモード | `po-combined` (推奨) or `canonical-two-sheet` |
| Gen2 Bridge モード | 下記参照 |

### 4. AppServer 起動確認ボタンを押す

`✓ AppServer 起動中` が表示されたら送信ボタンが有効になります。

### 5. 生成依頼を送信

成功すると `jobId` が表示されます。

### 6. 生成ジョブを確認する

```bash
# Watcher handoff ファイル
ls .godsandbox/jobs/*-request.json

# Status ファイル
ls .godsandbox/jobs/local-app-server/
cat .godsandbox/jobs/local-app-server/<jobId>.json
```

---

## Gen2 Bridge モード

| モード | 用途 | 必要な環境変数 |
|--------|------|---------------|
| `fake` | テスト専用。画像は生成されない | なし |
| `manual-drop` | 手動ファイルドロップ待機 | `GODSANDBOX_GEN2_MANUAL_DROP_FOLDER` |
| `hot-folder` | ローカル hot-folder 監視サービス | `GODSANDBOX_GEN2_HOT_FOLDER` |
| `local-cli` | ローカル CLI 実行 | `GODSANDBOX_GEN2_LOCAL_CLI_COMMAND` |

`fake` 以外のモードは AppServer 起動前に環境変数を設定してください。  
未設定の場合は POST 時に HTTP 400 が返ります。

---

## セキュリティ境界

| 境界 | ルール |
|------|--------|
| Web app | 画像生成 API を直接呼ばない。通信先は 127.0.0.1 のみ。 |
| localAssetGenerationClient.ts | 外部 URL・API key 参照なし |
| 生成物 | candidate 状態。`public/art/` への書き込みは別 PBI の PO 承認フロー |

---

## エラーケース

| エラー | 表示 |
|--------|------|
| AppServer 未起動 | 「AppServerに接続できません」|
| タイムアウト (15秒) | 「リクエストがタイムアウトしました」|
| 422 Validation error | 「入力検証エラー」+ 詳細メッセージ |
| 400 env var 不足 | 「リクエストエラー」+ Bridge エラー詳細 |

---

## 変更ファイル

| ファイル | 役割 |
|---------|------|
| `src/application/localAssetGenerationClient.ts` | AppServer HTTP クライアント |
| `src/features/asset-generation/CharacterAssetGenForm.tsx` | 生成依頼フォーム UI |
| `src/features/asset-generation/CharacterAssetGenForm.css` | フォームスタイル |
| `src/routes/routes.ts` | `/assetgen` ルート追加 |
| `src/app/AppShell.tsx` | `assetgen` ルートのレンダリング・ナビボタン追加 |
