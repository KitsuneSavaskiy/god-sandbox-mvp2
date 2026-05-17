import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
    // Reset immediately — before any early return — so the input is never
    // left in a used state, allowing re-selection even after errors.
    e.target.value = "";
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith(".mid") && !name.endsWith(".midi")) {
      onFileLoad(new ArrayBuffer(0), file.name);
      setFileName(null);
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        onFileLoad(reader.result, file.name);
      } else {
        // readAsArrayBuffer should always produce ArrayBuffer; handle edge case.
        setFileName(null);
        onFileLoad(new ArrayBuffer(0), file.name);
      }
    };
    reader.onerror = () => {
      // Reading failed — clear filename; parent state stays unchanged.
      setFileName(null);
    };
    reader.onabort = () => {
      setFileName(null);
    };
    reader.readAsArrayBuffer(file);
  }

  // Some browsers (Chromium 113+) fire a "cancel" event on <input type="file">
  // when the dialog is dismissed without selection. Guard against any filename
  // state that may have been set before the dialog opened.
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const onCancel = () => setFileName(null);
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, []);

  const hasNotes = state.notes.length > 0;
  const streakPct = Math.min(
    100,
    (state.currentNoteStreak / MUSIC_NOTE_STREAK_TARGET) * 100,
  );

  return (
    <div className="music-garden-panel">
      <p className="music-garden-panel__title">♪ Music Garden</p>

      <div className="music-garden-panel__body">
        <div className="music-garden-panel__left">
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
                {fileName.length > 22 ? `…${fileName.slice(-20)}` : fileName}
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

          {state.errorMessage && (
            <p className="music-garden-panel__message">{state.errorMessage}</p>
          )}
          {warnings.map((w, i) => (
            <p key={i} className="music-garden-panel__warning">{w}</p>
          ))}
        </div>

        <div className="music-garden-panel__right">
          <div className="music-garden-panel__streak">
            <div className="music-garden-panel__streak-label">
              <span>クリック {state.currentNoteStreak} / {MUSIC_NOTE_STREAK_TARGET}</span>
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
            ✦ 神の力 {state.godPointRewardsEarned} / {MUSIC_GOD_POINT_REWARD_CAP_PER_FILE}
          </div>

          {!hasNotes && (
            <p className="music-garden-panel__hint">
              MIDIファイルを選んで再生すると、音符が右から左へ流れてきます。タイミングよくクリックして連続成功を重ねると神の力が回復します。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
