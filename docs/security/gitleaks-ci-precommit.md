# gitleaks CI / ローカル pre-commit ガイド

この文書は、GodSandbox に secret / token / API key を混入させないための最小運用です。
検出結果を共有する時も、secret の実値は PR 本文、Issue、docs、チャットに貼らないでください。

## CI で確認すること

`.github/workflows/gitleaks.yml` で、pull request と `main` への push 時に gitleaks を実行します。
CI では pinned version の gitleaks CLI を GitHub Releases から取得し、checksum を確認してから実行します。
検出結果に secret らしき値を残しにくくするため、CI では `--redact` を付けます。

CI が失敗した場合は、次の順で対応します。

1. GitHub のログを開く。
2. 検出箇所を確認する。
3. secret の実値を PR 本文やコメントに貼らず、該当ファイルから削除する。
4. 実値が本物の credential だった可能性がある場合は、無効化・再発行が必要なものとして扱う。
5. 過去履歴に入っていた場合は、この PR では履歴 rewrite をしない。別の security follow-up として判断する。

## ローカルで staged changes を確認する

PR 前には、commit 予定の差分だけを先に確認します。

```powershell
git add <変更ファイル>
gitleaks protect --staged --verbose --redact
```

## pre-commit framework を使う場合

`pre-commit` を使う環境では、次で hook を有効化できます。

```powershell
pre-commit install
```

この repo の `.pre-commit-config.yaml` は、local hook として次を実行します。

```powershell
gitleaks protect --staged --verbose --redact
```

## pre-commit を使わない場合

framework を使わない場合も、PR 前に手動で同じ確認を実行します。

```powershell
git add <変更ファイル>
gitleaks protect --staged --verbose --redact
```

現在の作業ツリーだけを見る場合は次も使えます。

```powershell
gitleaks detect --source . --no-git --redact
```

## 誤検知の扱い

- 実値っぽい文字列は、可能なら明らかな placeholder に置き換える。
- PR コメントには secret 値を貼らない。
- allowlist や ignore で抑制したい場合は、別途 security review 付きの follow-up PBI として扱う。

## `.env` の扱い

`.gitignore` では `.env` と `.env.*` を Git 管理しない方針です。
共有してよいのは、実値を含まない `.env.example` だけです。

`.env.example` にも API key、token、password、個人 PC の絶対パスを書かないでください。
