/**
 * Alert callbacks are not promise-aware. Observe the controller rejection here;
 * the controller has already published its typed, locked failure snapshot.
 */
export async function observeDeleteAll(onDeleteAll: () => Promise<void>): Promise<void> {
  try {
    await onDeleteAll();
  } catch {
    // The visible failure state is owned by the controller.
  }
}
