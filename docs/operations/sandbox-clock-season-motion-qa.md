# Sandbox Clock / Season Motion QA

Status: Line 1 docs-first QA checklist

PBI: `PBI-QA-SANDBOX-CLOCK-SEASON-MOTION-ACCEPTANCE-001`

Owner: Line 1 / App Platform / Shell / QA coordination

## Purpose

Line 4 の `PBI-UI-SANDBOX-CLOCK-SEASON-MOTION-001` 実装を merge 判断できるように、時計、季節遷移、背景 transition、pause、mobile 表示、既存クリック導線の確認観点を整理する。

この文書は QA / merge 整理であり、`EventFirstSandbox` 実装、CSS、domain、persistence、Passport schema、asset 生成、生成 API には触れない。

## Final Vision

`/sandbox` の左上 HUD は、0時 / 3時 / 6時 / 9時の目印、短針、長針によって箱庭内の時間進行を直感的に示す。

時計の短針は 1 日で 2 周し、1 日の完了後に季節が次へ進む。背景は季節と時間帯に合わせて滑らかに切り替わり、イベント子画面表示中と結果表示中は時計、背景、季節進行が pause する。

390px / 360px でも HUD は主操作を邪魔せず、`!` バブルと住民クリック導線は維持される。

## Source Of Truth

- `AGENTS.md`
- `docs/agent-operating-rules.md`
- `docs/agent-pr-checklists.md`
- `docs/architecture/line-responsibilities.md`
- `docs/architecture/ui-state-model.md`
- `docs/architecture/sprint8-sandbox-final-acceptance.md`
- `docs/architecture/sandbox-time-season-hud-copy.md`
- `docs/architecture/sandbox-time-season-narrative-hook-spec.md`

Line 4 実装 PR では、追加で Line 2 の clock / season cycle spec と Line 3 の HUD copy / a11y spec がある場合、それらを優先して確認する。

## Common Guardrails

- GodSandbox 本体から生成 API を呼ばない。
- API key 入力 UI を作らない。
- domain / persistence / Passport schema を変更しない。
- 箱庭上にキャラ名、場所名、状態ラベルを戻さない。
- `focusedEvent` 中心を壊さない。
- 実時間連動やカレンダー機能にしない。
- 季節ごとの domain 効果を入れない。
- 天候システムを入れない。
- 実 asset 生成をしない。
- generated output / `dist/` を commit しない。

## Merge Review Checklist

### 1. Changed Files And Scope

Line 4 実装 PR の changed files が、指示された範囲に閉じていることを確認する。

Expected:

- `src/features/events/EventFirstSandbox.tsx`
- `src/features/events/EventFirstSandbox.css`
- 必要な場合のみ `src/features/events/EventFirstSandbox*.test.ts`

Blocker:

- `src/domain/**`
- `src/persistence/**`
- Passport schema
- `package*`
- `.github/**`
- `public/art/**`
- generated output
- `dist/`

### 2. Clock Marks

時計 HUD に、次の目印が視覚的に分かることを確認する。

| Mark | Meaning |
| --- | --- |
| 0時 | 1周の始点 |
| 3時 | 右方向の基準 |
| 6時 | 下方向の基準 |
| 9時 | 左方向の基準 |

Pass:

- 4つの目印が小さくても見える。
- 390px / 360pxで目印が潰れすぎない。
- 目印が住民クリックや `!` バブルの操作を邪魔しない。

Blocker:

- 目印がなく、時計の向きが読み取れない。
- HUD がイベントボタン、`!` バブル、住民クリックの操作対象を覆う。

### 3. Hour Hand And Minute Hand

短針と長針が別の針として見えることを確認する。

Pass:

- 短針が太さ、長さ、色、または layer で長針と区別できる。
- 長針の動きで時間進行が感じられる。
- `prefers-reduced-motion` では動きが弱まり、情報が失われない。

Blocker:

- 針が1本に見える。
- 針が背景に埋もれて読み取れない。
- reduced motion で HUD が壊れる。

### 4. Two Rotations And Season Transition

Line 4 PR では、時計と季節遷移の対応を確認する。

Expected:

- 1日 = 朝 / 昼 / 夕方 / 夜 の4 phase。
- 短針は1日で2周する。
- 2周完了後、季節が次へ進む。
- 季節順は `spring -> summer -> autumn -> winter -> spring`。
- UI表示は `朝 / 昼 / 夕方 / 夜` と `春 / 夏 / 秋 / 冬` を維持する。
- 実時間連動ではなく、箱庭内の演出時間である。

Manual check:

1. `/sandbox` を開く。
2. HUD の時間帯を確認する。
3. 時計の針が進むことを確認する。
4. 2周相当の進行後に季節表示が次へ進むことを確認する。
5. 背景も新しい season / phase に対応する表示へ切り替わることを確認する。

Blocker:

- 2周と季節遷移の関係が実装と説明で食い違う。
- 実時間や現実カレンダーに同期している。
- 季節遷移が domain 効果やイベント発生条件に結びついている。

### 5. Background Crossfade

背景が季節と時間帯に応じて滑らかに切り替わることを確認する。

Pass:

- 背景画像が急に白飛び、黒落ち、ちらつきしない。
- crossfade 中も住民、`!` バブル、コメントバブル、イベント子画面が読める。
- CSS filter / overlay の切り替えにも transition がある。
- 画像不足時は `world_spring_noon.png` fallback で壊れない。

Blocker:

- 背景切り替え時に一瞬 blank / broken image / 404 表示になる。
- 背景 layer が住民や `!` バブルの上に出る。
- fallback がなく、画像不足で画面が壊れる。

### 6. Pause Rules

pause 理由は次に限定する。

Pause:

- `eventWindowOpen`
- `latestOutcome`

Do not pause:

- Codex 生成待ち
- generated narrative 未生成
- generated asset 未生成
- needs-review

Manual check:

1. `!` バブルを押してイベント子画面を開く。
2. 時計の針、背景切り替え、季節進行が止まることを確認する。
3. `見守る` / `助ける` / `試練` のいずれかを選ぶ。
4. result 表示中も時計と背景進行が止まることを確認する。
5. result を閉じた後、進行が再開できることを確認する。

Blocker:

- イベント子画面中に時計や背景が進む。
- result 表示中に時計や背景が進む。
- Codex 生成待ちや generated content 状態を pause 理由にしている。

### 7. Mobile Viewport

必ず以下を確認する。

- `/sandbox` desktop
- `/sandbox` 390px
- `/sandbox` 360px

Pass:

- 横はみ出しがない。
- HUD が1行または小さなまとまりで読める。
- HUD が `!` バブル、住民本体、イベントボタン、CharacterDetailPanel 導線を大きく隠さない。
- 時計の目印と針が小さくても意味を失わない。

Blocker:

- 390px / 360pxで横スクロールが出る。
- HUD が主操作を覆う。
- `!` バブルや住民クリックができない。

### 8. Existing Interaction Routes

Line 4 PR は時計改善であり、既存導線を壊してはいけない。

Confirm:

- `!` バブルクリックでイベント子画面が開く。
- 住民本体クリックで CharacterDetailPanel が開く。
- `見守る` / `助ける` / `試練` が維持されている。
- CharacterDetailPanel を開いても `focusedEvent` 中心が維持される。
- 箱庭上にキャラ名、場所名、状態ラベルが復活していない。

Blocker:

- `!` バブルが反応しない。
- 住民クリック導線が壊れる。
- 介入ボタンが消える、または別の場所へ重複配置される。
- `focusedCharacter` / `selectedCharacter` 中心へ戻っている。

## Merge Decision Matrix

| Finding | Decision |
| --- | --- |
| Scope外ファイル混入 | Request changes |
| 時計目印または針が読めない | Request changes |
| 2周 / 1日 / 季節遷移が仕様と矛盾 | Request changes |
| eventWindowOpen / latestOutcome pause 不成立 | Request changes |
| 390px / 360pxで主要操作不能 | Request changes |
| 背景fallbackなしで画面崩壊 | Request changes |
| 箱庭上ラベル復活 | Request changes |
| 軽微な文言や余白の改善 | Comment or follow-up |
| Scope clean / checks green / blockerなし | Approve candidate |

## Ready Conditions

Line 4 PR の merge 前に、次がそろっていること。

- PR 本文に参照した docs がある。
- PR 本文に Line 4 責務がある。
- changed files が Line 4 の許可範囲に閉じている。
- `git diff --check origin/main...HEAD` が成功している。
- `npm run typecheck` が成功している。
- `npm run build` が成功している。
- desktop / 390px / 360px の確認結果がある。
- 時計目印、短針、長針、2周後の季節遷移、背景 crossfade、pause、既存クリック導線の確認結果がある。

## Safe Fallback

時計改善が安全に成立しない場合は、次の順で fallback する。

1. 時計針 animation を弱める、または静的表示へ戻す。
2. 背景 crossfade を単純 transition へ落とす。
3. それでも操作を邪魔する場合は、既存の短い時間・季節 HUD 表示へ戻す。

ただし、次は fallback ではなく blocker として扱う。

- 箱庭上ラベル復活。
- domain / persistence / Passport schema 変更。
- 生成 API 呼び出し。
- API key UI。
- generated output / `dist/` commit。

## Out Of Scope

- Line 4 実装そのもの。
- domain / persistence 変更。
- Passport schema 変更。
- public art 変更。
- generated asset / narrative 追加。
- 実時間連動。
- カレンダー機能。
- 季節ごとの domain 効果。
- 天候システム。
- 本格生活 AI。
- Codex App Server 連携。
- 画像生成 API 呼び出し。

## Testing Requirements

Line 1 QA docs PR before merge:

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run typecheck
npm run build
```

Line 4 implementation PR review should additionally include browser checks:

- `/sandbox` desktop
- `/sandbox` 390px
- `/sandbox` 360px
- eventWindowOpen pause
- latestOutcome pause
- `!` bubble
- resident click

## One-Line Codex Resume Instruction

```bash
codex "Read docs/operations/sandbox-clock-season-motion-qa.md, use it as the Line 1 acceptance checklist for the sandbox clock and season motion PR, and review until complete."
```
