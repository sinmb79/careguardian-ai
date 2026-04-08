import type { CareManual } from "../manual/manualSchema";

export type MedicationReminderStatus = "upcoming" | "overdue";

export interface MedicationReminder {
  id: string;
  label: string;
  detail: string;
  status: MedicationReminderStatus;
  minutesUntil: number;
}

function parseTimeToMinutes(timing: string): number | null {
  const match = timing.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function buildMedicationTimeline(
  manual: CareManual,
  referenceDate: Date
): MedicationReminder[] {
  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  return manual.sections.medication.drugs
    .map((drug, index) => {
      const targetMinutes = parseTimeToMinutes(drug.timing);
      const minutesUntil = targetMinutes === null ? 0 : targetMinutes - currentMinutes;
      const label = targetMinutes === null ? `${drug.name} · 시간 미지정` : `${drug.name} · ${drug.timing}`;

      return {
        id: `medication-reminder-${index}`,
        label,
        detail: `${drug.dosage} / ${drug.method}`,
        status: (minutesUntil < 0 ? "overdue" : "upcoming") as MedicationReminderStatus,
        minutesUntil
      };
    })
    .sort((left, right) => left.minutesUntil - right.minutesUntil);
}
