const HIDDEN_CHANGE_KEYS_FOR_SANDBOX_UI = new Set([
  "faith",
  "faithChange",
  "currentFaith",
  "previousFaith",
  "newFaith",
]);

function isHiddenChangeKeyForSandboxUi(key: string): boolean {
  return HIDDEN_CHANGE_KEYS_FOR_SANDBOX_UI.has(key);
}

export function createVisibleChangePatchForSandboxUi(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => !isHiddenChangeKeyForSandboxUi(key)),
  );
}
