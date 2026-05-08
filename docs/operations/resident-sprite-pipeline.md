# 住民sprite sheet生成パイプライン

状態: canonical ready 用の旧パイプラインメモ。PO preview の正本ではない。

## 先に読む注意

この文書の 2-sheet 手順は、将来の canonical ready 化に向けた安全ゲートである。
Eve と Ryo の PO 確認では、この自動 2-sheet pipeline よりも、Codex pet で
1キャラずつ作り、1枚combined sheetをPOが見ながら直した手順の方が要件を満たした。

そのため、現在の PO preview ではこの文書をそのまま実行しない。
PO preview の正本は次を使う。

```txt
.agents/skills/godsandbox-po-preview-sprite-from-portrait/SKILL.md
docs/operations/resident-sprite-po-preview-quality.md
```

PO preview の基本方針:

- 生成対象は常に1キャラだけにする。
- Codex pet / hatch-pet を画像の出どころにする。
- 2枚生成で品質がぶれる場合は、1枚combined sheetを使う。
- 実PNGの `frameWidth`、`frameHeight`、`columns`、`rows` をruntime metadataに合わせる。
- `sprite:fit`、reasoning effort low のサブエージェント評価、リーダー再評価を通してからPO確認に出す。
- `incoming/` へ置かない。canonical ready にしない。

## 方針

- GodSandbox 本体は画像生成 API を呼ばない。
- 非技術者が入力するのは、キャラ名、1枚絵、性格、口調、年齢の5項目だけにする。
- `slug`、`characterId`、`assetBundleId`、`jobId` はゲームまたは Codex sidekick が内部生成する。
- canonical ready 用 resident sprite は 2-sheet 構成に固定する。
- `npm run sprite:check -- <slug>` は Sheet 1 と Sheet 2 の両方がそろった時だけ pass とみなす。
- `ready` 判定の正本は `src/persistence/defaultCharacterAssetManifest.ts` と `src/application/characterAssetBundles.ts` に置く。
- `src/persistence/defaultResidentSpriteManifest.ts` は旧互換の橋渡しであり、2-sheet ready を上げる場所として使わない。
- PO visual OK 前に `ready` 化しない。

## 2-sheet 規格

```txt
Sheet 1: resident-sprite-sheet.png
  row 0: idle
  row 1: walk-right
  row 2: walk-left
  row 3: waving
  row 4: jumping
  row 5: failed
  row 6: waiting
  row 7: running
  row 8: review

Sheet 2: resident-sprite-sheet-extended.png
  row 0: walk-up
  row 1: walk-down
  row 2: walk-forward
  row 3: walk-back
  row 4: emote-happy
  row 5: emote-angry
  row 6: emote-sad
  row 7: emote-surprised
  row 8: spare
```

共通サイズ:

```txt
frame: 192x208
columns: 8
rows: 9
sheet size: 1536x1872
background: transparent alpha
```

## 非技術者フロー

非技術者はゲームのキャラクリエイト画面で次だけを渡す。

```txt
キャラ名
1枚絵
性格
口調
年齢
```

これ以外は Codex sidekick が担当する。

```txt
slug の生成
characterId の生成
assetBundleId の生成
jobId の生成
prompt 作成
incoming / reference フォルダ準備
sprite 生成
配置
検査
```

今回は sprite sheet だけがスコープであり、イベント絵や narrative 生成はこの手順に含めない。

## Sidekick 主経路（canonical ready 用）

1. ゲームが `.godsandbox/jobs/` に job を置く。
2. Codex sidekick が job を拾う。
3. `npm run sidekick:intake` が内部 ID を生成し、portrait reference と 2 枚の prompt を用意する。
4. Codex sidekick が hatch-pet を使って Sheet 1 と Sheet 2 を生成する。
5. 生成 PNG を次へ保存する。

```txt
assets/generated/residents/<slug>/incoming/resident-sprite-sheet.png
assets/generated/residents/<slug>/incoming/resident-sprite-sheet-extended.png
```

6. Codex sidekick が `npm run sprite:check -- <slug>` を実行する。
7. contact sheet と report を人間が確認する。
8. PO visual OK 後にだけ public 配置と採用更新を行う。

この経路は、2-sheet 生成の品質が安定した後に使う。
Eve/Ryo方式の PO preview 作業では、`incoming/` ではなく
`assets/generated/residents/<slug>/po-preview/` と versioned public preview を使う。

## developer / diagnosis 用コマンド

2-sheet ready gate:

```bash
npm run sprite:check -- <slug>
```

個別sheetの診断だけをしたい時:

```bash
npm run sprite:check -- <slug> motion
npm run sprite:check -- <slug> extended
```

public 配下などの直接 path を診断したい時:

```bash
npm run sprite:check -- public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet.png --kind motion
npm run sprite:check -- public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet-extended.png --kind extended
```

下位 tool は診断専用であり、ready gate には使わない。

```bash
node tools/asset-pipeline/check-resident-sprite-alpha.mjs <png-or-slug>
node tools/asset-pipeline/validate-resident-sprite-sheet.mjs <png-or-slug>
node tools/asset-pipeline/audit-resident-sprite-visuals.mjs <png-or-folder> --kind motion
node tools/asset-pipeline/audit-resident-sprite-visuals.mjs <png-or-folder> --kind extended
```

## ready 条件

次をすべて満たすまで `ready` にしない。

- Sheet 1 がある
- Sheet 2 がある
- `npm run sprite:check -- <slug>` が pass
- contact sheet review 済み
- PO visual OK 済み
- public 配置先が 2 枚ともそろっている

preview 中の fallback は許容するが、ready 条件には使わない。

## public 配置先

```txt
public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet.png
public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet-extended.png
```

採用前のローカル候補や preview 用コピーを、そのまま `ready` と見なさない。

## Git 管理境界

commit しないもの:

- `assets/generated/**`
- `assets/residents/**`
- `.godsandbox/jobs/**`
- `.godsandbox/portraits/**`
- `.hatch-pet-runs/**`
- `manifests/residents.json`
- `narrative/generated/**`

commit してよいもの:

- docs
- prompt template
- validator / audit / sidekick のコード
- PO review 後に採用済みとなった public asset と manifest 更新

## 検証

最低限:

```bash
npm run typecheck
npm run build
npm run test:domain
npm run sprite:check -- --help
```

失敗系:

```bash
npm run sprite:check -- <slug>
npm run sprite:check -- public/art/characters/defaults/<slug>/sprites/resident-sprite-sheet.png
```

期待:

- Sheet 2 が欠けている slug は fail
- path 指定で `--kind` がない場合は fail
