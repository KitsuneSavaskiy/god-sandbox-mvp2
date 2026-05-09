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
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
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
    setAcceptedIds(new Set());
  }

  function handleAccept(id: string) {
    setAcceptedIds((prev) => new Set([...prev, id]));
  }

  function handleReject(id: string) {
    setParsedCandidates((prev) => prev.filter((c) => c.id !== id));
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const acceptedCandidates = parsedCandidates.filter(
    (c) => acceptedIds.has(c.id) && c.validation.ok && c.characterId !== null,
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
            <h3>Step 1 — 外部AIへの依頼文をコピー</h3>
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
          <p className="dialogue-preview__hint">
            この依頼文には、キャラクター名・口調・最近の出来事・関係性の手がかりが含まれます。
            画面には内部値を表示しません。コピーした内容は、あなたが外部AIに貼り付けたときだけ読まれます。
          </p>
          <p className="dialogue-preview__hint dialogue-preview__hint--chatgpt">
            ChatGPTで使う場合は、キャラクター名のProjectを作り、その中で新しいチャットを始めてください。
            同じProjectにこの子の会話をまとめると、1つの人格として続けやすくなります。
            {digest.activeCharacters.length > 1 && (
              <>{" "}複数キャラクターが含まれる場合は、主役キャラクター名または箱庭名のProjectを使ってください。</>
            )}
          </p>
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
                  <li>この画面のプロンプトをコピーして、ChatGPTに貼り付けます。</li>
                  <li>返ってきた発話候補を Step 2 に貼ると、GodSandbox側で確認できます。</li>
                </ol>
                <p>
                  先にプロジェクトフォルダへキャラ名を入れておくと、ChatGPTが「誰と話すか」を
                  見失いにくくなります。APIキーは使わず、手動でコピーして遊ぶ導線です。
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
          <div className="dialogue-preview__copy-row">
            <Button type="button" variant="primary" onClick={handleCopy}>
              依頼文をコピー
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
          <p className="dialogue-preview__hint">
            「名前：発話文」形式（1行1発話）、または JSON 配列を貼り付けてください。
          </p>
          <textarea
            className="dialogue-preview__paste-area"
            aria-label="LLM出力の貼り付け欄"
            placeholder={"Ryo：今日はいい天気だな\nSuzu：そうね、散歩したい気分"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <Button type="button" variant="primary" onClick={handleParse}>
            解析して検証
          </Button>

          {parsedCandidates.length > 0 && (
            <div className="dialogue-preview__candidate-list" aria-label="解析結果">
              {parsedCandidates.map((candidate) => {
                const isAccepted = acceptedIds.has(candidate.id);
                const isValid = candidate.validation.ok;
                return (
                  <article
                    key={candidate.id}
                    className={`dialogue-preview__candidate${!isValid ? " dialogue-preview__candidate--invalid" : ""}`}
                  >
                    <p className="dialogue-preview__candidate-speaker">
                      {resolveDisplayName(candidate)}
                    </p>
                    <p className="dialogue-preview__candidate-text">{candidate.text}</p>
                    {!isValid && (
                      <ul className="dialogue-preview__violation">
                        {candidate.validation.violations.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    )}
                    {!isAccepted && (
                      <div className="dialogue-preview__candidate-actions">
                        <Button
                          type="button"
                          variant={isValid ? "primary" : "secondary"}
                          disabled={!isValid}
                          onClick={() => handleAccept(candidate.id)}
                        >
                          承認
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleReject(candidate.id)}
                        >
                          却下
                        </Button>
                      </div>
                    )}
                    {isAccepted && (
                      <p className="dialogue-preview__candidate-speaker">✓ 承認済み</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="dialogue-preview__panel" aria-label="発話ログプレビュー">
        <h3>Step 3 — 承認済み発話ログ（2ch 形式）</h3>
        {acceptedCandidates.length > 0 ? (
          <div className="dialogue-preview__log" role="log" aria-live="polite">
            {acceptedCandidates.map((candidate) => (
              <p key={candidate.id} className="dialogue-preview__log-entry">
                {resolveDisplayName(candidate)}：{candidate.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="dialogue-preview__empty-note">
            発話候補を解析して「承認」すると、ここにログが表示されます。
          </p>
        )}
      </section>
    </section>
  );
}
