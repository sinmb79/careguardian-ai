export interface MobileDataDeletionDependencies {
  deleteManual: () => Promise<void>;
  cancelCareguardianNotifications: () => Promise<void>;
  resetMemory: () => void;
}

export async function clearMobileData({
  deleteManual,
  cancelCareguardianNotifications,
  resetMemory
}: MobileDataDeletionDependencies): Promise<void> {
  await cancelCareguardianNotifications();
  await deleteManual();
  resetMemory();
}
