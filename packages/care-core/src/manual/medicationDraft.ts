import type { MedicationItem } from "./manualSchema";

function emptyMedication(): MedicationItem {
  return {
    name: "",
    dosage: "",
    timing: "",
    method: "",
    warnings: "",
    photo: ""
  };
}

export function updateMedicationName(
  existing: MedicationItem | undefined,
  name: string
): MedicationItem[] {
  if (!name) {
    return [];
  }

  return [{ ...emptyMedication(), ...existing, name }];
}

export function updateMedicationTiming(
  existing: MedicationItem | undefined,
  timing: string
): MedicationItem[] {
  return [{ ...emptyMedication(), ...existing, timing }];
}
