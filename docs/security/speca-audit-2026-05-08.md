# SPECA セキュリティ監査レポート — 2026-05-08

## 監査概要

| 項目 | 値 |
|---|---|
| 監査日 | 2026-05-08 |
| 監査対象 commit | `5d565b8234a23192c83b65177d2a489a0137e204` |
| 監査対象ブランチ | `main` のみ（PR ブランチは対象外） |
| 使用ツール | NyxFoundation/speca |
| 監査方式 | **手動ブリッジ**（後述） |

## ⚠️ 監査手法の制限事項

**本監査は SPECA 標準の自動サブグラフ抽出（Phase 01b）を使用していません。**

SPECA の Phase 01b は Ethereum EIP 形式の形式的状態機械仕様を対象に設計されており、
GodSandbox の自然言語 Markdown 仕様文書への自動適用結果は 0 件でした。

代替として `01b_PARTIAL_W0B0_1778193046.json` を手動作成し、
GodSandbox の 5 セキュリティドメインを擬似サブグラフとして定義しました。
Phase 01e はこの手動ブリッジから 36 件のプロパティを生成しています。

**監査結果は仕様ドキュメントから人間が抽出した不変条件に基づくインスペクション支援であり、形式的検証ではありません。**

---

## Phase 実行結果

| Phase | 説明 | 結果 | 出力 |
|---|---|---|---|
| 01a | spec 発見 | ✅ | 13 specs |
| 01b | サブグラフ抽出 | ✅（手動ブリッジ） | 5 domains / 29 invariants |
| 01e | プロパティ生成 | ✅ | 36 properties（HIGH: 22 / MEDIUM: 14） |
| 02c | コード位置解決 | ✅ | 42 items |
| 03 | 監査実行 | ⚠️ 36/42 処理 | 36 audit items |

---

## Phase 03 結果

| 分類 | 件数 |
|---|---|
| potential-vulnerability | **17** |
| not-a-vulnerability | **17** |
| out-of-scope | **2** |

---

## potential-vulnerability 一覧と対応

### カテゴリ A: check-git-boundary.mjs が CI 未接続（6件）→ PR #255 で解消

| finding | 内容 |
|---|---|
| inv-002 | `.godsandbox/jobs/**` コミット禁止 → CI 接続で検出可能に |
| inv-003 | `assets/generated/**` コミット禁止 → 同上 |
| inv-004 | `narrative/generated/**` コミット禁止 → 同上 |
| inv-024 | `dist/` 等コミット禁止 → 同上 |
| post-002 | job done 後 output が Git にない → 同上 |
| asm-001 | source のみ Git 追跡 → 同上 |

### カテゴリ B: routine-pr-guardian のバイパス（5件）→ PR #256 で解消

| finding | 内容 |
|---|---|
| pre-001 | PR reviewer ≠ PR author → auto-approve 停止 |
| inv-007 | 独立 reviewer の audit record → auto-approve 停止 |
| inv-014 | agent が自 PR を approve しない → auto-approve 停止 |
| inv-016 | 実装と監査の分離 → auto-approve 停止 |
| inv-015 | main direct push 禁止 → runbook 作成（GitHub 管理画面での手動設定が必要） |

### カテゴリ C: その他（6件）

| finding | 対応 PR | 状況 |
|---|---|---|
| inv-025 | PR #255 | `.gitleaks.toml` でbase64/hex シークレット検出を追加 |
| inv-011 | PR #255 | PR 本文の local path/API key スキャンを追加 |
| pre-002 | PR #257 | job-watcher timeout + SIGKILL を追加 |
| pre-003 | PR #258 | `AssetReadinessStatus` に `needs_review` 追加 |
| inv-001 | PR #258 | `promoteAssetToReady()` で PO 承認 gate を追加 |
| inv-019 | PR #258 | `validateGeneratedNarrativeCandidate()` を追加 |

---

## not-a-vulnerability 一覧（17件）

| finding | 根拠 |
|---|---|
| inv-005 | gitleaks CI が全 push/PR を監査 ✅ |
| inv-008 | Passport JSON に五行値なし（型定義で保証） ✅ |
| inv-009 | faith 数値が UI に表示されない（faith 未実装） ✅ |
| inv-010 | 陰陽内部値が外部出力に含まれない ✅ |
| inv-012 | gameplay が Codex 生成をブロック待ちしない（fire-and-forget）✅ |
| inv-013 | fallback コンテンツが常に存在する（sprite→portrait→icon→span cascade）✅ |
| inv-017 | needs-review/candidate を adopted として表示しない ✅ |
| inv-018 | done ≠ adopted のコードパス分離 ✅ |
| inv-020 | narrative が intervention 結果を変更しない ✅ |
| inv-021 | narrative が Passport スキーマを変更しない ✅ |
| inv-022 | Passport の後方互換性（TypeScript 型で保証）✅ |
| inv-023 | adopted 前の候補を公式表示しない ✅ |
| inv-006 | generated narrative が official event records を上書きしない ✅ |
| post-001 | narrative adoption 後、official event records 不変 ✅ |
| asm-002 | core app が画像生成 API を直接呼ばない ✅ |
| asm-003 | API キーを UI から要求しない ✅ |
| pre-006 | narrative schema validation（未実装 = non-issue）✅ |

---

## out-of-scope（2件）— narrative adoption 未実装

| finding | 内容 | 将来対応 |
|---|---|---|
| pre-004 | narrative `adopted` が safety review を経由するか | adoption 実装時に `safety_review_status` を必須化 |
| pre-005 | adopt 前の `safety_review_status` ゲート | adoption 実装時に validation gate を組み込む |

詳細は `docs/security/speca-audit-followups.md` を参照。

---

## 手動確認が必要な項目

以下はコード PR で解決できず、GitHub 管理画面での作業が必要です：

- **main branch protection の設定**（`docs/security/github-branch-protection-runbook.md` 参照）
  - Require PR before merging
  - Require approvals: 1 以上
  - Require status checks（build, gitleaks）

---

## SPECA 5 domains（手動ブリッジ）

| domain id | source doc | invariants |
|---|---|---|
| codex_job_lifecycle | codex-job-queue.md | 6件 |
| asset_state_machine | sandbox-generated-content-state-matrix.md | 6件 |
| narrative_review_gate | narrative-pack-schema.md | 5件 |
| passport_boundary | event-and-intervention-spec.md | 6件 |
| pr_guardrails | agent-pr-checklists.md | 6件 |
