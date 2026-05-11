# Event Image Request Flow

**PBI:** 9b-event-visual-reference-request  
**Lane:** Claude2 / Event Visual Reference Request  
**Last updated:** 2026-05-11

---

## 目的

GodSandbox のイベントに参加するキャラ（住民）の立ち絵・portrait を参照情報として含めた、イベントイラスト生成依頼を作成する。

今回のスコープは「依頼を作る」ところまで。実際の画像生成 API には接続しない。

---

## 今回やること / やらないこと

| やること | やらないこと |
|---|---|
| request JSON を作る | 画像生成 API を呼ぶ |
| prompt.md を作る | 生成画像を自動採用する |
| reference manifest を作る | `public/art/` へ直接昇格する |
| referencePath の存在チェック | `src/**` の変更 |
| dry-run プレビュー | Event Outcome システムの変更 |

---

## `.godsandbox/jobs/` を使わない理由

既存の `job-watcher.mjs` は `.godsandbox/jobs/` の `*-request.json` を**住民スプライト生成 request** として処理する。  
Event 画像 request をそこに置くと、住民スプライト用 intake に誤投入される。

Event 画像 request の出力先は `.asset-pipeline/event-images/<requestId>/` を使う。  
この配下は `.gitignore` で無視されており、PR に生成物が混入しない。

---

## CLI の使い方

### インストール不要

Node.js があれば動く。追加パッケージ不要。

```bash
node tools/sidekick/event-image-request.mjs --help
# または
npm run sidekick:event-image -- --help
```

### 必須引数

| 引数 | 説明 |
|---|---|
| `--event-id <id>` | イベントインスタンス ID |
| `--template-id <id>` | イベントテンプレート ID |
| `--summary <text>` | シーンの短い説明 |
| `--participant <spec>` | `characterId:displayName:role:referencePath` 形式、1〜4件 |

`--participant` の `role` は `primary` または `supporting`。

### 任意引数

| 引数 | 説明 |
|---|---|
| `--tag <tag>` | シチュエーションタグ（複数可） |
| `--location-label <text>` | 場所の説明 |
| `--mood-tag <tag>` | ムードタグ（複数可） |
| `--composition <value>` | `landscape` / `portrait` / `square`（デフォルト: `landscape`） |
| `--background-hint <text>` | 背景のヒント |
| `--style-hint <text>` | スタイルのヒント |
| `--dry-run` | ファイルを書かずにプレビューだけ表示 |

---

## dry-run 例

```bash
node tools/sidekick/event-image-request.mjs \
  --event-id evt_test_shared_nap \
  --template-id shared-nap-place \
  --summary "RyoとSuzuが木陰で同じ時間を過ごしている" \
  --tag daily-life \
  --tag shared-nap \
  --participant chr_ryo:Ryo:primary:public/art/characters/defaults/ryo/portrait.png \
  --participant chr_suzu:Suzu:supporting:public/art/characters/defaults/suzu/portrait.png \
  --composition landscape \
  --dry-run
```

`--dry-run` では `.asset-pipeline/` に何も書かない。  
request JSON・prompt.md・reference-manifest.json のプレビューを標準出力に表示する。  
referencePath の存在チェックは dry-run でも実行する。

---

## 非 dry-run 例

```bash
node tools/sidekick/event-image-request.mjs \
  --event-id evt_test_shared_nap \
  --template-id shared-nap-place \
  --summary "RyoとSuzuが木陰で同じ時間を過ごしている" \
  --tag daily-life \
  --tag shared-nap \
  --participant chr_ryo:Ryo:primary:public/art/characters/defaults/ryo/portrait.png \
  --participant chr_suzu:Suzu:supporting:public/art/characters/defaults/suzu/portrait.png \
  --composition landscape
```

出力:

```
.asset-pipeline/event-images/evtimg-20260511120000-evt-test-shared-nap/
  request.json
  prompt.md
  reference-manifest.json
  incoming/
```

---

## 出力ファイルの説明

| ファイル | 内容 |
|---|---|
| `request.json` | イベント・参加キャラ・ビジュアル方向をまとめた構造化 request |
| `prompt.md` | 画像生成担当へ渡す自然言語 prompt |
| `reference-manifest.json` | 各参加キャラの referencePath・referenceKind・存在確認結果 |
| `incoming/` | 生成画像の受け取り用ディレクトリ（空） |

---

## `.asset-pipeline/` はローカル生成物

`.asset-pipeline/event-images/` は `.gitignore` で無視されている。  
生成した request や prompt を PR に含めない。  
PR には `tools/sidekick/event-image-request.mjs` と `docs/` の変更だけを含める。

---

## referencePath のルール

- repo 相対パスのみ（絶対パス禁止）
- `..` による repo 外参照禁止
- CLI 実行時に存在チェックを行う（存在しない場合は失敗）
- 例: `public/art/characters/defaults/ryo/portrait.png`

---

## 生成画像の採用フロー

CLI は画像を生成しない。生成画像の `public/art/` への昇格は別フローになる。

```
1. このCLIでrequest作成
2. prompt.md + reference-manifest.json を画像生成ツールへ渡す（手動）
3. 生成画像を incoming/ に配置（手動）
4. PO が生成画像を確認
5. PO 承認後の別PBIで public/art/ へ昇格
```

---

## 他 PBI との分離

| PBI | 担当 | このCLIとの関係 |
|---|---|---|
| PBI 9a-spec | Claude1 | Event Outcome System 仕様 — 別 docs/product ファイル |
| PBI 9a-core | Codex | domain 実装 — src/domain 変更 |
| **PBI 9b** | **Claude2** | **このCLI（Event 画像 request 作成）** |

`src/**`・`docs/product/**`・`docs/architecture/**`・`.godsandbox/**` はこの PBI では触らない。
