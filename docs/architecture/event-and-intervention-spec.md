# イベントと介入の仕様

状態: 管理対象の正本ドキュメント

この文書は `god-sandbox-mvp2` のイベントループ、介入、変化適用ルールを固定する。

## イベント生成方針

- event 生成は純ランダムでも完全自由文でもなく、ハイブリッド方式とする。
- generator は curated template と structured rule を起点にする。
- template 選択は次の要素で重み付けする。
  - relation score
  - personality vector
  - world / situation tag
  - ongoing effect
  - recent event history
- 同じ seed、world state、weighted input を与えた場合は deterministic に再現できるようにする。

推奨 pipeline:

1. 現在の session projection を読む。
2. `activeSlots` から candidate character を集める。
3. relation と world-context tag を広げる。
4. eligible な event template を score 付けする。
5. `primaryCharacterId` を1件、`participantCharacterIds` を1件以上持つ current event を構築する。
6. 新 event を保存し、`currentEventId` をその event へ向ける。

## current event ルール

- `SandboxSession.currentEventId` は常に1件の current event record を指す。
- current event の status は `pending`、`active`、`resolved`、`expired`、`chained` を取りうる。
- 1つの event が current focus としての役割を終えるときは、post-event autosave を確定する前に次の current event を割り当てる。

## イベントライフサイクルルール

`WorldEvent.status` は `pending → active → (resolved | expired | chained)` の単方向遷移を取る。一度 terminal（`resolved` / `expired` / `chained`）に入った event は再 `active` 化しない。

```
pending  →  active     (generator が active slot に commit)
active   →  resolved   (最初に成功した介入が適用)
active   →  expired    (TTL 経過: EVENT_TTL_MINUTES = 6 分)
active   →  chained    (連鎖条件を満たす介入が適用)
```

### Resolve ルール

`applyIntervention(...)` が成功した瞬間（watch/help/trial 問わず）その event を `"resolved"` に遷移させる。MVP では 1 event = 1 intervention で resolve 確定とする。

### Expiry ルール

TTL = **実時間 6 分**（`export const EVENT_TTL_MINUTES = 6`）。起点は `WorldEvent.createdAt`。

expiry 直後に `primaryCharacterId` に対して `watch_failure` 相当（-1）の faith ChangeSet（kind: `status-delta`）を記録する。`InterventionRecord` は伴わない。

### Chain ルール

以下のいずれかを満たす介入が完了したとき、`resolve` の代わりに `chained` に遷移し、子 event を生成する：

1. `ChangeSet` に `kind === "ongoing-effect-created"` が含まれる
2. この介入の `relation-delta` の `|delta|` が 10 以上

### advanceEventLifecycle 関数

遷移判定は以下の 1 関数に集約する（優先順位: expired > chained > resolved）：

```ts
type AdvanceEventLifecycleInput = {
  event: WorldEvent;
  now: string; // ISO8601
  appliedIntervention?: {
    changeSetKinds: ReadonlyArray<ChangeSetKind>; // src/domain/models.ts で定義済み
    relationDeltaMaxAbs: number;
  };
};

type AdvanceEventLifecycleOutput =
  | { kind: "no-change"; event: WorldEvent }
  | { kind: "resolved"; event: WorldEvent }
  | { kind: "expired"; event: WorldEvent }
  | { kind: "chained"; event: WorldEvent; childEventSeed: { chainedFromEventId: string } };

export function advanceEventLifecycle(input: AdvanceEventLifecycleInput): AdvanceEventLifecycleOutput;
```

呼び出しは 2 箇所：
- **介入完了後（同期）**: `applyIntervention` 直後に `appliedIntervention` を渡して呼ぶ。
- **時間経過 tick**: 1 分ごとの tick から `appliedIntervention: undefined` で呼ぶ。

`chained` の場合、呼び出し側は `generateWorldEvent({ chainedFromEventId })` を続けて呼び、`session.currentEventId` を子 event に差し替える。

### テスト要件（イベントライフサイクル）

- TTL を 1 ms 超えた瞬間に `"expired"` になる（境界条件）。
- `relationDeltaMaxAbs === 9` → `"resolved"`、`10` → `"chained"`。
- `ongoing-effect-created` を含む介入は `relationDeltaMaxAbs === 0` でも `"chained"`。
- expired 後の primary character の faith が（介入前 faith）-1 以上（下限 0 クランプ）。

## 参加者モデル

- すべての event は `primaryCharacterId` を1件持つ。
- すべての event は `participantCharacterIds` を1件以上持つ。
- primary character は必ず `participantCharacterIds` にも含める。
- UI 文言では次のルールを使う。
  - primary character を主役として表示する
  - それ以外の参加者を脇役として表示する

## event 描画方針

許可する描画経路は2つある。

- 安定してテストできる deterministic template rendering
- richer な UI 合成や prompt 生成に使う structured-data rendering

ルール:

- event storage は deterministic な文面を再生成できるだけの structured data を持つ。
- 外部 AI が作った自由文は正本の event record にしない。
- アプリ外で richer narrative text を生成しても、それは補助表示に留める。

## 介入ルール

- 介入 enum の正本は `watch | help | trial` とする。
- MVPでは 1 event = 1 intervention とする。resolve 後は同一 event への再介入を受け付けない（将来拡張で複数回介入を許可する予定）。
- `watch` の resourceCost は `0` である。
- `help` と `trial` は有限の god point を消費する。
- resource 検証は persistence commit 前に application layer で行う。
- intervention 履歴は `InterventionRecord` を独立保存する。

## 育成サイクルの仮バランス

Sprint8 MVPでは、1回の育成サイクルを30分以内に一区切りできる体験として扱う。
この仮バランスは後から調整できるよう、domain定数として切り出す。

- 1育成サイクルの目標時間は30分。
- 1育成サイクルの目標イベント数は10件。
- 10件未満は進行中、10件到達で一区切り扱いにできる。
- `watch` は消費0で、見守る導線を塞がない。
- `help` は中消費、`trial` は高消費の有限リソースとして扱う。
- 時間経過で god point は小さく回復する。
- UI文言には内部定数名や細かい回復tickを出しすぎない。

この仕様は死亡・寿命・勲章を扱わない。

推奨 `InterventionRecord` 拡張:

```ts
interface InterventionRecord {
  id: string;
  eventId: string;
  type: "watch" | "help" | "trial";
  resourceCost: number;
  godPointsBeforeApply: number;
  godPointsAfterApply: number;
  playerReason?: string;
  playerMemo?: string;
  changeSetIds: string[];
  createdAt: string;
}
```

## プレイヤー誘導シグナル

- `playerReason` と `playerMemo` はプレイヤー自身が書く正本シグナルとして扱う。
- これらは今後の story generation や外部 prompt generation をプレイヤーが誘導するために保存する。
- application は deterministic な重み付けルールの入力として使ってよい。
- 外部 AI 用の prompt builder がこの値を含めることはできるが、ゲーム本体はそれなしでも成立しなければならない。

## 変化適用モデル

- キャラクター変化は append-only の `ChangeSet` record として積む。
- `ChangeSet` は kind ごとに型安全に分類する。
- 各 `ChangeSet` は次を持つ。
  - delta patch
  - target character
  - source event
  - optional な source intervention
  - post-apply snapshot
  - optional な origin metadata

`ChangeSet.patch` の想定:

- `status-delta`: 変更した数値 status key と差分量
- `personality-delta`: personality axis と差分量
- `relation-delta`: relation score 差分の入力
- `appearance-update`: asset 更新、sprite 再生成 hint、由来 linkage
- `speech-style-update`: 次の speech style template ID
- `narrative-role-update`: 自由文の立場更新
- `ongoing-effect-created`: 生成された継続効果 payload

## 即時効果と継続効果

- 一部の介入は即時 `ChangeSet` だけを出す。
- 一部の介入は `OngoingEffectInstance` も生成する。
- 継続効果は future event completion、event count、trigger exhaustion などで解消する。
- 継続効果は UI 演出ではなく canonical gameplay state として扱う。

## relation 再計算ルール

- relation score は高速参照のため current 値を materialize してよい。
- ただし正本の導出経路は履歴側に置く。
  - event history
  - intervention history
  - relation 系 `ChangeSet`
- repair や migration 時には履歴から再計算できるようにする。

## リレーションスコア初期値（全 6 ペア）

デフォルト 4 名の全 6 ペアの relation は sandbox session を seed する瞬間に materialize する（未生成ペアを置かない。Type B 発話が seed 直後から発火するための前提）。

### 初期スコア

| ペア | 初期スコア | 根拠 |
|---|---:|---|
| Eve ↔ Garan   | +15 | 穏やかな距離感。互いに摩擦が少ない。 |
| Eve ↔ Ryo     | +25 | Eve の思慮深さが Ryo の前向きさを受け止める。 |
| Eve ↔ Suzu    | +20 | 穏やかさの方向性が一致。 |
| Garan ↔ Ryo   | −10 | Garan の reserved/intense と Ryo のエネルギーが衝突しやすい。 |
| Garan ↔ Suzu  |  +5 | Suzu の穏やかさに Garan は害を感じない。 |
| Ryo ↔ Suzu    | +10 | 既存実装（runtimeBootstrap.seedRelation）との互換値。 |

スコア範囲は −100〜+100。seed 直後は誰も `>= 60`（仲良し発話閾値）にも `<= -30`（距離感発話閾値）にも到達しない。Garan↔Ryo の −10 は −10 > −30 のためシード直後は距離感発話を発生させない。数イベント後に `<= -30` へ到達できる位置として設計している。

### 定数と生成関数（配置先: src/domain/relations.ts）

```ts
export const INITIAL_RELATIONS: Record<string, number> = {
  "chr_eve__chr_garan": 15,
  "chr_eve__chr_ryo":   25,
  "chr_eve__chr_suzu":  20,
  "chr_garan__chr_ryo": -10,
  "chr_garan__chr_suzu": 5,
  "chr_ryo__chr_suzu":  10,
};

// pair key: [charIdA, charIdB].sort().join("__")（lexicographic ソート確定）
// relation ID: "rel_" + pairKey

export function buildDefaultCharacterRelations(now: string): CharacterRelation[];
```

`runtimeBootstrap.ts` の既存 `seedRelation`（Ryo↔Suzu のみ）をこの定数から全 6 件に書き換える。

## 外部 narrative 方針

- アプリ本体は外部 AI API を直接呼ばない。
- 外部 Codex などで parallel narrative text を生成してよい。
- ただしアプリ内の正本責務は次までに留める。
  - deterministic な event data 生成
  - deterministic な render text
  - prompt / export packet 生成
- 外部 narrative pack が未生成、失敗、review 待ちの場合も、イベントは既存の event summary、situation tag、intervention result 文で進行する。
- Codex 生成完了を gameplay は同期的に待たない。生成物があれば補助表示に使い、なければ fallback で進む。
- generated content の fallback 詳細は `docs/architecture/sandbox-generated-content-fallback-spec.md` を参照する。
