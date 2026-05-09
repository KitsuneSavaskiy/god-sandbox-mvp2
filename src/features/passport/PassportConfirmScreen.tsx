import { Button } from "../../ui/Button";
import { PASSPORT_CONFIRM_TEXTS } from "./passportUiText.js";

type PassportConfirmScreenProps = {
  characterName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PassportConfirmScreen({ characterName, onConfirm, onCancel }: PassportConfirmScreenProps) {
  return (
    <div className="passport-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="passport-confirm-title">
      <div className="passport-confirm-dialog">
        <h3 id="passport-confirm-title">{PASSPORT_CONFIRM_TEXTS.title}</h3>
        <p className="passport-confirm-character">対象: {characterName}</p>
        <ul className="passport-confirm-body">
          {PASSPORT_CONFIRM_TEXTS.bodyLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <div className="passport-confirm-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {PASSPORT_CONFIRM_TEXTS.cancel}
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm}>
            {PASSPORT_CONFIRM_TEXTS.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
