export interface MobileDataDeletionDependencies {
  /** Task 7 supplies this when the inference runtime is introduced. */
  stopActiveInference?: () => Promise<void>;
  deleteAllKnownWorkspaceData: () => Promise<void>;
  cancelAllScheduledNotifications: () => Promise<void>;
  removeAllModels: () => Promise<void>;
  resetMemory: () => void | Promise<void>;
}

export type MobileDeletionDomain =
  | "active-inference"
  | "scheduled-notifications"
  | "local-model-files"
  | "workspace-and-legacy-storage"
  | "in-memory-state";

export class MobileFullDeletionError extends Error {
  constructor(readonly domain: MobileDeletionDomain, cause: unknown) {
    super(`mobile full deletion failed for ${domain}`);
    this.name = "MobileFullDeletionError";
    this.cause = cause;
  }
}

export function getMobileDeletionFailedDomains(error: unknown): MobileDeletionDomain[] {
  if (!(error instanceof AggregateError)) return [];
  return error.errors
    .filter((failure): failure is MobileFullDeletionError => failure instanceof MobileFullDeletionError)
    .map((failure) => failure.domain);
}

/**
 * Attempt every independently-owned deletion domain even after a failure. The
 * order keeps model files behind inference shutdown, while an alarm/model error
 * cannot retain unrelated workspace data. Callers must keep UI locked if this
 * rejects; resetMemory always runs to drop in-process copies.
 */
export async function clearMobileData({
  stopActiveInference,
  deleteAllKnownWorkspaceData,
  cancelAllScheduledNotifications,
  removeAllModels,
  resetMemory
}: MobileDataDeletionDependencies): Promise<void> {
  const failures: MobileFullDeletionError[] = [];
  const attempt = async (
    domain: MobileDeletionDomain,
    operation: (() => void | Promise<void>) | undefined
  ) => {
    if (!operation) return;
    try {
      await operation();
    } catch (error) {
      failures.push(new MobileFullDeletionError(domain, error));
    }
  };

  await attempt("active-inference", stopActiveInference);
  await attempt("scheduled-notifications", cancelAllScheduledNotifications);
  await attempt("local-model-files", removeAllModels);
  await attempt("workspace-and-legacy-storage", deleteAllKnownWorkspaceData);
  await attempt("in-memory-state", resetMemory);
  if (failures.length > 0) throw new AggregateError(failures, "mobile full-data deletion was incomplete");
}
