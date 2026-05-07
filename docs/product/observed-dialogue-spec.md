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
- relation スコアが一定以上または以下のとき（閾値: スコア ≥ 60 で「仲良し発話」、スコア ≤ 30 で「距離感発話」）
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

### phase_change / proximity_enter トリガーの発火条件

#### DayPhase 定義

箱庭の 1 育成サイクル（30 分）を 4 等分した時間帯フェーズを使う：

```ts
type DayPhase = "morning" | "afternoon" | "evening" | "night";

function resolveDayPhase(elapsedMs: number, cycleDurationMs: number): DayPhase {
  const t = elapsedMs / cycleDurationMs;
  if (t < 0.25) return "morning";
  if (t < 0.5)  return "afternoon";
  if (t < 0.75) return "evening";
  return "night";
}
```

#### SandboxSession への追加フィールド（PBI 4 で追加）

```ts
currentDayPhase: DayPhase;
proximityState: Record<string, "near" | "far">;
// キーは [charIdA, charIdB].sort().join("::") — lexicographic ソート確定（逆順の重複防止）
positions: Record<CharacterId, { x: number; y: number }>;
```

#### 発火タイミング

**`phase_change`**
- 毎 tick の冒頭で `prevDayPhase !== currentDayPhase` を検出したとき、全 active キャラクターに 1 回発火。
- `resolveDialogueTriggerRate("phase_change")` = 0.1 のため多くの tick は null を返す。

**`proximity_enter`**
- `PROXIMITY_THRESHOLD = 2.0`（ワールド座標単位）。
- `prevDist > PROXIMITY_THRESHOLD` かつ `currDist <= PROXIMITY_THRESHOLD` のペアに対して、両者それぞれに発火。
- 同一ペアが近接状態を維持する間は再発火しない。`currDist > PROXIMITY_THRESHOLD * 1.5` で "far" にリセット。

#### Dialogue Tick Handler

`phase_change` / `proximity_enter` の検出と `generateDialogue` 呼び出しは、イベント生成ループとは独立した **dialogue tick handler** が担う。`SandboxSession.currentEventId` を変更しない。

```ts
type DialogueUtterance = {
  characterId: CharacterId;
  trigger: DialogueTrigger;
  text: string;
  nearbyCharacterId?: CharacterId; // proximity_enter の場合のみ
};

function runDialogueTick(
  session: SandboxSession,
  prevSession: SandboxSession,
  voiceProfiles: Record<CharacterId, VoiceProfile>,
  emit: (utterance: DialogueUtterance) => void,
): void;
```

`runDialogueTick` は sandbox runtime の main tick から呼ぶ（イベント生成・介入適用とは別レーン）。

---

### 発話生成関数

発話生成は以下のシグネチャで定義する：

```ts
function generateDialogue(
  character: Character,
  trigger: DialogueTrigger,
  faithBand: FaithBand,
  voiceProfile: VoiceProfile,
  nearbyCharacters?: Character[]
): string | null;
// `null` = 発話なし（確率判定でトリガーが発生しなかった場合）
```

トリガーごとの Type 選択ロジックは以下の擬似コードに従う（Type A / B / C の定義は §2 を参照）：

```
1. rate = resolveDialogueTriggerRate(trigger)
   if random() >= rate → return null

2. trigger が "event_started" または "event_resolved" の場合:
   - random() < 0.5 → Type C (god_indirect_reaction) を生成（faithBand に応じた内容 — §2 Type C 参照）
   - random() >= 0.5 → Type B (relationship) を生成（nearbyCharacters がある場合）
                        nearbyCharacters がなければ Type A にフォールバック
   ※ event_started / event_resolved での Type C / B 比率は 50/50 を基準とする

3. trigger が "intervention_applied" の場合:
   - Type C (god_indirect_reaction) を生成（faithBand に応じた内容 — §2 Type C 参照）

4. trigger が "proximity_enter" の場合:
   - random() < 0.5 → Type B (relationship) を生成（nearbyCharacters がある場合）
                       nearbyCharacters がなければ Type A にフォールバック
   - random() >= 0.5 → Type A (daily) を生成

5. trigger が "idle_timer" または "phase_change" の場合:
   - Type A (daily) を生成

6. voiceProfile.doNotSay に含まれるキーワードが発話に含まれる場合は発話を破棄して null を返す。
   （truncation の前に確認すること。truncation で禁止表現を切り落とすことは許可しない）

7. 生成した発話が 40 文字超の場合:
   - 40 文字で切り詰める（MVP）。表示ルールは §4 を参照。

random() は `Math.random()` を指す（この確率判定は表示用の多様性確保であり、seeded RNG ではない）。
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

### Type C 発話の永続化詳細

§5 の「Passport 候補として保持可」を実現するための型と保存フロー。

#### GodIndirectReflection 型

```ts
type GodIndirectReflection = {
  utteranceText: string;             // 最大 40 文字（truncation 後）
  trigger: "event_resolved" | "intervention_applied";
  faithBandAtUtterance: FaithBand;
  faithValueAtUtterance: number;     // Passport JSON に数値として出力しない
  sourceEventId?: string;
  sourceInterventionId?: string;
  occurredAt: string;                // ISO8601
};
```

#### CharacterSnapshot への追加（PBI 4 / PBI 5 で追加）

```ts
recentGodIndirectReflections: GodIndirectReflection[];
// 最大 3 件。occurredAt 降順（最新が先頭）。4 件目以降は最古を破棄（FIFO+cap）。
```

#### 保存フロー

`generateDialogue` は純関数のまま。保存は dispatch 側で行う：

1. `generateDialogue(...)` が `null` 以外を返したとき、呼び出し側が `trigger` を確認する。
2. `trigger` が `"event_resolved"` または `"intervention_applied"` の場合のみ、Type C 判定を行う。
3. `classifyDialogueType` で Type C かどうかを判定する：

```ts
function classifyDialogueType(
  text: string,
  voice: VoiceProfile,
): "daily" | "relationship" | "god_indirect_reaction" {
  const godKeywords = ["神", "不思議", "気配", "背中を押", "見られている", "誰か"];
  if (godKeywords.some(k => text.includes(k))) return "god_indirect_reaction";
  // マッチなし → 必ず "daily" を返す（"relationship" への誤分類を避けるため保守的に判定）
  return "daily";
}
```

4. Type C と判定された場合のみ `recentGodIndirectReflections` 先頭に prepend し、3 件超は末尾を切り捨てる。

#### Passport ビルダーでの利用

`buildMemorySummary` は `recentGodIndirectReflections[0]` があれば末尾に 1 文追加する：
```
「{utteranceText}」と感じていた。
```
0 件の場合は既存の event / relation 要約のみで構築する（`passport-outside-world-spec.md §2` 参照）。

`faithValueAtUtterance` は Passport JSON に数値として出力しない（§4 の信仰度数値表示禁止に従う）。

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

1. `resolveDialogueTriggerRate("event_started")` および `resolveDialogueTriggerRate("event_resolved")` が 0.8 以上を返す
2. 箱庭内発話に「あなた」「プレイヤー」「神様（直接呼びかけ）」が含まれない
3. `disbelieves` バンドのキャラクターが「神様が助けてくれた」と言わない
4. `devoted` バンドのキャラクターは `disbelieves` バンドより神への言及が明確に多い
5. 発話は40文字以内に収まる
6. 発話がない状態でもゲームが正常に進行する（nullや例外なし）
7. 同時表示は最大2件
8. relation スコアの数値が発話テキストに出力されない
