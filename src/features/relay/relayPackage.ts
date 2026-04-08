import type { CareManual } from "../manual/manualSchema";

export interface RelayPackage {
  summary: string;
  readinessScore: number;
  keyActions: string[];
  relayTargets: string[];
}

function countFilledSections(manual: CareManual): number {
  const checks = [
    manual.subject.name,
    manual.sections.daily_routine.morning[0]?.title,
    manual.sections.medication.drugs[0]?.name,
    manual.sections.communication.calming_methods[0],
    manual.sections.emotional.safe_spaces[0],
    manual.subject.emergency_contacts[0],
    manual.relay_targets[0]?.name
  ];

  return checks.filter(Boolean).length;
}

export function buildRelayPackage(manual: CareManual): RelayPackage {
  const readinessScore = Math.round((countFilledSections(manual) / 7) * 100);
  const firstRoutine = manual.sections.daily_routine.morning[0];
  const firstMedication = manual.sections.medication.drugs[0];
  const keyActions = [
    firstRoutine ? `${firstRoutine.title}: ${firstRoutine.notes}` : "아침 루틴 기록 필요",
    firstMedication
      ? `${firstMedication.name}: ${firstMedication.timing}에 ${firstMedication.method}`
      : "복약 기록 필요",
    manual.sections.communication.calming_methods[0]
      ? `불안 시 ${manual.sections.communication.calming_methods[0]} 사용`
      : "안정화 방법 기록 필요"
  ];

  return {
    summary: `${manual.subject.name || "이름 미입력"} 돌봄 인수인계를 위한 요약 패키지입니다.`,
    readinessScore,
    keyActions,
    relayTargets: manual.relay_targets.map(
      (target) => `${target.priority}차 ${target.name} (${target.relation})`
    )
  };
}
