# Sprint9 Planning

状態: Sprint9 parent planning document

PBI: `PBI-PRODUCT-SPRINT9-CODEX-SIDEKICK-PLANNING-001`

## Purpose

Sprint9の親計画を正本化する。

Sprint9は、Codex Sidekick / Codex App Server / subagent personas の最小運用基盤を作り、asset代表ケースとnarrative代表ケースをSidekickから実行できる状態を目標にする。

この文書は親計画であり、実装ではない。planning doc PRでは、App Server、runner、watcher、job processor、API接続、UI、生成処理を作らない。

## Sprint9 Goal

GodSandbox本体を生成APIへ直結させず、Codex Sidekick / Codex App Server / subagent personas の最小運用基盤を作る。

asset代表ケースとnarrative代表ケースを、Sidekickから実行できる状態にする。

ただし、代表ケースの生成物は `ready` / `adopted` にしない。review待ちcandidateとして保存する。

## Source Of Truth

Sprint9 planningは、Sprint8でmain入りした以下を前提にする。

- `docs/operations/codex-job-queue.md`
- `docs/operations/generated-workspace-retention-policy.md`
- `docs/operations/sprint8-closeout-git-hygiene.md`
- `docs/operations/sprint8-done-report.md`
- `docs/operations/sprint8-retro.md`
- `docs/operations/asset-sidekick-parallel-lanes.md`
- `docs/architecture/asset-sidekick-personas.md`
- `docs/architecture/asset-sidekick-batch-review-spec.md`
- `docs/operations/narrative-sidekick-workspace.md`
- `docs/architecture/narrative-pack-schema.md`
- `docs/architecture/narrative-gm-personas.md`
- `docs/architecture/sandbox-generated-content-state-matrix.md`

## Phase 1: docs-first gate

Phase 1では、実装へ入る前に必要な設計をdocs-firstで固定する。

対象PBI:

```txt
PBI-ARCH-CODEX-SIDEKICK-SUBAGENT-PERSONAS-001
PBI-ARCH-CODEX-APP-SERVER-BRIDGE-SPEC-001
PBI-OPS-CODEX-SIDEKICK-RUNNER-LIFECYCLE-SPEC-001
PBI-SEC-CODEX-SIDEKICK-LOCAL-SECURITY-SPEC-001
PBI-QA-CODEX-SIDEKICK-BRIDGE-TEST-PLAN-001
PBI-UX-CODEX-SIDEKICK-NONTECH-SETUP-FLOW-001
```

Phase 1では、App Server、runner、watcher、job processor、API接続、UI、生成処理を作らない。

## Phase 2: MVP implementation

Phase 2では、Phase 1のdocs-first gateを満たした後、最小runnerと最小bridgeの実装へ進む。

対象PBI:

```txt
PBI-OPS-CODEX-SIDEKICK-RUNNER-MVP-001
PBI-ARCH-CODEX-APP-SERVER-BRIDGE-MVP-001
```

Phase 2の実装は、GodSandbox本体の必須起動条件にしない。

Codex Sidekickが使えない場合も、GodSandbox本体はfallbackで進む。

## Phase 3: representative execution

Phase 3では、Sidekickの最小運用基盤を使い、代表ケースを実行する。

対象PBI:

```txt
PBI-SIDEKICK-ASSET-REPRESENTATIVE-CASE-001
PBI-SIDEKICK-NARRATIVE-REPRESENTATIVE-CASE-001
```

## Implementation Start Gate

Phase 2のrunner / App Server bridge実装へ入る前に、以下がmainに入っていることを必須条件にする。

- subagent personas
- App Server bridge spec
- runner lifecycle spec
- local security spec
- bridge test plan

このgateを満たすまでは、runner、App Server、watcher、job processor、API接続の実装に入らない。

## Representative Case Definition

### asset代表ケース

1 character の `character-asset-bundle` jobを対象にする。

生成物は `ready` にしない。review待ちcandidateとして保存する。

### narrative代表ケース

1 character + 1 event の `character-narrative-pack` jobを対象にする。

生成物は `adopted` にしない。review待ちcandidateとして保存する。

どちらの代表ケースも、GodSandbox本体のgameplayをCodex生成待ちで止めない。

## Sprint9 DoD

Sprint9は、次を満たしたらDone候補とする。

- Sidekick subagent personasが定義されている。
- App Server bridge仕様が定義されている。
- runner lifecycle仕様が定義されている。
- local security / nontechnical setup / bridge test plan がある。
- 最小runnerが `pending -> running -> done / failed` を処理できる。
- App Server bridgeまたはdry-run fallbackでSidekick jobを実行できる。
- asset代表ケースがSidekickから実行できる。
- narrative代表ケースがSidekickから実行できる。
- 生成物は `ready` / `adopted` にならず、review待ちcandidateとして保存される。
- generated output / real job JSON / local logs がGit管理に混入しない。
- gameplayはCodex生成待ちで停止しない。

## Important Rules

- GodSandbox本体から画像生成APIを呼ばない。
- APIキー入力UIを作らない。
- Codex生成待ちでgameplayを止めない。
- App ServerはSidekick側の補助であり、ゲーム本体の必須起動条件にしない。
- `done` は採用済みではない。
- asset `ready` / narrative `adopted` はreview gate後にだけ扱う。
- 実jobや生成物をGit管理しない。
- ChatGPT / Codex サブスク範囲の個人利用を前提にする。
- 商用利用、再配布、第三者提供を前提にしない。
- 生成担当と監査担当を分ける。
- 生成担当が自分の生成物を `ready` / `adopted` にしない。

## Out Of Scope For Sprint9

- GodSandbox本体から画像生成APIを呼ぶこと。
- APIキー入力UI。
- gameplayをCodex生成待ちにすること。
- ready promotion自動化。
- adopted promotion自動化。
- 実asset大量生成。
- 実narrative大量生成。
- Passport schema変更。
- 死亡、寿命、勲章復活。
- 箱庭上のキャラ名、場所、状態ラベル復活。
- 商用利用、再配布前提の導線。

## Planning PR Guardrails

このplanning doc PRでは、次をしない。

- `.agents/skills/**` を触らない。
- App Server / runner / watcher / job processor / API接続 / UI / 生成処理を作らない。
- 実job JSON、generated asset、generated narrative、manifest draftを追加しない。
- `src/**`、`public/**`、`assets/**`、`manifests/**`、`package*`、`.github/**` を触らない。
- Passport schemaを変更しない。
- ready promotion / adopted promotionを自動化しない。

## Follow-up Planning

`docs/operations/sprint9-codex-sidekick-planning.md` は、この親計画PRでは作らない。

Phase 1の詳細運用PBIで必要になった時に、別PRで作る。

## Testing Requirements

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## One-Line Codex Resume Instruction

```bash
codex "Read docs/product/sprint9-planning.md, keep Sprint9 planning as a parent plan only, do not implement App Server or runner in this PR, and test until complete."
```
