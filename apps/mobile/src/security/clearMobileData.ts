export interface MobileDataDeletionDependencies {
  /** Task 7 supplies this when the inference runtime is introduced. */
  stopActiveInference?: () => Promise<void>;
  deleteWorkspace: () => Promise<void>;
  cancelLifeNotifications: () => Promise<void>;
  removeAllModels: () => Promise<void>;
  resetMemory: () => void | Promise<void>;
}

export async function clearMobileData({
  stopActiveInference,
  deleteWorkspace,
  cancelLifeNotifications,
  removeAllModels,
  resetMemory
}: MobileDataDeletionDependencies): Promise<void> {
  await stopActiveInference?.();
  await cancelLifeNotifications();
  await removeAllModels();
  await deleteWorkspace();
  await resetMemory();
}
