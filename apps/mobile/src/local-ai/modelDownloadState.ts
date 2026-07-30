export interface InstalledModel {
  modelId: string;
  revision: string;
  uri: string;
  bytes: number;
  sha256: string;
}

export type DownloadState =
  | { kind: "notInstalled" }
  | { kind: "downloading"; bytesWritten: number; totalBytes: number }
  | { kind: "paused"; bytesWritten: number; resumeData: string }
  | { kind: "verifying" }
  | { kind: "ready"; installed: InstalledModel }
  | { kind: "failed"; code: string; message: string };

export type DownloadAction =
  | { type: "START" }
  | { type: "PROGRESS"; bytesWritten: number; totalBytes: number }
  | { type: "PAUSE"; bytesWritten: number; resumeData: string }
  | { type: "RESUME" }
  | { type: "VERIFY" }
  | { type: "COMPLETE"; installed: InstalledModel }
  | { type: "FAIL"; code: string; message: string }
  | { type: "REMOVE" };

function invalidTransition(state: DownloadState, action: DownloadAction): never {
  throw new Error(`invalid_download_state_transition:${state.kind}:${action.type}`);
}

export function reduceDownloadState(
  state: DownloadState,
  action: DownloadAction
): DownloadState {
  switch (action.type) {
    case "START":
      if (state.kind !== "notInstalled" && state.kind !== "failed") {
        return invalidTransition(state, action);
      }
      return { kind: "downloading", bytesWritten: 0, totalBytes: 0 };
    case "PROGRESS":
      if (state.kind !== "downloading") return invalidTransition(state, action);
      return {
        kind: "downloading",
        bytesWritten: action.bytesWritten,
        totalBytes: action.totalBytes
      };
    case "PAUSE":
      if (state.kind !== "downloading") return invalidTransition(state, action);
      return {
        kind: "paused",
        bytesWritten: action.bytesWritten,
        resumeData: action.resumeData
      };
    case "RESUME":
      if (state.kind !== "paused") return invalidTransition(state, action);
      return {
        kind: "downloading",
        bytesWritten: state.bytesWritten,
        totalBytes: 0
      };
    case "VERIFY":
      if (state.kind !== "downloading") return invalidTransition(state, action);
      return { kind: "verifying" };
    case "COMPLETE":
      if (state.kind !== "verifying") return invalidTransition(state, action);
      return { kind: "ready", installed: action.installed };
    case "FAIL":
      if (
        state.kind !== "downloading" &&
        state.kind !== "paused" &&
        state.kind !== "verifying"
      ) {
        return invalidTransition(state, action);
      }
      return { kind: "failed", code: action.code, message: action.message };
    case "REMOVE":
      if (state.kind !== "ready" && state.kind !== "failed" && state.kind !== "paused") {
        return invalidTransition(state, action);
      }
      return { kind: "notInstalled" };
  }
}
