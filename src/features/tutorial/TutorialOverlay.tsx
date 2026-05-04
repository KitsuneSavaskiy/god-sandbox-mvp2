import type { ReactNode } from "react";
import { Button } from "../../ui/Button.js";
import "./TutorialOverlay.css";

interface TutorialOverlayProps {
  stepId: string;
  title: string;
  body: string;
  anchorLabel: string;
  placement?: "bottom" | "top";
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  trailingContent?: ReactNode;
}

export function TutorialOverlay({
  stepId,
  title,
  body,
  anchorLabel,
  placement = "bottom",
  primaryActionLabel,
  onPrimaryAction,
  trailingContent,
}: TutorialOverlayProps) {
  return (
    <aside
      className={`tutorial-overlay tutorial-overlay--${placement}`}
      aria-live="polite"
      aria-label="チュートリアル案内"
    >
      <p className="tutorial-overlay__eyebrow">tutorial</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <p className="tutorial-overlay__anchor">
        今は <strong>{anchorLabel}</strong> を見れば進めます。
      </p>
      <div className="tutorial-overlay__actions">
        {primaryActionLabel && onPrimaryAction ? (
          <Button type="button" variant="primary" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </Button>
        ) : null}
        {trailingContent}
      </div>
      <span className="tutorial-overlay__step-id">{stepId}</span>
    </aside>
  );
}
