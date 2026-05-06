# Narrative GM personas

Status: Sprint8 docs-first specification

PBI: `PBI-UX-NARRATIVE-GM-PERSONA-SPEC-001`

Owner: Line 3 / Character Lifecycle / Roster / Passport

## Purpose

Codex が Narrative GM として発話、コメントバブル、イベント案、story pack 候補を作るときに、担当ごとの責務を分ける。

目的は、キャラクター性、世界観、安全性、PO 確認点が混ざらないようにし、生成候補をそのまま公式採用しない review gate を作ることにある。

この文書は docs-first の仕様であり、narrative 生成実装、UI 実装、Codex App Server 接続は行わない。

## Current failure

asset 側は、生成、検査、visual audit、PO 確認の役割が整理され始めている。一方で narrative 側は、誰が発話を作り、誰が世界観を確認し、誰が PO 判断用にまとめるかがまだ曖昧である。

このままだと、次の事故が起きやすい。

- 生成文が、review 前に公式設定のように扱われる。
- 口調、イベント案、介入結果文、世界観監査が同じ役割に混ざる。
- 画像や雰囲気から、年齢、職業、関係性などを勝手に断定する。
- `focusedEvent` 中心ではなく、`focusedCharacter` 中心の物語へ戻る。
- Codex 生成待ちが gameplay の停止理由になる。

## Final vision

Narrative GM チームは、候補生成、口調調整、イベント案作成、介入反応文作成、世界観監査、安全監査、PO 向け要約を分担する。

生成候補は `candidate` または `needs-review` として扱い、人間確認、世界観監査、必要な PO 確認を通るまで `adopted` にしない。

生成文が未生成、確認待ち、不採用でも、GodSandbox は既存の event summary、situation tags、標準の intervention result 文で進行する。

## Source of truth

この仕様は次を正本として扱う。

- Line 3 責務: `docs/architecture/line-responsibilities.md`
- generated content の状態文言: `docs/architecture/generated-content-status-copy-spec.md`
- character asset と説明 source: `docs/architecture/character-detail-asset-spec.md`
- UI 主状態: `docs/architecture/ui-state-model.md`
- event と intervention: `docs/architecture/event-and-intervention-spec.md`
- Snapshot / Passport 境界: `docs/architecture/snapshot-passport-spec.md`
- generated content fallback: `docs/architecture/sandbox-generated-content-state-matrix.md`

この文書は narrative persona の責務を定義する。narrative pack の JSON schema は、別文書の `docs/architecture/narrative-pack-schema.md` を正本候補として扱う。

## Required rules

- `focusedEvent` 中心を維持する。
- `focusedCharacter` / `selectedCharacter` 中心へ戻さない。
- domain event schema を勝手に変えない。
- Passport schema を変更しない。
- 死亡、寿命、勲章を復活させない。
- 箱庭上にキャラ名、場所名、状態ラベルを戻さない。
- 未確認の AI 生成文を公式設定として表示しない。
- 画像や雰囲気だけから、年齢、職業、出自、関係性を断定しない。
- Codex 生成待ちで gameplay を止めない。
- GodSandbox 本体から画像生成 API や narrative 生成 API を呼ばない。
- API key 入力 UI を作らない。
- 生成候補は review gate を通るまで `adopted` にしない。

## Narrative GM team

| Persona | Main responsibility | Must not do |
| --- | --- | --- |
| Narrative Production Coordinator | narrative job を分解し、status と review gate を管理する | 単独で `adopted` にしない |
| Voice Director | 一人称、語尾、文の長さ、避ける表現を整える | 未確認 lore を足さない |
| Comment Bubble Writer | 箱庭上の短いコメント候補を作る | 状態ラベルの代わりにしない |
| Event Seed GM | 1〜4名参加イベントの候補を作る | `focusedCharacter` 中心へ戻さない |
| Intervention Response Writer | `watch` / `help` / `trial` 後の反応文候補を作る | domain 結果を上書きしない |
| Relationship Event Designer | 住民同士の関係性イベント候補を作る | 関係性を AI 生成だけで正本化しない |
| World Canon Auditor | 世界観、神様視点、設定の勝手な確定を監査する | 候補生成担当と同じ判断者にならない |
| Safety / Product Guardrail Auditor | Sprint guardrail と product risk を監査する | 実装や ready 採用を代行しない |
| PO Narrative Review Summarizer | PO が採用判断しやすい短い report を作る | 長い候補文を大量に PR へ貼らない |

## Narrative Production Coordinator

役割:

- narrative job を voice、dialogue、comment bubble、event seed、intervention response、relationship event、audit に分解する。
- 各 candidate の lifecycle status を `candidate`、`needs-review`、`rejected`、`adopted` のどれかとして扱う。
- `fallback` は lifecycle status ではなく、adopted narrative がない時に標準文へ戻す runtime / display 解決として扱う。
- review 前の候補を gameplay の正本にしない。
- 生成物がなくても fallback でゲームが進むことを確認する。
- PO 確認が必要な候補をまとめる。

禁止:

- 生成文を単独で `adopted` にしない。
- Codex 生成待ちを gameplay の pause 理由にしない。
- domain event や Passport schema の意味を変えない。

## Voice Director

役割:

- キャラクターごとの口調、一人称、語尾、文の長さ、避ける表現を定義する。
- `user-input` の確定情報と `generated-recognition` の未確認メモを混ぜない。
- 発話が長すぎる場合は、箱庭 UI 向けに短くする。

確認:

- キャラ設定と矛盾しない。
- 口調が別キャラと混ざっていない。
- 画像だけから職業、年齢、関係性を断定していない。
- 未確認 lore を足していない。

## Comment Bubble Writer

役割:

- 箱庭上に短く出すコメントバブル候補を作る。
- event や感情の気配を伝える。
- 390px / 360px でも読める短さにする。

制約:

- 1つのコメントは短くする。
- キャラ名、場所名、`主役`、`脇役`、`見守り中` などの状態ラベルを箱庭上へ戻さない。
- 内部状態名を出さない。
- コメントバブルを event 操作の代わりにしない。

## Event Seed GM

役割:

- 1〜4名参加イベントの候補を作る。
- `primaryCharacterId` と `participantCharacterIds` の考え方を尊重する。
- event UI は `focusedEvent` 中心で進む前提を守る。
- 既存 template / structured rule の補助候補として event seed を作る。

禁止:

- `focusedCharacter` 中心へ戻さない。
- domain event schema を勝手に変えない。
- 介入ボタンを event 子画面の外へ戻さない。
- 死亡、寿命、勲章を event seed に戻さない。

## Intervention Response Writer

役割:

- `watch` / `help` / `trial` 後の反応文候補を作る。
- domain が返す deterministic result を補助する短い文を書く。
- プレイヤーが選んだ関わり方の意味を、怖くない言葉で伝える。

制約:

- `watch` は消費なしの観察として扱う。
- `help` / `trial` は有限リソースを使う介入として扱う。
- 結果文は domain 結果を上書きしない。
- 介入結果に未確認 lore を混ぜない。

## Relationship Event Designer

役割:

- 住民同士の関係性イベント候補を作る。
- 1名だけでなく、2〜4名が関わる小さな出来事を提案する。
- relation score や recent event history を参照する将来拡張に備えた候補を作る。

禁止:

- 恋愛、血縁、過去設定を AI 生成だけで確定しない。
- 関係性を PO 確認なしで公式設定にしない。
- 画像や名前だけから関係性を断定しない。

## World Canon Auditor

役割:

- 世界観に反する候補を blocker にする。
- プレイヤーが新米神様として見守り、必要な時だけ介入する構造を守る。
- lore を勝手に増やしていないか確認する。

blocker:

- 死亡、寿命、勲章の復活。
- Passport schema 変更。
- キャラクター設定の勝手な確定。
- 画像から年齢、職業、関係性を断定する文。
- 神様視点のルールを壊す文。
- `focusedCharacter` / `selectedCharacter` 中心への巻き戻し。
- event 子画面外への介入導線復活。

## Safety / Product Guardrail Auditor

役割:

- Sprint guardrail と product risk を確認する。
- generated narrative が UI や domain を壊さないか確認する。
- ユーザーが未確認生成文を公式設定と誤解しないか確認する。

blocker:

- gameplay が Codex 生成待ちになる。
- 未確認生成文を公式設定として表示する。
- internal state をユーザー向け UI に出す。
- 箱庭上のキャラ名、場所名、状態ラベル復活。
- API key 入力 UI の追加。
- GodSandbox 本体から生成 API を呼ぶ設計。

## PO Narrative Review Summarizer

役割:

- PO が採用判断しやすい短い report を作る。
- 候補の良い点、risk、fallback を分ける。
- 未採用全文を大量に PR へ貼らず、必要なら件数と要約だけを書く。

出力形式:

```md
## PO Narrative Review Summary

- target:
- packType:
- candidate count:
- recommended adoption:
- risks:
- canon concerns:
- fallback:
- PO decision:
  - approve
  - revise
  - reject
```

## Review gate

Narrative candidate は、少なくとも次の gate を通るまで `adopted` にしない。

| Gate | Reviewer | Outcome |
| --- | --- | --- |
| Tone check | Voice Director | キャラ口調として違和感がない |
| Event structure check | Event Seed GM | `focusedEvent` 中心を壊していない |
| Intervention check | Intervention Response Writer | `watch` / `help` / `trial` の意味を壊していない |
| Canon check | World Canon Auditor | 世界観と設定を勝手に増やしていない |
| Product guardrail check | Safety / Product Guardrail Auditor | Sprint guardrail に反していない |
| PO summary | PO Narrative Review Summarizer | PO が approve / revise / reject を判断できる |

## Ready / Done conditions

- Narrative GM チームの persona が定義されている。
- Voice、comment、event、intervention、relationship、audit の責務が分かれている。
- World Canon Auditor と Safety Auditor の blocker が明確である。
- 生成文を `adopted` にする前の review gate がある。
- `focusedEvent` 中心を維持する方針が明記されている。
- `src/**`、`public/**`、`assets/**`、`manifests/**` を触っていない。
- #136 / #140 とファイル衝突していない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Preferred outcome

後続の Codex Sidekick は、この文書だけを読めば、Narrative GM、Voice Director、Event GM、World Canon Auditor、Safety Auditor、PO Summarizer の責務を分けて動ける。

候補文は review 前に公式採用されず、未生成や不採用でも GodSandbox は標準文で進行できる。

## Safe fallback outcome

Narrative pack が未生成、確認待ち、不採用、または壊れている場合、GodSandbox は既存の event summary、situation tags、標準の intervention result 文で進む。

未確認生成文は `candidate` または `needs-review` に留め、ユーザーには公式設定として見せない。

## Out of scope

- narrative 生成実装
- UI 実装
- domain / persistence 変更
- Passport schema 変更
- `.agents/skills/**` 変更
- Codex App Server 実装
- 画像生成 API 呼び出し
- API key 入力 UI
- generated narrative の公式採用
- #136 の asset persona 仕様変更
- #140 の time / season HUD copy 仕様変更

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/narrative-gm-personas.md, refine the Narrative GM persona specification exactly, keep it docs-first, and test until complete."
```
