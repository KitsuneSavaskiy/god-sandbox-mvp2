# キャラクター詳細とasset bundle仕様

状態: 管理対象の正本ドキュメント

この文書は Sprint7 のキャラクター詳細画面、標準住民画像、使徒sprite sheet演出の方針を固定する。

## 中核方針

- 箱庭と `focusedEvent` を主役にする。
- キャラクター詳細は、event-first 主画面を補助する子画面であり、主状態を `focusedCharacter` へ戻さない。
- 詳細画面は「いまの出来事」と住民画面から開ける。
- 詳細画面は表示と確認のための面であり、介入ボタンを重複配置しない。
- 死亡、寿命、勲章は Sprint7 のキャラクター詳細では扱わない。
- lore が不足している項目は placeholder 表示に留め、画像の見た目から設定を断定しない。

## CharacterAssetBundle

`CharacterAssetBundle` は、UI がキャラクターの見た目素材を参照しやすくするための表示用まとまりである。

これは `Character` の正本データそのものではなく、asset registry と character profile から解決される参照束である。

```ts
interface CharacterAssetBundle {
  characterId: string;
  portrait?: AssetReference;
  icon?: AssetReference;
  spriteSheet?: SpriteSheetReference;
  expressions: Record<string, AssetReference>;
  placeholderReason?: string;
}

interface AssetReference {
  assetId: string;
  relativePath: string;
  alt: string;
}

interface SpriteSheetReference extends AssetReference {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  motions: Record<string, { row: number; frames: number }>;
}
```

ルール:

- `portrait` はプロフィール、会話、イベント、キャラクター詳細の主画像に使う。
- `icon` は住民サマリ、一覧、短い選択UIに使う。
- `spriteSheet` は箱庭内の小さい2Dキャラクター表示に使う。
- `expressions` は表情差分であり、`normal`、`joy`、`sad` などを必要な範囲で持つ。
- `CharacterAssetBundle` は不足素材を許容する。不足時は placeholder を出し、設定を勝手に補完しない。
- asset の正本参照は asset ID であり、file path は表示解決後の副次情報である。

## Sprint7標準住民画像

デフォルト4名の立ち絵は、Sprint7の標準住民画像として扱う。

mapping ルール:

| slot | asset bundle id | portrait asset id | 用途 |
| --- | --- | --- | --- |
| 0 | `standard-resident-01` | `standard-resident-01-portrait` | 初期 active slot 1 の標準住民 |
| 1 | `standard-resident-02` | `standard-resident-02-portrait` | 初期 active slot 2 の標準住民 |
| 2 | `standard-resident-03` | `standard-resident-03-portrait` | 初期 active slot 3 の標準住民 |
| 3 | `standard-resident-04` | `standard-resident-04-portrait` | 初期 active slot 4 の標準住民 |

ルール:

- `activeSlots[4]` は常に4名必須であり、標準住民画像も4名分を前提にする。
- 標準住民画像は立ち絵として登録する。
- default 4 character の `portrait` は上表の asset ID で参照する。
- `icon` は `<asset bundle id>-icon`、`spriteSheet` は `<asset bundle id>-sprite-sheet`、表情差分は `<asset bundle id>-expression-<emotion>` を推奨IDとする。
- `icon` は立ち絵から派生してよいが、派生方法が未実装なら placeholder を使う。
- `spriteSheet` と `expressions` は存在する場合だけ表示する。
- 画像から性格、出自、年齢、役職などの lore を断定しない。
- lore が未入力なら「未設定」「まだ分かっていません」などの placeholder を出す。

## キャラクター詳細画面

キャラクター詳細画面で参照できる項目:

- 立ち絵
- icon
- sprite sheet
- 表情差分
- 基本設定
- 現在の箱庭内での短い状態

表示ルール:

- 詳細画面は補助子画面として、メインの箱庭体験を覆い切らない。
- 「いまの出来事」から開く場合は、その event に関係する住民の確認として扱う。
- 住民画面から開く場合は、roster の確認として扱う。
- どちらの場合も、介入操作の主導線はイベント子画面側に置く。
- キャラクター詳細を開いても、`focusedEvent` は維持する。

## 使徒sprite sheet追従

使徒sprite sheetは、箱庭UIを案内する補助演出として使う。

Sprint7の必須方針:

- click-to-move を必須にする。
- プレイヤーが箱庭内をクリックした位置へ、使徒が小走りで追従する。
- hover追従は将来拡張とし、Sprint7の必須要件にはしない。
- 使徒演出はチュートリアル補助であり、キャラクター詳細や介入ロジックを置き換えない。

## 今回扱わないこと

- 死亡
- 寿命
- 勲章
- Passport schema変更
- 画像からの lore 自動推定
- 外部AIによるアプリ内自動生成
- hover追従の本実装
