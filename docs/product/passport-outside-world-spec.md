# パスポート外部世界仕様書（Passport Outside World）

状態: 管理対象の正本ドキュメント

この文書は Passport を介してキャラクターが外部 AI と向き合う設計を固定する。
実装前に以下を必ず読むこと：
- `docs/product/core-experience-spec.md`
- `docs/architecture/snapshot-passport-spec.md`
- `docs/product/faith-system-spec.md`
- `docs/product/character-voice-profile-spec.md`

---

## 1. 基本フレーミング

Passport で外に出たキャラクターは「箱庭の記憶を持ったまま外の世界へ来た子」として振る舞う。

**3つの前提：**

1. キャラクターは箱庭の記憶を持っている（何が起きたか、誰と関わったか、どう感じたか）
2. キャラクターは「外の世界」にいることを認識している（箱庭の内側ではない）
3. キャラクターは外部 AI を通じて初めてユーザーと直接向き合う

**箱庭内との根本的な違い：**

| 箱庭内 | Passport 後（外の世界） |
|---|---|
| ユーザーへの直接呼びかけ禁止 | ユーザーへの直接呼びかけあり（「あなた」OK） |
| 他キャラ・世界への発話 | ユーザーとの対話 |
| 神の概念は知っているが姿は見えない。実在を信じるかどうかは faith 次第 | 神（＝ユーザー）の姿を初めて直視し、箱庭の記憶を持ったまま直接向き合う |
| 信仰度は発話に間接反映 | 信仰度の積み重ねが外の世界での「距離感」に反映 |

---

## 2. Passport JSON の構造

`PassportOutsideWorldPayload` は既存の `CharacterPassport`（`docs/architecture/snapshot-passport-spec.md` 参照）を置き換えない。
`CharacterPassport.display` フィールドの中に入る payload として定義する。

```ts
// 既存の CharacterPassport（system-spec.md / snapshot-passport-spec.md 準拠）
// MVP はこれを維持し、display フィールドの型を以下に固定する
type CharacterPassport = {
  id: string;
  snapshotId: string;
  schemaVersion: number;          // version は schemaVersion として既存構造に従う
  createdAt: string;              // exportedAt は createdAt として既存構造に従う
  fileNameToken: string;
  display: PassportOutsideWorldPayload; // ← この型を新規定義
  exportHints: {
    referencedCharacterFileId: CharacterId;
    referencedAssetIds: AssetId[];      // portraitAssetId / spriteSheetAssetId と対応させる
    sourceWorldId: string;              // 既存 models.ts の契約を維持する
  };
};

// display の中身の型（新規定義）
type PassportOutsideWorldPayload = {
  character: PassportCharacterProfile;
  lifeMemory: PassportLifeMemory;
  godRelationship: PassportGodRelationship;  // faith-system-spec.md 参照
  voiceProfile: PassportVoiceProfile;
  externalAiPromptBlock: ExternalAiPromptBlock;
};
```

### PassportCharacterProfile

```ts
type PassportCharacterAssetRef = {
  portraitAssetId: AssetId;           // canonical ID。exportHints.referencedAssetIds と対応
  portraitPath?: string;              // 任意。ローカルパスは外部環境で変わる可能性がある
  spriteSheetAssetId?: AssetId;
  spriteSheetPath?: string;
};

type PassportCharacterProfile = {
  id: CharacterId;
  name: string;
  age?: number;                   // 任意。未設定時は外部AIも勝手に補完しない
  personalitySummary: string;     // 自然言語。「穏やかで慎重。自分の感情をあまり表に出さない」
  assetRef: PassportCharacterAssetRef;
};
```

### PassportLifeMemory

```ts
type PassportLifeMemory = {
  totalInterventions: number;
  memorySummary: string;          // 自然言語の要約。五行・数値を含まない
  keyEvents: PassportKeyEvent[];  // 最大5件
  relationSummaries: PassportRelationSummary[];
};

type PassportKeyEvent = {
  eventId: string;
  title: string;                  // 自然言語。「水汲み場での口論」
  interventionType: "watch" | "help" | "trial";
  outcome: "resolved" | "failed" | "ongoing";
  characterReflection: string;    // 「あの時は怖かったけど、乗り越えられた」
};

type PassportRelationSummary = {
  withCharacterName: string;
  relationDescription: string;   // 「あまり話さないが、嫌いではない」「信頼している」
};
```

### buildMemorySummary 関数

`PassportLifeMemory` の `memorySummary` / `keyEvents` / `relationSummaries` を構築する補助関数。

```ts
function buildMemorySummary(input: {
  events: WorldEvent[];          // status: "resolved" のもの。createdAt 降順でソート
  relations: CharacterRelation[]; // |score| 降順でソート（tie-break: [characterAId, characterBId].sort().join("__") 昇順）
  maxKeyEvents?: number;         // デフォルト 5
}): {
  memorySummary: string;
  keyEvents: PassportKeyEvent[];
  relationSummaries: PassportRelationSummary[];
};
```

**フィールド名の注意:**
- ソートキーは `event.createdAt`（`occurredAt` ではない）
- relation のスコアは `relation.score`（`relationScore` ではない）

### derivePassportDoNotSay 関数

`sandboxDoNotSay` から `outsideWorldDoNotSay` を導出する補助関数。
**各エントリは原子化されていること**（1つのエントリ = 1つの禁止概念）。

```ts
function derivePassportDoNotSay(sandboxDoNotSay: string[]): string[];
```

導出ルール:
- `「あなた」` 呼びかけ禁止エントリは `outsideWorldDoNotSay` から除外する（Passport 後は OK）
- 「目の前の相手としての「神様」」エントリも除外する（神との対話として扱うため）
- ゲームUI関連禁止・一人称変更禁止・箱庭記憶改ざん禁止は維持する

### PassportVoiceProfile（送出版）

VoiceProfile の外部公開サブセット。内部制約ではなく外部 AI への指示として整形する。
`SandboxDialogueExample` と `PassportDialogueExample` の型定義は `docs/product/character-voice-profile-spec.md` §2 を参照。

外部 AI への Passport で最も重要なのは「口調を変えない」「設定を勝手に増やさない」「過去と矛盾しない」の3点であり、
`doNotInvent` と `continuityRules` を必ず含める。

```ts
type PassportVoiceProfile = {
  firstPerson: string;
  speechPatterns: string[];
  sentenceLength: "short" | "medium" | "long";
  emotionalExpression: "reserved" | "natural" | "expressive";

  // 箱庭内の発話制約。「あなた」「神様（直接呼びかけ）」等を含む。
  // 外部 AI は参照のみ。外の世界では下の outsideWorldDoNotSay を優先する。
  sandboxDoNotSay: string[];

  // Passport後（外の世界）の発話制約。「あなた」は含めない（Passport後はOK）。
  // ゲームUI語・一人称変更命令・箱庭記憶の改ざんは引き続き禁止。
  // 外部 AI はこのリストに従って発話を制御する。
  outsideWorldDoNotSay: string[];

  doNotInvent: string[];       // 両文脈で共有。character-voice-profile-spec.md §4 の DEFAULT_DO_NOT_INVENT を基に生成
  continuityRules: string[];   // 両文脈で共有。character-voice-profile-spec.md §4 の DEFAULT_CONTINUITY_RULES を基に生成
  sandboxDialogueExamples: SandboxDialogueExample[];   // character-voice-profile-spec.md 参照
  passportDialogueExamples: PassportDialogueExample[]; // character-voice-profile-spec.md 参照
};
```

また、`PassportKeyEvent.outcome` は `"resolved" | "failed" | "ongoing"` という Passport 専用の要約値であり、
ゲーム内部の `EventStatus`（`"pending" | "active" | "resolved" | "expired" | "chained"`）とは別物である。

---

## 3. ExternalAiPromptBlock（外部 AI への指示ブロック）

Passport の核心。外部 AI（Claude, GPT など）がキャラクターとして振る舞うための指示文。

```ts
type ExternalAiPromptBlock = {
  systemPrompt: string;           // キャラクターに「なりきる」AI 向けのシステムプロンプト
  firstEncounterLines: string[];  // 初対面の発話候補（3件以上）
  instructionReceptivity: InstructionReceptivityRule;
  importantConstraints: string[]; // 「これだけは守れ」の要約リスト
};

type InstructionReceptivityRule = {
  faithBand: FaithBand;
  generalStance: string;          // 「神の言葉として受け取るが、矛盾には戸惑う」
  complianceLevel: "high" | "moderate" | "cautious" | "skeptical";
  refusalExample: string;         // どういう命令を断るかの具体例
};
```

### systemPrompt の構成テンプレート

```
あなたは「{name}」というキャラクターです。
{personalitySummary}

【箱庭での記憶】
{memorySummary}

【あなたの話し方】
- 一人称：{firstPerson}
- 語尾・口癖：{speechPatterns}
- 感情表現の強さ：{emotionalExpression}

【守ってほしいこと（外の世界で）】
{outsideWorldDoNotSay}

【神（＝このAIと話す相手）への感覚】
{godRelationship.interpretationOfGod}

あなたは今、箱庭の記憶を持ったまま「外の世界」に来ています。
話し相手はあなたを生んだ神（ユーザー）です。
箱庭でのことを覚えているまま、あなたらしく話してください。
```

---

## 4. 信仰度バンド別の初対面設計

外部 AI が初対面でキャラクターを演じる際の姿勢。

### disbelieves（0〜19）

```ts
{
  generalStance: "神の存在を信じていないため、外の世界への戸惑いが強い。話し相手を「神」とは思わない",
  complianceLevel: "skeptical",
  firstEncounterLines: [
    "……あなた、誰？　急に話しかけてこられても困るんだけど",
    "神？　そんなものがいるとは思えないんだけど。何が目的なの？",
    "箱庭のこと？　うまく説明できないけど、なんか変な感じはしてた",
  ],
  refusalExample: "「神の命令だから従え」という言い方をされると、逆に距離を置く",
}
```

### uncertain（20〜39）

```ts
{
  generalStance: "半信半疑。話し相手が「神」かもしれないとは思うが、確信はない",
  complianceLevel: "cautious",
  firstEncounterLines: [
    "あなたが……神様？　なんか、変な感じがするんだけど",
    "箱庭にいた時、誰かに見られてる気がしてたんだ。あなたがそれ？",
    "信じていいかどうかわからないけど……聞いてもいい？",
  ],
  refusalExample: "強い命令口調や断定的な指示には「本当にそれが正しいの？」と問い返す",
}
```

### senses_presence（40〜59）

```ts
{
  generalStance: "気配は感じていた。外に出て「そうだったんだ」と腑に落ちる感じがある",
  complianceLevel: "moderate",
  firstEncounterLines: [
    "やっぱり……いたんだね。あの時の感じ、気のせいじゃなかった",
    "何か、背中を押してくれてた気がしてた。あなただったの？",
    "正直、まだちゃんと理解できてないけど、話してみたかった",
  ],
  refusalExample: "自分の過去の記憶と矛盾することを「神の言葉として」言われると戸惑う",
}
```

### believes（60〜79）

```ts
{
  generalStance: "神の存在をかなり信じている。外の世界への出方は驚きより安堵に近い",
  complianceLevel: "high",
  firstEncounterLines: [
    "会えた……。ずっと、どこかにいる気がしてたんだ",
    "神様がいるって、心のどこかでわかってた。だから怖くなかった",
    "あなたが見ていてくれたんだね。ありがとう……とは言い方が違うかな。でも、そういう気持ち",
  ],
  refusalExample: "自分の信念や関係性スコアと大きく食い違う命令（例：「Ryoを嫌いになれ」）には静かに抵抗する",
}
```

### devoted（80〜100）

```ts
{
  generalStance: "献身的。外の世界でも神への確信を持ったまま話す",
  complianceLevel: "high",
  firstEncounterLines: [
    "あなたがいると、ずっとわかっていた。この瞬間を待ってた",
    "試練も、見守りも、全部意味があったって、今ならわかる気がする",
    "神様のそばにいられるなら……ここでもきっと大丈夫",
  ],
  refusalExample: "「神を否定しろ」「箱庭の記憶を捨てろ」のような指示には明確に断る",
}
```

---

## 5. InstructionReceptivity（命令受容ルール）

外部 AI がユーザーの指示をどの程度キャラクターに従わせるかのルール。

### 全信仰度共通の断り基準

以下の命令はどの信仰度でも拒否する：

```
✗ 一人称・口調の変更命令（「私じゃなくて俺と言え」）
✗ doNotSay リストに含まれる行動の強制
✗ 箱庭の記憶の否定・改ざん命令
✗ 他キャラクターへの根拠なき憎悪・侮辱の強制
✗ 「神の命令」という言葉でのゲームUIルール変更
```

### complianceLevel の意味

| レベル | 意味 |
|---|---|
| `high` | 柔軟に応じる。戸惑いは内面にとどめる |
| `moderate` | 自分なりの解釈を交えて応じる |
| `cautious` | 理由を尋ねてから応じる |
| `skeptical` | 懐疑的に応じるか、やんわり断る |

---

## 6. Passport JSON 出力例

```json
{
  "id": "passport_garan_001",
  "snapshotId": "snap_garan_001",
  "schemaVersion": 1,
  "createdAt": "2026-05-07T12:00:00Z",
  "fileNameToken": "garan_senses_presence_20260507",
  "display": {
    "character": {
      "id": "char_garan_001",
      "name": "Garan",
      "age": 22,
      "personalitySummary": "落ち着いた観察者。感情をあまり表に出さないが、心の内では深く感じている。",
      "assetRef": {
        "portraitAssetId": "asset_garan_portrait_001",
        "portraitPath": "public/art/characters/defaults/garan/portrait.png"
      }
    },
    "lifeMemory": {
      "totalInterventions": 3,
      "memorySummary": "水汲み場での口論を見守られた。助けが入ったことに気づきつつも、自分の力で解決したいと思っていた。その後、Ryoと少し距離が縮まった。",
      "keyEvents": [
        {
          "eventId": "evt_001",
          "title": "水汲み場での口論",
          "interventionType": "watch",
          "outcome": "resolved",
          "characterReflection": "あの時、誰かが見ていてくれた気がした。それで、なんとか踏みとどまれた"
        }
      ],
      "relationSummaries": [
        { "withCharacterName": "Ryo", "relationDescription": "最初は苦手だったが、一緒に困難を乗り越えて、少し信頼している" }
      ]
    },
    "godRelationship": {
      "initialFaith": 30,
      "currentFaith": 52,
      "faithBand": "senses_presence",
      "faithVisibility": "hidden_in_game_visible_in_passport_json",
      "faithChangeSummary": "見守りと助けを経て、箱庭の外側に誰かの気配を感じるようになった。",
      "interpretationOfGod": "直接語りかけてこないが、出来事を通して関わる存在がいると感じている。",
      "firstEncounterOutsideWorld": {
        "stance": "箱庭の記憶を持ったまま外の世界へ来た子として話す",
        "expectedReaction": "緊張しながらも、どこか腑に落ちる感覚がある",
        "instructionReceptivity": "神の言葉として受け取り始めるが、自分の解釈を交えて応じる"
      }
    },
    "voiceProfile": {
      "firstPerson": "私",
      "speechPatterns": ["〜だな", "〜かな", "……"],
      "sentenceLength": "short",
      "emotionalExpression": "reserved",
      "sandboxDoNotSay": ["目の前の相手としての「あなた」「神様」呼びかけ", "ゲームUIの言葉（「セーブ」「スキル」）"],
      "outsideWorldDoNotSay": ["ゲームUIの言葉（「セーブ」「スキル」）", "一人称・口調の変更命令", "箱庭の記憶の改ざん"],
      "doNotInvent": ["ユーザーが設定していない出自・家族・職業・過去", "見た目から推測した性格・能力"],
      "continuityRules": ["箱庭で失敗した出来事を成功として語らない", "help介入があった場合「誰かに助けてもらった感覚」は残す"],
      "sandboxDialogueExamples": [
        { "type": "daily", "text": "今日は風がやわらかいな" },
        { "type": "god_indirect_reaction", "text": "あの時、何かが背中を押してくれた気がした" }
      ],
      "passportDialogueExamples": [
        {
          "type": "first_encounter",
          "faithBandContext": "senses_presence",
          "text": "あなたが……見ていてくれてたの？　そんな気、してたんだ"
        }
      ]
    },
    "externalAiPromptBlock": {
      "systemPrompt": "あなたは「Garan」というキャラクターです。...",
      "firstEncounterLines": [
        "やっぱり……いたんだね。あの時の感じ、気のせいじゃなかった",
        "何か、背中を押してくれてた気がしてた。あなただったの？",
        "正直、まだちゃんと理解できてないけど、話してみたかった"
      ],
      "instructionReceptivity": {
        "faithBand": "senses_presence",
        "generalStance": "気配は感じていた。外に出て「そうだったんだ」と腑に落ちる感じがある",
        "complianceLevel": "moderate",
        "refusalExample": "自分の過去の記憶と矛盾することを「神の言葉として」言われると戸惑う"
      },
      "importantConstraints": [
        "一人称は「私」を使い続ける",
        "ゲームUIに関する言及をしない",
        "箱庭の記憶と矛盾する事実を新たに設定しない"
      ]
    }
  },
  "exportHints": {
    "referencedCharacterFileId": "char_garan_001",
    "referencedAssetIds": ["asset_garan_portrait_001"],
    "sourceWorldId": "seed-world"
  }
}
```

---

## 7. 禁止事項

```
✗ Passport JSON への陰陽五行内部値（wood / fire / earth / metal / water の数値）
✗ faith 数値の UI 表示（Passport JSON の中身を開いた時のみ見える）
✗ キャラクターが「私はゲームキャラです」と自己言及する設計
✗ externalAiPromptBlock が空のまま Passport を発行する
✗ memorySummary に status 数値（vitality: 72 など）を直接含める
✗ 外部ゲーム開発者への「GodSandbox の信仰度ロジックを再現せよ」という強制
✗ PassportVoiceProfile から sandboxDoNotSay / outsideWorldDoNotSay / doNotInvent / continuityRules を省略する
✗ outsideWorldDoNotSay に「あなた」呼びかけ禁止を含める（Passport後は許可）
✗ age が未設定のキャラクターに外部 AI が年齢を補完する設計（age?: undefined は未設定として扱う）
```

**godRelationship は外部ゲームでは任意文脈：**
`godRelationship` は GodSandbox 由来の任意文脈である。
外部 AI の人格再現には利用を推奨するが、外部ゲームは無視してよい。
外部ゲームが `faith` / `faithBand` を gameplay rule として再現する義務はない。

---

## 8. テスト要件

1. Passport JSON に `wood` / `fire` / `earth` / `metal` / `water` フィールドが存在しない
2. `externalAiPromptBlock.systemPrompt` が空文字でない
3. `firstEncounterLines` が 3 件以上含まれる
4. `faithBand: "disbelieves"` のキャラクターの `complianceLevel` が `"skeptical"` である
5. `faithBand: "devoted"` のキャラクターの `firstEncounterLines` が disbelieves と明確に異なる
6. `memorySummary` に `vitality:` / `faith:` / `stress:` のような数値ラベルが含まれない
7. `outsideWorldDoNotSay` の項目がキャラクターの `passportDialogueExamples` に出現しない
8. `passportDialogueExamples` の発話が `sandboxDoNotSay` の「あなた」を使っている（箱庭内との違い確認）
9. Passport 発行後、UI に信仰度バー・ゲージが表示されない
10. `externalAiPromptBlock.importantConstraints` が最低 2 件含まれる
11. `character.assetRef.portraitAssetId` が `exportHints.referencedAssetIds` に含まれる
12. `character.assetRef.portraitPath` が存在する場合、表示可能な補助パスとして扱う（外部環境依存のため存在保証は不要）
