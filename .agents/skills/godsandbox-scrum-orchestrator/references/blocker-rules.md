# Blocker Rules

次がPRに入っていたら blocker として扱う。

## Asset / API

- OpenAI Images API key 必須。
- ゲーム本体から画像生成APIを呼び出す。
- API従量課金前提の文言。
- API key 設定 UI。
- asset生成失敗でゲーム本体が起動不能になる構造。

## Git / Privacy

- 個人ローカルパスのGit混入。
- secret、API key、token、private credential の混入。
- `incoming` / `tmp` / `rejected` / `user-uploads` 画像のGit混入。
- ユーザーアップロード素材、ユーザー固有portrait、ユーザー固有sprite、ユーザー固有expressionのGit混入。

## GodSandbox Product

- 箱庭上のキャラ名、場所、状態ラベル復活。
- 死亡、寿命、勲章の復活。
- `focusedCharacter` / `selectedCharacter` 中心への巻き戻し。
- Passport schema変更。

## Process

- PR本文に `参照したdocs` がない。
- PR本文に `今回のLine責務` がない。
- `Closes #...` がない。
- review commentへPR上で返信していない。
- main追従が必要なのに作業Line側で対応していない。
