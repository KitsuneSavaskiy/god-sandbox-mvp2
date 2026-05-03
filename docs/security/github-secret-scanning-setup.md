# GitHub Secret Scanning / Push Protection 設定

## 目的

この文書は、`KitsuneSavaskiy/god-sandbox-mvp2` で GitHub 標準の Secret Scanning と Push Protection を確認・有効化・運用するための手順を整理したものです。

- GitHub の設定を勝手に変えず、PO または管理者が管理画面で確認できる状態を作る
- alert が出た後の運用を決める
- false positive と本物の secret leak を同じ手順で曖昧に扱わない

secret の実値、token 文字列、個人パス、API key 実値はこの文書に書きません。

## 前提

- 対象 repository: `KitsuneSavaskiy/god-sandbox-mvp2`
- 最終確認は GitHub 管理画面で行う

## まず確認すること

### 1. repository の公開設定

最初に、この repository が `public` か `private/internal` かを確認します。

- `public` repository:
  - Secret Scanning は GitHub.com 上で自動実行される無料範囲がある
  - Push Protection for users は GitHub.com で既定有効
  - repository 単位の Push Protection を有効にすると、bypass 時の alert を残せる
- `private` / `internal` repository:
  - GitHub Secret Protection の契約条件を先に確認する

### 2. 管理画面の場所

1. repository を開く
2. `Settings`
3. `Advanced Security` または `Security and analysis`
4. `Secret Protection` セクションを見る

ここで、次の項目を確認します。

- `Secret scanning` が有効か
- `Push protection` が有効か
- 必要なら `Validity checks` が有効か
- 必要なら `Extended metadata` が有効か

## PO / 管理者向けチェックリスト

- `Secret scanning` が有効になっている
- `Security and quality` タブから `Secret scanning` alert 一覧へ入れる
- `Push protection` が有効になっている
- bypass が発生したら誰が見るか決まっている
- false positive を close する際のコメント書式が決まっている
- 実 secret 検出時の revoke / rotate 担当が決まっている

## 誤検知の扱い

### 原則

誤検知かどうか分からない段階では、先に「本物の secret かもしれない」として扱います。

### 誤検知だった場合

- より誤検知されにくい placeholder へ置き換えられるなら先に置き換える
- alert を閉じる場合は `Close as` の理由を選び、コメント欄に根拠を残す
- コメントには実 secret を貼らず、根拠だけを書く

## secret 検出時の rotation 手順

1. 漏えいした secret を有効なものとして扱う
2. provider 側で revoke / rotate する
3. 利用サービスの設定を新 secret に差し替える
4. 不正利用ログを確認する
5. repository 上の該当箇所を削除または置換する
6. 必要なら履歴対策を別 PBI で判断する
7. GitHub 上の alert を手動で close する
