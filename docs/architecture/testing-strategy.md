# テスト戦略

状態: 管理対象の正本ドキュメント

この文書は `god-sandbox-mvp2` における最低限の重点テスト範囲を固定する。

## domain 単体テストの優先順位

最優先で押さえる domain unit test:

- event generation
- intervention apply
- roster replacement
- snapshot issuance

ルール:

- domain test は React なしで実行できるようにする。
- 重み付き event generation は deterministic な seed 入力で再現テストできるようにする。
- event 履歴からの relation 再計算は UI と独立に検証できるようにする。
- `ChangeSet` 適用では delta と post-apply snapshot の両方を検証する。

## UI 確認の優先順位

最優先で押さえる UI check:

- `390px` の event-first 導線
- `360px` の event-first 導線
- focused event の視認性
- desktop の複数 panel 挙動
- mobile の bottom sheet 挙動

ルール:

- sandbox の読みやすさは両幅で確認する。
- mobile でも event focus と intervention button を最前面に保つ。

## tutorial テスト

tutorial では次を分離して検証する。

- anchor 解決
- 自動 scroll 挙動
- 操作 lock 挙動
- step 遷移ロジック

ルール:

- tutorial test を巨大な統合 script 1本だけに依存させない。
- state machine の遷移は visual animation timing に依存せず確認できるようにする。

## passport テスト

- passport export には schema snapshot test を用意する。
- snapshot 入力の差分に応じて予測可能な export 差分が出ることを確認する。
- export filename に downstream matching 用の stable token が含まれることを確認する。

## persistence テスト

- save-version migration test を必須とする。
- chunk rollover 挙動をテストする。
- asset ID から relative path を引く解決処理をテストする。
- current-state projection の再構築をテストする。
