# Narrative pack schema

状態: Sprint8 docs-first 仕様

## Purpose

Codex Narrative GM が作る発話、イベント案、介入後の反応文を、GodSandbox が将来安全に取り込めるようにする。

この文書は、生成された文章をそのまま正本にしないための schema、narrative lifecycle、review gate、runtime / display fallback を定義する。
今回は docs-first 仕様化だけを行い、domain、persistence、runtime state、UI 実装は変更しない。

## Current failure

現在、asset 側の生成物は保存先、検査、採用前確認が整理されつつある。
一方で narrative 側は、発話、イベント案、story log 候補、介入反応文をどの形で受け取り、どこまでを候補として扱うかが未固定である。

このままだと、次のリスクがある。

- Codex が作った自由文が、review なしで公式設定に見える。
- domain event と generated narrative の境界が曖昧になる。
- `focusedEvent` 中心ではなく、キャラクター単体中心の生成に戻る。
- 未生成 narrative pack があるだけで gameplay が止まる。

## Final vision

Narrative pack は、GodSandbox の event-first 体験を補助する構造化テキスト候補である。

最終的には、次が成立する。

- Codex Narrative GM は、voice、dialogue、event seed、intervention response、story log candidate を定められた schema で出力する。
- 生成直後の pack は `candidate` または `needs-review` であり、ゲームで使ってよい状態ではない。
- 人間確認、世界観監査、安全確認、必要なら PO 確認を通ったものだけ `adopted` になる。
- pack が未生成、失敗、review 待ちでも、既存の deterministic event summary と intervention result 文でゲームは進む。

## Source of truth

この文書は、narrative pack schema の正本である。

関連する正本は次の通り。

- `docs/architecture/event-and-intervention-spec.md`
  - event generation、focused event、intervention、deterministic data の正本。
- `docs/architecture/ui-state-model.md`
  - `focusedEvent` 中心の UI state と generated content fallback の正本。
- `docs/agent-operating-rules.md`
  - docs-first、scope、PR運用の正本。

この文書は Passport schema を変更しない。
この文書は domain event record の正本を置き換えない。

## Required rules

- Narrative pack は補助情報であり、domain event / intervention result の正本を勝手に置き換えない。
- `focusedEvent` 中心を維持する。
- `focusedCharacter` / `selectedCharacter` 中心へ戻さない。
- narrative が未生成でも、既存 summary / deterministic result 文で進む。
- 生成文を `adopted` にする前に review gate を通す。
- ユーザーに未確認 AI 生成文を公式設定として見せない。
- 死亡、寿命、勲章を復活させない。
- Passport schema を変更しない。
- キャラクター設定を勝手に確定しない。
- 画像から年齢、職業、関係性を断定しない。
- アプリ本体から外部 AI API を呼ばない。

## Pack types

最低限の pack type は次の通り。

| packType | 目的 | 主な使用先 |
| --- | --- | --- |
| `voice-profile` | キャラクターの口調、一人称、避ける表現を整理する | dialogue / response 生成の入力 |
| `dialogue-lines` | 住民の短い発話候補を持つ | 詳細画面、story補助、将来の会話候補 |
| `comment-bubbles` | 箱庭上の短いコメントバブル候補を持つ | sandbox内の短文表示 |
| `event-seeds` | イベント候補の structured seed を持つ | future event generation 補助 |
| `intervention-responses` | `watch` / `help` / `trial` 後の反応文候補を持つ | 介入結果表示の補助 |
| `story-log-candidates` | story log に使える候補文を持つ | logs / story surface の補助 |
| `relationship-event-seeds` | 1〜4名参加、住民間関係イベント候補を持つ | relation-aware event 補助 |

## Common fields

すべての pack は、少なくとも次を持つ。

```json
{
  "schemaVersion": "godsandbox-narrative-pack/v0",
  "packType": "voice-profile",
  "packId": "voice-profile-chr_ryo-v0",
  "status": "candidate",
  "source": {
    "generator": "codex-narrative-gm",
    "reviewGate": "not-reviewed"
  }
}
```

`packId` は pack 単位の安定識別子である。
`status` は下記の状態定義に従う。
`source.generator` は生成元の種別だけを書く。
個人PCの絶対パス、secret、API key、token は入れない。

## Narrative lifecycle status

| status | 意味 | ゲーム内使用 |
| --- | --- | --- |
| `candidate` | Codex が作った候補。まだ使わない | 使用不可 |
| `needs-review` | 世界観、口調、安全性の確認待ち | 使用不可 |
| `rejected` | 使わないと判断したもの | 使用不可 |
| `adopted` | 公式採用済み。ゲームで使ってよい | 使用可 |

`candidate` と `needs-review` は、プレイヤーに公式文として見せない。
`done` は job が候補を返しただけであり、`adopted` ではない。

`fallback` は narrative pack の lifecycle status ではない。
採用済み pack がない、または採用済み pack が表示条件を満たさない時に、runtime / display 側が標準文へ戻す判断である。
UI では `adopted` の narrative pack だけを、必要に応じて「準備済み」と表示してよい。

## Review gate

`candidate` から `adopted` へ進めるには、少なくとも次を確認する。

- world canon audit: GodSandbox の世界観、神様視点、既存キャラクター設定と矛盾しない。
- tone audit: voice profile と口調が矛盾しない。
- safety audit: 禁止仕様、内部状態露出、未確認設定の断定がない。
- product audit: `focusedEvent` 中心を壊さず、fallback で進める。
- PO review: 重要なキャラクター性や世界観判断がある場合に実施する。

review が未完了なら、runtime / display fallback として標準文を使う。

## Voice profile schema

```json
{
  "schemaVersion": "godsandbox-narrative-pack/v0",
  "packType": "voice-profile",
  "packId": "voice-profile-chr_ryo-v0",
  "characterId": "chr_ryo",
  "assetBundleId": "ryo",
  "displayName": "Ryo",
  "tone": {
    "firstPerson": "僕",
    "sentenceStyle": "短く穏やか",
    "emotionalRange": ["calm", "surprised", "sad"],
    "avoid": ["断定的すぎる口調", "長文説明"]
  },
  "status": "candidate"
}
```

`voice-profile` は、キャラクターの公式設定を増やすものではない。
未確認 lore は `avoid` や notes に推測として書いても、正本化しない。

## Dialogue lines schema

```json
{
  "schemaVersion": "godsandbox-narrative-pack/v0",
  "packType": "dialogue-lines",
  "packId": "dialogue-lines-chr_ryo-v0",
  "characterId": "chr_ryo",
  "lines": [
    {
      "id": "ryo-line-001",
      "situation": "idle",
      "emotion": "calm",
      "text": "少しだけ、見ていてください。",
      "status": "candidate"
    }
  ],
  "status": "candidate"
}
```

`dialogue-lines` は短い発話候補である。
内部状態名、domain用語、schema用語を画面文言として出さない。

## Comment bubbles schema

```json
{
  "schemaVersion": "godsandbox-narrative-pack/v0",
  "packType": "comment-bubbles",
  "packId": "comment-bubbles-chr_ryo-v0",
  "characterId": "chr_ryo",
  "bubbles": [
    {
      "id": "ryo-bubble-001",
      "situation": "sandbox-idle",
      "emotion": "calm",
      "text": "……風が変わった？",
      "status": "candidate"
    }
  ],
  "status": "candidate"
}
```

`comment-bubbles` は、箱庭上の短い表現に限る。
箱庭上にキャラ名、場所、状態ラベルを戻すために使わない。

## Event seed schema

```json
{
  "schemaVersion": "godsandbox-narrative-pack/v0",
  "packType": "event-seeds",
  "packId": "event-seeds-ryo-spring-v0",
  "eventSeedId": "evt-seed-ryo-spring-001",
  "participantCharacterIds": ["chr_ryo"],
  "primaryCharacterId": "chr_ryo",
  "situationTags": ["spring", "pond", "small-trouble"],
  "summaryCandidate": "Ryoが泉のほとりで小さな違和感に気づきました。",
  "allowedInterventions": ["watch", "help", "trial"],
  "status": "candidate"
}
```

`event-seeds` は event generation の候補であり、canonical `WorldEvent` そのものではない。
`primaryCharacterId` は `participantCharacterIds` に含める。
参加者は1〜4名を許すが、activeSlots外のキャラクターを勝手に入れない。

## Relationship event seed schema

```json
{
  "schemaVersion": "godsandbox-narrative-pack/v0",
  "packType": "relationship-event-seeds",
  "packId": "relationship-event-seeds-ryo-eve-v0",
  "eventSeedId": "evt-seed-ryo-eve-001",
  "participantCharacterIds": ["chr_ryo", "chr_eve"],
  "primaryCharacterId": "chr_ryo",
  "relationshipTag": "small-cooperation",
  "summaryCandidate": "RyoとEveが、同じ小さな異変に気づきました。",
  "allowedInterventions": ["watch", "help", "trial"],
  "status": "candidate"
}
```

`relationship-event-seeds` は、関係性の候補を作るための補助である。
恋愛、血縁、過去設定を AI 生成だけで確定しない。

## Intervention response schema

```json
{
  "schemaVersion": "godsandbox-narrative-pack/v0",
  "packType": "intervention-responses",
  "packId": "intervention-responses-evt-seed-ryo-spring-001-v0",
  "eventSeedId": "evt-seed-ryo-spring-001",
  "responses": [
    {
      "intervention": "watch",
      "summaryTitle": "静かに見守りました",
      "summaryBody": "Ryoは自分で小さな違和感を確かめました。",
      "tone": "gentle",
      "status": "candidate"
    },
    {
      "intervention": "help",
      "summaryTitle": "小さく助けました",
      "summaryBody": "あなたの祝福で、Ryoは落ち着いて一歩進めました。",
      "tone": "gentle",
      "status": "candidate"
    },
    {
      "intervention": "trial",
      "summaryTitle": "小さな試練を与えました",
      "summaryBody": "Ryoは戸惑いながらも、自分で答えを探し始めました。",
      "tone": "serious",
      "status": "candidate"
    }
  ],
  "status": "candidate"
}
```

`intervention-responses` は、domain側の `InterventionRecord` や `ChangeSet` を上書きしない。
結果文は deterministic result の補助である。

## Story log candidate schema

```json
{
  "schemaVersion": "godsandbox-narrative-pack/v0",
  "packType": "story-log-candidates",
  "packId": "story-log-candidates-evt-001-v0",
  "eventId": "evt-001",
  "logCandidates": [
    {
      "id": "story-log-evt-001-001",
      "title": "小さな違和感",
      "body": "Ryoは泉のほとりで、いつもと違う風を感じました。",
      "sourceEventId": "evt-001",
      "status": "candidate"
    }
  ],
  "status": "candidate"
}
```

`story-log-candidates` は story surface の候補である。
append-only の canonical history を勝手に置き換えない。

## Deterministic dataとの境界

Narrative pack は補助情報である。

次は domain / application の正本であり、narrative pack が勝手に変更しない。

- `WorldEvent`
- `SandboxSession.currentEventId`
- `InterventionRecord`
- `ChangeSet`
- activeSlots[4]
- roster
- relation table
- Snapshot
- Passport

外部 Codex などで richer narrative text を作っても、それは補助表示に留める。
生成物がなければ、既存の event summary、situation tag、intervention result 文で進行する。

## Safe fallback outcome

Narrative pack が未生成、失敗、review待ち、rejected の場合、ゲームは次で進む。

- event: deterministic event summary を表示する。
- intervention response: 既存の標準結果文を表示する。
- comment bubble: 表示しない、または安全な標準短文を使う。
- story log: canonical event data から作る短い標準文を使う。

fallback は失敗ではない。
未確認生成文を出すより、安全な標準文で進むことを優先する。

## Ready / Done conditions

この仕様が ready と言える条件は次の通り。

- narrative pack の種類が定義されている。
- voice / dialogue / comment bubble / event seed / intervention response / story log の schema 案がある。
- `candidate`、`needs-review`、`rejected`、`adopted` の lifecycle status が定義されている。
- `fallback` が lifecycle status ではなく runtime / display 解決であることが定義されている。
- generated narrative を正本 data と混ぜない境界が明記されている。
- review gate がある。
- safe fallback がある。
- Passport schema、domain、persistence、runtime state への変更を要求していない。

## Testing requirements

このPBIでは docs-only のため、次を確認する。

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## Preferred outcome

後続の Narrative GM / Event GM / Voice Director は、この文書だけを読めば、どの pack type をどの schema で出すべきか分かる。

Line 2 の後続実装では、domain 型を勝手に作り直さず、この schema を参照して application boundary を設計できる。

## Safe fallback outcome

schema の一部が未確定でも、runtime / display fallback として、ゲーム本体は既存 deterministic 文で進む。

未確定 pack を `adopted` にしない。
未確認生成文を公式設定として表示しない。

## Out of scope

- `src/**` 変更
- persistence実装
- domain実装
- runtime state変更
- Passport schema変更
- narrative生成実装
- Codex App Server実装
- API呼び出し
- package変更
- 死亡、寿命、勲章の復活
- focusedCharacter / selectedCharacter 中心への回帰
- 箱庭上のキャラ名、場所、状態ラベル復活

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/narrative-pack-schema.md, refine the narrative pack schema specification exactly, keep it docs-first, and test until complete."
```
