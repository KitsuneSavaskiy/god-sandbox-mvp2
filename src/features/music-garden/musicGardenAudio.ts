import type { NormalizedNote } from "./musicGardenMidi.js";

const MAX_ACTIVE_OSCILLATORS = 8;

interface ActiveOscillator {
  oscillator: OscillatorNode;
  gain: GainNode;
  endTime: number;
}

export class MusicGardenAudio {
  private ctx: AudioContext | null = null;
  private active: ActiveOscillator[] = [];
  private scheduled = new Set<string>();

  private getContext(): AudioContext | null {
    try {
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioContext();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Call from a direct user-gesture handler (Play button) to satisfy
  // browser autoplay policy before the animation loop starts scheduling.
  prepareForPlay(): void {
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === "suspended") {
        void ctx.resume();
      }
    } catch { /* non-blocking */ }
  }

  scheduleNotes(notes: NormalizedNote[], elapsedMs: number): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const lookAheadMs = 200;
    const windowEnd = elapsedMs + lookAheadMs;

    for (const note of notes) {
      if (this.scheduled.has(note.id)) continue;
      if (note.startMs < elapsedMs - 50) continue;
      if (note.startMs > windowEnd) continue;

      this.scheduled.add(note.id);

      if (this.active.length >= MAX_ACTIVE_OSCILLATORS) {
        const oldest = this.active.shift();
        if (oldest) {
          try {
            oldest.gain.gain.setValueAtTime(0, ctx.currentTime);
            oldest.oscillator.stop(ctx.currentTime + 0.01);
          } catch { /* ignore */ }
        }
      }

      try {
        const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = freq;

        const startOffset = Math.max(0, (note.startMs - elapsedMs) / 1000);
        const duration = Math.min(note.durationMs / 1000, 2.0);

        const startTime = now + startOffset;
        const endTime = startTime + duration;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
        gain.gain.setValueAtTime(0.12, endTime - 0.05);
        gain.gain.linearRampToValueAtTime(0, endTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(endTime + 0.01);

        this.active.push({ oscillator: osc, gain, endTime });
      } catch { /* audio failure is non-blocking */ }
    }

    const t = ctx.currentTime;
    this.active = this.active.filter((a) => a.endTime > t);
  }

  pause(): void {
    try {
      this.ctx?.suspend();
    } catch { /* ignore */ }
  }

  resume(): void {
    try {
      this.ctx?.resume();
    } catch { /* ignore */ }
  }

  stop(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const a of this.active) {
      try {
        a.gain.gain.setValueAtTime(0, ctx.currentTime);
        a.oscillator.stop(ctx.currentTime + 0.01);
      } catch { /* ignore */ }
    }
    this.active = [];
    this.scheduled.clear();
  }

  resetSchedule(): void {
    this.scheduled.clear();
  }
}
