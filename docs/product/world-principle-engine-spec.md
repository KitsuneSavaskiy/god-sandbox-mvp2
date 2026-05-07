# 世界理エンジン仕様書（World Principle Engine）

状態: 管理対象の正本ドキュメント

この文書は GodSandbox の内部イベント生成原理（陰陽五行）を固定する。
実装前に `docs/product/core-experience-spec.md` を必ず読むこと。

**重要：この文書に記載される五行値・陰陽値は GodSandbox 内部専用であり、Passport・外部ゲーム・ユーザー向け UI に一切出力してはならない。**

---

## 1. 定義と目的

世界理エンジン（World Principle Engine）は、箱庭内のイベント・発話・関係変化・信仰度変化を「偶然ではなく意味のある流れ」として生成するための内部原理である。

プレイヤーには見えない。キャラクターも認識しない。UI にも表示されない。
あくまでイベント生成の「隠れた重み付け」として機能する。

---

## 2. MVP 実装方針（方式 E）

MVP では以下の最小実装を採用する：

**方式 E：イベントテンプレートへの隠れタグ付け**

- 各イベントテンプレートに `principleProfile`（五行・陰陽タグ）を付与する
- キャラクターの status ブロックから暗黙的な五行傾向（`implicitPhase`）を算出する
- イベント選択時に `principleProfile` と `implicitPhase` の相性を重み付けとして使う
- 五行値を独立して永続保存しない（status から毎回導出する）

方式 E は将来的に方式 B（起動時に status から完全算出・永続化）へ拡張できるが、MVP では不要。

---

## 3. 五行（Five Phases）

### 定義

| 五行 | 記号 | 傾向 | 対応 status 軸（参考） |
|---|---|---|---|
| 木（Wood） | `wood` | 成長・拡張・柔軟 | ambition, empathy |
| 火（Fire） | `fire` | 情熱・活性・起伏 | courage, stress |
| 土（Earth） | `earth` | 安定・調和・包容 | harmony, trustfulness |
| 金（Metal） | `metal` | 収縮・精密・決断 | insight, discipline※ |
| 水（Water） | `water` | 静寂・内省・受容 | vitality, empathy |

※ discipline は personality vector 軸。

### 型定義

```ts
type FivePhase = "wood" | "fire" | "earth" | "metal" | "water";

// MVP 方式E では使用しない。将来の方式B（status から完全算出・永続化）のための予約型。
type FivePhaseVector = {
  wood:  number;  // 0.0 ~ 1.0（合計が 1.0 になるよう正規化は任意）
  fire:  number;
  earth: number;
  metal: number;
  water: number;
};
```

---

## 4. 陰陽（Yin-Yang Polarity）

### 定義

| 極性 | 記号 | 傾向 | 典型状態 |
|---|---|---|---|
| 陽（Yang） | `yang` | 外向き・活性・動 | stress 高・courage 高 |
| 陰（Yin）  | `yin`  | 内向き・静止・受 | vitality 高・harmony 高・empathy 高（外向き活性が低い状態） |

### 型定義

```ts
type YinYangPolarity = "yang" | "yin" | "balanced";

function resolvePolarity(status: CharacterStatusBlock): YinYangPolarity {
  const yangScore = (status.courage + status.stress + status.ambition) / 3;
  const yinScore  = (status.vitality + status.harmony + status.empathy) / 3;
  const diff = yangScore - yinScore;
  if (diff > 15) return "yang";
  if (diff < -15) return "yin";
  return "balanced";
}
```

---

## 5. 相生・相剋ルール

### 相生（Sheng / Nourish）

```
木 → 火 → 土 → 金 → 水 → 木
```

木は火を生む、火は土を生む……の循環。隣接する五行は親和性が高い。

### 相剋（Ke / Restrain）

```
木 → 土 → 水 → 火 → 金 → 木
```

木は土を克する、土は水を克する……の循環。二つ置きの五行は緊張関係にある。

### 型定義

```ts
type PrincipleRelation = "nourish" | "restrain" | "neutral";

function getPrincipleRelation(from: FivePhase, to: FivePhase): PrincipleRelation {
  const SHENG: Record<FivePhase, FivePhase> = {
    wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood",
  };
  const KE: Record<FivePhase, FivePhase> = {
    wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood",
  };
  if (SHENG[from] === to) return "nourish";
  if (KE[from] === to) return "restrain";
  return "neutral";
}
```

---

## 6. キャラクターの暗黙的五行傾向

キャラクターの status から暗黙的な五行傾向を算出する。永続保存しない。

```ts
function resolveImplicitPhase(status: CharacterStatusBlock): FivePhase {
  const scores: Record<FivePhase, number> = {
    wood:  (status.ambition  + status.empathy)        / 2,
    fire:  (status.courage   + status.stress)         / 2,
    earth: (status.harmony   + status.trustfulness)   / 2,
    metal: (status.insight   + (100 - status.stress)) / 2,
    water: (status.vitality  + status.empathy)        / 2,
  };
  // tie-breaking: 同スコア時は宣言順（wood > fire > earth > metal > water）で先の要素を優先
  const ORDER: FivePhase[] = ["wood", "fire", "earth", "metal", "water"];
  return ORDER.reduce((a, b) => scores[a] >= scores[b] ? a : b);
}
```

---

## 7. イベントテンプレートへの五行プロフィール付与

`EventTemplate` は `docs/architecture/event-and-intervention-spec.md` の `WorldEvent` テンプレートとして扱う。
MVP の `EVENT_TEMPLATES` 定数では各テンプレートが `principleProfile` を必ず持つ（required）。
`calcEventWeight` は引数 `template` の `principleProfile` を optional として受け取ることで、
将来の principleProfile なしテンプレートとの後方互換を保証する（関数シグネチャ参照）。

各イベントテンプレートは `principleProfile` を持つ（省略時は weight = 1.0 のフォールバック）。

```ts
// WorldEvent を生成するテンプレートの拡張。EVENT_TEMPLATES では principleProfile は required。
type EventTemplatePrincipleProfile = {
  dominantPhase: FivePhase;        // このイベントの主五行
  polarity:      YinYangPolarity;  // 陽的（活性）か陰的（内省）か balanced か
  principleRole: EventPrincipleRole; // イベントが世界に対して果たす機能
};

type EventPrincipleRole =
  | "nourish"    // 相生：次の成長を生む出来事
  | "restrain"   // 相剋：問題・摩擦・試練
  | "circulate"  // 循環：日常の流れを維持する
  | "reveal"     // 顕現：潜在していたものが表に出る
  | "bind"       // 結縁：関係性が深まる出来事
  | "separate";  // 離別：距離が生まれる出来事
```

### テンプレート例

```ts
const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "ET_001",
    name: "水汲み争い",
    principleProfile: {
      dominantPhase: "water",
      polarity: "yang",
      principleRole: "restrain",
    },
    // ... 通常のテンプレートフィールド
  },
  {
    id: "ET_002",
    name: "木陰での昼寝",
    principleProfile: {
      dominantPhase: "wood",
      polarity: "yin",
      principleRole: "circulate",
    },
  },
];
```

---

## 7.1 イベントテンプレートレジストリ（MVP 最小セット）

### 前提ファイル（PBI 7 で新規作成）

- `src/domain/worldPrinciple.ts` — `FivePhase`, `YinYangPolarity`, `EventPrincipleRole`, `EventTemplatePrincipleProfile` をエクスポートする（§3〜7 の型定義を集約）。
- `src/domain/eventTemplates.ts` — `EventTemplate` 型と `EVENT_TEMPLATES` 定数。

### EventTemplate 型

```ts
// src/domain/eventTemplates.ts
import type { EventTemplatePrincipleProfile } from "./worldPrinciple.js";

export type EventTemplate = {
  id: string;                            // "ET_001" 形式の安定 ID
  name: string;                          // 内部表示名（日本語）
  principleProfile: EventTemplatePrincipleProfile; // MVP では必須（optional にしない）
  situationTags: readonly string[];
  minParticipants: 1 | 2 | 3 | 4;
  renderSummary: (input: { primaryName: string; participantNames: readonly string[] }) => string;
};
// renderSummary は関数フィールドのため JSON シリアライズ不可。
// WorldEvent には templateId: string のみを保存し、テンプレート自体は定数として保持する。
```

### MVP 最小セット（6 件）

`EventPrincipleRole` の 6 種すべてを 1 件ずつカバーする：

```ts
export const EVENT_TEMPLATES: readonly EventTemplate[] = [
  {
    id: "ET_001", name: "若芽の発見",
    principleProfile: { dominantPhase: "wood",  polarity: "yang",     principleRole: "nourish"   },
    situationTags: ["daily-life", "growth"],   minParticipants: 1,
    renderSummary: ({ primaryName }) =>
      `${primaryName}は新しく芽吹いたものに気づき、何かを始めたくなっている。`,
  },
  {
    id: "ET_002", name: "火種のいさかい",
    principleProfile: { dominantPhase: "fire",  polarity: "yang",     principleRole: "restrain"  },
    situationTags: ["conflict", "tension"],    minParticipants: 2,
    renderSummary: ({ primaryName, participantNames }) => {
      const partner = participantNames.find(n => n !== primaryName) ?? "誰か";
      return `${primaryName}と${partner}の間に小さな火種が生まれている。`;
    },
  },
  {
    id: "ET_003", name: "畑仕事の午後",
    principleProfile: { dominantPhase: "earth", polarity: "balanced", principleRole: "circulate" },
    situationTags: ["daily-life", "routine"],  minParticipants: 1,
    renderSummary: ({ primaryName }) =>
      `${primaryName}はいつもの仕事をいつもの手順でこなしている。`,
  },
  {
    id: "ET_004", name: "鏡に映る真意",
    principleProfile: { dominantPhase: "metal", polarity: "yin",      principleRole: "reveal"    },
    situationTags: ["introspection", "insight"], minParticipants: 1,
    renderSummary: ({ primaryName }) =>
      `${primaryName}は、自分でも気づかなかった気持ちに静かに気づいた。`,
  },
  {
    id: "ET_005", name: "夜の聞き役",
    principleProfile: { dominantPhase: "water", polarity: "yin",      principleRole: "bind"      },
    situationTags: ["bonding", "evening"],      minParticipants: 2,
    renderSummary: ({ primaryName, participantNames }) => {
      const partner = participantNames.find(n => n !== primaryName) ?? "誰か";
      return `${primaryName}は${partner}の話を、ただ静かに聞いている。`;
    },
  },
  {
    id: "ET_006", name: "別れ道の朝",
    principleProfile: { dominantPhase: "wood",  polarity: "yin",      principleRole: "separate"  },
    situationTags: ["parting", "morning"],      minParticipants: 2,
    renderSummary: ({ primaryName, participantNames }) => {
      const partner = participantNames.find(n => n !== primaryName) ?? "誰か";
      return `${primaryName}は${partner}と別の道を行く朝を迎えている。`;
    },
  },
];

export function findEventTemplateById(id: string): EventTemplate | undefined {
  return EVENT_TEMPLATES.find(t => t.id === id);
}
```

### テスト要件（§11 に追加）

10. `EVENT_TEMPLATES.length === 6` であり `EventPrincipleRole` の 6 種すべてが含まれる。
11. PBI 7 で `src/domain/events.ts` の `templateId: "daily-sandbox-observation"` ハードコードを `EVENT_TEMPLATES` からの加重選択に書き換える。本番経路で生成された `WorldEvent.templateId` は `EVENT_TEMPLATES` のいずれかの `id` と一致すること。
12. `findEventTemplateById` が未定義 ID に対して `undefined` を返す（クラッシュしない）。

---

## 8. イベント選択への影響

イベント生成時、候補テンプレートに重み付けを行う。

```ts
// DEFAULT_STATUS: principleProfile がない場合や characters が空の場合のフォールバック用初期値
const DEFAULT_STATUS: CharacterStatusBlock = {
  vitality: 50, empathy: 50, insight: 50, courage: 50,
  stress: 30, trustfulness: 50, ambition: 50, harmony: 50, faith: 30,
};

function calcEventWeight(
  template: { principleProfile?: EventTemplatePrincipleProfile },
  context: { primaryCharacter: Character; participantCharacters: Character[] }
): number {
  // principleProfile がないテンプレートは中立（weight = 1.0）として扱う
  if (!template.principleProfile) return 1.0;

  const allCharacters = [context.primaryCharacter, ...context.participantCharacters];
  const phases = allCharacters.map(c => resolveImplicitPhase(c.state.status));
  const polarity = resolvePolarity(context.primaryCharacter.state.status);
  const profile = template.principleProfile;

  let weight = 1.0;

  // キャラクターの主五行とイベント主五行が一致するとき確率 UP
  const dominantMatch = phases.filter(p => p === profile.dominantPhase).length;
  weight += dominantMatch * 0.2;

  // キャラクターがイベント主五行を「相生（nourish）」する関係にあるとき確率 UP
  const nourishCount = phases.filter(
    p => getPrincipleRelation(p, profile.dominantPhase) === "nourish"
  ).length;
  weight += nourishCount * 0.15;

  // キャラクターがイベント主五行と「相剋（restrain）」関係にあるとき緊張イベントとして確率 UP
  const restrainCount = phases.filter(
    p => getPrincipleRelation(p, profile.dominantPhase) === "restrain"
  ).length;
  weight += restrainCount * 0.1;

  // キャラクター群の陰陽極性とイベント極性が一致するとき +0.1
  if (polarity === profile.polarity) weight += 0.1;

  return weight;
}
```

重み付けは決定論的ではなく、seed を使った擬似乱数でサンプリングする。
seed は `SandboxSession.id`（= `input.seed`）とイベント生成時の ISO タイムスタンプ（`input.now`）を組み合わせる（同一の `(session.id, now)` ペアで結果を再現可能）。
これにより「同じキャラクターでも毎回同じ展開にならない」が、「そのキャラクターらしいイベントが出やすい」を両立する。

### 8.1 seed と stableHash の運用

seed 文字列から決定論的な数値を得るために、`src/domain/events.ts` で定義された `stableHash` を用いる。
**再実装してはならない。必ず `src/domain/events.ts` の export を `import { stableHash }` して再利用すること。**

```ts
// src/domain/events.ts
export function stableHash(value: string): number;
```

`input.seed`（= `SandboxSession.id`）をローカル変数 `seed` に束縛し、以下のパターンで使用する：

```ts
const seed = input.seed; // = SandboxSession.id
// activeCharacterCount >= 1 は assertSandboxSessionInvariants で保証される

// 1. 主役キャラクター選択（session.id のみで決まる安定的な選択）
const primaryIndex = stableHash(seed) % activeCharacters.length;

// 2. WorldEvent.id 生成（session.id + now + primaryCharacterId）
const id = `evt_${stableHash(`${seed}:${input.now}:${primaryCharacter.id}`).toString(36)}`;

// 3. 参加キャラクターのソート（session.id ごとに安定したランク付け）
seededCandidates.sort((left, right) =>
  stableHash(`${seed}:participant:${left}`) - stableHash(`${seed}:participant:${right}`),
);

// 4. 参加人数の決定（session.id ごとに安定）
const participantCount = 1 + (stableHash(`${seed}:participant-count`) % activeCharacterCount);
```

MVP では `eventGenerationCount` カウンタを `RuntimeWorldState` に持たない。タイムスタンプ（`now`）が呼び出しごとに変化するため再現性と多様性を両立できる。将来リプレイ機能が必要になった場合は `now` をモック化するか、カウンタ方式に移行する。

---

## 9. 出力禁止事項

以下は絶対に外部出力してはならない：

```
✗ Passport JSON への五行値（wood: 0.42 など）
✗ UI への陰陽・五行表示（「今は火の気が強い」など）
✗ キャラクター発話への五行言及（「金の気質があるから」など）
✗ イベントログへの五行ラベル出力
✗ Passport の faithChangeSummary や interpretationOfGod への五行名埋め込み
```

Passport が出力する情報は `docs/product/passport-outside-world-spec.md` の定義に従う。

---

## 10. 五行とイベントロールのマッピング例

Codex 実装時の参考として、既存イベントテンプレートへの付与例を示す。

| イベント種別 | dominantPhase | polarity | principleRole |
|---|---|---|---|
| 日常会話・散歩 | wood | yin | circulate |
| 突発的な口論 | fire | yang | restrain |
| 共同作業の成功 | earth | balanced | bind |
| 一人で試練を乗り越える | metal | yang | reveal |
| 悲しみに暮れる | water | yin | separate |
| 信頼の芽生え | wood | yin | bind |
| 事故・危機 | fire | yang | restrain |
| 静かな観察日 | water | yin | circulate |

---

## 11. テスト要件

1. `resolveImplicitPhase` が status 入力から五行を返す（5種類すべてのパスを通す）
2. `getPrincipleRelation` が相生（nourish）・相剋（restrain）・neutral を正しく返す（全 25 組合せ）
3. `calcEventWeight` で、あるキャラクターの implicitPhase がイベントの `dominantPhase` を相生（`PrincipleRelation.nourish`）する場合、neutral な関係より高い重みが返る（※`EventPrincipleRole.nourish` とは別概念）
4. `principleProfile` が未設定のテンプレートを渡したとき `calcEventWeight` が 1.0 を返す（クラッシュしない）
5. Passport JSON 出力に `wood` / `fire` / `earth` / `metal` / `water` フィールドが含まれない
6. UI コンポーネントが五行名を表示しない（静的解析またはスナップショットテストで確認）
7. 同一 seed で同一イベント列が生成される（決定論性）
8. 異なる personality のキャラクターで異なる五行傾向が算出される
9. tie-breaking: ambition=70 / empathy=70 / vitality=70 で wood と water が同スコアになる場合、wood が優先して返る
