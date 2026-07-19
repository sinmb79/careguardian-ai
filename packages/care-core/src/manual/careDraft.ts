import type { CareRoutineItem, RelayTarget } from "./manualSchema";

export function updateMorningRoutine(
  existing: CareRoutineItem | undefined,
  title: string
): CareRoutineItem[] {
  if (!title) {
    return [];
  }
  return [{ title, notes: existing?.notes ?? "" }];
}

export function updateRelayTargetName(
  existing: RelayTarget | undefined,
  name: string
): RelayTarget[] {
  if (!name) {
    return [];
  }
  return [
    {
      name,
      relation: existing?.relation ?? "",
      contact: existing?.contact ?? "",
      priority: existing?.priority ?? 1
    }
  ];
}

export function updateRelayTargetContact(
  existing: RelayTarget | undefined,
  contact: string
): RelayTarget[] {
  return [
    {
      name: existing?.name ?? "",
      relation: existing?.relation ?? "",
      contact,
      priority: existing?.priority ?? 1
    }
  ];
}
