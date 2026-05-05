# Asset Pipeline Guardrails

## 正本名称

APIキー不要・従量課金なしのサブスク前提ローカルasset pipeline。

## 基本方針

- 画像生成は原則、プレイヤーまたは開発者が別ブラウザのChatGPTなどで行う。
- GodSandbox本体は画像生成処理を呼ばない。
- Codexはprompt作成、保存先整理、検査、切り出し、manifest登録を支援する。
- ゲームはmanifest / read modelだけを見る。

## Git管理

- `.prompts/**`: 管理する。
- 採用済みdefault / official asset: 管理する。
- manifest: 管理する。
- user uploaded asset: 管理しない。
- `incoming` / `tmp` / `rejected` / `user-uploads`: 管理しない。

## 禁止

- OpenAI Images API key必須。
- API従量課金前提。
- API key入力UI。
- gameplay中のリアルタイム画像生成。
- asset生成失敗でゲーム本体が起動不能になる構造。
