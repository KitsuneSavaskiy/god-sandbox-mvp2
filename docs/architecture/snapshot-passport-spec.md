# Snapshot と Passport の仕様

状態: 管理対象の正本ドキュメント

この文書は character snapshot と passport をどう記録し、注記し、再生成し、export するかを固定する。

## 基本方針

- snapshot 記録と passport export は別ステップとする。
- snapshot はゲーム世界内の固定記録である。
- passport は snapshot から派生する表示 / export artifact である。
- passport は GodSandbox の stable file format だが、すべての外部ゲームに対する rigid な live contract にはしない。

## snapshot ルール

- snapshot は任意の時点の単体 character に対して記録する。
- 記録時点そのものは固定される。
- capture 後でも tag や memo の annotation は追加できる。
- 必要なら canonical world data から後で snapshot payload を再生成できるようにする。

推奨 snapshot 形状:

```ts
interface CharacterSnapshot {
  id: string;
  characterId: string;
  createdAt: string;
  sourceWorldId: string;
  sourceSessionId: string;
  sourceEventId?: string;
  character: Character;
  relations: CharacterRelation[];
  recentEvents: Pick<WorldEvent, "id" | "summary" | "status" | "createdAt">[];
  worldContextRefs: string[];
  annotations: {
    tags: string[];
    memo?: string;
    updatedAt?: string;
  };
}
```

## snapshot の最低保持内容

snapshot は外部 role-play や prompt-driven な後続利用に十分な context を持つ必要がある。

最低限含めるもの:

- character profile
- current character state
- recent relation context
- recent event context
- world-context reference
- canonical ID による asset 参照
- speech-style 参照

ルール:

- character の speech style は character 側 data file から解決できるようにする。
- world context は world / chunk file から解決できるようにする。
- prompt builder や export tool は、必要に応じて両方の file を読み合わせてよい。

## snapshot 再生成と将来 import 互換

- snapshot の再生成は許可し、想定機能とする。
- 再生成時も snapshot identity を保つか、元の capture へ trace できる provenance を残す。
- 形式は、将来の外部ゲーム側で変化した character state を import する拡張を妨げないようにする。
- MVP の時点では完全な round-trip import は不要だが、ID や provenance の持ち方で将来を塞がない。

## passport ルール

- passport 発行は明示的なユーザー操作で行う。
- どの eligible snapshot からでも任意タイミングで export できる。
- MVP では単体 character passport を基本とする。
- 4人編成 passport は将来追加してよいが、単体 model を壊さない。

推奨 passport 形状:

```ts
interface CharacterPassport {
  id: string;
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
  fileNameToken: string;
  display: Record<string, unknown>;
  exportHints: {
    referencedCharacterFileId: string;
    referencedAssetIds: string[];
    sourceWorldId: string;
  };
}
```

## passport のファイル命名

- passport filename は人が読める形を保つ。
- 同時に downstream tool が安定照合できる stable token も含める。
- filename 自体を canonical identifier にはしない。

推奨 pattern:

```text
<character-slug>--<passport-file-token>.json
```

## 外部利用方針

- 外部ゲームは passport を緩やかに解釈してよい。
- GodSandbox は、すべての外部 consumer に対して1つの strict runtime schema を約束しない。
- passport は file 交換と prompt-driven role-play に十分な安定性を持てばよい。
- asset matching は display filename だけでなく passport 内の canonical ID を使う。

## annotation と export の境界

- 後から追加した snapshot annotation は、元の capture payload 自体は書き換えない。
- 新しく export する passport には、その snapshot に紐づく最新 annotation を反映してよい。
- export tool は次を明確に区別して扱う。
  - 固定された capture data
  - 後から追加された user annotation
  - export 時の derived display formatting
