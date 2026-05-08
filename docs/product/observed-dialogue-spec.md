# 観察型発話仕様書（Observed Dialogue）

状態: 管理対象の正本ドキュメント

この文書は GodSandbox の箱庭内におけるキャラクター発話の設計を固定する。
箱庭内の発話は「観察型」であり、ユーザーへの直接会話ではない。

実装前に `docs/product/core-experience-spec.md` と `docs/product/character-voice-profile-spec.md` を必ず読むこと。

---

## 1. 基本方針

> 箱庭内の発話は、ユーザーに向けたチャットではなく、キャラクターが世界の中で生きている音として設計する。

ユーザーは「覗き見る」ように発話を観察する。
発話が常時流れるチャットアプリにしてはならない。
発話が全くない置物にしてもならない。

**目標とする感覚：たまに聞こえてくる生活音のような会話**

---

## 2. 発話の3種類

### Type A: 日常発話（daily）

**目的：** 生活している感じを出す。物語を進めることを目的にしない。

**条件：**
- 特定イベントに関連しない
- 場所・時間帯・季節・天気の状態から自然に発生する
- 他キャラクターに向けても独り言でもよい

**例：**
```
「今日は風がやわらかいね。少しだけ、遠くまで歩けそう」
「あの木の下、なんか落ち着くんだ」
「さっきの音、どこから聞こえたんだろう」
「お腹すいてきた……」
「雨、降りそうだな」
```

**生成ルール：**
- 5〜30 文字が目安
- キャラクターが世界に向けている言葉にする
- ユーザーへの呼びかけ禁止（`doNotSay` 参照）

---

### Type B: 関係性発話（relationship）

**目的：** キャラクター同士の距離感・仲良し・緊張・憧れ・苦手意識を見せる。

**条件：**
- 2 名以上の active キャラクターが近い位置にいる
- relation スコアが一定以上または以下のとき（閾値: スコア ≥ 60 で「仲良し発話」、スコア ≤ -30 で「距離感発話」、-29〜59 は通常関係でMVPでは強いトリガーにしない）
- すれ違い時・並んでいる時に発生しやすい

**例（仲良し）：**
```
「Ryoと歩くと、なんか楽しくなる」
「Suzuが笑ってると、広場が少し明るくなる気がする」
```

**例（距離感）：**
```
「Garanには、まだ少し話しかけづらい」
「…（そっぽを向く）」
```

**例（憧れ）：**
```
「Ryoって、なんであんなに迷わずに走れるんだろう」
```

**生成ルール：**
- 10〜30 文字が目安（相手の名前を含むため Type A より長くなりやすい）
- relation スコアの値を直接発話に出してはならない
- 「好感度 60」「友好度が上がった」などのゲームUI用語は絶対禁止
- 発話はあくまで世界内の自然な言葉にする

---

### Type C: 神への間接反応（god_indirect_reaction）

**目的：** 信仰度に応じて、神の気配・介入をキャラがどう解釈しているかを見せる。

**重要制約：**
- キャラクターはユーザーに向かって「あなた」と言わない
- 「神様が見ている」と確信表現してよいのは `believes` 以上のみ
- 直接的な感謝（「助けてくれてありがとう」）は禁止。間接的な解釈にする

**信仰度バンド別の発話例：**

```
disbelieves（0〜19）:
  「さっきうまくいったのは……ただの偶然だよね？」
  「なんか変な感じがしたけど、気のせいかな」

uncertain（20〜39）:
  「誰かに見られているような気がする時があるんだ」
  「あれ、なんだったんだろう。うまく説明できないけど」

senses_presence（40〜59）:
  「あの時、何かが背中を押してくれた気がした」
  「空気が変わったような。不思議だな」

believes（60〜79）:
  「神さまは、きっと見ている。だから、今は逃げない」
  「あの介入、意味があったと思う」

devoted（80〜100）:
  「これは試されているんだと思う。なら、私は応えたい」
  「あの世界の向こうに、誰かがいる。私はそれを信じている」
```

**生成ルール：**
- 10〜35 文字が目安（内省的な表現のため Type A より長くなりやすい）
- 発話頻度は3種類の中で最も低くする（イベント後や試練後に限定が望ましい）
- `disbelieves` のキャラに「神が助けた」と思わせる発話は禁止
- 信仰度数値を発話文字列に埋め込まない

---

## 3. 発話頻度とトリガー

### 頻度の目安

「普通」。常時しゃべらず、沈黙も演出として成立させる。

| 状況 | 発話確率の目安 | 種類 | `resolveDialogueTriggerRate` の戻り値 |
|---|---|---|---|
| イベント発生時 | 高（80%） | B or C | `event_started` / `event_resolved` → 0.8 |
| すれ違い時 | 中（40%） | A or B | `proximity_enter` → 0.4 |
| 一定時間経過（5〜10分ごと） | 低（20%） | A | `idle_timer` → 0.2 |
| 介入直後 | 中（50%） | C | `intervention_applied` → 0.5 |
| 静止中 | 低（10%） | A（独り言） | `idle_timer`（静止判定） → 0.1 |
| 時間帯・季節変化 | 低（10%） | A | `phase_change` → 0.1 |

`idle_timer` は「一定時間経過」（0.2）と「静止中」（0.1）で異なる確率を持つことがあるが、
MVP では実装を簡略化して `idle_timer` → 0.2 固定として差し支えない。
`phase_change` は必ず 0.1 を返すこと。

### トリガー

発話は以下のいずれかによってトリガーされる：

```ts
type DialogueTrigger =
  | "event_started"        // イベント開始時
  | "event_resolved"       // イベント解決後
  | "intervention_applied" // 介入適用直後
  | "proximity_enter"      // 別キャラが近くに来た
  | "idle_timer"           // 一定時間静止
  | "phase_change";        // 時間帯・季節変化
```

---

## 4. 発話の表示ルール

### 表示形式

- 吹き出し形式でキャラクター上部または横に表示
- テキスト量：最大 40 文字（日本語）
- 表示時間：3〜5 秒後にフェードアウト
- 同時に表示する発話は最大 2 件（複数キャラ発話が重なった場合は優先度の高い方を選ぶ）

### 優先度

```
高: event_started / event_resolved / intervention_applied
中: proximity_enter
低: idle_timer / phase_change
```

### フォールバック

発話候補が生成できなかった場合、発話なしで進める（エラーにしない）。

---

## 5. 発話の永続化ルール（MVP）

箱庭内発話はどこに保存されるかを明確にする。Codex は以下の境界に従って実装すること。

| 発話タイプ | MVP での扱い | Passport への反映 |
|---|---|---|
| Type A: daily | **UI 一時表示のみ**。保存しない | しない |
| Type B: relationship | **UI 一時表示のみ**。保存しない | しない |
| Type C: god_indirect_reaction（event_resolved / intervention_applied トリガー） | UI 一時表示。**Passport 候補として保持可** | `keyEvents.characterReflection` の候補として使ってよい |
| Type C: god_indirect_reaction（その他トリガー） | **UI 一時表示のみ** | しない |

**理由：** Passport は「箱庭の記憶を持って外に出る」体験の核であり、
イベント介入に紐づいた反応だけが「記憶に残る出来事」として意味を持つ。
日常発話・すれ違い発話は生活音として機能するが、自動保存するとノイズになる。

**実装の注意：**
- `event_resolved` / `intervention_applied` トリガーで生成された Type C 発話は、
  `characterReflection` の候補文字列として一時保持し、Passport 生成時に利用する。
- daily / relationship 発話はフェードアウト後に廃棄する（story log も不要）。
- 将来の PBI で「印象的な発話」を snapshot annotation に昇格させる導線を追加できるが、MVP では実装しない。

---

## 6. 禁止事項（箱庭内発話）

以下の表現は箱庭内発話に絶対に含めてはならない：

```
✗ ユーザーへの直接の呼びかけ（「あなた」「見てくれている？」）
✗ ゲームUI用語（「介入した」「ステータスが上がった」「セーブ」）
✗ 信仰度の数値（「信仰度が 58 だから」）
✗ 五行の属性言及（「今は火の気が強いから」）
✗ 他キャラクターの未設定情報の断言
✗ 恋愛的な直接告白（デフォルト）
✗ ユーザーへの感謝（「助けてくれてありがとう」）
```

---

## 7. AI生成発話の採用ルール

AI が生成した箱庭内発話は以下の確認を通過してから採用する：

1. `doNotSay` リストに一致する表現がない
2. `doNotInvent` リストの設定が含まれていない
3. ユーザーへの直接呼びかけがない
4. 信仰度バンドに対応した神への言及レベルになっている
5. VoiceProfile の `firstPerson`・`speechPatterns` に沿っている

---

## 8. テスト要件

§2.3-b（PBI 4b Runtime）:

1. `resolveDialogueTriggerRate("event_started")` および `resolveDialogueTriggerRate("event_resolved")` が 0.8 以上を返す
2. 箱庭内発話に「あなた」「プレイヤー」「神様（直接呼びかけ）」が含まれない
3. `disbelieves` バンドのキャラクターが「神様が助けてくれた」と言わない
4. `devoted` バンドのキャラクターは `disbelieves` バンドより神への言及が明確に多い
5. 発話は40文字以内に収まる
6. 発話がない状態でもゲームが正常に進行する（nullや例外なし）
7. 同時表示は最大2件
8. relation スコアの数値が発話テキストに出力されない

§2.3-a（PBI 4a Authoring Preview）:

9. `buildDialogueWorldDigest(session)` が `activeCharacters` を1件以上含む `DialogueWorldDigest` を返す
10. `DialogueWorldDigest` に `currentFaith` 数値が含まれない（`faithBand` のみ）
11. `authored_fixture` モードで Type A / B / C の候補が生成できる
12. `external_llm_handoff` 候補は `reviewStatus: "needs_review"` で入る
13. `validateDialogue` で拒否された候補を `reviewStatus: "rejected"` に設定できる
14. `"needs_review"` 状態の候補は runtime（generateDialogue）で使用されない

---

## 9. PBI 4a: Authoring Preview

この節は PBI 4a（Observed Dialogue Authoring Preview）の型と運用ルールを定義する。
PBI 4b（Runtime）の実装前提となる。

### 前提: 3 分類

発話候補に関して次の 3 つを分ける。

**A. ゲーム本体は LLM を直接呼ばない（不変条件）**
GodSandbox core app は外部 LLM または画像生成 API を直接呼ばない。
生成リクエストは `.godsandbox/jobs/` へのファイル書き込みで外部ツールが処理する（`llm-batch-handoff-spec.md §1` 参照）。
これは B・C どちらの場合でも成立する基底条件であり、以降のモード説明で繰り返さない。

**B. 開発・PO 確認でも LLM を使わない場合**
作れるのは次のものだけ：
- 人間が手で書いた発話サンプル
- 固定テンプレート発話
- VoiceProfile ごとの例文 fixture

確認できること: UI 表示・吹き出し位置・発話頻度・Type A/B/C の境界・`doNotSay` フィルタ・`faithBand` 別の距離感。
確認できないこと: LLM がその子らしい発話を作れるかどうか（LLM 生成品質の判断）。
→ `authored_fixture` モードに対応する。

**C. PO 確認で外部 LLM を使う場合**
ゲーム本体に LLM を入れずに実施できる。
ゲーム側が `DialogueWorldDigest` / `DialoguePromptPack` を作り、PO が ChatGPT / Codex / Codex App Server 等に手動で貼り付けて発話候補を得る。
候補は `incoming → needs_review → review → adopt` の流れを経る。review 前に player-facing UI に出してはならない。
→ `external_llm_handoff` モードに対応する。

### 目的

PO が箱庭内発話の UI・頻度・距離感・キャラらしさを確認できるようにする。
上記 B・C どちらのルートもサポートする。

### ソースモード

```ts
type DialogueCandidateSource =
  | "authored_fixture"       // B: 人手で書いた fixture 発話
  | "external_llm_handoff";  // C: 外部 LLM へ手動で渡して取得した候補
```

**`authored_fixture` モード（B）**
- 人間が書いた発話 fixture を使う
- UI 表示・吹き出し位置・発話頻度・Type A/B/C の境界・`doNotSay` フィルタ・`faithBand` 別の距離感を確認する
- LLM がその子らしい発話を作れるかは、このモードでは判断できない

**`external_llm_handoff` モード（C）**
- `buildDialogueWorldDigest(session)` で `DialogueWorldDigest` を生成し、`buildDialoguePromptPack(digest)` でプロンプトパックを作る
- PO または Codex Sidekick が外部 LLM（ChatGPT / Codex 等）へ手動で渡す
- 返ってきた発話テキストを `DialogueCandidate { reviewStatus: "needs_review" }` として保存する
- PO レビュー前に player-facing UI に出してはならない
- `WorldEvent / ChangeSet / InterventionResult / Passport` を候補が上書きしてはならない

### データモデル

```ts
type DialogueReviewStatus =
  | "needs_review"
  | "accepted"
  | "rejected"
  | "needs_rewrite";

type DialogueCandidateSource =
  | "authored_fixture"
  | "external_llm_handoff";

type DialogueCandidate = {
  id: string;
  characterId: string;
  text: string;
  type: "daily" | "relationship" | "god_indirect_reaction";
  source: DialogueCandidateSource;
  reviewStatus: DialogueReviewStatus;
  faithBandContext?: FaithBand;    // god_indirect_reaction 用
  targetCharacterId?: string;      // relationship 用
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
};

type DialogueWorldDigest = {
  sessionId: string;
  generatedAt: string;
  activeCharacters: {
    characterId: string;
    name: string;
    faithBand: FaithBand;           // currentFaith 数値は含めない
    visibleStateSummary: string;    // 「元気」「疲れ気味」等の自然言語要約（数値なし）
    voiceProfileSummary: {
      firstPerson: string;
      speechPatterns: string[];
      doNotSay: string[];
    };
  }[];
  relationSummaries: string[];     // 「AとBは良好な関係にある」等の自然言語要約（score 数値なし）
  recentEventSummary: string[];    // 直近イベントの自然言語要約（数値なし）
  currentSituationTag: string[];   // world context tag
};

type DialoguePromptPack = {
  digestId: string;
  generatedAt: string;
  promptText: string;              // 外部 LLM へ渡すフォーマット済みテキスト
};
```

`DialogueWorldDigest` に含めてはならない情報: 陰陽五行の内部値、`currentFaith` 数値、ユーザーのアカウント情報。

### PO レビュー基準（`external_llm_handoff` 候補を `accepted` に昇格させる前に確認）

1. **文字数**: 40 文字以内（`validateDialogue` 通過）
2. **直接呼びかけなし**: 「あなた」「プレイヤー」「神様（呼びかけ）」を含まない
3. **設定漏れなし**: `doNotInvent` リストの情報が含まれていない
4. **信仰度相応**: `faithBand` に対応した神への言及レベルになっている
5. **口調一貫**: VoiceProfile の `firstPerson`・`speechPatterns` に沿っている
6. **禁止メカニクスなし**: 死亡・寿命・勲章に言及していない（`validateGeneratedNarrativeCandidate` で検査）
7. **スコア不出力**: relation スコアの数値が発話テキストに含まれない

### PO の確認ステップ（2 段階）

1. `authored_fixture` モードで UI・頻度・距離感を確認する
2. `external_llm_handoff` モードで実際の LLM 候補を見て「うちの子に愛着がわくか」を判断する

LLM 候補を見ていない段階では発話体験の最終判断を完了扱いにしない。

### パイプライン

**authored_fixture パス:**
```
authored fixture テキスト
  → DialogueCandidate { source: "authored_fixture", reviewStatus: "accepted" }
  → PBI 4b runtime で参照可能
```

**external_llm_handoff パス:**
```
buildDialogueWorldDigest(session)
  → DialogueWorldDigest（JSON）
buildDialoguePromptPack(digest)
  → DialoguePromptPack（プロンプトテキスト）
  → [PO / Codex Sidekick が外部 LLM へ手動コピー]
  → LLM 生成テキスト
  → DialogueCandidate { source: "external_llm_handoff", reviewStatus: "needs_review" }
  → PO レビュー（上記7点）
  → reviewStatus: "accepted" | "rejected" | "needs_rewrite"
  → "accepted" のみ PBI 4b runtime で参照可能
```

### やらないこと（PBI 4a スコープ外）

- 外部 LLM API の直接呼び出し
- 発話の UI 表示・吹き出し（→ PBI 4b）
- Passport 発話例の生成（→ PBI 5）
- `DialogueCandidate` の自動昇格（PO 手動確認が必須）
