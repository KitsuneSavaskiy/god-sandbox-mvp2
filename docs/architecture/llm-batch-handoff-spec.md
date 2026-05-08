# LLM Batch Handoff 境界仕様（LLM Batch Handoff Spec）

状態: 管理対象の正本ドキュメント

GodSandbox における外部 AI（LLM・画像生成）への情報送信境界を定義する。
「AI が不安な創作ユーザー」向けに、外部 AI へ渡す情報を目的別に確認・送信する設計を保証する。

実装前に `docs/product/ai-literacy-tutorial-spec.md` を必ず読むこと。

---

## 1. 基本原則

1. **GodSandbox core app は外部 LLM または画像生成 API を直接呼び出してはならない**
   - 全ての生成リクエストは `.godsandbox/jobs/` へのファイル書き込みで行う
   - Codex Sidekick（外部ツール）がジョブファイルを処理する

2. **LLM バッチパケットは明示的なユーザー確認前に送信してはならない**
   - Passport 発行前の確認画面（Level 1）が必須
   - 確認前に API 呼び出しを行わない

3. **生成結果は常に incoming → review → adopt のパイプラインを経由する**
   - LLM / 画像生成の出力を直接 ready/adopted として扱ってはならない

---

## 2. バッチ種別と制約

### Review Batch（Passport 生成）

外部 AI に渡す情報：
- キャラクター名・性格要約
- 話し方（口調・禁止事項）
- 箱庭での出来事の自然言語要約（数値なし）
- 神との関係の段階（faithBand のみ、数値は含めない）
- 発話例

外部 AI に渡してはならない情報：
- 陰陽五行の内部値（`wood`, `fire`, `earth`, `metal`, `water`, `yin`, `yang`）
- 信仰度の詳細な数値（`currentFaith`）
- ユーザーのアカウント情報
- GodSandbox 固有の計算パラメータ

### Execution Job（Sprite Sheet 生成）

制約：
- **1 character / 1 style anchor / 1 sprite sheet job を最小単位にする**
- 同一スレッド内で複数の sprite sheet を並列生成してはならない（`preserveThreadIsolation: true`）
- 実行順序: serial（`concurrency: serial`）
- 品質優先: `qualityPriority: "highest"`
- 生成結果は `incoming/` → `candidate` に入る。review 前に `ready/adopted` にしない

### Result Intake（生成結果受け取り）

- 生成された LLM または画像結果は `incoming/` または `candidate` 状態に入る
- `needs_review` → PO 承認 → `ready/adopted` の順序を守る
- `promoteAssetToReady()` 関数（`src/persistence/assetManifest.ts`）を必ず使うこと
- gameplay は LLM 結果を待たない（非同期・fire-and-forget）

---

## 3. Narrative LLM 制約

- 定期 World Digest を LLM に渡して候補生成してよい
- LLM は narrative candidate / event flavor を作る
- **canonical WorldEvent / ChangeSet / InterventionResult は domain logic が管理する**
  - LLM 結果がこれらを直接変更してはならない
- gameplay は LLM 結果を待たない
- LLM 結果はレビュー後に補助表示・候補として採用する
- 採用前に `validateGeneratedNarrativeCandidate()`（`src/domain/generatedContentSafety.ts`）で検査する
- death / lifespan / medals メカニクスを含む候補は必ず拒否する

---

## 4. 不変条件（Invariants）

SPECA 手動ブリッジ domain: `llm_batch_handoff_boundary`

1. LLM バッチパケット MUST NOT be sent to any external AI before explicit user confirmation
2. GodSandbox core app MUST NOT call external LLM or image generation APIs directly
3. LLM バッチパケット MUST include only purpose-allowlisted fields
4. API keys, tokens, secrets, account information MUST NOT appear in any LLM batch packet
5. Five-phase values and yin-yang internal values MUST NOT appear in any LLM batch packet
6. Sprite sheet generation jobs MUST preserve thread isolation and MUST NOT batch multiple sprite sheets into one generation thread
7. Generated LLM or image result MUST enter incoming/candidate/needs_review and MUST NOT be treated as adopted/ready
8. LLM result MUST NOT overwrite official narrative, asset, character profile, snapshot, passport, WorldEvent, or ChangeSet before user review
9. Narrative LLM output MUST NOT be the canonical source of gameplay state
10. LLM batch audit log SHOULD store metadata only by default: batch id, purpose, source ids, counts, hashes, timestamps; not raw character content

---

## 5. 出力禁止事項

Passport に含まれない（外部 AI に渡さない）情報：

```
✗ 陰陽五行の内部値（wood: 0.42 など）
✗ 信仰度の詳細な数値（currentFaith: 58 など）
✗ ユーザーのアカウント情報
✗ GodSandbox 固有の計算パラメータ
✗ API キー・トークン・シークレット
✗ ローカルファイルパス（/home/... など）
```
