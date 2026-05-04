import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Character } from "../../domain/models.js";
import { Button } from "../../ui/Button";
import {
  createCharacterDraftFromCharacter,
  createEmptyCharacterDraft,
  type CharacterDraft,
  validateCharacterDraft,
} from "./characterDraft";
import { LINE3_CHARACTER_TEMPLATE } from "./characterTemplate";
import "./CharacterEditor.css";

type CharacterEditorMode = "initial" | "new" | "edit";

type CharacterEditorProps = {
  character?: Character;
  mode: CharacterEditorMode;
  onCancel: () => void;
  onSave: (draft: CharacterDraft) => void;
};

const copyByMode: Record<CharacterEditorMode, { title: string; body: string; action: string }> = {
  initial: {
    title: "最初の4人を同じ画面で整える",
    body: "最初の設定も後からの追加も同じ入力画面を使います。画像だけ必須で、性格、口調、年齢は空欄でも進められます。",
    action: "最初の設定を保存",
  },
  new: {
    title: "新しい住民を迎える",
    body: "保存すると、まず住民一覧に加わります。今の箱庭の4人はすぐには変わらず、入れ替えはあとで選べます。",
    action: "住民一覧に保存",
  },
  edit: {
    title: "住民プロフィールを再編集する",
    body: "箱庭で育った状態は保ち、プレイヤーが編集できるプロフィールだけを更新します。",
    action: "編集を保存",
  },
};

export function CharacterEditor({ character, mode, onCancel, onSave }: CharacterEditorProps) {
  const initialDraft = useMemo(
    () =>
      character
        ? createCharacterDraftFromCharacter(character, LINE3_CHARACTER_TEMPLATE)
        : createEmptyCharacterDraft(LINE3_CHARACTER_TEMPLATE),
    [character],
  );
  const [draft, setDraft] = useState<CharacterDraft>(initialDraft);
  const validation = validateCharacterDraft(draft);
  const copy = copyByMode[mode];

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft, mode]);

  function updateDraft(patch: Partial<CharacterDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCharacterDraft(draft).valid) {
      return;
    }

    onSave(draft);
  }

  return (
    <section className="character-editor" aria-labelledby="character-editor-title">
      <div className="character-editor__header">
        <p className="eyebrow">{LINE3_CHARACTER_TEMPLATE.name}</p>
        <h2 id="character-editor-title">{copy.title}</h2>
        <p>{copy.body}</p>
      </div>

      <form className="character-editor__form" onSubmit={handleSubmit}>
        <div className="character-editor__grid">
          <label className="character-editor__field">
            <span>名前 *</span>
            <input
              value={draft.displayName}
              onChange={(event) => updateDraft({ displayName: event.target.value })}
              placeholder="例: Aki"
            />
          </label>

          <label className="character-editor__field character-editor__field--wide">
            <span>見た目画像 *</span>
            <input
              value={draft.imageAssetId}
              onChange={(event) => updateDraft({ imageAssetId: event.target.value })}
              placeholder="asset_chr_aki_portrait など"
            />
          </label>

          <label className="character-editor__field character-editor__field--wide">
            <span>性格メモ</span>
            <textarea
              value={draft.personalityNote}
              onChange={(event) => updateDraft({ personalityNote: event.target.value })}
              placeholder="例: 小さな変化に気づきやすい"
            />
          </label>

          <label className="character-editor__field">
            <span>口調</span>
            <input
              value={draft.speechStyleId}
              onChange={(event) => updateDraft({ speechStyleId: event.target.value })}
              placeholder="例: gentle"
            />
          </label>

          <label className="character-editor__field">
            <span>年齢</span>
            <input
              inputMode="numeric"
              type="number"
              value={draft.age}
              onChange={(event) => updateDraft({ age: event.target.value })}
              placeholder="任意"
            />
          </label>
        </div>

        <p className="character-editor__hint">
          ここで設定した画像とプロフィールは、Snapshot と Passport で外へ持ち出す時の顔になります。
        </p>

        {!validation.valid ? (
          <div className="character-editor__error-list" role="alert">
            {validation.messages.map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        ) : null}

        <div className="character-editor__actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" disabled={!validation.valid}>
            {copy.action}
          </Button>
        </div>
      </form>
    </section>
  );
}
