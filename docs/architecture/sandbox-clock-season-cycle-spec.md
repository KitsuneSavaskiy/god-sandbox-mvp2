# Sandbox Clock Season Cycle Spec

Status: Sprint follow-up docs-first specification

PBI: `PBI-ARCH-SANDBOX-CLOCK-SEASON-CYCLE-SPEC-001`

Owner: Line 2 / Core Runtime・Domain・Persistence specification support

## Purpose

箱庭左上HUDの時計、時間帯、季節、背景切り替えの対応を定義する。

Line 4 が `EventFirstSandbox.tsx` / CSS を実装するときに、次を迷わない状態にする。

- `morning / noon / evening / night` は維持する。
- 1日を `朝 / 昼 / 夕方 / 夜` の4 phase として扱う。
- 時計の短針は、箱庭内の1日で2周する。
- 2周が完了したら、次の季節へ進む。
- これは実時間連動ではなく、箱庭内の演出時間である。

## Source of truth

この文書は、箱庭HUDの clock / season cycle の正本である。

合わせて読むdocs:

- `docs/architecture/ui-state-model.md`
- `docs/architecture/sandbox-time-season-hud-copy.md`
- `docs/architecture/sandbox-time-season-narrative-hook-spec.md`
- `docs/architecture/sprint8-sandbox-final-acceptance.md`

この文書は、domain rule や persistence rule を追加しない。
季節や時間帯は、画面演出とnarrative contextのためのUI状態であり、成長、介入コスト、イベント発生条件を変えない。

## Time phases

既存の internal key を維持する。

| Internal key | UI label | Phase index | 時計上の目安 |
| --- | --- | ---: | --- |
| `morning` | 朝 | 0 | 0時付近から始まる朝の区間 |
| `noon` | 昼 | 1 | 3時付近から始まる昼の区間 |
| `evening` | 夕方 | 2 | 6時付近から始まる夕方の区間 |
| `night` | 夜 | 3 | 9時付近から始まる夜の区間 |

1日はこの4 phaseで構成する。

```txt
morning -> noon -> evening -> night -> next day
```

UIには `morning` などの内部名をそのまま出さない。
ユーザー向け表示は `朝 / 昼 / 夕方 / 夜` を使う。

## Seasons

季節順は次に固定する。

```txt
spring -> summer -> autumn -> winter -> spring
```

UI表示は次を使う。

| Internal key | UI label |
| --- | --- |
| `spring` | 春 |
| `summer` | 夏 |
| `autumn` | 秋 |
| `winter` | 冬 |

季節は演出用の循環状態であり、domain効果を持たない。
季節ごとの成長補正、介入コスト補正、季節イベント生成、天候システムはこの仕様に含めない。

## Clock cycle

時計は「箱庭内の時間が進んでいる」ことを示すHUDである。

### 基本ルール

- 時計は1つの小さな円形UIとして表示する。
- 0時 / 3時 / 6時 / 9時 の目印を置く。
- 短針と長針を持つ。
- 短針は1日で2周する。
- 1日が終わった時点で次の季節へ進む。
- 長針は短針より速く動き、時間が流れている印象を補助する。

### 2周と1日の関係

短針の2周を、箱庭内の1日として扱う。

```txt
短針 1周目: morning -> noon -> evening -> night の前半表現
短針 2周目: morning -> noon -> evening -> night の後半表現
2周完了: 1日完了
1日完了: 次の季節へ進む
```

ただし、UI表示のphaseは既存の4 phaseだけにする。
ユーザーには「朝 / 昼 / 夕方 / 夜」と「春 / 夏 / 秋 / 冬」が分かればよい。

## Deriving state from `backgroundCycleStep`

Line 4 は既存の `backgroundCycleStep` を使って、phase / season / day progress を導ける。

推奨する考え方:

```ts
const phases = ["morning", "noon", "evening", "night"] as const;
const seasons = ["spring", "summer", "autumn", "winter"] as const;

const phasesPerDay = phases.length;
const clockRotationsPerDay = 2;
const stepsPerSeason = phasesPerDay;

const normalizedStep = Math.max(0, backgroundCycleStep);
const phaseIndex = normalizedStep % phasesPerDay;
const dayIndex = Math.floor(normalizedStep / phasesPerDay);
const seasonIndex = dayIndex % seasons.length;
const dayProgress = phaseIndex / phasesPerDay;
```

この例では、`backgroundCycleStep` が4進むと1日が終わり、次の季節へ進む。

時計の短針角度は、表示上「1日で2周」に見えるようにする。

```ts
const hourHandDegrees = dayProgress * 360 * clockRotationsPerDay;
```

CSS animationでphase内の進行を表現する場合も、phaseが変わるたびに針の進行が不自然に戻らないようにする。
実装都合でphaseごとにanimation keyを切り替える場合は、見た目として「2周で1日」に見えることを優先する。

## Background transition

背景画像は、season / phase から次のようなpathで解決する。

```txt
/art/world/backgrounds/world_<season>_<phase>.png
```

例:

```txt
/art/world/backgrounds/world_spring_morning.png
/art/world/backgrounds/world_summer_night.png
```

画像がない場合は、既存の安全な背景へfallbackする。

```txt
/art/world/backgrounds/world_spring_noon.png
```

背景切り替えは急に変えず、crossfadeやCSS transitionで滑らかに見せる。
ただし、画像が不足してもUIが壊れてはいけない。

## Pause rule

次の場合、時間・季節・時計・背景進行をpauseする。

- event child screen が開いているとき
- `eventWindowOpen` が true のとき
- `latestOutcome` を表示しているとき

pause中の方針:

- 時計の針アニメーションを止める。
- 背景の時間進行を止める。
- 季節遷移を進めない。
- HUDに「停止中」「paused」などの長い文言を常時出さない。

Codex生成待ち、narrative `candidate` / `needs-review`、asset未生成はpause理由にしない。
生成物が未生成でも、箱庭はfallbackで進む。

## Safe fallback

背景画像、時計アニメーション、narrative hook のどれかが不足しても、箱庭は止めない。

Fallback方針:

- 背景画像がない場合は `world_spring_noon.png` を使う。
- 時計が見えにくい場合でも、HUDには `朝 / 昼 / 夕方 / 夜` と `春 / 夏 / 秋 / 冬` の文字を残す。
- generated narrativeがない場合は、既存event summaryと標準result文で進む。
- 住民sprite sheetが未生成の場合は、portrait / icon / placeholder fallbackを使う。

## Out of scope

この仕様では次を扱わない。

- 実装変更
- domain / persistence 変更
- Passport schema変更
- 実時間連動
- カレンダー機能
- 季節ごとのdomain効果
- 季節イベント生成
- 天候システム
- 本格生活AI
- 画像生成API呼び出し
- API key入力UI
- 実asset生成
- generated output / dist のcommit
- 箱庭上のキャラ名、場所名、状態ラベルの復活

## Ready conditions

Line 4実装へ進む前に、次を満たす。

- 2周 = 1日 = 次季節、の関係が分かる。
- 朝 / 昼 / 夕方 / 夜 と時計針の対応方針が分かる。
- `backgroundCycleStep` から phase / season / day progress を導く方針がある。
- eventWindowOpen / latestOutcome中のpause方針が明確である。
- 実時間連動やdomain効果ではないことが明確である。
- domain / persistence / Passport schemaへ踏み込んでいない。

## One-line Codex resume instruction

```bash
codex "Read docs/architecture/sandbox-clock-season-cycle-spec.md, implement the sandbox clock and season HUD exactly in EventFirstSandbox without changing domain, persistence, Passport schema, generation APIs, or sandbox labels, and test until complete."
```
