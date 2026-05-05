# PR監査チェックリスト

## 正本

- GitHub PR diff
- changed files
- PR本文
- 対応Issue
- CI
- label
- review comments

ローカルdirty treeは監査判断に混ぜない。

## 監査順

1. PR本文に `参照したdocs` と `今回のLine責務` があるか。
2. `Closes #...` があるか。
3. changed files がPBI scopeとLine責務内か。
4. package / CI / Passport schema / secret / protected path に無許可変更がないか。
5. `git diff --check`、typecheck、build、必要なtestが通っているか。
6. GitHub checks が最新commitでgreenか。
7. review commentへPR上で返信済みか。
8. rebase/main追従が必要なら作業Line側で対応済みか。
9. `blocker-rules.md` に該当しないか。

## 出力

- blocker
- non-blocker
- follow-up

問題なければ「問題なし、承認・merge可能」と明記する。
