import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../../ui/Button.js";
import "./TutorialOverlay.css";

interface TutorialOverlayProps {
  stepId: string;
  title: string;
  body: string;
  anchorLabel: string;
  anchorId?: string;
  placement?: "bottom" | "top" | "anchor-right";
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  trailingContent?: ReactNode;
  showAnchorHint?: boolean;
}

export function TutorialOverlay({
  stepId,
  title,
  body,
  anchorLabel,
  anchorId,
  placement = "bottom",
  primaryActionLabel,
  onPrimaryAction,
  trailingContent,
  showAnchorHint = true,
}: TutorialOverlayProps) {
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties | undefined>();

  useEffect(() => {
    if (placement !== "anchor-right" || !anchorId) {
      setAnchorStyle(undefined);
      return;
    }

    function updatePosition() {
      const target = document.querySelector(`[data-tutorial-anchor="${anchorId}"]`);
      if (!target) {
        setAnchorStyle(undefined);
        return;
      }

      const rect = target.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 20);
      const panelHeight = window.innerWidth <= 760 ? 190 : 220;
      const hasRightSpace = rect.right + width + 18 <= window.innerWidth;
      const left = hasRightSpace
        ? rect.right + 12
        : Math.max(10, Math.min(rect.left, window.innerWidth - width - 10));
      const top = hasRightSpace
        ? rect.top + rect.height / 2 - 92
        : rect.bottom + 10;

      setAnchorStyle({
        left,
        top: Math.max(10, Math.min(top, window.innerHeight - panelHeight)),
        width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorId, placement]);

  useEffect(() => {
    if (placement === "anchor-right") {
      return;
    }

    function updateMobilePosition() {
      if (window.innerWidth > 760) {
        setAnchorStyle(undefined);
        return;
      }

      const target = document.querySelector('[data-tutorial-highlighted="true"]');
      if (!target) {
        setAnchorStyle(undefined);
        return;
      }

      const rect = target.getBoundingClientRect();
      const width = window.innerWidth - 20;
      const panelHeight = window.innerWidth <= 390 ? 170 : 190;
      const below = rect.bottom + 10;
      const top =
        below + panelHeight <= window.innerHeight - 10
          ? below
          : Math.max(10, rect.top - panelHeight - 10);

      setAnchorStyle({
        left: 10,
        top: Math.max(10, Math.min(top, window.innerHeight - panelHeight - 10)),
        width,
      });
    }

    updateMobilePosition();
    window.addEventListener("resize", updateMobilePosition);
    window.addEventListener("scroll", updateMobilePosition, true);
    return () => {
      window.removeEventListener("resize", updateMobilePosition);
      window.removeEventListener("scroll", updateMobilePosition, true);
    };
  }, [placement, stepId]);

  return (
    <aside
      className={`tutorial-overlay tutorial-overlay--${placement}`}
      style={anchorStyle}
      aria-live="polite"
      aria-label="チュートリアル案内"
    >
      <p className="tutorial-overlay__eyebrow">tutorial</p>
      <h2>{title}</h2>
      <p>{body}</p>
      {showAnchorHint ? (
        <p className="tutorial-overlay__anchor">
          今は <strong>{anchorLabel}</strong> を見れば進めます。
        </p>
      ) : null}
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
