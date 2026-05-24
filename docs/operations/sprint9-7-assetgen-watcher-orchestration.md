# Sprint9-7: Assetgen Watcher Orchestration with Lane-State

## 概要

`tools/sidekick/job-watcher.mjs` にルーティングロジックを追加し、LocalAppServer が生成した assetgen リクエスト（`jobId` / `lanes` / `previewMode` / `gen2Bridge` フィールドを持つ）を `character-asset-bundle-intake.mjs`（`assetgen:intake`）に送り、旧来の legacy リクエストを `sidekick-intake.mjs`（`sidekick:intake`）に送るようにしました。

---

## アーキテクチャ

```
[LocalAppServer / 手動 CLI]
        │
        ▼
.godsandbox/jobs/<jobId>-request.json   ← 新ファイル検知
        │
        ▼
[job-watcher.mjs]  ← classifyWatcherRequest() でルーティング判定
        │
        ├─ assetgen request (jobId/lanes/previewMode/gen2Bridge のいずれかあり)
        │       │
        │       ▼
        │  character-asset-bundle-intake.mjs (assetgen:intake)
        │       │ sidekick-intake → prompt-pack → lane-state.json
        │
        └─ legacy request (判定フィールドなし)
                │
                ▼
           sidekick-intake.mjs (sidekick:intake)
                │ 既存フロー（変更なし）
```

---

## リクエスト分類ロジック

`classifyWatcherRequest(parsed)` は純粋関数です（テスト可能な形でエクスポート）。

| 条件 | 結果 |
|------|------|
| `parsed` が JSON オブジェクトでない / `slug` が空 | `"malformed"` |
| `jobId`、`lanes`、`previewMode`、`gen2Bridge` のいずれかが存在する | `"assetgen"` |
| 上記フィールドがすべて存在しない | `"legacy"` |

```js
// assetgen リクエスト例（asset-generation-server.mjs が生成）
{
  "jobId": "mychar-20260524-abcd1234",
  "slug": "mychar",
  "displayName": "MyChar",
  "personality": "明るい",
  "tone": "タメ口",
  "age": 18,
  "portraitPath": "assets/generated/residents/mychar/reference/portrait.png",
  "lanes": ["resident-sprite-sheet", "portrait-expressions", "derived-icon"],
  "previewMode": "po-combined",
  "gen2Bridge": "fake"
}

// legacy リクエスト例（旧 sidekick フロー）
{
  "slug": "ryo",
  "displayName": "Ryo",
  "personality": "明るい",
  "tone": "タメ口",
  "age": 17,
  "portraitPath": "assets/generated/residents/ryo/reference/portrait.png"
}
```

---

## ファイルライフサイクル

```
.godsandbox/jobs/<jobId>-request.json
        │
        │  (処理開始: 重複実行防止のため即座にリネーム)
        ▼
.godsandbox/jobs/processing/<jobId>-request.json
        │
        ├─ 成功
        │       ▼
        │  .godsandbox/jobs/done/<jobId>-request.json
        │
        └─ 失敗
                ▼
           .godsandbox/jobs/failed/<jobId>-request.json
           .godsandbox/jobs/failed/<jobId>-error.json   ← 失敗理由
```

`failed/<jobId>-error.json` の内容例:

```json
{
  "baseId": "mychar-20260524-abcd1234",
  "reason": "process exited with code 1",
  "recordedAt": "2026-05-24T10:00:00.000Z"
}
```

> 注意: `reason` フィールドには絶対パス・シークレット・APIキーを含めません。

---

## lane-state.json 保証

`assetgen:intake` 完了後、`assets/generated/residents/<slug>/lane-state.json` の存在を確認します。intake が書き込んでいない場合は watcher がフォールバックを作成します。

```json
{
  "slug": "mychar",
  "lanes": {
    "resident-sprite-sheet": { "status": "planned", "updatedAt": "..." },
    "portrait-expressions":  { "status": "planned", "updatedAt": "..." },
    "derived-icon": {
      "status": "planned",
      "dependsOn": { "resident-sprite-sheet": "candidate-ready" },
      "updatedAt": "..."
    }
  },
  "previewMode": "po-combined",
  "updatedAt": "..."
}
```

`derived-icon` は `resident-sprite-sheet` が `candidate-ready` になるまで開始できない依存関係を `dependsOn` で明示します。

---

## Legacy 後方互換性

- 旧来の watcher リクエスト（`jobId` / `lanes` / `previewMode` / `gen2Bridge` フィールドなし）は **変更なし** で `sidekick:intake` へルーティングされます。
- 既存の `npm run sidekick:watch` コマンドは引き続き動作します。
- 旧フロー向けのファイルにはライフサイクル変更が一つあります: `processing/` サブディレクトリへの中間移動（重複実行防止）。これは既存動作に影響しません。

---

## --dry-run の使い方

```bash
# 現在の .godsandbox/jobs/ をスキャンし、各ファイルの処理予定をログ出力して終了
node tools/sidekick/job-watcher.mjs --dry-run

# または npm script 経由
npm run sidekick:watch -- --dry-run
```

`--dry-run` では:
- ファイルを移動しない
- プロセスを起動しない
- 各ファイルが `assetgen:intake` / `sidekick:intake` / `FAIL` のどれにルーティングされるかをログ出力

```
[watcher] --dry-run mode: scanning .godsandbox/jobs/
[dry-run] WOULD RUN assetgen:intake — jobId=mychar-20260524-abcd1234 slug=mychar: mychar-20260524-abcd1234-request.json
[dry-run] WOULD RUN sidekick:intake — slug=ryo: ryo-sprite-20260524123456-request.json
[dry-run] WOULD FAIL (malformed, missing required field: slug): bad-request.json
[watcher] --dry-run complete. No files were moved or processed.
```

`--once` フラグを使うと、現在の pending ジョブを一度処理して終了します（CI 環境や手動確認に便利）。

---

## 関連ファイル

- `tools/sidekick/job-watcher.mjs` — watcher 本体（ルーティング・ライフサイクル）
- `tools/sidekick/character-asset-bundle-intake.mjs` — assetgen:intake
- `tools/sidekick/sidekick-intake.mjs` — legacy sidekick:intake
- `tools/app-server/asset-generation-server.mjs` — watcher request ファイルを生成する AppServer
- `tools/app-server/test-dry-run.mjs` — テスト 10〜13（watcher 分類ロジック）
- `docs/operations/sprint9-5-local-gen2-asset-generation.md` — Sprint9-5 アーキテクチャ全体像
