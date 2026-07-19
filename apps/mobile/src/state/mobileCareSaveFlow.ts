import type { CareManual } from "@careguardian/care-core/manual";

export type MobileCareSaveOutcome =
  | {
      kind: "storage-failed";
      message: string;
    }
  | {
      kind: "notification-failed";
      message: string;
    }
  | {
      kind: "saved";
      notificationCount: number;
      message: string;
    };

type SaveMobileCareProfileInput = {
  manual: CareManual;
  save: (manual: CareManual) => Promise<void>;
  syncNotifications: (manual: CareManual) => Promise<number>;
};

export async function saveMobileCareProfile({
  manual,
  save,
  syncNotifications
}: SaveMobileCareProfileInput): Promise<MobileCareSaveOutcome> {
  try {
    await save(manual);
  } catch {
    return {
      kind: "storage-failed",
      message: "저장에 실패했습니다. 내용을 확인한 뒤 다시 시도해 주세요."
    };
  }

  try {
    const notificationCount = await syncNotifications(manual);
    return {
      kind: "saved",
      notificationCount,
      message: `저장 완료. 복약 알림 ${notificationCount}건을 예약했습니다.`
    };
  } catch {
    return {
      kind: "notification-failed",
      message: "저장은 완료됐지만 알림 예약에 실패했습니다. 기기 알림 권한과 설정을 확인해 주세요."
    };
  }
}
