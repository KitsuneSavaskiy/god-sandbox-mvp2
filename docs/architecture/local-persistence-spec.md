# ローカル永続化仕様

状態: 管理対象の正本ドキュメント

この文書は `god-sandbox-mvp2` が正本データをローカル filesystem にどう保存するかを定義する。

## 目的

- world をローカルに軽量保存する。
- 1つの巨大な JSON file を避ける。
- 可能な範囲で人が読めるデータ構造にする。
- migration を最初から現実的に運用できるようにする。
- React UI から直接 filesystem mutation しない。

## 永続化ルール

- MVP はローカル filesystem 保存のみを使う。
- DBMS は使わない。
- world directory をアプリケーションの正本データソースとする。
- 永続化アクセスは `persistence` layer のみが行う。
- `application` layer が read、write、autosave、migration を統括する。
- autosave は event 完了ごとに保証する。
- character 編集確定、snapshot 作成、passport export などの明示操作では即時 write を行ってよい。

## world directory 構成

正本 save root は world directory とする。

```text
worlds/
  <world-slug>--<world-id>/
    world.json
    session/
      current.json
    characters/
      <character-slug>--<character-id>.json
    templates/
      <template-slug>--<template-id>.json
    relations/
      <character-a-id>__<character-b-id>.json
    events/
      current/
        <event-id>.json
      history/
        2026-05/
          chunk-0001.json
          chunk-0002.json
    interventions/
      2026-05/
        chunk-0001.json
    changes/
      2026-05/
        chunk-0001.json
    effects/
      <effect-id>.json
    snapshots/
      <character-id>/
        <snapshot-id>.json
    passports/
      characters/
        <character-id>/
          <passport-file-token>.json
      squads/
    world-context/
      chunks/
        <chunk-id>.json
    assets/
      manifest.json
      characters/
        <character-id>/
          <asset-slug>--<asset-id>.png
          <asset-slug>--<asset-id>.json
```

## この構成にする理由

- `world.json` は高レベル metadata と version を持つ。
- `session/current.json` は現在の gameplay projection を持つ。
- `characters/` を個別 file 化することで、1人の編集で world 全体を書き換えずに済む。
- `relations/` は pairwise relation を独立保存できる。
- `events/`、`interventions/`、`changes/` は月別と連番 chunk に分けて、履歴 file の肥大化を防ぐ。
- `events/current/` は current event を長期履歴から分離する。
- `world-context/chunks/` は prompt builder や export が参照する世界文脈を分割管理できる。
- `assets/manifest.json` は media asset の正本 registry である。

## canonical ID と filename

- 正本参照は ID で行う。
- filename は人が読みやすくする補助情報であり、必ず ID を含める。
- システムは filename だけの一致に依存してはならない。

推奨 filename pattern:

```text
<human-readable-slug>--<stable-id>.<ext>
```

例:

```text
aki--chr_01JABC123.json
happy-front--ast_01JXYZ456.png
aki-passport--psp_01JPPP789.json
```

ルール:

- save data は asset ID、character ID、world ID、passport ID を参照する。
- filename に可読 token を入れてよいが、canonical key は ID である。
- export された passport filename には passport 固有の stable token を必ず含める。

## world.json

`world.json` は top-level metadata file とする。

```ts
interface WorldMetaFile {
  worldId: string;
  worldName: string;
  playerDisplayName: string;
  saveVersion: number;
  createdAt: string;
  updatedAt: string;
  currentSessionPath: string;
  activeCharacterIds: [string, string, string, string];
}
```

ルール:

- `saveVersion` は必須である。
- `world.json` は world 全体の dump にはしない。
- `activeCharacterIds` は quick load hint として重複保持してよいが、詳細な runtime projection は `session/current.json` を正本とする。

## session projection

`session/current.json` は current gameplay state だけを持つ。

- event、intervention、change の履歴全体を置き換えるものではない。
- 高速起動と gameplay read のための materialized projection である。
- repair や migration 時には source record から再構築できるようにする。

## history chunk 形式

chunk file は append-friendly でサイズを抑えた file とする。

例:

```ts
interface HistoryChunk<T> {
  chunkId: string;
  chunkType: "events" | "interventions" | "changes";
  worldId: string;
  createdAt: string;
  updatedAt: string;
  items: T[];
}
```

ルール:

- chunk size は item 数と file size の両面で上限を持たせる。
- `persistence` layer はどちらかの閾値に達した時点で新 chunk へ切り替えてよい。
- ここでいう chunk は地形 chunk ではなく、履歴分割の論理単位である。
- 設計思想は Minecraft の world file 運用にならい、1つの巨大 file より複数の bounded file を優先する。

## asset registry

`assets/manifest.json` は media asset の authoritative registry とする。

```ts
interface AssetManifestEntry {
  id: string;
  ownerCharacterId?: string;
  kind: "appearance-source" | "appearance-variant" | "sprite-sheet" | "video-source";
  relativePath: string;
  contentHash?: string;
  generatedFromAssetIds?: string[];
}
```

ルール:

- canonical な参照は asset ID とする。
- save data と passport は filename だけでなく asset ID を使う。
- sprite sheet や将来の動画連動 asset も generated derivative として登録する。

## migration 戦略

migration 対応は初期段階から必須とする。

ルール:

- すべての world は `saveVersion` を持つ。
- アプリケーションは stepwise な migration registry を持つ。
- migration は保存 version から current version まで順番に実行する。
- 各 migration は同じ version 境界で再実行されても破綻しない idempotent な性質を目指す。
- 破壊的な migration 前には backup か restore checkpoint を作る。

推奨 migration flow:

1. `world.json` を読む。
2. `saveVersion` と app 側の対応 version を比較する。
3. upgrade が必要なら backup marker を作る。
4. 登録済み migration を順に実行する。
5. 変更対象 file を `persistence` layer 経由で書き戻す。
6. `saveVersion` を更新する。
7. 必要なら materialized projection を再構築する。

## application 境界

- React component は file の open、write、rename、delete を直接行わない。
- UI は intent を application service へ渡す。
- application service は persistence gateway を呼ぶ。
- persistence gateway が directory 作成、file naming、chunk rollover、atomic write 戦略を持つ。
