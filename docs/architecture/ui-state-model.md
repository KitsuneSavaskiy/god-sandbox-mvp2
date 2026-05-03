# UI状態モデル

状態: 管理対象の正本ドキュメント

この文書は、主 UI state、route、panel 挙動、tutorial 連携ルールを定義する。

## UI の中核ルール

- main screen は sandbox である。
- 主な gameplay state は `focusedEvent` とする。
- `selectedCharacter` は主概念から外す。
- desktop では side panel を複数同時に開いてよい。
- mobile では desktop 型 side panel ではなく bottom sheet を使う。
- logs、relations、passports、roster は route 化された surface とする。
- tutorial anchor は loose な DOM 慣習ではなく screen state machine と結びつける。

## canonical route

推奨 route model:

```text
/sandbox
/roster
/relations
/logs
/passports
/passports/:passportId
/character-editor/:characterId
/character-editor/new
```

ルール:

- `/sandbox` がメインループを担う。
- route surface の内部では panel や sheet を使ってよい。
- route identity は deep link、reload 後の復元、tutorial state の整合に使う。

## sandbox UI 構成

desktop の基本形:

- player 情報、global action、navigation を置く top shell
- 中央の sandbox viewport
- event focus area
- intervention control
- roster、logs、relations、passport surface を複数開ける panel 構成

mobile の基本形:

- sandbox viewport を見た目の主役に保つ
- event focus と intervention control を最優先に置く
- 補助 surface は bottom sheet で開く

## UI state 形状

```ts
interface SandboxUiState {
  focusedEventId: string | null;
  openPanels: Array<"roster" | "relations" | "logs" | "passport">;
  mobileSheet?: "roster" | "relations" | "logs" | "passport" | null;
  tutorialStateId?: string | null;
  routePath: string;
}
```

ルール:

- `focusedEventId` は application layer の canonical current event を反映する。
- hydration 完了後は `focusedEventId` と `SandboxSession.currentEventId` が同じ event を指すようにする。
- desktop の panel state は加算的でよい。
- mobile の sheet state は1つに絞る。

## キャラクターライフサイクル UI ルール

- 初回4名設定と後続の character creation は同じ editor UI と同じ draft model を使う。
- 新キャラクターは active な4名をすぐ崩さずに `roster` へ保存できる。
- activeSlots の入れ替えは別操作として扱う。
- 既存キャラクターは再編集可能である。
- save 前に画像選択は必須である。
- personality vector、speech style、age は任意入力でよい。

## tutorial state machine ルール

- tutorial は state machine で管理する。
- anchor の有効判定は route と期待 UI state の両方に依存させる。
- DOM に要素が出ているだけでは step 完了にしない。

推奨 step binding 形状:

```ts
interface TutorialAnchorBinding {
  stepId: string;
  route: string;
  requiredUiState: Record<string, unknown>;
  anchorId: string;
}
```

ルール:

- step の進行判定では route、state、anchor presence をまとめて確認する。
- scroll、lock、highlight のロジックは個別にテスト可能にする。
- 新キャラクター追加時の第2 tutorial は初回だけ必須とする。

## event-first の見せ方ルール

- event panel はプレイヤーを `見守る`、`助ける`、`試練` へ自然に導く。
- 複数参加イベントでは主役と脇役を見分けられるようにする。
- story log と relation view は補助 surface であり、main sandbox focus ではない。
- プレイヤーが介入を求められる前に、今の event が何かを理解できる必要がある。
