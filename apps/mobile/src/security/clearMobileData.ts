export interface MobileDataDeletionDependencies {
  stopActiveInference: () => Promise<void>;
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
 * Inference release is a prerequisite: deleting model files while a native
 * context may still own them is unsafe. After that barrier succeeds, every
 * independently-owned deletion domain is attempted even if another one fails.
 * Callers keep the UI locked on rejection; resetMemory runs with the independent
 * domains so in-process copies are dropped whenever inference was released.
 */
export async function clearMobileData({
  stopActiveInference,
  deleteAllKnownWorkspaceData,
  cancelAllScheduledNotifications,
  removeAllModels,
  resetMemory
}: MobileDataDeletionDependencies): Promise<void> {
  await stopActiveInference();

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

  await attempt("scheduled-notifications", cancelAllScheduledNotifications);
  await attempt("local-model-files", removeAllModels);
  await attempt("workspace-and-legacy-storage", deleteAllKnownWorkspaceData);
  await attempt("in-memory-state", resetMemory);
  if (failures.length > 0) throw new AggregateError(failures, "mobile full-data deletion was incomplete");
}
