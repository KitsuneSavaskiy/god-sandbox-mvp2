# `god-sandbox-mvp2` の Line 別責務

正本参照:

- `docs/product/godsandbox-user-flow.md`
- `docs/product/godsandbox-user-flow.drawio`
- `docs/architecture/system-spec.md`
- `docs/architecture/event-and-intervention-spec.md`
- `docs/architecture/snapshot-passport-spec.md`
- `docs/architecture/local-persistence-spec.md`
- `docs/architecture/ui-state-model.md`

この文書は新 repository における初期の実装責務境界を定義する。
完成版ユーザーフローを縦に切りつつ、PR の混線を減らすことを目的とする。

## 全 Line 共通の PR 運用

- PR 本文に、参照した docs と担当 Line 責務を必ず書く。
- review comment が付いた場合は GitHub PR 上で返信し、必要な修正 commit を push する。
- rebase または main 追従が必要な場合は、作業 Line 側で対応し、結果を PR comment に残す。
- Codex 監査役へ毎回 rebase を依頼しない。

## Line 1: App Platform / Shell / Auth

作業前に必ず読む docs:

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`

担当:

- ログインとログアウト導線
- アプリ起動処理
- ルーティング
- グローバルレイアウト
- 上部メニューと shell ナビゲーション
- modal、drawer、panel の基盤
- レスポンシブ viewport 挙動
- 共通 UI プリミティブ
- 各 feature slice を載せる sandbox 画面の枠組み

主ディレクトリ:

- `src/app/**`
- `src/routes/**`
- `src/ui/**`
- `src/platform/**`

意味を決めないもの:

- イベント生成ルール
- キャラクター作成仕様
- passport 発行仕様
- gameplay 意味、domain 仕様、event 生成ルール

PR 本文に書く責務確認:

- Line 1 責務内の app shell / route / 共通 UI の器の変更であること。
- gameplay 意味、domain 仕様、event 生成ルールを決めていないこと。

## Line 2: Core Runtime / Domain / Persistence

作業前に必ず読む docs:

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/architecture/system-spec.md`
- `docs/architecture/event-and-intervention-spec.md`

担当:

- `Character`、`SandboxSession`、`WorldEvent`、`Intervention`、`CharacterSnapshot`、`CharacterPassport` の正本モデル
- `roster` と active な4名の分離
- イベント状態と介入適用
- キャラクター変化計算
- save / load 挙動
- seed data とデフォルト session bootstrap
- 正本フローに結びつく短い architecture decision record

主ディレクトリ:

- `src/domain/**`
- `src/state/**`
- `src/persistence/**`
- `docs/adr/**`

意味を決めないもの:

- 画面レイアウト
- tutorial 演出
- character creator UI 体験

PR 本文に書く責務確認:

- Line 2 責務内の正本モデル、runtime、persistence、balance rule の変更であること。
- UI 表示や tutorial 文言を同じ PR に混ぜていないこと。
- 30分 / 10イベント / god point 回復などの正本ルール変更では domain test 結果を書くこと。

## Line 3: Character Lifecycle / Roster / Passport

作業前に必ず読む docs:

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/architecture/character-detail-asset-spec.md`
- `docs/architecture/snapshot-passport-spec.md`

担当:

- 初回 tutorial 後のキャラクター設定
- デフォルト4名の template 選択と編集
- キャラクター作成 UI と再編集 UI
- 初回設定と後続追加で共通の editor フロー
- active な4名の選択
- 新キャラクター追加後の遅延入れ替え導線
- snapshot 記録 UI
- Character Passport 発行 UI
- 外部ゲームへの持ち出し UI

主ディレクトリ:

- `src/features/character-creator/**`
- `src/features/roster/**`
- `src/features/snapshot/**`
- `src/features/passport/**`
- `src/features/external-handoff/**`

意味を決めないもの:

- メインイベントループの意味
- app shell の挙動
- 導入 tutorial 全体の進行管理

PR 本文に書く責務確認:

- Line 3 責務内の CharacterDetail / Roster / Snapshot / Passport 導線の変更であること。
- `focusedEvent` を壊していないこと。
- Passport schema を明示許可なしに変更していないこと。

## Line 4: Event Experience / Tutorial / Narrative

作業前に必ず読む docs:

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/architecture/ui-state-model.md`
- `docs/architecture/event-and-intervention-spec.md`

担当:

- 導入 tutorial
- イベント発生の見せ方
- イベントフォーカス UI
- `focusedEvent` 中心の sandbox 体験設計
- `見守る`、`助ける`、`試練` の介入 UI
- 介入後の結果表示
- 物語ログ表示
- 複数参加イベントの文言と見せ方
- 新キャラクター追加時の第2 tutorial
- ハイライト、scroll lock、ガイド演出

主ディレクトリ:

- `src/features/events/**`
- `src/features/tutorial/**`
- `src/features/story/**`

意味を決めないもの:

- 正本の保存状態
- character creator のフォーム仕様
- アプリ全体の platform 設定

PR 本文に書く責務確認:

- Line 4 責務内の event-first UI、tutorial、物語ログ、イベント体験の変更であること。
- `focusedCharacter` / `selectedCharacter` 中心へ戻していないこと。
- 箱庭上にキャラ名、場所、状態ラベルを戻していないこと。
- UI 変更では 390px / 360px の確認結果、または未実施理由を書くこと。

## 境界ルール

- Line 1 は器を持ち、ゲームプレイの意味は持たない。
- Line 2 は正本の product state と data contract を定義する。
- Line 3 はキャラクターの設定、入れ替え、持ち出しまでのライフサイクルを持つ。
- Line 4 は onboarding から反復介入までのイベント体験を持つ。
- 他 Line 領域に触れる必要がある場合も、接続に必要な最小変更に留め、その PR で責務定義自体を書き換えない。

## 推奨実装順

1. Line 2 が runtime model と session state の正本を固める。
2. Line 1 が shell 構造と接続点を整える。
3. Line 4 が event-first の onboarding とイベント体験を整える。
4. Line 3 が初回設定、入れ替え、snapshot、passport 導線を整える。

## 監査観点

- active な4名と `roster` が明確に分離されているか
- イベントフォーカスが UI と state の両方で第一級になっているか
- snapshot と passport が別ステップのまま保たれているか
- 新キャラクター追加で `roster` には即時追加しつつ、active な4名の入れ替えは遅延できるか
- Line ごとの責務が混ざりすぎず、PR scope が明確に保たれているか
