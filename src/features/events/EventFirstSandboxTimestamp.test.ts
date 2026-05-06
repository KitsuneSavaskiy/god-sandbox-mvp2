import { createTimestamp } from "./EventFirstSandboxTimestamp.js";

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, but got ${String(actual)}.`);
  }
}

function ok(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

equal(createTimestamp(1), "2026-05-04T08:01:00.000Z");
equal(createTimestamp(59), "2026-05-04T08:59:00.000Z");
equal(createTimestamp(60), "2026-05-04T09:00:00.000Z");
equal(createTimestamp(61), "2026-05-04T09:01:00.000Z");
equal(createTimestamp(125), "2026-05-04T10:05:00.000Z");
ok(!Number.isNaN(Date.parse(createTimestamp(125))), "timestamp must parse as valid ISO");
