import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type { Character, CharacterId } from "../../domain/models.js";
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

export type WelcomeSlotOption = {
  slotIndex: number;
  characterId: CharacterId;
  displayName: string;
};

type CharacterEditorProps = {
  character?: Character;
  mode: CharacterEditorMode;
  sidekickIsConnected?: boolean;
  welcomeSlotOptions?: WelcomeSlotOption[];
  onCancel: () => void;
  onOpenSidekickSetup?: () => void;
  onSave: (draft: CharacterDraft, portraitFile?: File, welcomeSlotIndex?: number) => void;
};

type DirectoryPicker = () => Promise<FileSystemDirectoryHandleLike>;

type FileSystemDirectoryHandleLike = {
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemFileHandleLike>;
};

type FileSystemFileHandleLike = {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
};

type FileSystemWritableFileStreamLike = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};

type WindowWithFileSystemAccess = Window & {
  showDirectoryPicker?: DirectoryPicker;
};

const copyByMode: Record<CharacterEditorMode, { title: string; body: string; action: string }> = {
  initial: {
    title: "最初の4人を同じ画面で整える",
    body: "最初の設定も後からの追加も同じ入力画面を使います。入力は名前、見た目画像、性格、口調、年齢の5項目です。",
    action: "最初の設定を保存",
  },
  new: {
    title: "新しい住民を迎える",
    body: "保存すると住民一覧に追加し、選んだ枠へ仮の姿で呼びます。Sidekick設定済みなら制作依頼も渡せます。",
    action: "仮の姿で箱庭へ呼ぶ",
  },
  edit: {
    title: "住民プロフィールを再編集する",
    body: "箱庭で育った状態は保ち、プレイヤーが編集できる5項目だけを更新します。",
    action: "編集を保存",
  },
};

export function CharacterEditor({
  character,
  mode,
  sidekickIsConnected = false,
  welcomeSlotOptions = [],
  onCancel,
  onOpenSidekickSetup,
  onSave,
}: CharacterEditorProps) {
  const initialDraft = useMemo(
    () =>
      character
        ? createCharacterDraftFromCharacter(character, LINE3_CHARACTER_TEMPLATE)
        : createEmptyCharacterDraft(LINE3_CHARACTER_TEMPLATE),
    [character],
  );
  const [draft, setDraft] = useState<CharacterDraft>(initialDraft);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePickerMessage, setImagePickerMessage] = useState<string | null>(null);
  const [imageSaveStatus, setImageSaveStatus] = useState<string | null>(null);
  const [imageDraftId, setImageDraftId] = useState(() => createDraftImageId());
  const defaultWelcomeSlotIndex = welcomeSlotOptions.some((option) => option.slotIndex === 3)
    ? 3
    : welcomeSlotOptions[welcomeSlotOptions.length - 1]?.slotIndex ?? 3;
  const [welcomeSlotIndex, setWelcomeSlotIndex] = useState(defaultWelcomeSlotIndex);
  const validation = validateCharacterDraft(draft);
  const copy = copyByMode[mode];
  const directoryPicker = getDirectoryPicker();
  const selectedWelcomeSlot = welcomeSlotOptions.find(
    (option) => option.slotIndex === welcomeSlotIndex,
  );

  useEffect(() => {
    setDraft(initialDraft);
    setSelectedImageFile(null);
    setImagePickerMessage(null);
    setImageSaveStatus(null);
    setImageDraftId(createDraftImageId());
  }, [initialDraft, mode]);

  useEffect(() => {
    if (mode === "new") {
      setWelcomeSlotIndex(defaultWelcomeSlotIndex);
    }
  }, [defaultWelcomeSlotIndex, mode]);

  useEffect(() => {
    if (!selectedImageFile) {
      setImagePreviewUrl(null);
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedImageFile);
    setImagePreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedImageFile]);

  function updateDraft(patch: Partial<CharacterDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCharacterDraft(draft).valid) {
      return;
    }

    onSave(
      draft,
      selectedImageFile ?? undefined,
      mode === "new" ? welcomeSlotIndex : undefined,
    );
  }

  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!isSupportedImageFile(file)) {
      setSelectedImageFile(null);
      setImagePickerMessage("PNG / JPG / JPEG / WebP の画像ファイルを選んでください。");
      setImageSaveStatus(null);
      return;
    }

    const nextImageAssetId = createWorkingImageFileName(file, draft, imageDraftId);
    setSelectedImageFile(file);
    setImagePickerMessage("画像を選択しました。保存すると、まず仮の姿として箱庭に表示します。");
    setImageSaveStatus(null);
    updateDraft({ imageAssetId: nextImageAssetId });
  }

  async function handleSaveSelectedImageToFolder() {
    if (!directoryPicker || !selectedImageFile || !draft.imageAssetId.trim()) {
      return;
    }

    try {
      setImageSaveStatus("保存先フォルダを選んでいます。");
      const directoryHandle = await directoryPicker();
      const fileHandle = await directoryHandle.getFileHandle(draft.imageAssetId.trim(), {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(selectedImageFile);
      await writable.close();
      setImageSaveStatus("作業フォルダへ画像をコピーしました。通常はこのまま保存へ進めます。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setImageSaveStatus("保存先フォルダの選択をキャンセルしました。");
        return;
      }

      setImageSaveStatus("事前コピーは使えませんでした。通常はそのまま保存してください。");
    }
  }

  return (
    <section className="character-editor" aria-labelledby="character-editor-title">
      <div className="character-editor__header">
        <p className="eyebrow">{LINE3_CHARACTER_TEMPLATE.name}</p>
        <h2 id="character-editor-title">{copy.title}</h2>
        <p>{copy.body}</p>
      </div>

      {mode === "new" ? (
        <aside className="character-editor__sidekick-guide" aria-label="制作候補の案内">
          <div>
            <strong>
              {sidekickIsConnected
                ? "保存すると制作依頼を渡せます"
                : "サイドキック設定はあとからでも大丈夫です"}
            </strong>
            <p>
              見た目画像と5項目をもとに、Codex サイドキックが箱庭アニメや立ち絵候補の準備を助けます。
              候補は自動採用されず、確認してから使います。
            </p>
            <small>
              サイドキックを使わない場合も、通常画像と標準文で箱庭は動きます。
            </small>
          </div>
          {!sidekickIsConnected && onOpenSidekickSetup ? (
            <Button type="button" variant="ghost" onClick={onOpenSidekickSetup}>
              サイドキック設定を見る
            </Button>
          ) : null}
        </aside>
      ) : null}

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

          <div className="character-editor__field character-editor__field--wide">
            <span id="character-image-picker-label">見た目画像 *</span>
            <div className="character-editor__image-picker" aria-labelledby="character-image-picker-label">
              <label className="character-editor__file-button">
                画像ファイルを選ぶ
                <input
                  type="file"
                  accept="image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp"
                  onChange={handleImageFileChange}
                />
              </label>

              <div className="character-editor__image-summary">
                <strong>
                  {selectedImageFile
                    ? selectedImageFile.name
                    : draft.imageAssetId.trim()
                      ? "登録済みの見た目画像があります"
                      : "画像ファイルを選んでください"}
                </strong>
                <small>
                  {draft.imageAssetId.trim()
                    ? "保存すると、この画像を仮の姿として使い、スプライト準備へ進みます。"
                    : "PNG / JPG / JPEG / WebP に対応しています。個人PCの絶対パスは入力しません。"}
                </small>
              </div>

              {imagePreviewUrl ? (
                <figure className="character-editor__image-preview">
                  <img src={imagePreviewUrl} alt="選択した見た目画像のプレビュー" />
                  <figcaption>選択済みプレビュー</figcaption>
                </figure>
              ) : null}

              <div className="character-editor__image-save-guide">
                {directoryPicker ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleSaveSelectedImageToFolder}
                      disabled={!selectedImageFile || !draft.imageAssetId.trim()}
                    >
                      必要なときだけ事前コピーする
                    </Button>
                    <small>
                      通常は保存ボタンだけで進められます。対応ブラウザでは、必要なときだけ事前コピーもできます。
                    </small>
                  </>
                ) : (
                  <small>
                    このブラウザでは事前コピーは使えません。通常はそのまま保存してください。
                  </small>
                )}
              </div>

              {imagePickerMessage ? (
                <p className="character-editor__image-message" role="status">
                  {imagePickerMessage}
                </p>
              ) : null}
              {imageSaveStatus ? (
                <p className="character-editor__image-message" role="status">
                  {imageSaveStatus}
                </p>
              ) : null}
            </div>
          </div>

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
          ここで設定した5項目は、住民の見た目準備とプロフィール表示のもとになります。
        </p>

        {mode === "new" && welcomeSlotOptions.length > 0 ? (
          <fieldset className="character-editor__welcome-slot">
            <legend>箱庭に呼ぶ枠</legend>
            <label>
              <span>入れ替える枠</span>
              <select
                value={welcomeSlotIndex}
                onChange={(event) => setWelcomeSlotIndex(Number(event.target.value))}
              >
                {welcomeSlotOptions.map((option) => (
                  <option key={option.slotIndex} value={option.slotIndex}>
                    Slot {option.slotIndex + 1}: {option.displayName}
                  </option>
                ))}
              </select>
            </label>
            <p>
              この枠の住民と入れ替わります。あとから戻せます。
              {selectedWelcomeSlot
                ? ` 現在は Slot ${selectedWelcomeSlot.slotIndex + 1} の ${selectedWelcomeSlot.displayName} と入れ替わります。`
                : ""}
            </p>
          </fieldset>
        ) : null}

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

function isSupportedImageFile(file: File): boolean {
  return Boolean(getSupportedImageExtension(file));
}

function createWorkingImageFileName(
  file: File,
  draft: CharacterDraft,
  imageDraftId: string,
): string {
  const extension = getSupportedImageExtension(file) ?? "png";
  const sourceId = createSafeFileToken(draft.id ?? imageDraftId);
  const timestamp = Date.now().toString(36);

  return `character-${sourceId}-portrait-original-${timestamp}.${extension}`;
}

function getSupportedImageExtension(file: File): "png" | "jpg" | "jpeg" | "webp" | undefined {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp") {
    return extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/jpeg") {
    return "jpg";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return undefined;
}

function createSafeFileToken(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || createDraftImageId();
}

function createDraftImageId(): string {
  const randomToken = Math.random().toString(36).slice(2, 8);

  return `draft-${Date.now().toString(36)}-${randomToken}`;
}

function getDirectoryPicker(): DirectoryPicker | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as WindowWithFileSystemAccess).showDirectoryPicker;
}
