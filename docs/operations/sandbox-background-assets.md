# 箱庭背景asset catalog

状態: Sprint8 運用メモ

## 目的

この文書は、箱庭の季節と時間帯に応じて参照する背景画像の存在状況を整理する。

Line 4 の `EventFirstSandbox` 実装では、この catalog を見て、存在する公式assetだけを参照する。
不足している背景画像がある場合も、UI が壊れないように fallback を使う。

## 方針

- 背景画像は Git 管理済みの公式assetだけを使う。
- `assets/generated/**`、`assets/residents/**`、ローカル作業画像、未採用画像は参照しない。
- 画像生成、API 呼び出し、Codex App Server 連携はこのPBIでは行わない。
- 季節と時間帯の不足画像は、`world_spring_noon.png` へ fallback する。
- Line 4 は必要に応じて CSS filter で朝、夕方、夜の見た目を補助してよい。

## 既定fallback

```txt
/art/world/backgrounds/world_spring_noon.png
```

現在確認できる公式背景は、この1ファイルのみである。

## 推奨命名

```txt
public/art/world/backgrounds/world_<season>_<phase>.png
```

`season`:

- `spring`
- `summer`
- `autumn`
- `winter`

`phase`:

- `morning`
- `noon`
- `evening`
- `night`

例:

```txt
public/art/world/backgrounds/world_spring_morning.png
public/art/world/backgrounds/world_spring_noon.png
public/art/world/backgrounds/world_spring_evening.png
public/art/world/backgrounds/world_spring_night.png
```

## 16パターン存在状況

| season | phase | 推奨ファイル | 状態 | Line 4 fallback |
| --- | --- | --- | --- | --- |
| `spring` | `morning` | `world_spring_morning.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `spring` | `noon` | `world_spring_noon.png` | 存在 | そのまま使用 |
| `spring` | `evening` | `world_spring_evening.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `spring` | `night` | `world_spring_night.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `summer` | `morning` | `world_summer_morning.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `summer` | `noon` | `world_summer_noon.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `summer` | `evening` | `world_summer_evening.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `summer` | `night` | `world_summer_night.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `autumn` | `morning` | `world_autumn_morning.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `autumn` | `noon` | `world_autumn_noon.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `autumn` | `evening` | `world_autumn_evening.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `autumn` | `night` | `world_autumn_night.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `winter` | `morning` | `world_winter_morning.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `winter` | `noon` | `world_winter_noon.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `winter` | `evening` | `world_winter_evening.png` | 不足 | `world_spring_noon.png` + CSS filter |
| `winter` | `night` | `world_winter_night.png` | 不足 | `world_spring_noon.png` + CSS filter |

## Line 4 実装時の参照方針

Line 4 は、季節と時間帯から次のような path を組み立ててもよい。

```txt
/art/world/backgrounds/world_<season>_<phase>.png
```

ただし、すべての組み合わせの画像が存在するとは限らない。
未登録画像で表示が壊れないように、実装側では必ず既定fallbackを残す。

```txt
missing image -> /art/world/backgrounds/world_spring_noon.png
```

背景画像が不足している間も、HUD の季節・時間帯表示は進めてよい。
その場合、背景は既定fallbackを使い、明暗や色味の違いは CSS filter で補助する。

## 今回確認したこと

- `public/art/world/backgrounds/world_spring_noon.png` は存在する。
- そのほかの15パターンは、現時点では存在しない。
- `public/art/**` の画像追加、削除、差し替えはしていない。
- `assets/generated/**` やローカル作業画像は参照していない。

## 今回やらないこと

- 背景画像の生成
- 背景画像の追加、削除、差し替え
- `src/**` の実装変更
- 季節ごとの domain 効果
- 季節イベント生成
- 天候システム
- 実時間連動
- Codex App Server 連携
