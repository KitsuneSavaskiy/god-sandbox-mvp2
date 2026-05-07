# Asset Sidekick Batch Review Spec

Status: Sprint8 docs-first specification

PBI: `PBI-QA-ASSET-SIDEKICK-BATCH-REVIEW-SPEC-001`

Owner: Line 4 / Event Experience / Tutorial / Narrative

## Purpose

Asset Sidekick が最大12 itemを並行生成した後、箱庭表示とイベント体験で安全に確認できるように、batch visual review、QA、safe fallback の仕様を定義する。

この文書は EventFirstSandbox の実装修正ではない。Line 4 は、generated asset がある場合もない場合も、`focusedEvent` 中心の箱庭体験が止まらないことを確認する。

## Source Of Truth

- `docs/architecture/sandbox-generated-content-state-matrix.md`
- `docs/architecture/generated-content-status-copy-spec.md`
- `docs/architecture/character-detail-asset-spec.md`
- `docs/operations/resident-sprite-visual-correctness-task.md`
- `docs/operations/codex-job-queue.md`
- `docs/architecture/line-responsibilities.md`

## Required Rules

- 箱庭に同時表示できる住民は `activeSlots[4]` の最大4名とする。
- Asset Sidekick の review batch も最大4名を基本単位にする。
- `characterId` と `assetBundleId` を混同しない。
- icon は sprite sheet の正面 frame から派生する。別AI生成しない。
- PO visual OK なしで ready 扱いにしない。
- 1 item が不合格でも batch 全体を止めない。
- 箱庭上にキャラ名、場所名、主役、脇役、見守り中、数値ラベル、内部状態名を表示しない。
- 死亡、寿命、勲章を復活させない。
- Passport schema を変更しない。

## ID Rules

`characterId` は runtime、domain、roster、activeSlots で使うIDである。

例: `chr_ryo`

`assetBundleId` は asset、prompt、folder、asset id prefix で使うIDである。

例: `ryo`

Batch review では、両方を併記する。

```txt
characterId = chr_ryo
assetBundleId = ryo
```

## Review Target

1 batch は最大4 character を対象にする。

Asset lane は次の3種類とする。

| Lane | Review target | Max item |
| --- | --- | --- |
| `resident-sprite-sheet` | 箱庭用 sprite sheet | 4 |
| `portrait-expressions` | 立ち絵の表情差分 | 4 |
| `derived-icon` | sprite 正面 frame 由来 icon | 4 |

最大 review 対象は次の通り。

```txt
4 character x 3 asset lanes = 12 item
```

## Review Order

1. item 単位の検査結果を見る。
2. character 単位で sprite、expression、icon の整合を見る。
3. 4名同時に `/sandbox` で箱庭表示を見る。
4. mobile 390px / 360px で表示を見る。
5. `eventWindowOpen` / `latestOutcome` 中の pause を見る。
6. CharacterDetailPanel / Roster の状態文言を見る。
7. PO review report を作り、item ごとに採用、再生成、fallback を判断する。

## Sprite Review

Sprite review では、まず visual audit contact sheet と processor report を見る。その後、箱庭上で実表示を確認する。

確認する画面:

- `/sandbox` desktop
- `/sandbox` 390px
- `/sandbox` 360px

確認する motion:

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

Sprite sheet の前提:

| Item | Value |
| --- | --- |
| frame size | `192 x 208` |
| columns | `8` |
| rows | `9` |
| image size | `1536 x 1872` |
| background | alpha transparent PNG |

Sprite が ready 候補になる条件:

- 頭、体、足が1 frame 内に収まっている。
- 上下の row が混ざっていない。
- body が frame 外へ大きくはみ出していない。
- 不透明な背景矩形がない。
- 文字、番号、透かしが焼き込まれていない。
- source portrait と同じ character として読める。

## Expression Review

Expression review では、次の表情差分を確認する。

- `neutral`
- `happy`
- `angry`
- `sad`
- `surprised`

確認観点:

- source portrait と同一 character として読める。
- 表情の違いが分かる。
- 勝手に衣装、年齢、職業、関係性、lore を増やしていない。
- CharacterDetailPanel で見切れずに表示できる。
- 未生成または不合格の表情は `neutral` / portrait fallback で破綻しない。

## Icon Review

Icon は sprite sheet の正面 frame から派生する。別AI生成しない。

Source frame の優先順:

1. `walk-down` row frame `0`
2. `idle` row frame `0` が正面として自然な場合

Icon review では、次を item report に残す。

```txt
iconSourceMotionKey
iconSourceFrameIndex
iconSourceReason
```

確認観点:

- 正面 frame から切り出されている。
- 小さいサイズでも character として読める。
- sprite と同一人物に見える。
- 別AI生成ではない。
- 不自然な emote effect や文字が icon に混ざっていない。

## Warning Judgment

許容できる可能性がある warning:

- 小さな emote effect
- sparkle
- tear
- anger mark
- surprise mark

許容できない warning:

- 頭と体が分離している。
- 足だけ別 component に見える。
- body が frame 外へ出ている。
- row mixing がある。
- 不透明な背景矩形がある。
- 文字や番号が焼き込まれている。
- source portrait と別人化している。
- asset から年齢、職業、関係性、死亡、寿命、勲章のような lore を断定している。

許容できない warning がある item は ready にしない。fallback または regeneration に回す。

## Four Character Sandbox QA

4名同時表示では、次を確認する。

- `activeSlots[4]` に収まる。
- 1440px / 390px / 360px で横はみ出ししない。
- 箱庭上ラベルが戻っていない。
- 住民アニメーション、コメントバブル、イベントの `!`、必要最小限の感情アイコンだけで表示されている。
- `eventWindowOpen` / `latestOutcome` 中に motion が pause する。
- `見守る` / `助ける` / `試練` のイベント導線が維持されている。
- CharacterDetailPanel を開いても `focusedEvent` 中心の体験が壊れない。

表示しないもの:

- キャラ名
- 場所名
- 主役 / 脇役 / 見守り中
- 活力 / 調和などの数値
- 内部状態名
- manifest / incoming / ready promotion などの制作内部語

## Safe Fallback

1 item が不合格の場合:

- その asset item だけ fallback する。

1 character の sprite が不合格の場合:

- その character の sprite だけ fallback する。
- 他の expression / icon が合格していても、sprite ready とは扱わない。

Expression が不合格の場合:

- `neutral` / portrait fallback を使う。

Icon が不合格の場合:

- sprite 正面 frame を再選択する。
- それでも不自然な場合は portrait fallback を使う。

1 character が不合格の場合:

- 他3名の採用判断を止めない。

Generated content が壊れている場合:

- 壊れた asset は ready から外す。
- 壊れた narrative は採用せず、既存文言 fallback を使う。
- Codex 生成待ちで gameplay を同期的に止めない。

## PO Batch Asset Review

PO 確認用 report は次の形にする。

```md
## PO Batch Asset Review

- batchId:
- characters:
- sprite results:
- expression results:
- icon results:
- warnings:
- mobile:
- sandbox:
- decisions:
  - approve
  - approve except item
  - regenerate item
  - fallback item
```

PO review report では、各 item の推奨判断を短く書く。

- `approve`: PO visual OK 後に ready promotion 候補へ進めてよい。
- `approve except item`: batch の一部だけ採用し、問題 item は fallback / regenerate にする。
- `regenerate item`: item 単位で再生成する。
- `fallback item`: 今回は通常画像、placeholder、既存文言で進行する。

## Ready / Done Conditions

- 最大12 item の review 対象が定義されている。
- sprite / expression / icon 別の review 観点がある。
- warning を許容する / しない基準がある。
- 1 item 不合格でも全体を止めない safe fallback がある。
- 箱庭定員4名との関係が明記されている。
- `characterId` / `assetBundleId` の分離が明記されている。
- EventFirstSandbox を触っていない。
- asset 生成、ready 化、public asset 変更をしていない。

## Testing Requirements

Docs-only PR でも、次を確認する。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Preferred Outcome

Asset Sidekick が最大4名 batch / 最大12 item を生成した後、Line 4 が箱庭とイベント体験の観点から安全に review できる。

Item 単位で warning、fallback、PO visual OK の判断が分かれ、1 item の失敗で batch 全体が止まらない。

## Safe Fallback Outcome

Review で不合格の item がある場合は、その item だけ fallback にする。

Sprite が壊れている character は、箱庭では portrait / icon / placeholder fallback を使う。Expression や narrative が未生成でも、既存の表示とイベント文で進行する。

## Out Of Scope

- EventFirstSandbox 実装修正
- asset 生成
- ready 化
- public/art 変更
- src 変更
- App Server 実装
- 画像生成API呼び出し
- 箱庭上ラベル復活
- Passport schema 変更
- 本格自由移動AI
- 3D engine 導入

## One-line Codex Resume Instruction

```bash
codex "Read docs/architecture/asset-sidekick-batch-review-spec.md, refine the asset Sidekick batch review specification exactly, keep it docs-first, and test until complete."
```
