import { useRef, type ChangeEvent } from "react";
import {
  MUSIC_GOD_POINT_REWARD_CAP_PER_FILE,
  MUSIC_NOTE_STREAK_TARGET,
  type MusicGardenState,
} from "./musicGardenModel.js";
import "./MusicGarden.css";

interface MusicGardenPanelProps {
  state: MusicGardenState;
  onFileLoad: (buffer: ArrayBuffer) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function MusicGardenPanel({
  state,
  onFileLoad,
  onPlay,
  onPause,
  onReset,
}: MusicGardenPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        onFileLoad(reader.result);
      }
    };
    reader.readAsArrayBuffer(file);
    // reset input so same file can be re-uploaded
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
            accept=".mid,.midi"
            className="music-garden-panel__file-input"
            onChange={handleFileChange}
          />
        </label>
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
          <span>目標まであと {Math.max(0, MUSIC_NOTE_STREAK_TARGET - state.currentNoteStreak)}</span>
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
    </div>
  );
}
