# One-Portrait "うちの子起動" Guided Flow

Sprint 10-F — UI-first entry point for the character asset candidate pipeline.

## Overview

The guided flow (`/assetgen`) lets a user drop in one portrait image and start the
candidate-generation process without understanding pipeline internals.

The three-step UI maps user intent to lanes:

| Step | User sees | What it does internally |
|---|---|---|
| ① 見た目画像と名前 | Portrait path + character profile | Fills job params |
| ② 作りたい候補を選ぶ | Preset cards | Maps to `lanes[]` |
| ③ ローカル補助へ渡す | "うちの子を迎える" button | POST to Local AppServer |

## Presets

| Label (UI) | Internal lanes |
|---|---|
| まず試す | `resident-sprite-sheet`, `portrait-expressions`, `derived-icon` |
| イベント用まで作る | `resident-sprite-sheet`, `portrait-expressions`, `event-standing-expressions`, `derived-icon` |
| 表情だけ作る | `portrait-expressions`, `event-standing-expressions` |

`event-standing-expressions` is accessible via preset but is not the default.
The default is "まず試す" (three-lane set).

## AppServer health

The UI checks `/healthz` on mount.

If the server is down, the UI shows:

```
ローカル補助サーバーが起動していません
npm run assetgen:server
```

No raw network errors are shown as the primary message.

## Job progress

After POST returns a `jobId`, the UI polls `GET /api/local/asset-generation/jobs/:jobId`
every 3 seconds and maps the internal status to Japanese steps:

| Internal status | User sees |
|---|---|
| `pending` | 受付完了 |
| `prompt-pack-ready` | 制作指示を準備しました |
| `gen2-dispatched` | ローカル補助に受け渡し済み |
| `watcher-intake-done` | 画像候補待ち |
| `error` | エラーが発生しました |

## Fake bridge warning

When `gen2Bridge === "fake"` (the default), two notices appear:

- Pre-submit: "動作確認モードです — 見た目候補画像は生成されません"
- Post-submit: "これは動作確認用です。見た目候補としては使えません。"

Internal terms (`lane`, `manifest`, `contract`, `bridge`, `candidateEligible`) are
hidden from primary copy and only visible in "詳細設定（上級者向け）".

## Review pack affordance

Once the `assetBundleId` (slug) is available from the polled job status, the UI shows:

```
npm run assetgen:review-pack -- --slug <slug>
または assets/generated/residents/<slug>/review-pack/index.html を開いてください
```

## What is and is not automated

**This UI automates:**
- Health check and server-down guidance
- Preset → lane mapping
- Job submission and progress polling
- Fake bridge warning

**Still requires local tools or human action:**
- Actual image generation (`local-cli` / `manual-drop` / `hot-folder`)
- Semantic consistency check (same character across expressions)
- PO review and promotion

Nothing submitted through this UI is automatically adopted into the sandbox.

## File locations

| Purpose | Location |
|---|---|
| Preset + status logic | `src/features/asset-generation/assetgenPresets.ts` |
| Preset logic tests | `src/features/asset-generation/assetgenPresets.test.ts` |
| Form component | `src/features/asset-generation/CharacterAssetGenForm.tsx` |
| HTTP client | `src/application/localAssetGenerationClient.ts` |
| Route | `/assetgen` in `src/routes/routes.ts` |

## Running preset tests

```bash
npm run assetgen:test-presets
```

12 deterministic tests covering preset lane mapping, status label coverage,
Japanese copy assertions, and event-standing isolation.
