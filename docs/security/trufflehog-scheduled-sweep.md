# TruffleHog 定期 secret sweep

この文書は、TruffleHog による定期または手動の secret 履歴スキャン運用をまとめます。

## 目的

Git 履歴に残った有効な secret 候補を検出します。
通常の PR ごとに全履歴を重く検証するのではなく、週次の定期実行と手動実行で確認します。

## ワークフロー

対象 workflow: `.github/workflows/trufflehog-scheduled-sweep.yml`

実行タイミング:

- `workflow_dispatch`: 必要な時に手動実行します。
- `schedule`: 週1回、月曜 00:00 JST に相当する `0 15 * * 0` で定期実行します。

この workflow は `pull_request` では動かしません。

## スキャン方針

workflow では、リポジトリ全履歴を checkout してから TruffleHog を実行します。
目的は次のコマンド相当です。

```sh
trufflehog git file://. --only-verified
```

`--only-verified` を使い、TruffleHog が検証できた secret 候補を主対象にします。
Docker image は `latest` を使わず、version tag と digest を固定します。

## ログに secret 実値を出さない

Actions ログには secret 実値を出しません。
workflow では、TruffleHog の JSON 出力を一時ファイルへ保存し、ログには中身を表示しません。
verified secret 候補が見つかった場合も、ログに出すのは件数と対応案内だけです。

## verified secret が出た時の対応

1. Actions ログや PR に secret 実値を貼らない。
2. まず該当サービス側で secret を失効またはローテーションする。
3. 必要な担当者だけで、安全なローカル環境で再現確認する。
4. 共有する場合は、secret 実値ではなく、検出種別、影響範囲、対応状況だけを書く。
5. 露出範囲を確認し、必要なら履歴 rewrite を別 PBI として判断する。
6. ローテーション後に workflow を再実行し、verified finding が消えたことを確認する。
