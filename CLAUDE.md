# CLAUDE.md

GodSandbox の Claude 系エージェント向け共通運用メモです。

## 最重要ルール

- Claude は同じ PR で実装役と監査役を兼任しない。
- PBI が要求する場合は `Issue -> branch -> PR` の順で進める。
- エージェントは原則として自分の判断で approve / merge しない。
- PR 作成者は自分の PR を approve しない。
- PO が明示許可した監査役だけが、blocker なし・CI 成功・scope 確認済みのときに限り approve / merge してよい。
- 迷ったら `manual-review-required` を選ぶ。
- `AGENTS.md`、`CLAUDE.md`、commit する docs に、個人パス、secret、API key、token、ローカル環境名、個別アカウント設定を書かない。

## 参照ドキュメント

- `docs/product/godsandbox-user-flow.md`
- `docs/architecture/`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`

固定ルールはこのファイルに長文で再掲せず、各 PBI では今回差分だけを書く。

## AI 実装ルール（Runtime AI）

アーキテクチャ詳細は `docs/architecture/ai-architecture.md` を参照。

### 絶対ルール

- **AI はゲーム状態を直接変更しない**。`src/ai/` 内のコードは `RuntimeWorldState` を受け取っても更新しない。状態更新は `runtimeCommands.ts` 経由でアプリ層が行う。
- LLM が生成してよいのは**テキスト（台詞・説明文・タグ）のみ**。HP・信仰値・好感度の増減はゲームロジックが決定する。
- LLM 出力は必ず `src/ai/schemas/` のバリデーターを通してから UI や下流処理に渡す。
- スキーマ検証失敗時は fallback 台詞を返す（`RYO_FALLBACK_LINE` 参照）。
- `state_change_request` フィールドは常に `null`。スキーマで強制する。

### プロンプト管理

- プロンプトはコードに直書きしない。`src/ai/prompts/registry.ts` の `PromptId` で管理する。
- バージョンアップ時は既存 `v1` を残して `v2` を追加する（後方互換）。

### セキュリティ

- LLM に渡すコンテキストに**信仰値の生数値・スコア・五行内部値を含めない**。`faithBand`（文字列）に変換してから渡す。
- 出力ガード（`src/ai/security/output_guard.ts`）を全 LLM 出力に適用する。

### このファイルについて

CLAUDE.md は開発支援 AI へのコンテキスト提供であり、本番セキュリティ境界ではない。
本番ガードレール・スキーマ検証は `src/ai/security/` と `src/ai/schemas/` に実装する。
