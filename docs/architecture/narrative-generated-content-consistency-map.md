# Narrative generated content consistency map

状態: Sprint8 docs-first 整合確認

## Purpose

main入り済みの narrative schema / workspace / GM persona と、open PR の narrative surface / acceptance / hook / mobile QA が矛盾していないかを整理する。

この文書は確認用の地図である。
実装変更、narrative生成、domain / persistence 変更、Passport schema変更は行わない。

## Source of truth

main 側の正本:

- `docs/architecture/narrative-pack-schema.md`
- `docs/architecture/narrative-gm-personas.md`
- `docs/operations/narrative-sidekick-workspace.md`
- `docs/architecture/event-and-intervention-spec.md`
- `docs/architecture/ui-state-model.md`
- `docs/architecture/generated-content-status-copy-spec.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`

open PR 側の確認対象:

- #152 `docs/architecture/sandbox-narrative-surface-spec.md`
- #154 `docs/architecture/gm-narrative-event-ui-acceptance-matrix.md`
- #157 `docs/architecture/sandbox-generated-content-mobile-a11y-spec.md`
- #158 `docs/architecture/sandbox-time-season-narrative-hook-spec.md`

## Final vision

Narrative generated content は、次の順で安全に扱う。

1. Narrative GM が候補を作る。
2. 候補は `candidate` または `needs-review` として扱う。
3. 世界観、口調、安全性、mobile / a11y、必要な PO 確認を通す。
4. 公式採用できるものだけ `adopted` にする。
5. `adopted` だけが UI surface で generated narrative として表示できる。
6. 未生成、確認待ち、不採用、長すぎる文は runtime / display fallback で進む。

この流れでも、domain event / intervention result の正本は置き換えない。

## Main docs consistency

| 観点 | main docs の方針 | 判定 |
| --- | --- | --- |
| 置き場 | `narrative/generated/**` はローカル生成候補置き場で、原則Git管理外 | 整合 |
| lifecycle | `done` は候補返却であり、`adopted` ではない | 整合 |
| pack status | `candidate / needs-review / rejected / adopted` | 整合 |
| review gate | world canon / tone / safety / product / PO review を通す | 整合 |
| fallback | lifecycleではなく、narrative未生成時に deterministic summary / result 文へ戻すruntime / display解決 | 整合 |
| UI主状態 | `focusedEvent` 中心を維持する | 整合 |
| 禁止 | 死亡、寿命、勲章、Passport schema変更、focusedCharacter回帰は禁止 | 整合 |

## Open PR consistency

| PR | 目的 | status扱い | domain正本との境界 | 判定 |
| --- | --- | --- | --- | --- |
| #152 | narrative surface 仕様 | `candidate / needs-review` は出さず、`adopted` のみ表示可 | generated narrative は補助表示 | 整合 |
| #154 | event UI acceptance matrix | `adopted` でも基準未達なら表示しない | `watch / help / trial` の意味を上書きしない | 整合 |
| #157 | mobile / a11y QA | mobile条件を満たす `adopted` のみ表示可 | 主操作を押し出さない | 整合 |
| #158 | time / season narrative hook | time / season は雰囲気づけのみ | domain効果や実時間連動にしない | 整合 |

現時点の PR 本文確認では、#152 / #154 / #157 / #158 に `src/**` 変更、domain / persistence 変更、Passport schema変更は含まれていない。

## Status words map

### Narrative pack status

| status | 意味 | UI surface |
| --- | --- | --- |
| `candidate` | Codex が作った候補。未確認 | 表示しない |
| `needs-review` | 世界観、口調、安全性などの確認待ち | 表示しない |
| `rejected` | 使わない | runtime / display fallback |
| `adopted` | 公式採用済み | surface条件を満たせば表示可 |
| runtime / display fallback | lifecycleではない。採用済みpackがない時に標準文を使う解決 | 表示可 |

### `ready` と `adopted` の使い分け

`ready` は asset read model やユーザー向け表示名「準備済み」で使われてきた状態語である。
Narrative pack の公式採用状態は `adopted` とする。

整理すると次の通り。

| 用語 | 主な対象 | 意味 |
| --- | --- | --- |
| `ready` | asset manifest / read model、またはUI表示名 | 検査済みでゲーム表示に使える状態 |
| `adopted` | narrative pack | world canon / tone / safety / product review を通った公式採用文 |
| `準備済み` | ユーザー向け表示 | assetなら `ready`、narrativeなら `adopted` 後にだけ使ってよい表示名 |

重要:

- narrative pack 本体の status では `ready` を増やさない。
- UI文言で「準備済み」と表示する場合も、narrative内部状態は `adopted` として扱う。
- `candidate` や `needs-review` を「準備済み」と見せない。

## Surface connection map

| surface | narrative source | 表示してよい状態 | fallback |
| --- | --- | --- | --- |
| comment bubble | `comment-bubbles` | `adopted` の短文だけ | 非表示、または標準短文 |
| event window | `event-seeds` / `dialogue-lines` | `adopted` かつ主操作を邪魔しない文だけ | deterministic event summary |
| result card | `intervention-responses` | `adopted` かつ `watch / help / trial` を上書きしない文だけ | 標準result文 |
| story log | `story-log-candidates` | `adopted` かつcanonical historyを置き換えない文だけ | canonical event data由来の短文 |
| time / season hook | `event-seeds` / `comment-bubbles` の補助tag | `adopted` の雰囲気づけだけ | 通常のevent文 |

## Deterministic dataとの境界

生成文があっても、次は置き換えない。

- `WorldEvent`
- `SandboxSession.currentEventId`
- `InterventionRecord`
- `ChangeSet`
- activeSlots[4]
- roster
- Snapshot
- Passport
- `watch / help / trial` の意味、cost、domain result

PR #152 / #154 / #157 / #158 は、本文上この境界を維持している。

## Blocker

現時点の確認では、#152 / #154 / #157 / #158 に対する narrative schema 整合上の blocker は見つかっていない。

ただし、監査時には各PRの実diffを正本として再確認する。
この文書は PR本文と main docs を読んだ整合mapであり、各PRのmerge判断そのものではない。

## Follow-up

### 1. `ready` と `adopted` の表記同期

`docs/architecture/sandbox-generated-content-state-matrix.md` では、narrative の採用状態を `adopted` に寄せる。
`ready` は asset manifest / read model の lifecycle 状態として維持する。
UI表示では、asset `ready` と narrative `adopted` のどちらも「準備済み」と表示してよい。
ただし、narrative pack 本体の status に `ready` は増やさない。

短期判断:

- open PR #152 / #154 / #157 / #158 は `adopted` を使っているため、そのまま進めてよい。
- `fallback` は pack status ではなく runtime / display 解決として扱う。

### 2. PR本文のmain追従メモ

#152 / #154 / #157 / #158 のPR本文には、古い `origin/main eb85b59` から作成した旨が残っている。
GitHub上の `mergeStateStatus` は確認時点で `CLEAN` だが、merge前監査では最新main追従とCI再確認を行う。

### 3. Surface docsの相互参照

#152 / #154 / #157 / #158 がmergeされた後、必要なら `narrative-pack-schema.md` から各surface docsへの参照を追加する。
ただし、今回のPBIでは既存docsの追記に踏み込まず、新規mapに留める。

## Ready conditions

- main docs と open PR の接続点が分かる。
- `candidate / needs-review / rejected / adopted` と runtime / display fallback の扱いが分かる。
- `ready` と `adopted` の使い分けが分かる。
- blocker / follow-up が分類されている。
- 実装変更をしていない。

## Out of scope

- `src/**` 変更
- domain / persistence 実装
- Passport schema変更
- narrative生成実装
- Codex App Server実装
- open PR branch の直接修正
- #152 / #154 / #157 / #158 のmerge判断

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/narrative-generated-content-consistency-map.md, refine the narrative schema and surface consistency map exactly, keep it docs-first, and test until complete."
```
