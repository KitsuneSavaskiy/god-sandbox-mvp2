# Sprint9-5: Local GEN2 Character Asset Generation Pipeline

## 概要

ローカル AppServer と GEN2 Bridge を組み合わせて、APIキーを使わずに新キャラクターの Resident Sprite Sheet・立ち絵表情差分を自動生成するパイプラインです。  
GodSandbox Web アプリ自体は画像生成 API を直接呼びません。

---

## アーキテクチャ

```
[GodSandbox Web App]
        │ (game UI: キャラ作成フォーム)
        ▼
[LocalAppServer 127.0.0.1:8787]  ← APIキー不要、ループバック専用
        │
        ├─ POST /api/local/asset-generation/characters
        │        │ 入力バリデーション
        │        ▼
        │  [characterAssetPromptPack]
        │        │ prompt-pack/ を生成
        │        ▼
        │  [Gen2Bridge (mode 選択)]
        │        ├─ FakeGen2Bridge      (テスト・ドライラン)
        │        ├─ Gen2HotFolderBridge (GEN2 hot-folder 連携)
        │        ├─ Gen2ManualDropBridge(手動ドロップ待機)
        │        └─ Gen2LocalCliBridge  (ローカル CLI 実行)
        │
        ├─ GET  /api/local/asset-generation/jobs/:jobId
        └─ POST /api/local/asset-generation/jobs/:jobId/cancel

[Codex Sidekick / Job Watcher]
        │ .godsandbox/jobs/<jobId>-request.json を検知
        ▼
[characterAssetBundleIntake]
        │ sidekick:intake + prompt-pack + lane-state.json
        ▼
[既存 hatch-pet / sprite:check パイプライン]
        │ (信頼できるビジュアル生成パス: 変更なし)
        ▼
[PO Review Gate] → 承認後のみ public/art/** へ昇格
```

---

## APIキー境界

| 境界 | ルール |
|------|--------|
| LocalAppServer | OPENAI_API_KEY を読まない。外部 URL を呼ばない。 |
| Gen2Bridge 全実装 | 外部 URL を呼ばない。ガードコメント記載済み。 |
| assetgen:guard | ツール群に API キー参照がないことを CI で検証。 |

`assetgen:guard` は以下のパターンを検出します:
- `OPENAI_API_KEY`
- `api.openai.com`
- `images.generate`
- `dall-e`
- Bearer トークンパターン (`"Authorization": "Bearer sk-`)

ドキュメント上の "forbidden" / "DO NOT" を含む行は除外されます。

---

## GEN2 Bridge モード

| モード | 用途 | handoff | 必要な環境変数 |
|--------|------|---------|--------------|
| `fake` | テスト・ドライラン | validation-only メタデータ JSON を書く。`candidateEligible: false` 固定。 | なし |
| `hot-folder` | GEN2 hot-folder 連携 | `GODSANDBOX_GEN2_HOT_FOLDER` に指定したフォルダにジョブファイルをドロップ。出力フォルダをポーリング。 | `GODSANDBOX_GEN2_HOT_FOLDER`（必須）、`GODSANDBOX_GEN2_HOT_FOLDER_OUTPUT`（省略可） |
| `manual-drop` | 手動ドロップ待機 | `GODSANDBOX_GEN2_MANUAL_DROP_FOLDER` に人間がファイルを置くまで待機。 | `GODSANDBOX_GEN2_MANUAL_DROP_FOLDER`（必須） |
| `local-cli` | ローカル CLI 実行 | `GODSANDBOX_GEN2_LOCAL_CLI_COMMAND` の CLI を child_process.spawn で実行。 | `GODSANDBOX_GEN2_LOCAL_CLI_COMMAND`（必須、JSON 配列文字列 `["gen2", "--run"]` またはスペース区切り） |

> **Fake bridge の出力は PO ビジュアルレビュー対象外です。**  
> `validationOnly: true, candidateEligible: false` を常に書き、実候補と区別します。

> **非 fake モードの起動前に環境変数を設定してください。**  
> 環境変数が未設定の場合、POST /api/local/asset-generation/characters は 400 を返します。

---

## レーンライフサイクル

```
planned → queued → running → candidate-ready → alpha-checked
       → validated → visual-audit-ready → po-review
       → ready-promotion-candidate → ready-promoted
```

`lane-state.json` はローカルのみ（gitignored）。

### derived-icon の制約

- **AI 生成禁止**。Sheet 2 (extended) の **row 1 (walk-down) frame 0** から切り出し（デフォルト）。
- `derive-icon-from-sprite.mjs --kind extended` が PNG デコード→切り出し→再エンコードを pure Node.js で実行。
- `--kind extended` がデフォルト。Sheet 1 (motion) を使う場合は `--allow-idle-fallback` が必要（row 0 は idle）。
- `icon-source-report.json` で切り出し元を記録。`candidateOnly: true` 必須。
- `resident-sprite-sheet` が `candidate-ready` 以上に達するまで実行禁止。

---

## フォルダ境界

| フォルダ | git 管理 | 用途 |
|----------|----------|------|
| `assets/generated/residents/<slug>/` | 非管理 (.gitignored) | 生成物・候補 |
| `.godsandbox/jobs/` | 非管理 (.gitignored) | ジョブファイル |
| `docs/operations/examples/codex-jobs/` | 管理 | サンプル JSON のみ |
| `public/art/` | 管理 | PO 承認済み資産のみ |

生成されたバイナリは一切コミットしません。  
`public/art/**` への書き込みは本 PBI の scope 外です。

---

## ドライラン手順

```bash
# 1. セキュリティガード
npm run assetgen:guard

# 2. サーバー起動確認 (すぐ終了)
npm run assetgen:server -- --dry-run

# 3. Fake bridge でキャラ生成リクエスト (別ターミナルでサーバー起動後)
npm run assetgen:server &
curl -s -X POST http://127.0.0.1:8787/api/local/asset-generation/characters \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "テスト",
    "personality": "明るい",
    "tone": "タメ口",
    "age": 18,
    "portraitPath": "assets/generated/residents/test/reference/portrait.png",
    "assetBundleId": "test",
    "gen2Bridge": "fake"
  }'

# 4. ジョブ確認
#   watcher 互換ファイル: .godsandbox/jobs/<jobId>-request.json
#   (job-watcher.mjs はこのファイルを検知します。pending/ は使いません)
#   jobId は自動生成されるため、glob で確認します
ls .godsandbox/jobs/*-request.json
ls .godsandbox/jobs/local-app-server/
ls assets/generated/residents/test/prompt-pack/

# 5. 非 fake bridge を使う場合は先に環境変数を設定する
# hot-folder 例:
export GODSANDBOX_GEN2_HOT_FOLDER=/tmp/gen2-hot
export GODSANDBOX_GEN2_HOT_FOLDER_OUTPUT=/tmp/gen2-hot/output
# local-cli 例:
export GODSANDBOX_GEN2_LOCAL_CLI_COMMAND='["node", "tools/gen2/run.mjs"]'
# manual-drop 例:
export GODSANDBOX_GEN2_MANUAL_DROP_FOLDER=/tmp/gen2-manual

# 6. 表情候補インテーク (dry-run)
npm run assetgen:expressions -- --slug test --source-dir /tmp/expressions --dry-run

# 7. アイコン切り出し (dry-run、sprite sheet 必要)
#   デフォルト: --kind extended (Sheet 2 row 1 = walk-down, front-facing)
npm run assetgen:derive-icon -- --slug test --sprite-sheet <sheet-path> --kind extended --dry-run
```

### po-combined スプライトシートの仕様

po-combined モードのキャンバスは **826×1904 px / フレーム 118×136 / 14 行 / 7 列** です。  
canonical-two-sheet (Sheet 2 / extended) のアイコンソースは **row 1 (walk-down) frame 0** です。

---

## Codex App Server / Sidekick の責務分担

| コンポーネント | 責務 |
|----------------|------|
| LocalAppServer | HTTP エントリーポイント。入力バリデーション。Gen2Bridge 呼び出し。ジョブ状態管理。 |
| Gen2Bridge | 外部 (GEN2/Codex pet) への handoff 抽象化。出力待機。証跡記録。 |
| characterAssetPromptPack | prompt-pack/ 生成。表情プロンプトの一貫性制約を保証。 |
| characterAssetBundleIntake | sidekick:intake + lane-state 初期化。Sidekick watcher のエントリーポイント。 |
| portraitExpressionIntake | GEN2 出力候補の受け入れ検証。PO review 前の candidate 段階に留める。 |
| deriveIconFromSprite | Sprite Sheet からのアイコン切り出し。AI 生成完全排除。 |
| 既存 hatch-pet | 信頼できるビジュアル生成パス。本 PBI では変更なし。 |
| PO Review Gate | 候補 → 採用の最終判断。human-in-the-loop 必須。 |

---

## バリデーション

```bash
npm run sprint9:dispatch -- --status   # Wave 状態確認
npm run typecheck                       # TypeScript チェック
npm run build                           # ビルド確認
npm run sprite:check -- --help          # 既存ツール確認
npm run sprite:fit -- --help            # 既存ツール確認
npm run assetgen:guard                  # セキュリティガード
npm run assetgen:server -- --dry-run    # サーバー起動確認
```

---

## リスクと注意事項

- GEN2 のローカルインターフェースが存在しない場合は `manual-drop` または `fake` モードを使用。
- 表情差分がコスチューム・体型・ポーズを変化させた場合は expression lane の visual review gate で棄却。
- 生成物の誤コミットを防ぐため `assetgen:guard` と `.gitignore` で二重ガード。
- `public/art/**` への昇格は本 PBI の scope 外 — 別 PBI での PO 承認フロー経由。
