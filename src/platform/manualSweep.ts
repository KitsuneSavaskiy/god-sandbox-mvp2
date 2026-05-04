const MANUAL_SWEEP_RUNTIME_DIR = ".local/manual-sweep";

export interface ManualSweepState {
  enabled: boolean;
  runtimeDirectory: string;
}

export function getManualSweepState(search: string): ManualSweepState {
  const params = new URLSearchParams(search);
  return {
    enabled: params.get("mode") === "manual-sweep",
    runtimeDirectory: MANUAL_SWEEP_RUNTIME_DIR
  };
}
