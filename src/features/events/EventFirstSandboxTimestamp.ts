const STORY_BASE_TIMESTAMP_MS = Date.UTC(2026, 4, 4, 8, 0, 0, 0);

export function createTimestamp(stepIndex: number): string {
  const timestamp = new Date(STORY_BASE_TIMESTAMP_MS);
  timestamp.setUTCMinutes(timestamp.getUTCMinutes() + stepIndex);
  return timestamp.toISOString();
}
