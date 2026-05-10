import { useMemo, useState } from "react";
import {
  buildDialoguePromptPack,
  buildDialogueWorldDigest,
  parseDialogueCandidatesFromText,
  validateDialogue,
  type ParsedCandidateRaw,
} from "../../domain/dialogue.js";
import type { DialogueValidationResult } from "../../domain/models.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import { Button } from "../../ui/Button.js";
import "./DialoguePreviewSurface.css";

type ParsedCandidate = ParsedCandidateRaw & { validation: DialogueValidationResult };

type Props = {
  state: RuntimeWorldState;
};

const CHATGPT_PROJECT_GUIDE_VIDEO_PATH = "/guides/chatgpt-project-guide.mp4";

function shouldOpenChatGptGuideByDefault(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("guide") === "chatgpt";
}

export function DialoguePreviewSurface({ state }: Props) {
  const [pasteText, setPasteText] = useState("");
  const [parsedCandidates, setParsedCandidates] = useState<ParsedCandidate[]>([]);
  const [copied, setCopied] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(shouldOpenChatGptGuideByDefault);

  const nameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const character of state.characters.values()) {
      map.set(character.profile.displayName, character.id);
    }
    return map;
  }, [state.characters]);

  const digest = useMemo(
    () =>
      buildDialogueWorldDigest(
        state.session,
        state.characters,
        [...state.relations.values()],
        [...state.events.values()],
      ),
    [state.session, state.characters, state.relations, state.events],
  );

  const promptPack = useMemo(() => buildDialoguePromptPack(digest), [digest]);

  function handleCopy() {
    navigator.clipboard.writeText(promptPack.promptText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleParse() {
    const now = new Date().toISOString();
    const raws = parseDialogueCandidatesFromText(pasteText, nameToIdMap, now);
    const withValidation: ParsedCandidate[] = raws.map((raw) => ({
      ...raw,
      validation:
        raw.characterId === null
          ? {
              ok: false as const,
              violations: [`不明な話者: 「${raw.rawSpeakerName}」はキャラクターリストに存在しません`],
            }
          : validateDialogue(raw.text),
    }));
    setParsedCandidates(withValidation);
  }

  const acceptedCandidates = parsedCandidates.filter(
    (c) => c.validation.ok && c.characterId !== null,
  );

  const invalidCandidates = parsedCandidates.filter(
    (c) => !c.validation.ok || c.characterId === null,
  );

  function resolveDisplayName(candidate: ParsedCandidate): string {
    if (candidate.characterId === null) return candidate.rawSpeakerName;
    return state.characters.get(candidate.characterId)?.profile.displayName ?? candidate.rawSpeakerName;
  }

  return (
    <section className="dialogue-preview" aria-labelledby="dialogue-preview-title">
      <div>
        <p className="eyebrow">発話プレビュー / Manual LLM Handoff</p>
        <h2 id="dialogue-preview-title">外部 LLM 経由の発話候補を育成 UI で確認する</h2>
        <p>
          外部AIに依頼文をコピーして得た発話候補を、ここに貼り戻して確認できます。
          GodSandbox から外部AIへの自動送信はありません。
        </p>
      </div>

      <div className="dialogue-preview__grid">
        <section className="dialogue-preview__panel" aria-label="プロンプト生成">
          <div className="dialogue-preview__step-heading">
            <h3>Step 1 — プロンプトをコピー</h3>
            <button
              type="button"
              className="dialogue-preview__help-button"
              aria-label="ChatGPTプロジェクトで遊ぶ方法を見る"
              aria-expanded={guidanceOpen}
              aria-controls="dialogue-preview-chatgpt-guide"
              onClick={() => setGuidanceOpen((open) => !open)}
            >
              ?
            </button>
          </div>
          {guidanceOpen && (
            <aside
              id="dialogue-preview-chatgpt-guide"
              className="dialogue-preview__guide"
              aria-label="ChatGPTプロジェクトの使い方ガイド"
            >
              <div className="dialogue-preview__guide-copy">
                <p className="dialogue-preview__guide-title">ChatGPTでキャラクターと会話する流れ</p>
                <ol>
                  <li>ChatGPTのプロジェクトを開きます。</li>
                  <li>プロジェクトフォルダに、会話したいキャラ名のメモを入れます。</li>
                  <li>このボタンでコピーした依頼文を、ChatGPTの新しいチャットに貼り付けます。</li>
                  <li>JSON配列が返ってきたら、Step 2 に貼り付けて確認します。</li>
                </ol>
                <p>
                  先にプロジェクトフォルダへキャラ名を入れておくと、ChatGPTが「誰として話すか」を
                  把握しやすくなります。
                  {digest.activeCharacters.length > 1 && (
                    <>{" "}複数キャラクターが含まれる場合は、箱庭名のProjectを使ってください。</>
                  )}
                </p>
                <p>
                  コピーされる依頼文はJSON候補を返す実行命令です。
                  そのまま貼るとGodSandboxに戻せる形式が返ります。
                </p>
              </div>
              <video
                className="dialogue-preview__guide-video"
                controls
                preload="metadata"
                aria-label="ChatGPTプロジェクトの使い方動画"
              >
                <source src={CHATGPT_PROJECT_GUIDE_VIDEO_PATH} type="video/mp4" />
                このブラウザでは動画を表示できません。
              </video>
            </aside>
          )}
          <p className="dialogue-preview__hint">
            コピーしたプロンプトを外部AIに貼ると、GodSandboxに戻せるJSON形式のテキストが作成されるので、それをStep2に張り付けてください。
          </p>
          <div className="dialogue-preview__copy-row">
            <Button type="button" variant="primary" onClick={handleCopy}>
              コピーする
            </Button>
            {copied && (
              <span className="dialogue-preview__copied-label" role="status">
                コピーしました
              </span>
            )}
          </div>
          <details className="dialogue-preview__advanced-prompt">
            <summary>コピー内容を確認する（開発者向け）</summary>
            <pre className="dialogue-preview__prompt-box" aria-label="生成プロンプト">
              {promptPack.promptText}
            </pre>
          </details>
        </section>

        <section className="dialogue-preview__panel" aria-label="LLM出力の貼り付け">
          <h3>Step 2 — LLM の出力を貼り付けて検証</h3>
          <textarea
            className="dialogue-preview__paste-area"
            aria-label="LLM出力の貼り付け欄"
            placeholder={'[\n  { "name": "Ryo", "text": "今日はいい天気だな" },\n  { "name": "Suzu", "text": "そうね、散歩したい気分" }\n]'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <Button type="button" variant="primary" onClick={handleParse}>
            取り込む
          </Button>

          {parsedCandidates.length > 0 && (
            <div className="dialogue-preview__candidate-list" aria-label="解析結果">
              {parsedCandidates.length > 0 && (
                <p className="dialogue-preview__hint">
                  {acceptedCandidates.length}件取り込みました
                  {invalidCandidates.length > 0 && `（${invalidCandidates.length}件は検証NG）`}
                </p>
              )}
              {invalidCandidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className="dialogue-preview__candidate dialogue-preview__candidate--invalid"
                >
                  <p className="dialogue-preview__candidate-speaker">
                    {resolveDisplayName(candidate)}
                  </p>
                  <p className="dialogue-preview__candidate-text">{candidate.text}</p>
                  <ul className="dialogue-preview__violation">
                    {!candidate.validation.ok && candidate.validation.violations.map((v: string, i: number) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="dialogue-preview__panel" aria-label="発話ログプレビュー">
        <h3>Step 3 — 取り込み済み発話ログ</h3>
        {acceptedCandidates.length > 0 ? (
          <div className="dialogue-preview__log" role="log" aria-live="polite">
            {acceptedCandidates.map((candidate, index) => {
              const postNumber = index + 1;
              return (
                <div
                  key={candidate.id}
                  id={`post-${postNumber}`}
                  className="dialogue-preview__post"
                >
                  <div className="dialogue-preview__post-header">
                    <span className="dialogue-preview__post-number">{postNumber}</span>
                    <span className="dialogue-preview__post-name">
                      {resolveDisplayName(candidate)}
                    </span>
                  </div>
                  <p className="dialogue-preview__post-text">
                    {candidate.replyTo != null && candidate.replyTo <= acceptedCandidates.length && (
                      <a
                        href={`#post-${candidate.replyTo}`}
                        className="dialogue-preview__anchor"
                      >
                        &gt;&gt;{candidate.replyTo}
                      </a>
                    )}
                    {candidate.replyTo != null ? " " : ""}{candidate.text}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="dialogue-preview__empty-note">
            LLM出力を取り込むと、ここにログが表示されます。
          </p>
        )}
      </section>
    </section>
  );
}
