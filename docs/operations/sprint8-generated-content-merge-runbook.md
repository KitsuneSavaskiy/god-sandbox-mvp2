# Sprint8 generated content merge runbook

状態: Sprint8 docs-first merge runbook

## Purpose

Sprint8終盤の generated content / narrative / time-season 関連PRを、安全な順番でmergeするための確認順を定義する。

この文書は実装ではない。
open PR / Draft PR / merge前QA の依存関係を整理し、監査役と各Lineが同じ順番で確認できるようにするためのrunbookである。

## Current state

mainには、narrative基盤docsの前提がすでに入っている。

| PR | 状態 | 内容 |
| --- | --- | --- |
| `#146` | main merge済み | narrative sidekick workspace |
| `#149` | main merge済み | narrative pack schema |
| `#150` | main merge済み | narrative GM personas |

現在の主なopen PR / Draft PRは、次の3系統に分かれる。

| 系統 | PR | 状態 | 目的 |
| --- | --- | --- | --- |
| narrative consistency | `#161` | open | narrative schema / surface 整合map |
| narrative surface chain | `#152` | open | sandbox narrative surface 仕様 |
| narrative surface chain | `#154` | open | GM narrative event UI acceptance matrix |
| narrative surface chain | `#157` | open | generated content mobile a11y QA |
| narrative surface chain | `#158` | open | time / season narrative hook |
| time-season UI | `#144` | open | sandbox time / season background HUD 実装 |
| time-season copy | `#140` | Ready for review | sandbox time / season HUD copy 仕様 |
| asset sidekick | `#136` | Ready for review | asset sidekick personas 仕様 |

`dist/` はローカルのbuild出力であり、PRに入れない。
未追跡で出ている場合も、Git管理対象へ昇格しない。

## Final vision

Sprint8終盤のPRは、次の状態でmerge判断できる。

- narrative surface chain は、main入り済みの `#146` / `#149` / `#150` と矛盾しない順番でmergeする。
- time-season UI は、`#142` で入った `!` バブル操作分離と衝突しないことを確認してmergeする。
- Draft PR は、実装PRの表示や用語と矛盾しない状態まで仕上げてからReady for reviewにする。現在 `#140` と `#136` はReady for reviewである。
- `dist/`、生成途中素材、実job JSON、ローカル作業物はPRに混ぜない。

## Source of truth

merge判断では、次を正本として扱う。

1. GitHub PR diff / changed files
2. 各PRの最新CI結果、review状態、merge state
3. main入り済みdocs
4. このrunbook

関連docs:

- `docs/operations/codex-job-queue.md`
- `docs/operations/generated-workspace-retention-policy.md`
- `docs/operations/narrative-sidekick-workspace.md`
- `docs/operations/sprint8-closeout-git-hygiene.md`
- `docs/architecture/narrative-pack-schema.md`
- `docs/architecture/narrative-gm-personas.md`

ローカルworking treeの汚れは、監査の正本にしない。
ローカルで再現確認する場合は、clean branch / clean worktreeで補助確認として扱う。

## Required rules

- GitHub PR diff / changed files を正本にする。
- `src/**` をこのrunbook PRで触らない。
- PR branchをこのrunbook PRから直接修正しない。
- `dist/` をcommitしない。
- workflow / package / CIを触らない。
- 個人PCの絶対パス、secret、API key、tokenを書かない。
- generated narrative は、domain event正本を上書きしない。
- `focusedEvent` 中心を維持する。
- 箱庭上にキャラ名、場所、状態ラベルを戻さない。
- 死亡、寿命、勲章を復活させない。

## Recommended merge order

### Narrative surface chain

推奨順:

```txt
#161 -> #152 -> #154 -> #157 -> #158
```

理由:

1. `#161` で main入り済みの narrative schema / workspace / GM persona と surface系PRの整合mapを先に置く。
2. `#152` で narrative surface の表示面を定義する。
3. `#154` で event UI acceptance matrix を定義する。
4. `#157` で mobile / accessibility QA を定義する。
5. `#158` で time / season narrative hook を接続する。

`#158` は time-season 語彙に触れるため、`#144` / `#140` の状態も確認してからmergeする。

### Time-season UI / copy axis

`#144` は実装PRである。
`#142` merge後の `!` バブル操作分離と衝突していないことを確認する。

`#140` はReady for reviewのcopy仕様PRである。
`#144` の実装表示と用語が矛盾しない状態に更新済みである。

推奨:

```txt
#144 final QA
#140 copy finalize
#158 time / season narrative hook
```

`#144` と `#140` のmerge順は、実装表示とcopy仕様が矛盾しないなら前後してよい。
ただし、`#158` の確認前には、time / season の表示名と内部状態名の境界を確認する。

### Asset sidekick axis

`#136` はReady for reviewのasset sidekick persona仕様PRである。
narrative surface chainとは別軸で進める。

確認では、次を優先する。

- `characterId` / `assetBundleId` を混同していない。
- `resident-sprite-sheet` / `portrait-expressions` / `derived-icon` の3 laneと整合している。
- iconはsprite正面frameから派生し、別AI生成しない。
- `#135` / `#138` のbatch review仕様と矛盾しない。

## Merge-before checklist by PR

| PR | merge前に見る観点 | blocker例 |
| --- | --- | --- |
| `#161` | narrative schema / workspace / GM persona と #152 / #154 / #157 / #158 の接続mapとして妥当。`ready` / `adopted` 差分がfollow-up扱いでよい。 | mapが古いPR状態を正本のように断定する。generated narrativeをadopted前に表示可とする。 |
| `#152` | `#146` / `#149` / `#150` と用語が合っている。`candidate` / `needs-review` / `rejected` / `adopted` と runtime / display fallback がUI surfaceで誤用されていない。 | generated narrativeをadopted前に公式表示する。domain event正本を上書きする。 |
| `#154` | event UI acceptance が `focusedEvent` 中心を維持している。watch / help / trial の扱いが既存仕様と矛盾しない。 | `focusedCharacter` 中心へ戻す。介入導線を複数箇所へ戻す。 |
| `#157` | 390px / 360px、accessibility、fallback時の表示が確認できる。Codex生成待ちでgameplayを止めない。 | pending / needs-review だけでイベント進行が止まる。内部状態名をそのままユーザーへ見せる。 |
| `#158` | time / season narrative hook が `#144` / `#140` の表示名と矛盾しない。season / phase は演出補助であり、domain効果に踏み込まない。 | 季節イベント生成やdomain season効果をこのPRで定義する。 |
| `#144` | `!` バブルクリックでイベント子画面が開く。住民本体クリックでCharacterDetailPanelが開く。HUDが390px / 360pxで邪魔しない。eventWindowOpen / latestOutcome中に時計と背景進行がpauseする。背景fallbackが壊れない。 | `#142` の操作分離を壊す。箱庭上ラベルを戻す。domain / persistence / Passport schemaへ踏み込む。 |
| `#140` | 朝 / 昼 / 夕方 / 夜、春 / 夏 / 秋 / 冬 の表示名が `#144` と矛盾しない。HUDに内部状態名を出さない。短い文言で390px / 360pxでも読める。 | `morning` など内部状態名をUI文言正本にする。実装PRと違うアイコンやラベルを固定する。 |
| `#136` | asset personaが3 laneと整合している。PO Review Summarizer がbatch review specと矛盾しない。 | iconを別AI生成に戻す。PO visual OK前のready promotionを許す。 |

## Dist and local output policy

`dist/` は `npm run build` で再生成できるローカル出力である。
Sprint8 generated content / narrative / time-season PRには入れない。

Sprint8 closeout直前のGit衛生確認は `docs/operations/sprint8-closeout-git-hygiene.md` を正本にする。

PR前に次を確認する。

```bash
git status --short
git diff --name-only origin/main...HEAD
```

もし `dist/`、実job JSON、`assets/generated/**`、`assets/residents/**`、`narrative/generated/**`、`manifests/drafts/**` が差分に出ている場合は、PRから外す。

## Ready / Done conditions

- Sprint8終盤のmerge順がdocsで分かる。
- `#161` / `#152` / `#154` / `#157` / `#158` のnarrative consistency / surface chainが整理されている。
- `#144` / `#140` / `#136` が別軸として整理されている。
- `#146` / `#149` / `#150` はmain merge済み前提として明記されている。
- `dist/` をPRに入れない方針が明記されている。
- PRごとのmerge前確認観点が表で分かる。
- 実装やPR branch修正に踏み込んでいない。
- 個人パス、secret、token、API keyを書いていない。

## Testing requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

追加確認:

- changed files が許可範囲内である。
- `src/**` を触っていない。
- `dist/` をcommitしていない。
- GitHub workflow / package / CIを触っていない。

## Preferred outcome

このrunbookがmergeされ、監査役と各Lineが次の順で判断できる。

```txt
narrative surface:
#161 -> #152 -> #154 -> #157 -> #158

time-season:
#144 final QA
#140 copy finalize

asset sidekick:
#136 finalize
```

各PRの確認観点が明確になり、generated content / narrative / time-season PRのmerge順で迷わなくなる。

## Safe fallback outcome

PR状態が変わった場合は、このrunbookを古い事実として断定に使わない。
GitHub上の最新PR diff / changed files / CI / review stateを正本として再確認する。

merge順が判断できない場合は、次の安全側へ倒す。

- narrative chain は `#161` から順に確認し直す。
- `#158` は `#144` / `#140` の表示名と挙動確認が終わるまで保留する。
- `dist/` やローカル生成物が混ざったPRはmergeしない。
- blockerがあるPRは、review commentで理由を残して修正待ちにする。

## Out of scope

- `src/**` の修正
- `#161` / `#152` / `#154` / `#157` / `#158` / `#144` / `#140` / `#136` のbranch修正
- GitHub workflow / package / CI変更
- Codex App Server実装
- narrative生成実装
- time-season HUD実装
- asset生成
- public asset変更
- Passport schema変更

## One-line Codex resume instruction

```bash
codex "Read docs/operations/sprint8-generated-content-merge-runbook.md, use it as the Sprint8 generated content merge runbook, verify current GitHub PR state before acting, and keep scope docs-first."
```
