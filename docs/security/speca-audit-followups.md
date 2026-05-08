# SPECA 監査フォローアップ — 未解消・将来対応項目

SPECA 監査（2026-05-08）で out-of-scope または手動確認が必要と分類された項目を記録する。

---

## 1. Narrative Adoption 未実装（out-of-scope）

### pre-004: narrative `adopted` が safety review を経由するか

- **現状**: narrative adoption state machine が未実装のため、検査対象コードが存在しない
- **将来対応**: narrative adoption を実装する際に以下を必須とする
  - `safety_review_status: "passed"` を `adopt` transition の前提条件にする
  - `draft` → `safety_review_passed` → `adopted` の順序を state machine で強制する
  - `adopted` 状態へは `needs_review` → `draft` → `safety_review_passed` のフルパスを必須とする

### pre-005: adopt 前の `safety_review_status` ゲート

- **現状**: 同上（未実装）
- **将来対応**: adoption 関数が `safety_review_status !== "passed"` の場合は例外をスローする
- **参考**: `promoteAssetToReady()` の実装（`src/persistence/assetManifest.ts`）が設計パターンの参考になる

### promoteAssetToReady() の適用範囲

- **対象**: Codex パイプラインで生成されたアセット（generated content）
- **対象外**: `defaultCharacterAssetManifest.ts` などの PO が直接コミットしたシード/デフォルトアセット
  - これらは `status: "ready"` を直接設定してよい。PO レビューはコミット時に実施済みとみなす

---

## 2. LLM Batch Handoff 境界（P2 追加ドメイン）

`docs/architecture/llm-batch-handoff-spec.md` に LLM バッチ送信の設計制約を記録。

主な不変条件：

1. LLM バッチパケットは明示的なユーザー確認前に外部 AI に送信してはならない
2. GodSandbox core app は外部 LLM または画像生成 API を直接呼び出してはならない
3. LLM バッチパケットには purpose-allowlist に含まれるフィールドのみを含める
4. API キー・トークン・シークレット・アカウント情報は LLM バッチパケットに含めてはならない
5. 五行値・陰陽内部値・`currentFaith` 数値は外部 AI プロンプトテキスト（`externalAiPromptBlock`）に含めてはならない。Raw Passport JSON（内部保存）は `currentFaith` を含んでよい。
6. sprite sheet 生成ジョブはスレッド分離を維持し、複数の sprite sheet を1つのスレッドでバッチ生成してはならない
7. 生成された LLM または画像結果は incoming/candidate/needs_review に入れ、adopted/ready として扱ってはならない
8. LLM 結果はユーザーレビュー前に official narrative/asset/character profile/snapshot/passport/WorldEvent/ChangeSet を上書きしてはならない
9. Narrative LLM 出力は gameplay state の canonical source であってはならない
10. LLM バッチ監査ログはデフォルトでメタデータのみを保存する（batch id/purpose/source ids/counts/hashes/timestamps）— raw character content は含めない

---

## 3. GitHub Branch Protection（手動設定が必要）

SPECA finding inv-015（main への direct push 禁止）はコード PR では解消できない。
`docs/security/github-branch-protection-runbook.md` を参照して GitHub 管理画面で設定すること。

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| 2026-05-08 | 初版作成（SPECA 監査 2026-05-08 に基づく） |
| 2026-05-08 | currentFaith 境界を明確化（Raw Passport JSON と externalAiPromptBlock の分離）; promoteAssetToReady() 適用範囲を追記 |
