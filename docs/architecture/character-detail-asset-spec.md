# キャラクター詳細とasset bundle仕様

状態: 管理対象の正本ドキュメント

この文書は Sprint7 以降のキャラクター詳細画面、標準住民画像、住民sprite sheet、使徒sprite sheet演出の方針を固定する。

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
  extendedSheet?: SpriteSheetReference;
  expressions: Partial<Record<CharacterExpressionKey, AssetReference>>;
  placeholderReason?: string;
}

type CharacterExpressionKey = "neutral" | "happy" | "angry" | "sad" | "surprised";

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
  motions: Record<ResidentSpriteMotionKey, { row: number; frames: number }>;
}

type ResidentSpriteMotionKey =
  | "idle"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review"
  | "walk-up"
  | "walk-down"
  | "walk-left"
  | "walk-right"
  | "walk-forward"
  | "walk-back"
  | "emote-happy"
  | "emote-angry"
  | "emote-sad"
  | "emote-surprised";
```

ルール:

- `portrait` はプロフィール、会話、イベント、キャラクター詳細の主画像に使う。
- `icon` は住民サマリ、一覧、短い選択UIに使う。
- `spriteSheet` は Sheet 1 の箱庭アニメ素材に使う。
- `extendedSheet` は Sheet 2 の方向移動 / emote 素材に使う。
- 住民sprite sheetのframeは `192x208` を基本にする。
- 住民sprite sheetは2枚構成（Sheet 1: motion-sheet、Sheet 2: extended-sheet）。
- Sheet 1のmotion keyは `idle`、`walk-right`、`walk-left`、`waving`、`jumping`、`failed`、`waiting`、`running`、`review`。
- Sheet 2のmotion keyは `walk-up`、`walk-down`、`walk-forward`、`walk-back`、`emote-happy`、`emote-angry`、`emote-sad`、`emote-surprised`。
- 住民sprite sheetは未生成でも参照枠を持ってよい。未生成時は `isPlaceholder: true` とし、`portrait` または `icon` へ fallback する。
- sprite sheetの実画像がない状態で、立ち絵を縮小して本物のsprite sheetとして扱わない。
- 住民sprite sheetは、立ち絵の雰囲気を保ったドット絵風の小さい箱庭キャラとして生成する。
- 住民sprite sheetは、2.5Dペーパークラフト背景の上で動いて見えることを優先する。
- アプリ内からCodex petや外部AI APIを直接呼ばない。生成は外部補助で行い、結果PNGを決められた保存先へ置く。
- MVPのasset pipelineは、ChatGPTなどのサブスク画面で生成した画像をローカルで検査し、採用済みPNGだけをmanifestへ登録する方式を基本にする。
- GodSandbox本体は、API key入力UI、従量課金の画像生成API、外部AIへの自動送信を必須にしない。
- Codexやローカルscriptは、採用前画像の検査、切り出し確認、manifest登録補助に使ってよい。ただし、未検査画像を本物のsprite sheetとして扱わない。
- 住民sprite sheetの正本manifestは `src/persistence/defaultCharacterAssetManifest.ts` とし、motion sheet と extended sheet を別assetとして持つ。
- `src/persistence/defaultResidentSpriteManifest.ts` は旧互換の橋渡しであり、2-sheet ready 判定の正本にしない。
- ローカル作業用の `manifests/residents.json` は Git 管理外のplaceholderであり、正本manifestとしてcommitしない。
- `ready` は、motion sheet と extended sheet の両方が検査済みで、`publicPath` から読める時だけに使う。
- `incoming`、`tmp`、`rejected`、`user-uploads` を含むpathは、manifestに載っていてもready assetとして扱わない。
- manifestが存在しない、または該当residentのentryがない場合でも、既存のdefault asset manifestから `portrait` または `icon` fallbackで起動できる状態を保つ。
- `expressions` の正本キーは `neutral | happy | angry | sad | surprised` に統一する。
- `neutral` は必須とし、添付元画像、または最初に登録された基準画像の表情を保つ。
- `happy`、`angry`、`sad`、`surprised` は未生成でもよい。未生成の表情は `neutral` を fallback 表示する。
- 未生成表情を fallback 表示する場合、UI向けの解決結果では `isPlaceholder: true` とし、必要に応じて `missingReason` を持たせる。
- `missingReason` は `not-generated-yet` または `asset-not-registered` を想定する。
- 表情差分生成用promptは `.prompts/character-expressions/` に保存する。
- `CharacterAssetBundle` は不足素材を許容する。不足時は placeholder を出し、設定を勝手に補完しない。
- asset の正本参照は asset ID であり、file path は表示解決後の副次情報である。

## Resident sprite manifest

Resident sprite manifest は、旧運用の motion-sheet 情報を asset manifest へ橋渡しするための互換レイヤーである。

このmanifestを 2-sheet ready 判定の正本として使わない。
GodSandbox本体が参照する採用状態は、`src/persistence/defaultCharacterAssetManifest.ts` と
`src/application/characterAssetBundles.ts` の read model 側でそろえる。

`manifests/residents.json` はローカル作業用placeholderであり、`.gitignore` 対象としてGit管理しない。

schemaの要点:

```ts
type ResidentSpriteAssetStatus = "ready" | "placeholder" | "rejected" | "missing";

interface ResidentSpriteManifest {
  schemaVersion: "resident-sprite-manifest-v1";
  updatedAt: string;
  residents: Array<{
    residentId: string;
    spriteSheet: {
      assetId: string;
      status: ResidentSpriteAssetStatus;
      sourcePath?: string;
      publicPath?: string;
      frameSize: { width: number; height: number };
      columns: number;
      rows: number;
      fallbackAssetId?: string;
      missingReason?: string;
      motions: Record<ResidentSpriteMotionKey, { row: number; frames: number }>;
    };
  }>;
}
```

`sourcePath` は `assets/residents/<id>/sprites/` 側の採用元を示す。
`publicPath` はブラウザから読める配信用pathを示す。
root `assets/` がブラウザ配信できない場合でも、UIは `publicPath` だけを見ればよい。

## 説明sourceとplaceholder

キャラクター詳細の説明文は、画像から勝手に公式設定を確定しないため、source を分けて扱う。

source の分類:

- `user-input`: ユーザーが入力または確認した説明。公式設定として扱ってよい。
- `generated-recognition`: 画像や生成物から得たAI認識メモ。公式 lore ではなく、ユーザー確認待ちの補助メモとして扱う。
- `placeholder`: まだ分からない項目。UIでは「未設定」「まだ分かっていません」などの仮表示に留める。

表示ルール:

- `generated-recognition` は、キャラクターの職業、出自、年齢、関係性を断定する根拠にしない。
- `generated-recognition` を表示する場合は、ユーザー確認が必要な情報として扱う。
- `isPlaceholder` は、表示値が仮置きかどうかを示す。
- `missingReason` は、素材や表情差分が未生成なのか、登録漏れなのかを区別するために使う。

## Sprint7標準住民画像

デフォルト4名の立ち絵は、Sprint7の標準住民画像として扱う。

mapping ルール:

| slot | character | asset bundle id | portrait asset id | 用途 |
| --- | --- | --- | --- |
| 0 | Eve | `eve` | `eve-portrait-neutral` | 初期 active slot 1 の標準住民 |
| 1 | Garan | `garan` | `garan-portrait-neutral` | 初期 active slot 2 の標準住民 |
| 2 | Ryo | `ryo` | `ryo-portrait-neutral` | 初期 active slot 3 の標準住民 |
| 3 | Suzu | `suzu` | `suzu-portrait-neutral` | 初期 active slot 4 の標準住民 |

ルール:

- `activeSlots[4]` は常に4名必須であり、標準住民画像も4名分を前提にする。
- 標準住民画像は立ち絵として登録する。
- default 4 character の `portrait` は上表の asset ID で参照する。
- `icon` は `<asset bundle id>-icon`、`spriteSheet` は `<asset bundle id>-sprite-sheet`、表情差分は `<asset bundle id>-expression-<emotion>` を推奨IDとする。
- 表情差分の `<emotion>` は `neutral`、`happy`、`angry`、`sad`、`surprised` のいずれかにする。
- `icon` は立ち絵から派生してよいが、派生方法が未実装なら placeholder を使う。
- `spriteSheet` は `<asset bundle id>-sprite-sheet` の参照枠を持つ。実画像未生成なら `portrait` または `icon` fallback を表示し、sprite sheet本体として扱わない。
- `spriteSheet` のmotion keyは `ResidentSpriteMotionKey` にそろえる。未生成motionは placeholder として扱い、生成済みPNGが入るまで本物のmotionとして扱わない。
- `expressions` は存在する場合だけ表示し、不足分は `neutral` fallback にする。
- 画像から性格、出自、年齢、役職などの lore を断定しない。
- lore が未入力なら「未設定」「まだ分かっていません」などの placeholder を出す。
- 生成直後のincoming画像、作業中tmp画像、rejected画像はGit管理しない。Git管理するのはprompt、採用済みmanifest、採用済みsprite sheetだけにする。

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
