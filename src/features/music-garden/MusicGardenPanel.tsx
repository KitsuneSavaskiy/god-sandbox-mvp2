import { useRef, useState, type ChangeEvent } from "react";
import {
  MUSIC_GOD_POINT_REWARD_CAP_PER_FILE,
  MUSIC_NOTE_STREAK_TARGET,
  type MusicGardenState,
} from "./musicGardenModel.js";
import "./MusicGarden.css";

interface MusicGardenPanelProps {
  state: MusicGardenState;
  warnings: string[];
  onFileLoad: (buffer: ArrayBuffer, fileName: string) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function MusicGardenPanel({
  state,
  warnings,
  onFileLoad,
  onPlay,
  onPause,
  onReset,
}: MusicGardenPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Explicit MIME-type / extension guard before handing off to FileReader
    const name = file.name.toLowerCase();
    if (!name.endsWith(".mid") && !name.endsWith(".midi")) {
      // Synthesise the same error shape the parent expects
      onFileLoad(new ArrayBuffer(0), file.name);
      setFileName(null);
      e.target.value = "";
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        onFileLoad(reader.result, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  const hasNotes = state.notes.length > 0;
  const streakPct = Math.min(
    100,
    (state.currentNoteStreak / MUSIC_NOTE_STREAK_TARGET) * 100,
  );

  return (
    <div className="music-garden-panel">
      <p className="music-garden-panel__title">Music Garden</p>

      <div className="music-garden-panel__file-row">
        <label className="music-garden-panel__file-label">
          MIDIを選ぶ
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi,audio/midi,audio/x-midi"
            className="music-garden-panel__file-input"
            onChange={handleFileChange}
          />
        </label>
        {fileName && (
          <span className="music-garden-panel__file-name" title={fileName}>
            {fileName.length > 20 ? `…${fileName.slice(-18)}` : fileName}
          </span>
        )}
      </div>

      <div className="music-garden-panel__controls">
        {state.isPlaying ? (
          <button
            type="button"
            className="music-garden-panel__btn"
            onClick={onPause}
            disabled={!hasNotes}
          >
            一時停止
          </button>
        ) : (
          <button
            type="button"
            className="music-garden-panel__btn"
            onClick={onPlay}
            disabled={!hasNotes}
          >
            再生
          </button>
        )}
        <button
          type="button"
          className="music-garden-panel__btn"
          onClick={onReset}
          disabled={!hasNotes}
        >
          リセット
        </button>
      </div>

      <div className="music-garden-panel__streak">
        <div className="music-garden-panel__streak-label">
          <span>連続 {state.currentNoteStreak} / {MUSIC_NOTE_STREAK_TARGET}</span>
          <span>あと {Math.max(0, MUSIC_NOTE_STREAK_TARGET - state.currentNoteStreak)}</span>
        </div>
        <div className="music-garden-panel__streak-bar">
          <div
            className="music-garden-panel__streak-fill"
            style={{ width: `${streakPct}%` }}
          />
        </div>
      </div>

      <div className="music-garden-panel__rewards">
        ✦ 獲得: {state.godPointRewardsEarned} / {MUSIC_GOD_POINT_REWARD_CAP_PER_FILE} (神の力)
      </div>

      {state.errorMessage && (
        <p className="music-garden-panel__message">{state.errorMessage}</p>
      )}

      {warnings.map((w, i) => (
        <p key={i} className="music-garden-panel__warning">{w}</p>
      ))}
    </div>
  );
}
