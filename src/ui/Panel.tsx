import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Panel({ title, children, actions }: PanelProps) {
  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <h2>{title}</h2>
        {actions ? <div className="ui-panel__actions">{actions}</div> : null}
      </div>
      <div className="ui-panel__body">{children}</div>
    </section>
  );
}
