# Line別作業指示テンプレート

```md
# <PBI名> 作業指示

## 対象Line

Line <1|2|3|4>: <責務名>

## 対象PBI

`<PBI-ID>`

## 目的

<ユーザー体験と実装上の目的を1〜3行で書く>

## Required before work

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- <今回PBIに関係するdocs>

## 変更してよいファイル

- `<path>`

## やること

- <具体作業>

## 受け入れ条件

- <Done条件>

## 禁止

- <scope外>
- <GodSandbox常時ガードに反するもの>

## 確認コマンド

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

## 報告フォーマット

- 参照したdocs
- 今回のLine責務
- branch / commit / PR
- changed files
- 実施内容
- やらなかったこと
- 確認結果
- review comment対応
- main追従結果

## 他Lineへの影響

- <依存、待ち、後続>

## conflictしそうなファイル

- `<path>`
```
