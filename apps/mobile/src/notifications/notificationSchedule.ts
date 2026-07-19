import type { CareManual } from "@careguardian/care-core/manual";

export const MEDICATION_NOTIFICATION_DISCLOSURE =
  "등록한 시각마다 매일 로컬 알림을 예약합니다. 기기 설정과 상태에 따라 지연되거나 누락될 수 있습니다.";

export interface MedicationNotificationRequest {
  identifier: string;
  schedule: {
    hour: number;
    minute: number;
  };
  content: {
    title: string;
    body: string;
    data: {
      notificationType: "medication-reminder";
    };
  };
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHoursAndMinutes(timing: string): { hour: number; minute: number } | null {
  const match = timing.match(TIME_PATTERN);
  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

export function buildMedicationNotificationRequests(
  manual: CareManual,
  _referenceDate: Date = new Date()
): MedicationNotificationRequest[] {
  return manual.sections.medication.drugs.flatMap((drug, index) => {
    const schedule = parseHoursAndMinutes(drug.timing);
    if (!schedule) {
      return [];
    }

    return [
      {
        identifier: `careguardian-medication-${index}`,
        schedule,
        content: {
          title: "복약 알림",
          body: "지금 알림을 확인해주세요.",
          data: {
            notificationType: "medication-reminder"
          }
        }
      }
    ];
  });
}
