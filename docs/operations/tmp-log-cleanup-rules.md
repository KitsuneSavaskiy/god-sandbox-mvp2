# tmp確認ログと一時ファイルの扱い

## 目的

この文書は、Sprint中の確認で出る `tmp-*` ファイル、コマンドログ、一時HTML、ブラウザprofileを Git に混ぜないための運用ルールです。

実装Lineの作業を止めず、あとで監査できる記録だけを短く残すことを目的にします。

## 現在よく出る一時ファイル

既存の作業場所で、次の種類が確認されています。

| 種類 | 例 | 扱い |
| --- | --- | --- |
| コマンド標準出力ログ | `tmp-*-dev.out.log` | Git管理しない |
| コマンド標準エラーログ | `tmp-*-dev.err.log` | Git管理しない |
| ブラウザ確認HTML | `tmp-*-frame-390.html` | Git管理しない |
| 画面確認HTML | `tmp-sandbox-check-390.html` | Git管理しない |
| ブラウザprofile | `chrome-profile*/` | Git管理しない |
| runtime出力 | `.local/**` | Git管理しない |

これらは、ローカル確認の途中で使う一時物です。PRの成果物にはしません。

## .gitignore 方針

次のものは Git 差分に出ないようにします。

- repository root の `tmp-*`
- `*.tmp`
- `.local/`
- `chrome-profile*/`
- `browser-profile*/`
- `playwright-profile*/`
- `*.out.log`
- `*.err.log`

`.logs/` は丸ごと ignore しません。QA結果として人間が読む短い Markdown を残すことがあるためです。

## 確認ログを残す場合

残す必要がある場合は、一時ログそのものではなく、短く要約した Markdown を保存します。

推奨:

```text
.logs/<pbi-name>.md
```

書く内容:

- 対象PBI
- 対象branch / commit
- 確認した画面やコマンド
- 成功 / 失敗
- blocker / non-blocker
- 次に必要な判断

書かない内容:

- 個人PCの絶対パス
- secret / API key / token
- 長い標準出力全文
- 一時ブラウザprofileの中身
- localStorageやdebug stateの丸ごと貼り付け

## ブラウザ確認時のルール

ブラウザ確認のスクリーンショットやprofileは、原則としてOSの一時フォルダに置きます。

例:

```text
%TEMP%/godsandbox-*-screens-*
%TEMP%/godsandbox-*-chrome-*
```

PRに必要な場合でも、画像やHTMLをそのまま追加せず、`.logs/*.md` に確認結果だけを書きます。

## PR前チェック

PR前に次を確認します。

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
```

見ること:

- `tmp-*` が changed files に入っていない
- `*.out.log` / `*.err.log` が入っていない
- ブラウザprofile directoryが入っていない
- 残すべきQA記録は `.logs/*.md` に要約されている

## 判断

一時物は基本的に Git 管理しません。

必要な情報だけを、人間が読める短い記録にして残します。
