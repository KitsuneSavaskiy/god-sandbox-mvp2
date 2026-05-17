export interface NormalizedNote {
  id: string;
  pitch: number;
  startMs: number;
  durationMs: number;
  clicked: boolean;
  active: boolean;
}

export interface MidiParseResult {
  notes: NormalizedNote[];
  durationMs: number;
  warnings: string[];
}

export interface MidiParseError {
  error: string;
}

export type MidiParseOutcome = { ok: true; result: MidiParseResult } | { ok: false; error: string };

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VISUALIZED_NOTES = 800;

const DEFAULT_TEMPO_US = 500000; // 120 BPM

// MIDI spec: VLQ is at most 4 bytes (max value 0x0FFFFFFF)
function readVarLen(data: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let bytesRead = 0;
  let byte: number;
  do {
    if (bytesRead >= 4) throw new Error("VLQ exceeds 4-byte limit");
    if (offset + bytesRead >= data.length) throw new Error("Unexpected end of data in var-len");
    byte = data[offset + bytesRead]!;
    value = (value << 7) | (byte & 0x7f);
    bytesRead++;
  } while (byte & 0x80);
  return [value, bytesRead];
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!) >>> 0
  );
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return ((data[offset]! << 8) | data[offset + 1]!) >>> 0;
}

interface TrackEvent {
  tickTime: number;
  type: "note-on" | "note-off" | "tempo";
  pitch?: number;
  velocity?: number;
  tempoUs?: number;
}

function parseTrack(data: Uint8Array, startOffset: number, trackLen: number): TrackEvent[] {
  const events: TrackEvent[] = [];
  let offset = startOffset;
  const end = startOffset + trackLen;
  let currentTick = 0;
  let runningStatus = 0;

  while (offset < end) {
    const [delta, deltaLen] = readVarLen(data, offset);
    offset += deltaLen;
    currentTick += delta;

    if (offset >= end) break;

    let statusByte = data[offset]!;

    // System realtime messages (0xF8–0xFE) have no data bytes and do not
    // affect running status. Skip them before the status-byte branch.
    if (statusByte >= 0xf8) {
      offset++;
      continue;
    }

    if (statusByte & 0x80) {
      runningStatus = statusByte;
      offset++;
    } else {
      // Data byte without a preceding status byte.
      if (runningStatus === 0) {
        // No running status established yet — malformed stream; skip byte.
        offset++;
        continue;
      }
      statusByte = runningStatus;
    }

    const type = statusByte & 0xf0;
    const channel = statusByte & 0x0f;

    if (statusByte === 0xff) {
      // Meta event — clears running status per spec
      runningStatus = 0;
      if (offset >= end) break;
      const metaType = data[offset++]!;
      const [metaLen, metaLenBytes] = readVarLen(data, offset);
      offset += metaLenBytes;

      if (metaType === 0x51 && metaLen === 3) {
        const us =
          ((data[offset]! << 16) | (data[offset + 1]! << 8) | data[offset + 2]!) >>> 0;
        events.push({ tickTime: currentTick, type: "tempo", tempoUs: us });
      }
      offset += metaLen;
    } else if (statusByte === 0xf0 || statusByte === 0xf7) {
      // SysEx — clears running status
      runningStatus = 0;
      const [sysexLen, sysexLenBytes] = readVarLen(data, offset);
      offset += sysexLenBytes + sysexLen;
    } else if (statusByte >= 0xf1 && statusByte <= 0xf6) {
      // System common messages — various data lengths; skip safely
      runningStatus = 0;
      const systemCommonDataBytes: Record<number, number> = {
        0xf1: 1, 0xf2: 2, 0xf3: 1, 0xf4: 0, 0xf5: 0, 0xf6: 0,
      };
      offset += systemCommonDataBytes[statusByte] ?? 0;
    } else if (type === 0x90 && offset + 1 < end) {
      // Note-on (all channels treated uniformly for MVP)
      const pitch = data[offset++]!;
      const velocity = data[offset++]!;
      if (velocity === 0) {
        events.push({ tickTime: currentTick, type: "note-off", pitch, velocity: 0 });
      } else {
        events.push({ tickTime: currentTick, type: "note-on", pitch, velocity });
      }
    } else if (type === 0x80 && offset + 1 < end) {
      // Note-off
      const pitch = data[offset++]!;
      const velocity = data[offset++]!;
      events.push({ tickTime: currentTick, type: "note-off", pitch, velocity });
    } else if ((type === 0xa0 || type === 0xb0 || type === 0xe0) && offset + 1 < end) {
      offset += 2;
    } else if ((type === 0xc0 || type === 0xd0) && offset < end) {
      offset += 1;
    } else {
      // Unknown channel message — skip and reset running status
      runningStatus = 0;
      offset++;
    }
    void channel;
  }

  return events;
}

interface PendingNote {
  pitch: number;
  startTick: number;
}

function convertTrackEventsToNotes(
  events: TrackEvent[],
  ppq: number,
  tempoMapFromHeader: Map<number, number>,
): { notes: Array<{ pitch: number; startMs: number; durationMs: number }>; finalMs: number } {
  const tempoMap = new Map<number, number>(tempoMapFromHeader);

  // collect tempo events from this track
  for (const ev of events) {
    if (ev.type === "tempo" && ev.tempoUs !== undefined) {
      tempoMap.set(ev.tickTime, ev.tempoUs);
    }
  }

  // sort tempo change points
  const tempoChanges = [...tempoMap.entries()].sort(([a], [b]) => a - b);

  function ticksToMs(tick: number): number {
    let ms = 0;
    let lastTick = 0;
    let lastTempo = DEFAULT_TEMPO_US;
    for (const [changeTick, tempo] of tempoChanges) {
      if (changeTick >= tick) break;
      const segmentTicks = changeTick - lastTick;
      ms += (segmentTicks / ppq) * (lastTempo / 1000);
      lastTick = changeTick;
      lastTempo = tempo;
    }
    ms += ((tick - lastTick) / ppq) * (lastTempo / 1000);
    return ms;
  }

  const pending = new Map<number, PendingNote[]>();
  const notes: Array<{ pitch: number; startMs: number; durationMs: number }> = [];
  let maxTick = 0;

  for (const ev of events) {
    if (ev.type === "tempo") continue;
    if (ev.tickTime > maxTick) maxTick = ev.tickTime;

    if (ev.type === "note-on" && ev.pitch !== undefined) {
      const bucket = pending.get(ev.pitch) ?? [];
      bucket.push({ pitch: ev.pitch, startTick: ev.tickTime });
      pending.set(ev.pitch, bucket);
    } else if (ev.type === "note-off" && ev.pitch !== undefined) {
      const bucket = pending.get(ev.pitch);
      if (bucket && bucket.length > 0) {
        const open = bucket.shift()!;
        const startMs = ticksToMs(open.startTick);
        const endMs = ticksToMs(ev.tickTime);
        const durationMs = Math.max(50, endMs - startMs);
        notes.push({ pitch: ev.pitch, startMs, durationMs });
      }
    }
  }

  // close any still-open notes at track end
  for (const bucket of pending.values()) {
    for (const open of bucket) {
      const startMs = ticksToMs(open.startTick);
      const endMs = ticksToMs(maxTick);
      const durationMs = Math.max(50, endMs - startMs);
      notes.push({ pitch: open.pitch, startMs, durationMs });
    }
  }

  return { notes, finalMs: ticksToMs(maxTick) };
}

export function parseMidi(buffer: ArrayBuffer): MidiParseOutcome {
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `ファイルサイズが上限 (2MB) を超えています` };
  }

  const data = new Uint8Array(buffer);
  const warnings: string[] = [];

  if (data.length < 14) return { ok: false, error: "読み込めませんでした" };

  const magic =
    data[0] === 0x4d &&
    data[1] === 0x54 &&
    data[2] === 0x68 &&
    data[3] === 0x64;
  if (!magic) return { ok: false, error: "読み込めませんでした" };

  const headerLen = readUint32BE(data, 4);
  if (headerLen < 6) return { ok: false, error: "読み込めませんでした" };

  const format = readUint16BE(data, 8);
  const numTracks = readUint16BE(data, 10);
  const timeDivision = readUint16BE(data, 12);

  if (format !== 0 && format !== 1) {
    return { ok: false, error: `SMF フォーマット ${format} は未対応です (0 または 1 のみ)` };
  }

  if (timeDivision & 0x8000) {
    return { ok: false, error: "SMPTE タイムコード形式は未対応です" };
  }

  const ppq = timeDivision;
  let offset = 8 + headerLen;

  const allTrackEvents: TrackEvent[][] = [];

  for (let t = 0; t < numTracks; t++) {
    if (offset + 8 > data.length) break;

    const chunkId = String.fromCharCode(
      data[offset]!,
      data[offset + 1]!,
      data[offset + 2]!,
      data[offset + 3]!,
    );
    const chunkLen = readUint32BE(data, offset + 4);
    offset += 8;

    if (chunkId !== "MTrk") {
      offset += chunkLen;
      continue;
    }

    if (offset + chunkLen > data.length) {
      warnings.push(`トラック ${t + 1} が途中で終わっています`);
      break;
    }

    try {
      const trackEvents = parseTrack(data, offset, chunkLen);
      allTrackEvents.push(trackEvents);
    } catch {
      warnings.push(`トラック ${t + 1} の解析に失敗しました`);
    }

    offset += chunkLen;
  }

  // Build global tempo map from all tracks (format 1: track 0 is tempo track)
  const globalTempoMap = new Map<number, number>();
  for (const trackEvents of allTrackEvents) {
    for (const ev of trackEvents) {
      if (ev.type === "tempo" && ev.tempoUs !== undefined) {
        globalTempoMap.set(ev.tickTime, ev.tempoUs);
      }
    }
  }
  if (globalTempoMap.size === 0) {
    globalTempoMap.set(0, DEFAULT_TEMPO_US);
  }

  let allNotes: Array<{ pitch: number; startMs: number; durationMs: number }> = [];
  let maxDurationMs = 0;

  for (const trackEvents of allTrackEvents) {
    const { notes, finalMs } = convertTrackEventsToNotes(trackEvents, ppq, globalTempoMap);
    allNotes.push(...notes);
    if (finalMs > maxDurationMs) maxDurationMs = finalMs;
  }

  // check total duration
  if (maxDurationMs > MAX_DURATION_MS) {
    warnings.push(`曲の長さが上限 (10分) を超えています。最初の10分だけを使用します。`);
    allNotes = allNotes.filter((n) => n.startMs < MAX_DURATION_MS);
    maxDurationMs = MAX_DURATION_MS;
  }

  // sort by startMs
  allNotes.sort((a, b) => a.startMs - b.startMs);

  let truncated = false;
  if (allNotes.length > MAX_VISUALIZED_NOTES) {
    warnings.push(
      `音符数が上限 (${MAX_VISUALIZED_NOTES}) を超えています。最初の ${MAX_VISUALIZED_NOTES} 音符のみを表示します。`,
    );
    allNotes = allNotes.slice(0, MAX_VISUALIZED_NOTES);
    truncated = true;
  }
  void truncated;

  let noteId = 0;
  const normalized: NormalizedNote[] = allNotes.map((n) => ({
    id: `note-${noteId++}`,
    pitch: n.pitch,
    startMs: n.startMs,
    durationMs: n.durationMs,
    clicked: false,
    active: false,
  }));

  return {
    ok: true,
    result: {
      notes: normalized,
      durationMs: maxDurationMs,
      warnings,
    },
  };
}
