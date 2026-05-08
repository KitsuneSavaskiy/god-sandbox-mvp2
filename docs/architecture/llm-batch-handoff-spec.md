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

**Raw Passport JSON（内部保存・未送信）**

Raw Passport JSON はシステム内部に保存される記録であり、外部 AI へは送信しない。
`currentFaith`（数値）を含んでいてよい。

**外部 AI プロンプトテキスト（`externalAiPromptBlock`）**

Raw Passport JSON から外部 AI へ渡すテキストを構築する際に含めてよい情報：
- キャラクター名・性格要約
- 話し方（口調・禁止事項）
- 箱庭での出来事の自然言語要約（数値なし）
- 神との関係の段階（`faithBand` のみ、`currentFaith` 数値は含めない）
- 発話例

外部 AI プロンプトテキストに含めてはならない情報：
- 陰陽五行の内部値（`wood`, `fire`, `earth`, `metal`, `water`, `yin`, `yang`）
- 信仰度の数値（`currentFaith`）— `faithBand` + `interpretationOfGod` のみ使用する
- ユーザーのアカウント情報
- GodSandbox 固有の計算パラメータ

> **注意**: ユーザーが確認画面で Raw Passport JSON をコピーして直接外部 AI に貼り付けた場合は、`currentFaith` 数値も外部に渡ることになる。これはユーザーの意図的な操作であり、このドキュメントの制約（システムが自動送信しないこと）は満たされているが、ユーザーへの説明文に含めることを推奨する。

### Execution Job（Sprite Sheet 生成）

制約：
- **1 character / 1 style anchor / 1 sprite sheet job を最小単位にする**
- 同一スレッド内で複数の sprite sheet を並列生成してはならない（`preserveThreadIsolation: true`）
- 実行順序: serial（`concurrency: serial`）
- 品質優先: `qualityPriority: "highest"`
- 生成結果は `incoming/` → `candidate` に入る。review 前に `ready/adopted` にしない

### Dialogue Candidate Generation（発話候補生成）

> **注意: 分類の前提**
> A. ゲーム本体は外部 LLM API を直接呼ばない（本仕様書 §1 の不変条件）。これは B・C の両ケースで成立する。
> B. PO 確認でも LLM を使わない場合: `authored_fixture` モードのみ。LLM 品質の判断はできない。
> C. PO 確認で外部 LLM を使う場合: `external_llm_handoff` モード。以下のフローを使う。

**`authored_fixture` モード（B）:**
- 人手で書いた発話 fixture をそのまま候補とする
- `DialogueCandidate { source: "authored_fixture", reviewStatus: "accepted" }` として扱ってよい
- UI・頻度・Type A/B/C 境界・doNotSay フィルタの確認に使う
- LLM がその子らしい発話を作れるかはこのモードで判断できない

**`external_llm_handoff` モード（C）:**
- `buildDialogueWorldDigest(session)` が `DialogueWorldDigest` を返す
- `buildDialoguePromptPack(digest)` が外部 LLM へ渡すフォーマット済みテキストを返す
- PO または Codex Sidekick が手動で外部 LLM（ChatGPT / Codex / Codex App Server 等）へコピーし、発話候補テキストを受け取る
- 受け取った候補は `DialogueCandidate { source: "external_llm_handoff", reviewStatus: "needs_review" }` で保存する
- PO レビュー（`observed-dialogue-spec.md §9` の 7 点基準）後に `"accepted"` へ昇格させる
- `"needs_review"` 状態の候補を player-facing UI に出してはならない
- `WorldEvent / ChangeSet / InterventionResult / Passport` を候補が上書きしてはならない
- `validateGeneratedNarrativeCandidate()` で death / lifespan / medals の混入を検査する

`DialogueWorldDigest` に含めてよい情報:
- キャラクター名・`faithBand`・status 数値・voiceProfile 要約
- relation スコア（参照のみ。スコアを発話テキストに埋め込んではならない）
- 直近イベントの自然言語要約（数値なし）
- world context tag

`DialogueWorldDigest` に含めてはならない情報:
- 陰陽五行の内部値（`wood`, `fire`, `earth` 等）
- ユーザーのアカウント情報
- `currentFaith` 数値（`faithBand` を使用する）

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
5. Five-phase values, yin-yang internal values, and currentFaith numeric values MUST NOT appear in the external AI prompt text (externalAiPromptBlock); use faithBand and interpretationOfGod instead
6. Sprite sheet generation jobs MUST preserve thread isolation and MUST NOT batch multiple sprite sheets into one generation thread
7. Generated LLM or image result MUST enter incoming/candidate/needs_review and MUST NOT be treated as adopted/ready
8. LLM result MUST NOT overwrite official narrative, asset, character profile, snapshot, passport, WorldEvent, or ChangeSet before user review
9. Narrative LLM output MUST NOT be the canonical source of gameplay state
10. LLM batch audit log SHOULD store metadata only by default: batch id, purpose, source ids, counts, hashes, timestamps; not raw character content

---

## 5. 外部 AI プロンプトテキスト 禁止事項

`externalAiPromptBlock`（外部 AI へのプロンプトテキスト）に含めてはならない情報：

```
✗ 陰陽五行の内部値（wood: 0.42 など）
✗ 信仰度の数値（currentFaith: 58 など）— faithBand + interpretationOfGod のみ使用
✗ ユーザーのアカウント情報
✗ GodSandbox 固有の計算パラメータ
✗ API キー・トークン・シークレット
✗ ローカルファイルパス（/home/... など）
```

Raw Passport JSON（内部保存）は上記の値を含んでいてよい。
外部 AI へ送信するプロンプトテキストを構築するときにのみ上記制約が適用される。
