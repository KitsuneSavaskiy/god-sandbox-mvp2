import { Panel } from "../../ui/Panel.js";
import "./StoryLogPanel.css";

export type StoryLogTone = "event" | "result" | "pause";

export interface StoryLogEntry {
  id: string;
  title: string;
  detail: string;
  timestampLabel: string;
  tags: string[];
  tone: StoryLogTone;
}

interface StoryLogPanelProps {
  entries: StoryLogEntry[];
}

export function StoryLogPanel({ entries }: StoryLogPanelProps) {
  return (
    <Panel title="物語ログ">
      <div className="story-log-panel">
        {entries.length === 0 ? (
          <p className="story-log-panel__empty">
            まだ新しい記録はありません。出来事を見て、ひとつ介入すると流れがここに残ります。
          </p>
        ) : (
          <ol className="story-log-panel__list">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`story-log-panel__entry story-log-panel__entry--${entry.tone}`}
              >
                <div className="story-log-panel__entry-topline">
                  <strong>{entry.title}</strong>
                  <span>{entry.timestampLabel}</span>
                </div>
                <p>{entry.detail}</p>
                <div className="story-log-panel__tags">
                  {entry.tags.map((tag) => (
                    <span key={`${entry.id}-${tag}`}>{tag}</span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
