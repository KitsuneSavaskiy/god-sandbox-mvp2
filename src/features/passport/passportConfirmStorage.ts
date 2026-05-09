const PASSPORT_CONFIRM_KEY = "godsandbox.passport-confirm.v1";

export function hasSeenPassportConfirm(storage: Storage = window.localStorage): boolean {
  return storage.getItem(PASSPORT_CONFIRM_KEY) === "done";
}

export function markPassportConfirmSeen(storage: Storage = window.localStorage): void {
  storage.setItem(PASSPORT_CONFIRM_KEY, "done");
}
