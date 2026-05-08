# GitHub Branch Protection Runbook

状態: 運用手順書

SPECA 監査（2026-05-08）で、main ブランチへの直接 push 禁止が `AGENTS.md` のテキストポリシーのみであり、
GitHub の技術的な branch protection が未設定であることが確認された（SPECA finding: inv-015）。

本ドキュメントは、リポジトリ管理者が GitHub 管理画面で行う手動設定の手順を示す。
**この設定はコードの PR では変更できない。GitHub 管理画面での作業が必要。**

---

## 対象ブランチ

`main`

---

## 設定手順

### 1. Branch protection rule を開く

```
https://github.com/KitsuneSavaskiy/god-sandbox-mvp2/settings/branches
```

「Add branch protection rule」をクリックし、Branch name pattern に `main` を入力。

### 2. 必須設定項目

| 設定 | 値 | 理由 |
|---|---|---|
| Require a pull request before merging | ✅ 有効 | direct push 禁止 |
| Require approvals | 1 以上 | 独立レビュー必須（SPECA inv-007/pre-001） |
| Dismiss stale pull request approvals when new commits are pushed | ✅ 有効 | commit 追加後の approve 無効化 |
| Require status checks to pass before merging | ✅ 有効 | CI 通過必須 |
| Require branches to be up to date before merging | ✅ 有効 | 古い base での merge 禁止 |
| Allow force pushes | ❌ 無効 | force push 禁止 |
| Allow deletions | ❌ 無効 | main ブランチ削除禁止 |

### 3. Required status checks

以下のチェックを必須に設定する（PR 1 がマージされた後に有効化）：

- `build`（ci.yml のジョブ名）
- `gitleaks`（gitleaks.yml のジョブ名）

セキュリティ系 step が CI job の一部として含まれるため、`build` job が通ることで
git-boundary check と PR text check も必須になる。

### 4. Code Owners（任意、推奨）

`docs/security/` と `.github/workflows/` に対して CODEOWNERS を設定することで、
これらのパスへの変更時に特定レビュワーの承認を必須化できる。

```
# .github/CODEOWNERS
docs/security/      @<PO-username>
.github/workflows/  @<PO-username>
```

### 5. Require review from Code Owners

CODEOWNERS を設定した場合は「Require review from Code Owners」も有効にする。

---

## 設定完了の確認

設定後、以下を確認する：

- [ ] `main` ブランチに直接 `git push` しようとすると rejected される
- [ ] PR なしで commit が main に入らない
- [ ] CI（build job）が fail した PR が merge できない
- [ ] draft PR が force merge できない

---

## 関連 SPECA findings

| finding | 内容 | 本設定での解消 |
|---|---|---|
| inv-015 | main への direct push 禁止がテキストポリシーのみ | GitHub branch protection で技術的に禁止 |
| inv-007 | PR マージに独立 reviewer の audit record 必須 | Require approvals: 1 で必須化 |
| pre-001 | PR reviewer ≠ PR author | Require approvals で自己 approve を GitHub が拒否 |

**注:** branch protection は GitHub 管理画面の設定であり、
PR でのコード変更では実施できない。設定完了後に本ドキュメントに設定日時を記録すること。

---

## 設定記録

| 日付 | 設定者 | 備考 |
|---|---|---|
| （未設定） | — | 本 runbook は 2026-05-08 の SPECA 監査を受けて作成 |
