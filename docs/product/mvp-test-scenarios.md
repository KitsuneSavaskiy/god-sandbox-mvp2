# MVP テストシナリオ仕様書

状態: 管理対象の正本ドキュメント

この文書は GodSandbox MVP の検証に必要なすべてのテストシナリオを定義する。
Codex はこの文書のシナリオをそのまま実装・実行できる状態にすること。

実装前に以下を読むこと：
- `docs/product/core-experience-spec.md`
- `docs/product/faith-system-spec.md`
- `docs/product/character-voice-profile-spec.md`
- `docs/product/observed-dialogue-spec.md`

---

## 1. テスト分類

| 種別 | 目的 | ファイル場所 |
|---|---|---|
| Unit | 単一関数の正確性 | `src/**/__tests__/` |
| Domain | ドメインロジックの整合性 | `src/domain/__tests__/` |
| Integration | 複数システムをまたいだ連鎖 | `src/__tests__/integration/` |
| E2E | ユーザーシナリオの完走 | `tests/e2e/` |
| Negative | 禁止事項の非発生確認 | 各テストファイル内 |
| Snapshot | UI 出力の静的確認 | `src/__tests__/snapshots/` |

---

## 2. Unit テスト

### 2.1 信仰度（faith）計算

```typescript
describe("faith system", () => {
  describe("resolveFaithBand", () => {
    it.each([
      [0,   "disbelieves"],
      [19,  "disbelieves"],
      [20,  "uncertain"],
      [39,  "uncertain"],
      [40,  "senses_presence"],
      [59,  "senses_presence"],
      [60,  "believes"],
      [79,  "believes"],
      [80,  "devoted"],
      [100, "devoted"],
    ])("faith=%i → %s", (faith, expected) => {
      expect(resolveFaithBand(faith)).toBe(expected);
    });
  });

  describe("applyFaithChange", () => {
    it("help success: +4", () => {
      expect(applyFaithChange(30, "help_success")).toBe(34);
    });
    it("help failure: -2", () => {
      expect(applyFaithChange(30, "help_failure")).toBe(28);
    });
    it("watch success: +2", () => {
      expect(applyFaithChange(30, "watch_success")).toBe(32);
    });
    it("watch failure: -1", () => {
      expect(applyFaithChange(30, "watch_failure")).toBe(29);
    });
    it("trial success: +5", () => {
      expect(applyFaithChange(30, "trial_success")).toBe(35);
    });
    it("trial failure: -4", () => {
      expect(applyFaithChange(30, "trial_failure")).toBe(26);
    });
    it("clamps at 0: faith=2, trial_failure → 0", () => {
      expect(applyFaithChange(2, "trial_failure")).toBe(0);
    });
    it("clamps at 100: faith=98, help_success → 100", () => {
      expect(applyFaithChange(98, "help_success")).toBe(100);
    });
  });

  describe("personality modifier", () => {
    it("sensitivity ≥ 70 + watch_success: ×1.5", () => {
      const char = buildCharacter({ personality: { sensitivity: 75 }, faith: 30 });
      const result = applyFaithChangeWithPersonality(char, "watch_success");
      expect(result).toBe(33); // 30 + Math.trunc(2 * 1.5) = 33
    });
    it("boldness ≥ 70 + trial_failure: ×0.5", () => {
      const char = buildCharacter({ personality: { boldness: 80 }, faith: 30 });
      const result = applyFaithChangeWithPersonality(char, "trial_failure");
      expect(result).toBe(28); // 30 - Math.trunc(4 * 0.5) = 28
    });
    it("curiosity ≥ 70 + help_failure: 減少 ×0.7", () => {
      const char = buildCharacter({ personality: { curiosity: 75 }, faith: 30 });
      const result = applyFaithChangeWithPersonality(char, "help_failure");
      // help_failure base delta = -2。Math.trunc(-2 * 0.7) = Math.trunc(-1.4) = -1 減少
      expect(result).toBe(29); // 30 - 1 = 29
    });
    it("discipline ≥ 70 + trial_success: ×1.5", () => {
      const char = buildCharacter({ personality: { discipline: 80 }, faith: 30 });
      const result = applyFaithChangeWithPersonality(char, "trial_success");
      // trial_success base delta = +5。5 * 1.5 = 7.5 → Math.trunc = 7
      expect(result).toBe(37); // 30 + 7 = 37
    });
    it("sensitivity < 70 では watch_success に modifier がかからない", () => {
      const char = buildCharacter({ personality: { sensitivity: 60 }, faith: 30 });
      const result = applyFaithChangeWithPersonality(char, "watch_success");
      expect(result).toBe(32); // 30 + 2 = 32（modifier なし）
    });
  });
});
```

### 2.2 世界理エンジン（五行）

```typescript
describe("world principle engine", () => {
  describe("resolveImplicitPhase", () => {
    it("high ambition + empathy → wood", () => {
      const status = buildStatus({ ambition: 90, empathy: 85, courage: 20, stress: 20, vitality: 20 });
      expect(resolveImplicitPhase(status)).toBe("wood");
    });
    it("high courage + stress → fire", () => {
      const status = buildStatus({ courage: 90, stress: 85, ambition: 20, empathy: 20, vitality: 20 });
      expect(resolveImplicitPhase(status)).toBe("fire");
    });
    it("high harmony + trustfulness → earth", () => {
      const status = buildStatus({ harmony: 90, trustfulness: 85, ambition: 20, empathy: 20, vitality: 20, courage: 20, stress: 20 });
      expect(resolveImplicitPhase(status)).toBe("earth");
    });
    it("high insight + low stress → metal", () => {
      // metal = (insight + (100 - stress)) / 2 = (90 + 90) / 2 = 90
      const status = buildStatus({ insight: 90, stress: 10, ambition: 20, empathy: 20, vitality: 20, courage: 20, harmony: 20, trustfulness: 20 });
      expect(resolveImplicitPhase(status)).toBe("metal");
    });
    it("tie-breaking: wood と water が同スコアのとき wood を優先する", () => {
      // wood = (70 + 70) / 2 = 70, water = (70 + 70) / 2 = 70
      // fire=(40+30)/2=35, earth=(30+30)/2=30, metal=(30+70)/2=50 → wood wins by ORDER
      const status = buildStatus({
        ambition: 70, empathy: 70, vitality: 70,
        courage: 40, stress: 30, harmony: 30, trustfulness: 30, insight: 30,
      });
      expect(resolveImplicitPhase(status)).toBe("wood");
    });
  });

  describe("getPrincipleRelation", () => {
    it.each([
      ["wood", "fire", "nourish"],
      ["fire", "earth", "nourish"],
      ["earth", "metal", "nourish"],
      ["metal", "water", "nourish"],
      ["water", "wood", "nourish"],
      ["wood", "earth", "restrain"],
      ["earth", "water", "restrain"],
      ["water", "fire", "restrain"],
      ["fire", "metal", "restrain"],
      ["metal", "wood", "restrain"],
      ["wood", "metal", "neutral"],
    ] as const)("%s → %s: %s", (from, to, expected) => {
      expect(getPrincipleRelation(from, to)).toBe(expected);
    });
  });

  describe("calcEventWeight", () => {
    it("nourish relation → higher weight than neutral", () => {
      // wood キャラ（ambition + empathy が高い）
      const woodChar = buildCharacter({ status: buildStatus({ ambition: 90, empathy: 85, courage: 20, stress: 20, vitality: 40 }) });
      // fireTemplate: wood → fire は相生（nourish）
      const fireTemplate = buildTemplate({
        principleProfile: { dominantPhase: "fire", polarity: "yang", principleRole: "restrain" },
      });
      // neutralTemplate: wood → metal は neutral
      const neutralTemplate = buildTemplate({
        principleProfile: { dominantPhase: "metal", polarity: "yang", principleRole: "reveal" },
      });
      // nourish 関係のテンプレートが neutral より高い重みを持つ
      const ctx = { primaryCharacter: woodChar, participantCharacters: [] };
      expect(calcEventWeight(fireTemplate, ctx))
        .toBeGreaterThan(calcEventWeight(neutralTemplate, ctx));
    });

    it("principleProfile なしのテンプレートは weight = 1.0 を返す", () => {
      const anyChar = buildCharacter({ status: buildStatus({}) });
      const templateWithoutProfile = buildTemplate({ principleProfile: undefined });
      expect(calcEventWeight(templateWithoutProfile, { primaryCharacter: anyChar, participantCharacters: [] })).toBe(1.0);
    });
  });
});
```

### 2.3-a 観察型発話 Authoring Preview（PBI 4a）

```typescript
describe("dialogue world digest", () => {
  it("buildDialogueWorldDigest がセッション状態からダイジェストを構築する", () => {
    const digest = buildDialogueWorldDigest(session);
    expect(digest).toBeDefined();
    expect(digest.activeCharacters.length).toBeGreaterThan(0);
    expect(digest.sessionId).toBe(session.id);
  });

  it("digest の activeCharacters に faithBand が含まれる（currentFaith 数値は含まない）", () => {
    const digest = buildDialogueWorldDigest(session);
    const json = JSON.stringify(digest);
    digest.activeCharacters.forEach(c => {
      expect(["disbelieves", "uncertain", "senses_presence", "believes", "devoted"])
        .toContain(c.faithBand);
    });
    expect(json).not.toMatch(/"currentFaith":/);
  });

  it("authored_fixture の候補は source が authored_fixture になる", () => {
    const candidate: DialogueCandidate = {
      id: "fixture-001",
      characterId: "garan",
      text: "今日は風がやわらかいね",
      type: "daily",
      source: "authored_fixture",
      reviewStatus: "accepted",   // fixture は事前 accepted でよい
      createdAt: "2026-05-08T00:00:00Z",
    };
    expect(candidate.source).toBe("authored_fixture");
    expect(candidate.reviewStatus).toBe("accepted");
  });

  it("external_llm_handoff の候補は reviewStatus が needs_review で始まる", () => {
    const candidate: DialogueCandidate = {
      id: "llm-001",
      characterId: "garan",
      text: "今日は風がやわらかいね",
      type: "daily",
      source: "external_llm_handoff",
      reviewStatus: "needs_review",
      createdAt: "2026-05-08T00:00:00Z",
    };
    expect(candidate.source).toBe("external_llm_handoff");
    expect(candidate.reviewStatus).toBe("needs_review");
  });

  it("validateDialogue を通過しない候補は rejected に設定できる", () => {
    const longText = "あ".repeat(41);
    expect(validateDialogue(longText)).toBe(false);
    const status: DialogueReviewStatus = "rejected";
    expect(status).toBe("rejected");
  });

  it("needs_review の候補は generateDialogue で使用されない", () => {
    const candidates: DialogueCandidate[] = [
      { id: "c1", characterId: "garan", text: "テスト発話", type: "daily",
        source: "external_llm_handoff", reviewStatus: "needs_review",
        createdAt: "2026-05-08T00:00:00Z" },
    ];
    const accepted = candidates.filter(c => c.reviewStatus === "accepted");
    expect(accepted.length).toBe(0);
  });
});
```

### 2.3-b 観察型発話 Runtime（PBI 4b）

```typescript
describe("observed dialogue", () => {
  describe("validateDialogue", () => {
    it("40文字以内の発話を通過させる", () => {
      expect(validateDialogue("今日は風がやわらかいね")).toBe(true);
    });
    it("41文字以上の発話を拒否する", () => {
      const longText = "あ".repeat(41);
      expect(validateDialogue(longText)).toBe(false);
    });
    it("「あなた」を含む発話を拒否する", () => {
      expect(validateDialogue("あなた、見てくれてる？")).toBe(false);
    });
    it("「プレイヤー」を含む発話を拒否する", () => {
      expect(validateDialogue("プレイヤーが来た")).toBe(false);
    });
    it("「セーブ」を含む発話を拒否する", () => {
      expect(validateDialogue("セーブしておこう")).toBe(false);
    });
    it("信仰度数値を含む発話を拒否する", () => {
      expect(validateDialogue("信仰度が58だから")).toBe(false);
    });
  });

  describe("faith band dialogue", () => {
    it("disbelieves のキャラが「神様が助けてくれた」と言わない", () => {
      const examples = getGodIndirectExamples("disbelieves");
      examples.forEach(e => {
        expect(e.text).not.toMatch(/神様が助けてくれた/);
        expect(e.text).not.toMatch(/神が.*助けた/);
      });
    });
    it("devoted のキャラが disbelieves より明確な神への言及を持つ", () => {
      const devoted = getGodIndirectExamples("devoted");
      const disbelieves = getGodIndirectExamples("disbelieves");
      const godMentionScore = (examples: DialogueExample[]) =>
        examples.filter(e => e.text.match(/神|信じ|試され/)).length;
      expect(godMentionScore(devoted)).toBeGreaterThan(godMentionScore(disbelieves));
    });
  });
});
```

### 2.4 VoiceProfile 制約

```typescript
describe("voice profile", () => {
  const garanProfile = getDefaultVoiceProfile("garan");

  it("doNotSay に「あなた」が含まれる", () => {
    expect(garanProfile.doNotSay.join("")).toContain("あなた");
  });

  it("sandboxDialogueExamples に god_indirect_reaction が 1 件以上", () => {
    const godReactions = garanProfile.sandboxDialogueExamples
      .filter(e => e.type === "god_indirect_reaction");
    expect(godReactions.length).toBeGreaterThanOrEqual(1);
  });

  it("passportDialogueExamples に first_encounter が 1 件以上", () => {
    const firstEncounters = garanProfile.passportDialogueExamples
      .filter(e => e.type === "first_encounter");
    expect(firstEncounters.length).toBeGreaterThanOrEqual(1);
  });

  it("passportDialogueExamples の発話にユーザーへの直接呼びかけが含まれる（箱庭内と異なる）", () => {
    const passportLines = garanProfile.passportDialogueExamples.map(e => e.text);
    const hasDirectAddress = passportLines.some(t => t.match(/あなた|神様|見ていてくれた/));
    expect(hasDirectAddress).toBe(true);
  });
});
```

---

## 3. Integration テスト

### 3.1 介入 → 信仰度 → 発話 連鎖

```typescript
describe("intervention → faith → dialogue chain", () => {
  it("help 介入成功 → faith +4 → senses_presence 発話が生成される", async () => {
    const char = createCharacter({ faith: 38 }); // uncertain の上限付近
    const event = createEvent({ type: "help" });
    const result = await applyIntervention(char, event, "success");

    // faith が上昇
    expect(result.character.state.status.faith).toBe(42); // +4 → senses_presence 境界越え

    // 信仰度バンドが変わった
    expect(resolveFaithBand(result.character.state.status.faith)).toBe("senses_presence");

    // 発話が senses_presence に対応している
    const dialogue = await generateGodIndirectDialogue(result.character);
    expect(dialogue).not.toBeNull();
    expect(validateDialogue(dialogue!.text)).toBe(true);
  });

  it("trial 介入失敗 → faith -4 → disbelieves 発話に変化", async () => {
    const char = createCharacter({ faith: 22 }); // uncertain の下限付近
    const event = createEvent({ type: "trial" });
    const result = await applyIntervention(char, event, "failure");

    expect(result.character.state.status.faith).toBe(18); // -4 → disbelieves
    expect(resolveFaithBand(result.character.state.status.faith)).toBe("disbelieves");
  });

  it("連続 watch 成功 → playerMemo 補正 +1 が適用される（2回目から）", async () => {
    const char = createCharacter({ faith: 30 });
    // 両メモとも「見守る」キーワードグループに属する（faith-system-spec.md §3 参照）
    const memo1 = "そっと見守りたい";
    const memo2 = "遠くから応援する";

    // r1: 1回目。前回メモなし → 補正なし。30 + 2 = 32
    const r1 = await applyIntervention(char, createEvent({ type: "watch" }), "success", memo1);
    expect(r1.character.state.status.faith).toBe(32);

    // r2: 2回目。memo2 は memo1 と同グループ（「見守る」）→ 一貫性補正 +1。32 + 2 + 1 = 35
    const r2 = await applyIntervention(r1.character, createEvent({ type: "watch" }), "success", memo2);
    expect(r2.character.state.status.faith).toBe(35);
  });
});
```

### 3.2 Passport 生成整合性

```typescript
describe("passport generation", () => {
  it("snapshot から Passport JSON を生成できる", async () => {
    const char = createCharacterWithHistory({
      faith: 52,
      events: [
        { type: "watch", outcome: "resolved" },
        { type: "help", outcome: "resolved" },
        { type: "trial", outcome: "failed" },
      ],
    });
    const snapshot = createSnapshot(char);
    const passport = issueCharacterPassport(snapshot);

    expect(passport).not.toBeNull();
    expect(passport.display.godRelationship.faithBand).toBe("senses_presence");
    expect(passport.display.externalAiPromptBlock.systemPrompt.length).toBeGreaterThan(50);
    expect(passport.display.lifeMemory.keyEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("Passport JSON に五行フィールドが存在しない", async () => {
    const char = createCharacter({ faith: 50 });
    const passport = issueCharacterPassport(createSnapshot(char));
    const json = JSON.stringify(passport);

    expect(json).not.toMatch(/"wood":/);
    expect(json).not.toMatch(/"fire":/);
    expect(json).not.toMatch(/"earth":/);
    expect(json).not.toMatch(/"metal":/);
    expect(json).not.toMatch(/"water":/);
  });

  it("Passport JSON の memorySummary に status 数値が含まれない", async () => {
    const char = createCharacter({ faith: 50 });
    const passport = issueCharacterPassport(createSnapshot(char));

    expect(passport.display.lifeMemory.memorySummary).not.toMatch(/vitality:\s*\d+/);
    expect(passport.display.lifeMemory.memorySummary).not.toMatch(/faith:\s*\d+/);
    expect(passport.display.lifeMemory.memorySummary).not.toMatch(/stress:\s*\d+/);
  });
});
```

---

## 4. E2E シナリオ

### シナリオ 1：1 キャラクター + 3 イベント + Passport 発行

**前提：** デフォルトキャラクター Garan（faith=30）を使用。

```
Step 1: キャラクター作成
  Input:  name="Garan", personality="落ち着いた", tone="標準語", age=22
  Assert: character.state.status.faith === 30
  Assert: character.voiceProfile.firstPerson === "私"

Step 2: 箱庭観察（10分シミュレーション）
  Input:  箱庭起動
  Assert: 10分後、daily 発話が少なくとも 1 件生成されている
  Assert: 生成された発話が 40 文字以内
  Assert: 発話に「あなた」「プレイヤー」が含まれない

Step 3: イベント発生 + 介入（watch）
  Input:  "水汲み場での口論" イベントに watch 介入
  Assert: faith が 32 になる（+2）
  Assert: resolveDialogueTriggerRate("intervention_applied") === 0.5
  Assert: 発話が信仰度バンド "uncertain" に対応している

Step 4: イベント発生 + 介入（help 成功）
  Input:  help 介入、outcome=success
  Assert: faith が 36 になる（+4）
  Assert: faith バンドがまだ "uncertain" (20-39 内)

Step 5: イベント発生 + 介入（trial 成功）
  Input:  trial 介入、outcome=success
  Assert: faith が 41 になる（+5）
  Assert: faith バンドが "senses_presence" に変化

Step 6: snapshot 記録
  Input:  [スナップショット] ボタンタップ
  Assert: snapshot が LocalStorage に保存される
  Assert: snapshot.character.state.status.faith === 41

Step 7: Passport 発行
  Input:  [Passport を発行] ボタンタップ → 確認画面 → [確認して続ける]
  Assert: Passport JSON が生成される
  Assert: passport.display.godRelationship.faithBand === "senses_presence"
  Assert: passport.display.externalAiPromptBlock.systemPrompt に "Garan" が含まれる
  Assert: passport.display.externalAiPromptBlock.firstEncounterLines.length >= 3
  Assert: Passport JSON に "wood" / "fire" / "earth" / "metal" / "water" フィールドがない

Step 8: JSON ビューア表示
  Input:  [JSON の中身を見る] ボタンタップ
  Assert: 全フィールドのラベル（日本語説明）が表示される
  Assert: faithBand の値 "senses_presence" に日本語説明が付いている
  Assert: UI に "faith: 41" の数値が表示されていない
```

### シナリオ 2：関係性発話の確認

```
Step 1: Garan と Ryo が同じ箱庭に存在する
  Assert: relation スコアが存在する（初期値）

Step 2: proximity_enter トリガーが発生
  Assert: resolveDialogueTriggerRate("proximity_enter") === 0.4
  Assert: 生成された発話が "relationship" タイプ
  Assert: 発話に relation スコアの数値が含まれない（「好感度 60」などなし）

Step 3: relation スコア ≥ 60 に変化後の発話確認
  Assert: "仲良し発話" が生成される
  Assert: "Ryoと歩くと、なんか楽しくなる" のような表現

Step 4: relation スコア ≤ -30 に変化後の発話確認
  Assert: "距離感発話" が生成される
  Assert: "まだ少し話しかけづらい" のような表現
```

---

## 5. Negative テスト

### 5.1 信仰度の UI 非表示

```typescript
describe("faith UI prohibition", () => {
  it("箱庭画面に信仰度バーが存在しない", () => {
    render(<SandboxScreen character={testChar} />);
    expect(screen.queryByRole("progressbar", { name: /faith|信仰/ })).toBeNull();
  });

  it("キャラクター詳細に faith 数値が表示されない", () => {
    render(<CharacterDetail character={testChar} />);
    expect(screen.queryByText(/faith.*\d+/)).toBeNull();
    expect(screen.queryByText(/信仰度.*\d+/)).toBeNull();
  });

  it("イベント画面に「信仰度が上がりました」が表示されない", () => {
    render(<EventScreen event={testEvent} />);
    expect(screen.queryByText(/信仰度が上がりました/)).toBeNull();
    expect(screen.queryByText(/信仰度が下がりました/)).toBeNull();
  });
});
```

### 5.2 箱庭内発話の直接呼びかけ禁止

```typescript
describe("sandbox dialogue prohibition", () => {
  const PROHIBITED_PATTERNS = [
    /あなた/,
    /プレイヤー/,
    /見てくれている/,
    /助けてくれてありがとう/,
    /セーブ/,
    /ステータス/,
    /信仰度が\d+/,
    /今は.*の気が強い/,
  ];

  it("生成された全発話が禁止パターンに一致しない", async () => {
    const dialogues = await generateAllDialogues(testCharacters, 100);
    dialogues.forEach(d => {
      PROHIBITED_PATTERNS.forEach(pattern => {
        expect(d.text).not.toMatch(pattern);
      });
    });
  });
});
```

### 5.3 五行の Passport 非出力

```typescript
describe("five phase passport prohibition", () => {
  const PHASE_FIELDS = ["wood", "fire", "earth", "metal", "water"];

  it("Passport JSON のすべてのネストレベルに五行フィールドがない", async () => {
    const passport = issueCharacterPassport(createSnapshot(testChar));
    const json = JSON.stringify(passport);
    PHASE_FIELDS.forEach(field => {
      expect(json).not.toMatch(new RegExp(`"${field}":\\s*\\d`));
    });
  });
});
```

### 5.4 発話 null 安全性

```typescript
describe("dialogue null safety", () => {
  it("発話が生成できなくてもゲームが止まらない", () => {
    mockDialogueGeneration.mockReturnValue(null);
    expect(() => runSandboxTick(testState)).not.toThrow();
  });

  it("発話 null 時にデフォルト空配列が返る", () => {
    mockDialogueGeneration.mockReturnValue(null);
    const result = runSandboxTick(testState);
    expect(result.dialogues).toEqual([]);
  });

  it("同時発話は最大 2 件に制限される", () => {
    const result = runSandboxTick(testStateWithManyTriggers);
    expect(result.dialogues.length).toBeLessThanOrEqual(2);
  });
});
```

---

## 6. スナップショットテスト

```typescript
describe("UI snapshots", () => {
  it("箱庭画面のスナップショット", () => {
    const { container } = render(<SandboxScreen {...defaultProps} />);
    expect(container).toMatchSnapshot();
  });

  it("Passport 確認画面のスナップショット", () => {
    const { container } = render(<PassportConfirmScreen {...defaultProps} />);
    expect(container).toMatchSnapshot();
  });

  it("JSON ビューアのスナップショット", () => {
    const { container } = render(<PassportJsonViewer passport={testPassport} />);
    expect(container).toMatchSnapshot();
  });
});
```

---

## 7. 成功判定チェックリスト（PO 確認用）

MVP 完了の最低条件（`docs/product/core-experience-spec.md` §8 より）：

```
□ 非技術者が説明なしでキャラ作成から箱庭体験まで 30 分以内に到達できる
□ 箱庭内で 10 分間、キャラクターが自律的に生活している様子を観察できる
□ 1 回の介入でキャラクターの状態（status, relation, faith のいずれか）が変化する
□ snapshot を記録できる
□ Passport JSON を発行でき、外部 AI に貼れる prompt block が含まれる
□ 信仰度が UI に数値で表示されないが、Passport JSON を開くと確認できる
□ 箱庭内でキャラクターがユーザーに直接話しかけることがない
□ AI なし（通常画像・標準文）でも上記が成立する
```

テストコマンド：

```bash
npm run typecheck        # 型エラーゼロ
npm run test:domain      # Unit + Integration テスト全通過
npm run build            # ビルド成功
```

※ UI スナップショットテスト（`npm run test:ui`）は MVP 段階では未整備。CI 組み込みは将来の PBI で追加する。

**テストフレームワーク注意：** `src/domain/runtime.test.ts` は現在 Jest ではなくカスタム assertions（deepEqual / equal / ok / throws）を使用している。本仕様の `describe` / `it` / `expect` 形式は仕様の意図を示す記述であり、実装時は既存のカスタム形式に合わせるか、または MVP で Jest を導入するかをプロジェクトで決定すること。

---

## 8. 「生きている感」客観受け入れ条件（PO 確認用）

10 分間の箱庭セッションで以下をすべて目視確認すること：

```
□ activeSlots 4 名が表示され続ける（途中で消えるスロットがない）
□ 少なくとも 1 回、住民の移動アニメーションが発生する
□ 少なくとも 1 回、daily 発話（吹き出し）が表示される
□ 少なくとも 1 回、関係性発話またはすれ違い反応が発生する
□ イベント発生中は住民移動が pause する
□ 箱庭内発話に「あなた」「プレイヤー」「助けてくれてありがとう」が一切出ない
□ AI 接続なし（fallback mode）でも上記 6 条件が成立する
□ イベント解決後 5 秒以内に何らかの発話または状態変化が画面に出る
```

自動テストで担保できないもの（観察者による判定）：
- 発話が「生活音のように自然」と感じられるか
- キャラクターが「意志を持って動いている」と感じられるか
