## Sprint9 Phase 2 ブロック通知 — Issue #{{issue}}

**Thread:** {{line}}
**Wave:** {{wave}}
**PBI:** {{pbi}}

---

### ブロック状態

依存Issueがまだmain入りしていないため、実装を開始できません。

**依存Issue（main入り待ち）:**

{{dependencies}}

---

### 待機中にできること

- 必読ドキュメントを読む
- テスト観点・実装配置案を整理する（コードのpushは不可）
- 疑問点をThread-ORCHまたはPOに質問する

### 待機中にできないこと

- 実装PRの作成・push
- ownedPaths外のファイル変更
- `ready` / `adopted` promotionの操作
- 先行してjob JSONやgenerated outputをcommitする

---

### Wave開始ポリシー

{{waveStartPolicy}}

---

### 必読ドキュメント（待機中に読む）

{{requiredDocs}}

---

### 競合注意事項

{{conflictNotes}}

---

### 再開タイミング

依存Issueが全てmain入りした後、Thread-ORCHからstart指示を受け取ってください。
再開まで実装コードのpushを行わないでください。
