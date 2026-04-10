import type { CareManual } from "@careguardian/care-core/manual";

export interface MedicationNotificationRequest {
  identifier: string;
  date: Date;
  content: {
    title: string;
    body: string;
    data: {
      medicationName: string;
      timing: string;
    };
  };
}

const TIME_PATTERN = /(\d{1,2}):(\d{2})/;

function parseHoursAndMinutes(timing: string): { hours: number; minutes: number } | null {
  const match = timing.match(TIME_PATTERN);
  if (!match) {
    return null;
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2])
  };
}

function buildNextOccurrence(
  referenceDate: Date,
  hours: number,
  minutes: number
): Date {
  const scheduled = new Date(referenceDate);
  scheduled.setHours(hours, minutes, 0, 0);

  if (scheduled.getTime() <= referenceDate.getTime()) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  return scheduled;
}

export function buildMedicationNotificationRequests(
  manual: CareManual,
  referenceDate: Date = new Date()
): MedicationNotificationRequest[] {
  return manual.sections.medication.drugs
    .flatMap((drug, index) => {
      const parsedTime = parseHoursAndMinutes(drug.timing);
      if (!parsedTime) {
        return [];
      }

      const date = buildNextOccurrence(referenceDate, parsedTime.hours, parsedTime.minutes);

      return [
        {
          identifier: `careguardian-medication-${index}`,
          date,
          content: {
            title: "복약 시간",
            body: `${drug.name} 복용 시간입니다. ${drug.method}`,
            data: {
              medicationName: drug.name,
              timing: drug.timing
            }
          }
        }
      ];
    })
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}
