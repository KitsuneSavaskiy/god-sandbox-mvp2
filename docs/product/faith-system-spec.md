# 信仰度（Faith）仕様書

状態: 管理対象の正本ドキュメント

この文書は GodSandbox の信仰度システムを固定する。
実装前に `docs/product/core-experience-spec.md` を必ず読むこと。

---

## 1. 定義

> 信仰度（faith）は、キャラクターが「箱庭の外側にいる神」の存在をどの程度信じ、介入や兆しをどの程度「神から届いたもの」として解釈するかを表す値（0〜100）である。

信仰度は好感度ではない。以下の3概念は分離する：

| 概念 | 定義 | MVP での扱い |
|---|---|---|
| 信仰度（faith） | 神の実在確信度 | 正本パラメータとして実装 |
| 好感度（affection） | 神への好意・安心感 | MVP では発話表現のみ、数値なし |
| 畏れ（awe） | 神への緊張・敬い | MVP では personality との掛け合わせのみ |

---

## 2. 初期値とデータモデル

### 初期値

- 全キャラクター共通：`30`
- 意味：神の概念は知っているが、実在は半信半疑の開始状態

### CharacterStatusBlock への追加

既存の `CharacterStatusBlock` に `faith` フィールドを追加する：

```ts
type CharacterStatusBlock = {
  vitality: number;      // 0-100
  empathy: number;       // 0-100
  insight: number;       // 0-100
  courage: number;       // 0-100
  stress: number;        // 0-100
  trustfulness: number;  // 0-100
  ambition: number;      // 0-100
  harmony: number;       // 0-100
  faith: number;         // 0-100 ← 追加
  [key: string]: number;
};
```

### 信仰度バンド（faithBand）

数値を5段階の記述的バンドに変換する。Passport JSON にはバンド名も含める。

| 数値範囲 | faithBand | 意味 |
|---|---|---|
| 0〜19 | `disbelieves` | 神の存在を信じない |
| 20〜39 | `uncertain` | 半信半疑 |
| 40〜59 | `senses_presence` | 気配は感じている |
| 60〜79 | `believes` | 神の存在をかなり信じている |
| 80〜100 | `devoted` | 確信・献身 |

```ts
type FaithBand =
  | "disbelieves"
  | "uncertain"
  | "senses_presence"
  | "believes"
  | "devoted";

function resolveFaithBand(faith: number): FaithBand {
  if (faith < 20) return "disbelieves";
  if (faith < 40) return "uncertain";
  if (faith < 60) return "senses_presence";
  if (faith < 80) return "believes";
  return "devoted";
}
```

---

## 3. 信仰度変化ルール

### 変化要因と変化幅

| 介入種類 | 条件 | faith 変化 |
|---|---|---|
| help | 成功（キャラが助けられたと感じた） | +4 |
| help | 失敗（助けが届かなかった） | -2 |
| watch | 成功（見守りが信頼として解釈された） | +2 |
| watch | 失敗（放置として解釈された） | -1 |
| trial | 乗り越えた（意味を見出した） | +5 |
| trial | 失敗（理不尽と感じた） | -4 |

`player_memo_bonus` / `player_memo_penalty` はスタンドアロンの介入トリガーではなく、
`applyFaithChangeWithPersonality` 内部で playerMemo 一貫性チェック後に呼ばれる補正専用トリガーである。
- `player_memo_bonus` → +1（基本 delta を上向き補正）
- `player_memo_penalty` → -1（基本 delta を下向き補正）
これらを `applyFaithChange` 単体に渡した場合は ±1 を返す。
通常の介入フローでは `applyFaithChangeWithPersonality` が上位関数として呼ばれ、これらのトリガーを内部的に使用する。

### playerMemo 補正

介入時に `playerMemo` または `playerReason` が設定されており、かつその内容が前回介入と方向性が一貫している場合、補正を適用する。

**補正方向（常に「信仰度をより上向きに」）：**
- 正の delta のとき：delta に +1 する（例: +4 → +5）
- 負の delta のとき：delta に +1 する（減少を和らげる。例: -4 → -3）

矛盾するメモが続く場合は -1 補正（例: +4 → +3、-4 → -5）。

補正は 2 回目以降の介入から適用する（1 回目は比較対象がないため補正なし）。

**一貫性キーワード判定（MVP）：**

| 方向 | キーワード例 |
|---|---|
| 「見守る・信頼する」方向 | `見守`, `信頼`, `応援`, `そばにいる`, `待つ` |
| 「助ける・介入する」方向 | `助け`, `救`, `支え`, `守る`, `一緒に` |
| 「試練・成長」方向 | `試練`, `乗り越え`, `成長`, `強く`, `鍛える` |

前回と今回のメモが同じキーワードグループに属していれば「一貫」と判定する。
異なるグループや真逆の内容（例：前回「見守る」→今回「試練」）は「矛盾」と判定する。
将来的に AI による意図解析に置き換え可能。

### 変化の適用

- `faith` は 0 以下にならない（下限 0）
- `faith` は 100 以上にならない（上限 100）
- 変化は `ChangeSet` として記録する

**実装関数シグネチャ：**

```ts
type FaithChangeTrigger =
  | "watch_success" | "watch_failure"
  | "help_success"  | "help_failure"
  | "trial_success" | "trial_failure"
  | "player_memo_bonus" | "player_memo_penalty";

type MemoGroup = "watch_trust" | "help_rescue" | "trial_growth";

// trigger に対応する delta（変化量）のみを返す。clamp・personality修正・playerMemo補正なし。
function resolveFaithDelta(trigger: FaithChangeTrigger): number;

// currentFaith に trigger を適用した後の新しい faith 値（0〜100 clamped）を返す。
// personality 修正なし、playerMemo 補正なし。
function applyFaithChange(currentFaith: number, trigger: FaithChangeTrigger): number;

// personality 修正と playerMemo 補正を含む実際の適用関数。新しい faith 値（0〜100 clamped）を返す。
function applyFaithChangeWithPersonality(
  character: Character,
  trigger: FaithChangeTrigger,
  currentMemoGroup?: MemoGroup | null,   // 今回 playerMemo のキーワードグループ
  previousMemoGroup?: MemoGroup | null   // 前回 playerMemo のキーワードグループ（補正判定用）
): number;
```

```ts
type FaithChangeRecord = {
  characterId: CharacterId;
  previousFaith: number;
  newFaith: number;
  delta: number;
  trigger: "watch_success" | "watch_failure" | "help_success" | "help_failure"
         | "trial_success" | "trial_failure" | "player_memo_bonus" | "player_memo_penalty";
  interventionId: string;
};
```

### personality による修正

同じ介入でも、personality vector によって解釈が変わる。
以下のケースでは変化幅を 50% 増減する（乗算後に整数丸め）：

| personality 軸 | 条件 | 修正 |
|---|---|---|
| `sensitivity` ≥ 70 | watch success | faith 変化 ×1.5（気配に敏感）|
| `boldness` ≥ 70 | trial failure | faith 減少 ×0.5（強い子は折れにくい）|
| `curiosity` ≥ 70 | help failure | faith 減少 ×0.7（興味に向けて解釈する）|
| `discipline` ≥ 70 | trial success | faith 変化 ×1.5（試練に意味を見出す）|

**整数丸めルール：** 修正適用後の delta を `Math.trunc`（ゼロ方向への切り捨て）する。
負の delta でも減少量が大きくなりすぎないためこのルールを採用する。

```
例（正）: 2 × 1.5 = 3.0 → Math.trunc(3.0)   = 3
例（正）: 5 × 1.5 = 7.5 → Math.trunc(7.5)   = 7
例（負）: -2 × 0.7 = -1.4 → Math.trunc(-1.4) = -1（減少量は1）
例（負）: -4 × 0.5 = -2.0 → Math.trunc(-2.0) = -2（減少量は2）
```

複数の personality 修正が同時に適用される場合は乗算してから1回 `Math.trunc` する。
例: sensitivity ≥ 70 かつ discipline が同時に trial_success に適用されない（sensitivity は watch_success のみ）ので現状は重複しない。

---

## 4. 信仰度の表現（UI）

### 表示禁止

以下を箱庭画面・キャラクター詳細・イベント画面に出力してはならない：

- 信仰度バーまたはゲージ
- `faith: 58` のような数値
- 「信仰度が上がりました」のようなフィードバック
- 信仰度ランキング

### 間接的な表現（発話）

信仰度バンドに応じて、キャラクターの発話トーンに反映する。
詳細は `docs/product/observed-dialogue-spec.md` の「神への間接反応」セクションを参照。

代表例：

```
disbelieves:
  「さっきのは……ただの偶然だと思う」
  「誰かに助けてもらったわけじゃない」

uncertain:
  「誰かに見られているような気がする時があるんだ」
  「あれ、なんか不思議だった」

senses_presence:
  「あの時、何かが背中を押してくれた気がした」
  「気配、みたいなものがある気がして」

believes:
  「神さまは、きっと見ている。だから、今は逃げない」
  「あの介入、意味があったと思う」

devoted:
  「これは試されているんだと思う。なら、私は応えたい」
  「あの世界の向こうに、誰かがいる。私はそれを信じている」
```

---

## 5. Passport での扱い

### 出力形式

```ts
type PassportGodRelationship = {
  initialFaith: number;                // 30 固定（初期値）
  currentFaith: number;                // 現在値
  faithBand: FaithBand;
  faithVisibility: "hidden_in_game_visible_in_passport_json";
  faithChangeSummary: string;          // 自然言語での要約
  interpretationOfGod: string;         // キャラがどう神を解釈しているか
  firstEncounterOutsideWorld: {
    stance: string;                    // 外へ来た子としての立場
    expectedReaction: string;          // 初対面で予想される反応
    instructionReceptivity: string;    // 神の言葉の受け取りやすさ
  };
};
```

### 出力例

```json
{
  "godRelationship": {
    "initialFaith": 30,
    "currentFaith": 58,
    "faithBand": "senses_presence",
    "faithVisibility": "hidden_in_game_visible_in_passport_json",
    "faithChangeSummary": "助けと試練を通じて、箱庭の外側にいる神の存在をかなり感じるようになった。",
    "interpretationOfGod": "神は直接話しかけてこないが、出来事を通して関わる存在だと感じている。",
    "firstEncounterOutsideWorld": {
      "stance": "箱庭の記憶を持ったまま外の世界へ来た子として話す",
      "expectedReaction": "緊張しながらも、どこか懐かしさを感じる",
      "instructionReceptivity": "神の言葉として受け取り始めるが、口調・ユーザー設定・過去イベントに矛盾する指示には戸惑う"
    }
  }
}
```

### 禁止事項

- Passport に陰陽五行の内部値（wood, fire, earth, metal, water）を含めない
- `faith` 値をゲームUI で表示するための computed field として使わない
- 外部ゲーム開発者に信仰度に基づく行動を強制するような構造にしない

---

## 6. テスト要件

以下をすべて満たすこと：

1. キャラクター作成時に `faith = 30` で初期化される
2. `help` 介入成功後に `faith += 4`（上限100以内）
3. `trial` 介入失敗後に `faith -= 4`（下限0以内）
4. `faith` が UI の任意の表示要素（テキスト・バー・バッジ）に直接出力されない
5. Passport JSON に `godRelationship.currentFaith` が含まれる
6. `faithBand` が数値から正しく計算される（境界値：0, 19, 20, 39, 40, 59, 60, 79, 80, 100）
7. `sensitivity ≥ 70` のキャラクターが `watch_success` で `faith` 変化 ×1.5（= +3）を受ける
8. `boldness ≥ 70` のキャラクターが `trial_failure` で `faith` 減少 ×0.5（= -2）を受ける
9. `curiosity ≥ 70` のキャラクターが `help_failure` で `faith` 減少 ×0.7（= -1）を受ける
10. `discipline ≥ 70` のキャラクターが `trial_success` で `faith` 変化 ×1.5（= +7）を受ける
11. `faith` が 100 を超えない、0 を下回らない
12. playerMemo 補正は 2 回目以降の介入から適用される（1 回目は補正なし）
13. 連続して同一キーワードグループの playerMemo を設定すると `+1` 補正が加算される
