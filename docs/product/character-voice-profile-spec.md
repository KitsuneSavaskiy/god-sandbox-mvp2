# キャラクター音声プロフィール仕様書（VoiceProfile）

状態: 管理対象の正本ドキュメント

この文書はキャラクターの発話人格（VoiceProfile）を固定する。
発話の一貫性はプロダクトの「うちの子らしさ」の核であり、最優先の品質基準である。

実装前に `docs/product/core-experience-spec.md` を必ず読むこと。

---

## 1. 定義と目的

VoiceProfile は、キャラクターが「その子らしい話し方」を保持し続けるための規則集合である。

**AI 生成・手動生成にかかわらず、すべての発話はこのプロフィールに従うこと。**

---

## 2. データモデル

```ts
type VoiceProfile = {
  // 基本的な話し方
  firstPerson: string;             // 一人称（例: "私", "ぼく", "あたし", "俺"）
  secondPersonToCharacters: string; // キャラクター同士での二人称（例: "きみ", "あなた", "おまえ"）
  sentenceLength: "short" | "medium" | "long";  // 文の長さの傾向
  emotionalExpression: "reserved" | "natural" | "expressive"; // 感情表現の強さ
  politeness: "casual" | "polite" | "formal";    // 丁寧さ

  // 口調の特徴
  speechPatterns: string[];        // 語尾・口癖・よく使う表現（例: ["〜だよ", "〜かな", "まあ"]）
  silenceUsage: "frequent" | "occasional" | "rare"; // 沈黙・間の使い方

  // 発話サンプル（2種類）
  sandboxDialogueExamples: SandboxDialogueExample[]; // 箱庭内発話例（他キャラ向け）
  passportDialogueExamples: PassportDialogueExample[]; // Passport 後のユーザー向け発話例

  // 制約
  doNotSay: string[];              // 言ってはいけない表現・概念
  doNotInvent: string[];           // 勝手に追加してはいけない設定
  continuityRules: string[];       // 過去イベントとの整合ルール
};

// 箱庭内発話例（他キャラ向け、ユーザーに直接話しかけない）
type SandboxDialogueExample = {
  type: "daily" | "relationship" | "god_indirect_reaction";
  context?: string;                // どんな状況か（任意）
  text: string;                    // 発話テキスト
};

// Passport 後のユーザー向け発話例（外へ来た子として）
type PassportDialogueExample = {
  type: "first_encounter" | "memory_reference" | "general";
  faithBandContext: FaithBand;     // どの信仰度バンドの時の発話か
  text: string;                    // 発話テキスト
};
```

---

## 3. ユーザー入力から VoiceProfile を作る

キャラクター作成時にユーザーが入力するのは次の 5 項目のみ（非技術者向け）：

| ユーザー入力 | 使われ方 |
|---|---|
| 名前 | Core Profile |
| 性格（自由記述） | VoiceProfile の emotionalExpression / politeness の推定材料 |
| 口調（自由記述 or プリセット選択） | VoiceProfile の firstPerson / sentenceLength / speechPatterns の材料 |
| 年齢 | VoiceProfile の politeness 傾向の参考 |
| 1枚絵（画像） | Visual Anchor のみ。VoiceProfile には使わない |

**ユーザーが見る UI には「VoiceProfile」という語を出さない。**
UI 文言は「この子の話し方」「口調の設定」などに置き換える。

### 口調プリセット例

非技術者向けにプリセット選択を提供してよい：

```
「タメ口（明るい）」→ firstPerson: "おれ" / casual / short / expressive
「丁寧（穏やか）」  → firstPerson: "私" / polite / medium / reserved
「標準語（普通）」  → firstPerson: "ぼく" / casual / medium / natural
「無口（クール）」  → firstPerson: "私" / casual / short / reserved + silenceUsage: "frequent"
```

プリセットはユーザーが後から変更できる。

---

## 4. doNotSay / doNotInvent の必須制約

以下はすべてのキャラクターに共通して適用するデフォルト制約である。
ユーザーが追加禁止事項を設定することもできる。

### デフォルト doNotSay（箱庭内発話用）

箱庭内発話では以下を禁止する。**「神様」という語の全面禁止ではない点に注意。**
直接呼びかけとして使う「神様」は禁止するが、信仰度に応じた間接的な神への言及は許可する（`observed-dialogue-spec.md` §2 Type C 参照）。

```ts
// 箱庭内発話専用の doNotSay
// 各エントリは原子化すること（1エントリ = 1禁止概念）。
// Passport の derivePassportDoNotSay は個別エントリを選択的に除外するため、
// 「あなた」「プレイヤー」「神様」を1つのエントリにまとめてはならない。
const DEFAULT_DO_NOT_SAY_SANDBOX = [
  "ユーザーへの直接呼びかけとしての「あなた」",
  "ユーザーへの直接呼びかけとしての「プレイヤー」",
  "目の前の相手として使う「神様」",
  "ゲームUIの認識を示す表現（画面、ボタン、セーブ、ステータスなど）",
  "恋愛的な直接告白・強い親密表現",
  "他キャラクターの設定を勝手に断言する表現",
];

// 箱庭内で信仰度に応じて許可される神への間接言及（禁止ではない）
const ALLOWED_GOD_INDIRECT_REFERENCES = [
  "senses_presence 以上: 「何かが背中を押してくれた気がした」",
  "believes 以上: 「神さまは、きっと見ている」",
  "devoted: 「あの世界の向こうに、誰かがいる」",
  // disbelieves / uncertain では神の存在を肯定する表現を使わない
];
```

Passport 後（外の世界）では、ユーザーへの直接呼びかけ（「あなた」）は許可される。箱庭内との違いは `passport-outside-world-spec.md` §1 参照。

### デフォルト doNotInvent

```ts
const DEFAULT_DO_NOT_INVENT = [
  "ユーザーが設定していない出自・家族・職業・過去",
  "見た目から推測した性格・能力・属性",
  "他キャラクターとの関係設定（公式なrelationスコアに反するもの）",
  "信仰度を示唆しない状況での「神を信じている」発言",
];
```

### 継続性ルール（continuityRules）

デフォルト：

```ts
const DEFAULT_CONTINUITY_RULES = [
  "前回イベントで失敗した内容を、次の発話で成功として扱わない",
  "help 介入があった場合、「誰かに助けてもらった」という感覚は残す（神とは言わない）",
  "trial 介入が続いた場合、ストレスや疲労感を示す表現が増える",
  "relation スコアが低い相手には、距離感のある話し方をする",
];
```

---

## 5. 口調が変わってはならないケース

以下の状況でも口調・一人称・語尾を変えてはならない：

- AI 生成の発話を使う場合
- 異なるイベントタイプ（help, trial, watch）の後
- 信仰度が変化した後
- relation スコアが大きく変動した後
- 箱庭内発話と Passport 後発話の両方

口調の変化は、ユーザーが明示的に VoiceProfile を編集した場合のみ許可する。

---

## 6. 発話サンプルの品質基準

サンプル発話を生成・評価するときの基準：

| 基準 | OK 例 | NG 例 |
|---|---|---|
| ユーザーに直接向けない | 「Ryoが走っていった」 | 「見てくれているんでしょ」 |
| 設定を勝手に増やさない | 「なんとなく不安なんだ」 | 「昔、親に捨てられたから（未設定の過去）」 |
| 口調が一貫する | 「〜だよ」の子は常に「〜だよ」 | 場面によって「〜です」に変わる |
| 過去と矛盾しない | trial 後「あれ、きつかったな」 | trial 失敗後「全然平気だった」 |
| 信仰度相応の神への言及 | senses_presence: 「なんか、見られてる気がした」 | disbelieves: 「神様が助けてくれた」 |

---

## 7. テスト要件

1. キャラクター作成後、VoiceProfile が生成されている
2. `doNotSay` の表現がサンドボックス内発話に出ない
3. `doNotInvent` の制約外の設定が発話に出ない
4. 異なる介入（watch/help/trial）の後でも `firstPerson` が変わらない
5. `sandboxDialogueExamples` に `type: "god_indirect_reaction"` が最低 1 件ある
6. `passportDialogueExamples` に `type: "first_encounter"` が最低 1 件ある
7. `passportDialogueExamples` の発話にユーザーへの直接呼びかけが含まれる（箱庭内とは異なること）
8. `faithBandContext: "disbelieves"` と `faithBandContext: "devoted"` では明確に異なる発話例が生成される
