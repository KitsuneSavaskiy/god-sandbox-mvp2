import { useState } from "react";
import type { CharacterPassport } from "../../domain/models.js";
import { Button } from "../../ui/Button";
import {
  COPY_BUTTON_LABEL,
  COPY_DONE_LABEL,
  EXTERNAL_AI_TEXT_LABEL,
  FAITH_BAND_LABELS,
} from "./passportUiText.js";

type PassportJsonViewerProps = {
  passport: CharacterPassport;
};

export function PassportJsonViewer({ passport }: PassportJsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const d = passport.display;

  function handleCopy() {
    navigator.clipboard.writeText(d.externalAiPromptBlock.systemPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="passport-json-viewer">
      <section className="pjv-section">
        <h5>キャラクター</h5>
        <dl className="pjv-dl">
          <dt>名前</dt><dd>{d.character.name}</dd>
          {d.character.age != null && <><dt>年齢</dt><dd>{d.character.age}</dd></>}
          <dt>性格</dt><dd>{d.character.personalitySummary}</dd>
        </dl>
      </section>

      <section className="pjv-section">
        <h5>箱庭での記憶</h5>
        <dl className="pjv-dl">
          <dt>経験した出来事</dt><dd>{d.lifeMemory.totalInterventions}件</dd>
          <dt>記憶のまとめ</dt><dd>{d.lifeMemory.memorySummary}</dd>
        </dl>
        {d.lifeMemory.keyEvents.length > 0 && (
          <ul className="pjv-list">
            {d.lifeMemory.keyEvents.map((e) => (
              <li key={e.eventId}>{e.title} — {e.characterReflection}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="pjv-section">
        <h5>神との距離感</h5>
        <dl className="pjv-dl">
          <dt>神との距離感</dt>
          <dd>{FAITH_BAND_LABELS[d.godRelationship.faithBand]}</dd>
          <dt>神をどう解釈しているか</dt>
          <dd>{d.godRelationship.interpretationOfGod}</dd>
          <dt>神の気配</dt>
          <dd>{d.godRelationship.faithVisibility}</dd>
        </dl>
      </section>

      <section className="pjv-section">
        <h5>話し方</h5>
        <dl className="pjv-dl">
          <dt>一人称</dt><dd>{d.voiceProfile.firstPerson}</dd>
          <dt>話し方の特徴</dt>
          <dd>{d.voiceProfile.speechPatterns.join("、") || "特になし"}</dd>
        </dl>
      </section>

      <section className="pjv-section pjv-section--highlight">
        <h5>{EXTERNAL_AI_TEXT_LABEL}</h5>
        <pre className="pjv-system-prompt">{d.externalAiPromptBlock.systemPrompt}</pre>
        <Button type="button" variant="primary" onClick={handleCopy}>
          {copied ? COPY_DONE_LABEL : COPY_BUTTON_LABEL}
        </Button>
      </section>

      <details className="pjv-raw" onToggle={(e) => setJsonOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>{jsonOpen ? "生JSONを閉じる" : "生JSONを見る"}</summary>
        <pre className="pjv-raw-pre">{JSON.stringify(d, null, 2)}</pre>
      </details>
    </div>
  );
}
