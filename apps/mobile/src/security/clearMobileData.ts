export interface MobileDataDeletionDependencies {
  deleteWorkspace: () => Promise<void>;
  cancelLifeNotifications: () => Promise<void>;
  resetMemory: () => void;
}

export async function clearMobileData({
  deleteWorkspace,
  cancelLifeNotifications,
  resetMemory
}: MobileDataDeletionDependencies): Promise<void> {
  await cancelLifeNotifications();
  await deleteWorkspace();
  resetMemory();
}
